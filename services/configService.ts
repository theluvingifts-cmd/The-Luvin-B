
import { db } from '../config/firebase';
// Standard firestore imports for modular SDK
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ThemeConfig, CustomFont, StaffMember } from '../types';

const CONFIG_DOC_ID = 'general';
const CACHE_KEY = 'store_config_cache';

export interface StoreConfig {
    // Legacy fields
    logoUrl?: string;
    faviconUrl?: string;
    siteName?: string;
    giftBoxImageUrl?: string;
    giftBoxOutOfStock?: boolean; // THAY THẾ hideGiftBoxOption
    
    // Content Fields
    heroImageUrl?: string;
    inspireImageUrl?: string;
    
    // Contact Info
    address?: string;
    hotline?: string;
    hotline2?: string;
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
    
    // B2B Config
    b2bDiscountPercent?: number;

    // Pancake POS Config
    pancakeShopId?: string;
    pancakeAccessToken?: string;
    enablePancakePush?: boolean;

    // NEW: Telegram Notification Config
    telegramBotToken?: string;
    telegramChatId?: string;

    // SEO & Social
    seoTitle?: string;
    seoDescription?: string;
    seoImageUrl?: string;

    // Cleanup Config
    enableAutoCleanup?: boolean;
    autoCleanupDays?: number;
    lastAutoCleanupAt?: number;
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

/**
 * Returns the cached configuration from localStorage immediately.
 * Used for instant first-paint hydration.
 */
export const getCachedConfig = (): StoreConfig | null => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch (e) {
        return null;
    }
};

export const getStoreConfig = async (): Promise<StoreConfig | null> => {
    try {
        const docRef = doc(db, 'config', CONFIG_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as StoreConfig;
            if (!data.theme) data.theme = DEFAULT_THEME;
            if (!data.uploadedFonts) data.uploadedFonts = [];
            if (!data.staff) data.staff = [];
            if (data.b2bDiscountPercent === undefined) data.b2bDiscountPercent = 5;
            
            // Persist to cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            return data;
        }
        return getCachedConfig() || { theme: DEFAULT_THEME, uploadedFonts: [], staff: [], b2bDiscountPercent: 5 };
    } catch (error: any) {
        console.warn("Firestore: Unable to fetch config. Using cache fallback.");
        return getCachedConfig();
    }
};

export const updateStoreConfig = async (config: Partial<StoreConfig>) => {
    try {
        await setDoc(doc(db, 'config', CONFIG_DOC_ID), config, { merge: true });
        // Update cache
        const current = getCachedConfig() || {};
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...current, ...config }));
        return true;
    } catch (error) {
        console.error("Error saving config:", error);
        return false;
    }
};

export const getAdsCosts = async (startDate: Date, endDate: Date): Promise<Record<string, number>> => {
    try {
        // We'll use a dedicated collection for ads costs to ensure persistence across browsers
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        const q = query(
            collection(db, 'ads_costs'),
            where('__name__', '>=', startStr),
            where('__name__', '<=', endStr)
        );
        
        const querySnapshot = await getDocs(q);
        const filteredCosts: Record<string, number> = {};
        querySnapshot.forEach((doc) => {
            filteredCosts[doc.id] = doc.data().cost || 0;
        });
        
        // Fallback to localStorage for any legacy data if needed, but prefer Firestore
        const stored = localStorage.getItem('ads_costs');
        if (stored) {
            try {
                const allCosts: Record<string, number> = JSON.parse(stored);
                for (const [date, cost] of Object.entries(allCosts)) {
                    if (date >= startStr && date <= endStr && !filteredCosts[date]) {
                        filteredCosts[date] = cost;
                    }
                }
            } catch (e) {}
        }
        
        return filteredCosts;
    } catch (e) {
        console.error("Error fetching ads costs:", e);
        return {};
    }
};

export const saveAdsCost = async (date: string, cost: number) => {
    try {
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'ads_costs', date), { cost, updatedAt: Date.now() });
        
        // Also update localStorage for immediate feedback/offline support
        const stored = localStorage.getItem('ads_costs');
        const allCosts: Record<string, number> = stored ? JSON.parse(stored) : {};
        allCosts[date] = cost;
        localStorage.setItem('ads_costs', JSON.stringify(allCosts));
        
        return true;
    } catch (e) {
        console.error("Error saving ads cost:", e);
        return false;
    }
};
