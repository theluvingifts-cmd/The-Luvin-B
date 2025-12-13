
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ThemeConfig, CustomFont, StaffMember } from '../types';

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
    
    // NEW: Staff Management
    staff?: StaffMember[];

    // Ads Config
    dailyAdsBudget?: number; 

    // NEW: Telegram Notification Config
    telegramBotToken?: string;
    telegramChatId?: string;

    // SEO & Social
    seoTitle?: string;
    seoDescription?: string;
    seoImageUrl?: string;
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
            // Ensure staff exists
            if (!data.staff) {
                data.staff = [];
            }
            return data;
        }
        return { theme: DEFAULT_THEME, uploadedFonts: [], staff: [] };
    } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
            console.warn("Firestore: Unable to fetch config (Permission Denied). Using default settings.");
            return { theme: DEFAULT_THEME, uploadedFonts: [], staff: [] };
        }
        console.error("Error fetching config:", error);
        return { theme: DEFAULT_THEME, uploadedFonts: [], staff: [] };
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

// --- DAILY ADS COSTS FUNCTIONS (SWITCHED TO LOCAL STORAGE) ---

export const getAdsCosts = async (startDate: Date, endDate: Date): Promise<Record<string, number>> => {
    // Local Storage Implementation
    try {
        const stored = localStorage.getItem('ads_costs');
        const allCosts: Record<string, number> = stored ? JSON.parse(stored) : {};
        
        // Filter by date range
        const filteredCosts: Record<string, number> = {};
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        for (const [date, cost] of Object.entries(allCosts)) {
            if (date >= startStr && date <= endStr) {
                filteredCosts[date] = cost;
            }
        }
        return filteredCosts;
    } catch (e) {
        console.error("Error reading ads costs from local storage", e);
        return {};
    }
};

export const saveAdsCost = async (date: string, cost: number) => {
    // Local Storage Implementation
    try {
        const stored = localStorage.getItem('ads_costs');
        const allCosts: Record<string, number> = stored ? JSON.parse(stored) : {};
        
        allCosts[date] = cost;
        
        localStorage.setItem('ads_costs', JSON.stringify(allCosts));
        return true;
    } catch (e) {
        console.error("Error saving ads cost to local storage:", e);
        return false;
    }
};