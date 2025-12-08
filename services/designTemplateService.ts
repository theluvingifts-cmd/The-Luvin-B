
import { db } from '../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import type { BackgroundTemplate } from '../types';

const COLLECTION_NAME = "design_templates";

export const getAllDesignTemplates = async (): Promise<BackgroundTemplate[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const templates: BackgroundTemplate[] = [];
        querySnapshot.forEach((doc) => {
            templates.push(doc.data() as BackgroundTemplate);
        });
        return templates.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
        console.error("Error fetching design templates:", error);
        return [];
    }
};

export const getDesignTemplateById = async (id: string): Promise<BackgroundTemplate | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as BackgroundTemplate;
        }
        return null;
    } catch (error) {
        console.error("Error fetching design template:", error);
        return null;
    }
};

export const saveDesignTemplate = async (template: BackgroundTemplate) => {
    try {
        await setDoc(doc(db, COLLECTION_NAME, template.id), {
            ...template,
            updatedAt: Date.now()
        });
        return true;
    } catch (error) {
        console.error("Error saving design template:", error);
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
