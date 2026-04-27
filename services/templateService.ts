
import { db } from '../config/firebase';
// Proper imports for the modular Firestore SDK
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, increment, writeBatch, query, orderBy } from 'firebase/firestore';
import { COLLECTION_TEMPLATES } from '../constants';
import type { CollectionTemplate } from '../types';
import { cleanForFirestore } from '../utils/helpers';

const COLLECTION_NAME = "templates";

export const getAllTemplates = async (): Promise<CollectionTemplate[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));
        let querySnapshot = await getDocs(q).catch(async (err) => {
            // Fallback if index is not created yet
            console.warn("Index not found or error, falling back to unordered fetch:", err);
            return await getDocs(collection(db, COLLECTION_NAME));
        });

        const templates: CollectionTemplate[] = [];
        querySnapshot.forEach((doc) => {
            templates.push(doc.data() as CollectionTemplate);
        });

        // If fallback was used or order is missing, templates might not be sorted correctly here in JS
        // but we'll return them anyway
        
        // JS sort as safety net if order field exists
        templates.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        return templates;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Permission denied for templates.");
            return [];
        }
        console.error("Error fetching templates:", error);
        return [];
    }
};

export const addTemplate = async (template: CollectionTemplate) => {
    try {
        const cleaned = cleanForFirestore({
            ...template,
            purchaseCount: template.purchaseCount || 0,
            order: template.order ?? 9999
        });
        await setDoc(doc(db, COLLECTION_NAME, template.id), cleaned);
        return true;
    } catch (error) {
        console.error("Error adding template:", error);
        return false;
    }
};

export const updateTemplate = async (id: string, updates: Partial<CollectionTemplate>) => {
    try {
        await updateDoc(doc(db, COLLECTION_NAME, id), updates);
        return true;
    } catch (error) {
        console.error("Error updating template:", error);
        return false;
    }
};

export const deleteTemplate = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting template:", error);
        return false;
    }
};

export const incrementTemplatePurchaseCount = async (templateId: string) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, templateId);
        await updateDoc(docRef, {
            purchaseCount: increment(1)
        });
    } catch (error) {
        console.error("Error incrementing purchase count:", error);
    }
};

export const seedTemplates = async () => {
    try {
        for (const t of COLLECTION_TEMPLATES) {
            const id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await setDoc(doc(db, COLLECTION_NAME, id), { ...t, id, purchaseCount: 0 });
        }
        return true;
    } catch (error) {
        console.error("Seed templates error:", error);
        return false;
    }
};

export const reorderTemplatesList = async (items: CollectionTemplate[]) => {
    try {
        const batch = writeBatch(db);
        items.forEach((item, index) => {
            const ref = doc(db, COLLECTION_NAME, item.id);
            batch.update(ref, { order: index });
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error reordering templates:", error);
        return false;
    }
};
