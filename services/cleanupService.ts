
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
            'lego_parts',
            'backgrounds',
            'templates',
            'feedbacks',
            'frames',
            'config',
            'assets',
            'vouchers',
            'users'
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
        const totalFiles = res.items.length;

        for (const item of res.items) {
            const url = await getDownloadURL(item);
            
            let isUsed = false;
            for (const usedUrl of usedUrls) {
                // Fix: Decode URL to handle encoded characters like %2F (slash)
                const decodedUrl = decodeURIComponent(usedUrl);
                if (decodedUrl.includes(item.fullPath)) {
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

        // Safety Check: If more than 50% of files are marked as unused, it's suspicious
        if (totalFiles > 10 && unusedFiles.length > totalFiles * 0.5) {
            console.warn(`Suspicious cleanup: ${unusedFiles.length}/${totalFiles} files marked as unused. Aborting for safety.`);
            return []; // Return empty to prevent accidental mass deletion
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
        if (obj.startsWith('http') && obj.includes('firebasestorage.googleapis.com')) {
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
 * Only deletes images in the 'uploads/' folder and ensures they aren't used in products/backgrounds.
 */
export const cleanupOldOrderImages = async (days: number = 30): Promise<{ ordersProcessed: number; filesDeleted: number }> => {
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        // 1. Collect all "protected" URLs from other collections
        const protectedUrls = new Set<string>();
        const collectionsToProtect = [
            'lego_parts',
            'backgrounds',
            'templates',
            'feedbacks',
            'frames',
            'config',
            'assets',
            'vouchers',
            'users'
        ];

        for (const colName of collectionsToProtect) {
            try {
                const querySnapshot = await getDocs(collection(db, colName));
                querySnapshot.forEach((doc) => {
                    extractUrls(doc.data(), protectedUrls);
                });
            } catch (error) {
                console.warn(`Could not read collection ${colName} for protection, skipping:`, error);
            }
        }

        // 2. Find old orders that haven't been cleaned yet
        const q = query(
            collection(db, 'orders'),
            where('createdAt', '<', cutoff)
        );
        
        const querySnapshot = await getDocs(q);
        let ordersProcessed = 0;
        let filesDeleted = 0;

        for (const orderDoc of querySnapshot.docs) {
            const orderData = orderDoc.data() as Order;
            
            if (orderData.imagesCleaned) continue;

            const urlsInOrder = new Set<string>();
            extractUrls(orderData, urlsInOrder);

            // 3. Filter URLs to delete: must be in 'uploads/' and NOT in protectedUrls
            for (const url of urlsInOrder) {
                // Only process Firebase Storage URLs in 'uploads/' folder
                if (!url.includes('firebasestorage.googleapis.com') || !url.includes('uploads%2F')) {
                    continue;
                }

                // Check if it's protected
                let isProtected = false;
                const decodedUrl = decodeURIComponent(url);
                for (const protectedUrl of protectedUrls) {
                    const decodedProtected = decodeURIComponent(protectedUrl);
                    if (decodedProtected.includes(decodedUrl) || decodedUrl.includes(decodedProtected)) {
                        isProtected = true;
                        break;
                    }
                }

                if (isProtected) continue;

                try {
                    const match = url.match(/\/o\/(.+)\?alt=media/);
                    if (match) {
                        const fullPath = decodeURIComponent(match[1]);
                        const fileRef = ref(storage, fullPath);
                        await deleteObject(fileRef);
                        filesDeleted++;
                    }
                } catch (error) {
                    console.warn(`Could not delete file at ${url}:`, error);
                }
            }

            // Update order to mark as cleaned
            await updateDoc(doc(db, 'orders', orderDoc.id), {
                imagesCleaned: true
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
