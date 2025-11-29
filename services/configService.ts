
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CONFIG_DOC_ID = 'general';

export interface StoreConfig {
    logoUrl?: string;
    faviconUrl?: string;
    siteName?: string;
    heroImageUrl?: string;
    inspireImageUrl?: string;
    
    // Theme Builder Config
    primaryColor?: string;
    headingFont?: string; // Tên Google Font hoặc 'CustomBrandFont'
    bodyFont?: string;
    customFontUrl?: string; // URL file font upload lên (.ttf, .otf, .woff2)
}

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
        await setDoc(doc(db, 'config', CONFIG_DOC_ID), config, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving config:", error);
        return false;
    }
};
