
import { db } from '../config/firebase';
// Fix: Import firestore functions from 'firebase/firestore'
import { collection, getDocs, setDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { SavedAsset } from '../types';

const COLLECTION_NAME = "assets";

export const getAllAssets = async (): Promise<SavedAsset[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const assets: SavedAsset[] = [];
        querySnapshot.forEach((doc) => {
            assets.push(doc.data() as SavedAsset);
        });
        return assets;
    } catch (error) {
        console.error("Error fetching assets:", error);
        return [];
    }
};

export const addAsset = async (url: string, type: 'background' | 'sticker') => {
    try {
        const id = `asset_${Date.now()}`;
        const newAsset: SavedAsset = {
            id,
            url,
            type,
            createdAt: Date.now()
        };
        await setDoc(doc(db, COLLECTION_NAME, id), newAsset);
        return newAsset;
    } catch (error) {
        console.error("Error adding asset:", error);
        return null;
    }
};

export const deleteAsset = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting asset:", error);
        return false;
    }
};
