
import { db } from '../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { BackgroundTemplate } from '../types';

const COLLECTION_NAME = "background_templates";

export const getAllDesignTemplates = async (): Promise<BackgroundTemplate[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const templates: BackgroundTemplate[] = [];
        querySnapshot.forEach((doc) => {
            templates.push(doc.data() as BackgroundTemplate);
        });
        return templates.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
        console.error("Error fetching design templates:", error);
        return [];
    }
};

export const addDesignTemplate = async (template: BackgroundTemplate) => {
    try {
        await setDoc(doc(db, COLLECTION_NAME, template.id), template);
        return true;
    } catch (error) {
        console.error("Error adding design template:", error);
        return false;
    }
};

export const updateDesignTemplate = async (id: string, updates: Partial<BackgroundTemplate>) => {
    try {
        await updateDoc(doc(db, COLLECTION_NAME, id), { ...updates, updatedAt: Date.now() });
        return true;
    } catch (error) {
        console.error("Error updating design template:", error);
        return false;
    }
};

export const deleteDesignTemplate = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting design template:", error);
        return false;
    }
};
