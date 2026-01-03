
import { db } from '../config/firebase';
// Fix: Import firestore functions from 'firebase/firestore'
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { FEEDBACK_ITEMS } from '../constants';
import type { FeedbackItem } from '../types';

const COLLECTION_NAME = "feedbacks";

export const getAllFeedbacks = async (): Promise<FeedbackItem[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const feedbacks: FeedbackItem[] = [];
        querySnapshot.forEach((doc) => {
            feedbacks.push(doc.data() as FeedbackItem);
        });
        return feedbacks;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Permission denied for feedbacks.");
            return [];
        }
        console.error("Error fetching feedbacks:", error);
        return [];
    }
};

export const addFeedback = async (feedback: FeedbackItem) => {
    try {
        await setDoc(doc(db, COLLECTION_NAME, feedback.id), feedback);
        return true;
    } catch (error) {
        console.error("Error adding feedback:", error);
        return false;
    }
};

export const updateFeedback = async (id: string, updates: Partial<FeedbackItem>) => {
    try {
        await updateDoc(doc(db, COLLECTION_NAME, id), updates);
        return true;
    } catch (error) {
        console.error("Error updating feedback:", error);
        return false;
    }
};

export const deleteFeedback = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting feedback:", error);
        return false;
    }
};

export const seedFeedbacks = async () => {
    try {
        for (const f of FEEDBACK_ITEMS) {
            const id = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            // Ensure type compatibility if constants differ slightly from interface
            const newFb: FeedbackItem = { id, name: f.name, text: f.text, imageUrl: f.imageUrl };
            await setDoc(doc(db, COLLECTION_NAME, id), newFb);
        }
        return true;
    } catch (error) {
        console.error("Seed feedbacks error:", error);
        return false;
    }
};
