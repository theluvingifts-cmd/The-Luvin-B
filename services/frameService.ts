
// services/frameService.ts
import { db } from '../config/firebase';
// Standard imports for the firestore modular SDK
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { FRAME_OPTIONS } from '../constants';
import type { FrameOption } from '../types';

const COLLECTION_NAME = "frames";

export const getAllFrames = async (): Promise<FrameOption[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const frames: FrameOption[] = [];
        querySnapshot.forEach((doc) => {
            frames.push(doc.data() as FrameOption);
        });
        
        // Sort by order if possible, or by price
        if (frames.length > 0) {
             return frames.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }
        return [];
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
        await setDoc(doc(db, COLLECTION_NAME, frame.id), frame);
        return true;
    } catch (error) {
        console.error("Error adding frame:", error);
        return false;
    }
};

export const updateFrame = async (id: string, updates: Partial<FrameOption>) => {
    try {
        await updateDoc(doc(db, COLLECTION_NAME, id), updates);
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
