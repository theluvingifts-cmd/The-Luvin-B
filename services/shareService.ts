
import { db } from '../config/firebase';
import { collection, addDoc, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { FrameConfig } from '../types';

export const saveSharedDesign = async (config: FrameConfig, createdBy: string) => {
    try {
        const docRef = await addDoc(collection(db, 'shared_designs'), {
            config,
            createdBy,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving shared design:", error);
        return null;
    }
};

export const getSharedDesign = async (designId: string) => {
    try {
        const docSnap = await getDoc(doc(db, 'shared_designs', designId));
        if (docSnap.exists()) {
            return docSnap.data().config as FrameConfig;
        }
        return null;
    } catch (error) {
        console.error("Error getting shared design:", error);
        return null;
    }
};
