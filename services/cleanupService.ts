
import { db, storage } from '../config/firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { ref, listAll, deleteObject, getDownloadURL } from 'firebase/storage';
import { Order, LegoPart, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption, CustomFont, FrameConfig } from '../types';
import { StoreConfig } from './configService';

export interface UnusedFile {
    name: string;
    fullPath: string;
    url: string;
    size?: number;
    timeCreated?: string;
}

/**
 * Scans all Firestore collections and Firebase Storage to find unused images.
 */
export const findUnusedImages = async (): Promise<UnusedFile[]> => {
    try {
        const usedUrls = new Set<string>();

        // 1. Collect all used URLs from Firestore
        const collections = [
            'orders',
            'products',
            'backgrounds',
            'templates',
            'feedbacks',
            'frames',
            'config',
            'assets'
        ];

        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                extractUrls(data, usedUrls);
            });
        }

        // 2. List all files in Firebase Storage (uploads/ folder)
        const storageRef = ref(storage, 'uploads');
        const res = await listAll(storageRef);
        
        const unusedFiles: UnusedFile[] = [];

        for (const item of res.items) {
            const url = await getDownloadURL(item);
            // Check if the URL is in the used set
            // Note: Firebase Storage URLs contain a token, so we might need to compare the base path or just check if the URL contains the filename
            
            let isUsed = false;
            for (const usedUrl of usedUrls) {
                if (usedUrl.includes(item.fullPath)) {
                    isUsed = true;
                    break;
                }
            }

            if (!isUsed) {
                unusedFiles.push({
                    name: item.name,
                    fullPath: item.fullPath,
                    url: url
                });
            }
        }

        return unusedFiles;
    } catch (error) {
        console.error("Error finding unused images:", error);
        throw error;
    }
};

/**
 * Deeply extracts all strings that look like Firebase Storage URLs from an object.
 */
const extractUrls = (obj: any, urls: Set<string>) => {
    if (!obj) return;

    if (typeof obj === 'string') {
        if (obj.startsWith('http') && (obj.includes('firebasestorage.googleapis.com') || obj.includes('cloudinary'))) {
            urls.add(obj);
        }
        return;
    }

    if (Array.isArray(obj)) {
        obj.forEach(item => extractUrls(item, urls));
        return;
    }

    if (typeof obj === 'object') {
        Object.values(obj).forEach(val => extractUrls(val, urls));
    }
};

/**
 * Finds and deletes images from orders older than 30 days.
 */
export const cleanupOldOrderImages = async (days: number = 30): Promise<{ ordersProcessed: number; filesDeleted: number }> => {
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        // 1. Find old orders that haven't been cleaned yet
        const q = query(
            collection(db, 'orders'),
            where('createdAt', '<', cutoff)
        );
        
        const querySnapshot = await getDocs(q);
        let ordersProcessed = 0;
        let filesDeleted = 0;

        for (const orderDoc of querySnapshot.docs) {
            const orderData = orderDoc.data() as Order;
            
            // Skip if already cleaned or if it's a very new order (though query should handle it)
            if (orderData.imagesCleaned) continue;

            const urlsToDelete = new Set<string>();
            extractUrls(orderData, urlsToDelete);

            // Delete files from Storage
            for (const url of urlsToDelete) {
                try {
                    // Extract path from Firebase Storage URL
                    // Example: https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/uploads%2Ffilename?alt=media
                    const match = url.match(/\/o\/(.+)\?alt=media/);
                    if (match) {
                        const fullPath = decodeURIComponent(match[1]);
                        const fileRef = ref(storage, fullPath);
                        await deleteObject(fileRef);
                        filesDeleted++;
                    }
                } catch (error) {
                    // File might already be deleted or not in our Storage
                    console.warn(`Could not delete file at ${url}:`, error);
                }
            }

            // Update order to mark as cleaned
            await updateDoc(doc(db, 'orders', orderDoc.id), {
                imagesCleaned: true,
                // Optional: clear the actual URLs to save space in Firestore and avoid broken links
                // But keeping them marked as cleaned is safer for record keeping
            });

            ordersProcessed++;
        }

        return { ordersProcessed, filesDeleted };
    } catch (error) {
        console.error("Error cleaning up old order images:", error);
        throw error;
    }
};
/**
 * Deletes a list of files from Firebase Storage.
 */
export const deleteStorageFiles = async (files: UnusedFile[]): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;

    for (const file of files) {
        try {
            const fileRef = ref(storage, file.fullPath);
            await deleteObject(fileRef);
            success++;
        } catch (error) {
            console.error(`Failed to delete ${file.fullPath}:`, error);
            failed++;
        }
    }

    return { success, failed };
};
