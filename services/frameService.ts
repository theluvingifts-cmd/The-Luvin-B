
// services/frameService.ts
import { db } from '../config/firebase';
// Standard imports for the firestore modular SDK
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { FRAME_OPTIONS } from '../constants';
import type { FrameOption } from '../types';
import { cleanForFirestore } from '../utils/helpers';

const COLLECTION_NAME = "frames";

export const reorderFramesList = async (items: FrameOption[]) => {
    try {
        const batch = writeBatch(db);
        items.forEach((item, index) => {
            const ref = doc(db, COLLECTION_NAME, item.id);
            batch.update(ref, { order: index });
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error reordering frames:", error);
        return false;
    }
};

export const getAllFrames = async (): Promise<FrameOption[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const frames: FrameOption[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as FrameOption;
            frames.push({ ...data, id: doc.id });
        });
        
        // Final JS sort as safety net
        return frames.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Permission denied for frames. Using default.");
            return [];
        }
        console.error("Error fetching frames:", error);
        return [];
    }
};

export const addFrame = async (frame: FrameOption) => {
    try {
        const cleaned = cleanForFirestore(frame);
        await setDoc(doc(db, COLLECTION_NAME, frame.id), cleaned);
        return true;
    } catch (error) {
        console.error("Error adding frame:", error);
        return false;
    }
};

export const updateFrame = async (id: string, updates: Partial<FrameOption>) => {
    try {
        const cleaned = cleanForFirestore(updates);
        await updateDoc(doc(db, COLLECTION_NAME, id), cleaned);
        return true;
    } catch (error) {
        console.error("Error updating frame:", error);
        return false;
    }
};

export const deleteFrame = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting frame:", error);
        return false;
    }
};

export const seedFrames = async () => {
    try {
        console.log("Seeding frames...");
        let count = 0;
        for (const f of FRAME_OPTIONS) {
            await setDoc(doc(db, COLLECTION_NAME, f.id), { ...f, order: count });
            count++;
        }
        console.log("Frames seeded.");
        return true;
    } catch (error) {
        console.error("Seed frames error:", error);
        return false;
    }
};
