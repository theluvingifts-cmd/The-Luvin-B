
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { ThemeConfig } from '../types';

const CONFIG_DOC_ID = 'general';

export interface StoreConfig {
    logoUrl?: string;
    faviconUrl?: string;
    siteName?: string;
    heroImageUrl?: string;
    inspireImageUrl?: string;
    
    // Theme System
    theme?: ThemeConfig;
}

// Default Theme matching current hardcoded styles
export const DEFAULT_THEME: ThemeConfig = {
    global: {
        colors: {
            primary: '#efa3b5',      // luvin-pink
            secondary: '#f4eee8',    // luvin-cream
            background: '#f9f4ef',   // body bg
            text: '#1f2937',         // gray-900
            accent: '#e5a84b',       // gold/yellow accent
        },
        typography: {
            headingFont: 'BrandFont', // Playfair Display / Custom
            bodyFont: 'Montserrat',
        }
    },
    sections: {
        header: { useGlobal: true },
        hero: { useGlobal: true },
        collections: { useGlobal: true },
        footer: { useGlobal: true },
    },
    customFonts: []
};

export const getStoreConfig = async (): Promise<StoreConfig | null> => {
    try {
        const docRef = doc(db, 'config', CONFIG_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as StoreConfig;
            // Merge with default theme to ensure structure exists
            if (!data.theme) {
                data.theme = DEFAULT_THEME;
            }
            return data;
        }
        return { theme: DEFAULT_THEME };
    } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
            console.warn("Firestore: Unable to fetch config (Permission Denied). Using default settings.");
            return { theme: DEFAULT_THEME };
        }
        console.error("Error fetching config:", error);
        return { theme: DEFAULT_THEME };
    }
};

export const updateStoreConfig = async (config: Partial<StoreConfig>) => {
    try {
        await setDoc(doc(db, 'config', CONFIG_DOC_ID), config, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving config:", error);
        return false;
    }
};
