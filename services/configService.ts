
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ThemeConfig, CustomFont } from '../types';

const CONFIG_DOC_ID = 'general';

export interface StoreConfig {
    // Legacy fields (kept for backward compatibility during migration)
    logoUrl?: string;
    faviconUrl?: string;
    siteName?: string;
    
    // Content Fields
    heroImageUrl?: string;
    inspireImageUrl?: string;
    
    // Contact Info
    address?: string;
    hotline?: string;
    email?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;

    // Homepage Texts
    heroTitle?: string;
    heroSubtitle?: string;
    
    // Homepage Story
    homeStoryTitle?: string;
    homeStoryContent?: string;

    // NEW: Unified Theme Config
    theme?: ThemeConfig;
    uploadedFonts?: CustomFont[];
    
    // Ads Config (Deprecated in favor of daily collection, kept for fallback if needed)
    dailyAdsBudget?: number; 
}

export const DEFAULT_THEME: ThemeConfig = {
    global: {
        colors: {
            primary: '#efa3b5',
            secondary: '#f9f4ef',
            text: '#3a2a28',
            background: '#ffffff',
            accent: '#e5a84b'
        },
        typography: {
            headingFont: 'Playfair Display',
            bodyFont: 'Montserrat',
            customFontUrl: ''
        },
        borderRadius: '8px'
    },
    sections: {
        header: {
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            textColor: '#1f2937'
        },
        hero: {
            backgroundColor: '#fffbf0',
            textColor: '#3a2a28',
            headingColor: '#111827'
        },
        footer: {
            backgroundColor: '#ffffff',
            textColor: '#374151'
        }
    }
};

export const getStoreConfig = async (): Promise<StoreConfig | null> => {
    try {
        const docRef = doc(db, 'config', CONFIG_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as StoreConfig;
            // Ensure theme object exists with defaults if missing
            if (!data.theme) {
                data.theme = DEFAULT_THEME;
            }
            // Ensure uploadedFonts exists
            if (!data.uploadedFonts) {
                data.uploadedFonts = [];
            }
            return data;
        }
        return { theme: DEFAULT_THEME, uploadedFonts: [] };
    } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
            console.warn("Firestore: Unable to fetch config (Permission Denied). Using default settings.");
            return { theme: DEFAULT_THEME, uploadedFonts: [] };
        }
        console.error("Error fetching config:", error);
        return { theme: DEFAULT_THEME, uploadedFonts: [] };
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

// --- DAILY ADS COSTS FUNCTIONS ---

export const getAdsCosts = async (startDate: Date, endDate: Date): Promise<Record<string, number>> => {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    try {
        // Query ads_costs collection where date is within range
        // Note: 'date' field in document should be stored as YYYY-MM-DD string
        const q = query(
            collection(db, 'ads_costs'), 
            where('date', '>=', startStr), 
            where('date', '<=', endStr)
        );
        
        const snapshot = await getDocs(q);
        const costs: Record<string, number> = {};
        
        snapshot.forEach(doc => {
            costs[doc.id] = doc.data().cost;
        });
        
        return costs;
    } catch (e: any) {
        console.warn("Error fetching ads costs:", e.message);
        return {};
    }
};

export const saveAdsCost = async (date: string, cost: number) => {
    try {
        // Use date string (YYYY-MM-DD) as document ID
        await setDoc(doc(db, 'ads_costs', date), { date, cost });
        return true;
    } catch (e) {
        console.error("Error saving ads cost:", e);
        return false;
    }
};
