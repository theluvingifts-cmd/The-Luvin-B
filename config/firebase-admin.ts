
// config/firebase-admin.ts
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (getApps().length === 0) {
    initializeApp();
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
