
import { db } from '../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { CustomFont } from '../types';

const COLLECTION_NAME = "fonts";

export const getAllFonts = async (): Promise<CustomFont[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const fonts: CustomFont[] = [];
        querySnapshot.forEach((doc) => {
            fonts.push(doc.data() as CustomFont);
        });
        return fonts;
    } catch (error: any) {
        // Suppress permission errors to avoid console noise for non-admins if rules are strict
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Permission denied for fonts. Using default fonts.");
            return [];
        }
        console.error("Error fetching fonts:", error);
        return [];
    }
};

export const addFont = async (font: CustomFont) => {
    try {
        await setDoc(doc(db, COLLECTION_NAME, font.id), font);
        return true;
    } catch (error) {
        console.error("Error adding font:", error);
        return false;
    }
};

export const deleteFont = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting font:", error);
        return false;
    }
};
