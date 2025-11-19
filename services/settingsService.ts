
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { GENERAL_ASSETS } from '../constants';

export const getGeneralAssets = async () => {
    try {
        const docRef = doc(db, "settings", "assets");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            // Merge with defaults to ensure all keys exist
            return { ...GENERAL_ASSETS, ...docSnap.data() };
        }
        return GENERAL_ASSETS;
    } catch (error: any) {
        // If permission-denied (common for public users if rules aren't set to public), 
        // fall back to defaults silently or with a warning.
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Access to 'settings/assets' denied. Using default assets. (Check Security Rules if this is unintended)");
            return GENERAL_ASSETS;
        }
        console.error("Error fetching assets:", error);
        return GENERAL_ASSETS;
    }
};

export const saveGeneralAssets = async (assets: any) => {
    try {
        await setDoc(doc(db, "settings", "assets"), assets);
        return { success: true };
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Write access to 'settings/assets' denied.");
            return { success: false, error: error, code: 'permission-denied' };
        }
        console.error("Error saving assets:", error);
        return { success: false, error: error, code: error.code || 'unknown' };
    }
};
