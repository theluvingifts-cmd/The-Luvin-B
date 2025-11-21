
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { StoreConfig } from '../types';

const CONFIG_DOC_ID = 'general';

export { StoreConfig };

export const getStoreConfig = async (): Promise<StoreConfig | null> => {
    try {
        const docRef = doc(db, 'config', CONFIG_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as StoreConfig;
        }
        return null;
    } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
            console.warn("Firestore: Unable to fetch config (Permission Denied). Using default settings.");
            return null;
        }
        console.error("Error fetching config:", error);
        return null;
    }
};

export const updateStoreConfig = async (config: Partial<StoreConfig>) => {
    try {
        // Use setDoc with merge: true to allow deep merging of objects like contact and bank
        await setDoc(doc(db, 'config', CONFIG_DOC_ID), config, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving config:", error);
        return false;
    }
};
