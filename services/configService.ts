
import { db } from '../config/firebase';
// Standard firestore imports for modular SDK
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ThemeConfig, CustomFont, StaffMember } from '../types';
import { cleanForFirestore, safeJsonStringify } from '../utils/helpers';

const CONFIG_DOC_ID = 'general';
const CACHE_KEY = 'store_config_cache';
const TEMPLATES_CACHE_KEY = 'templates_cache';

export interface StoreConfig {
    // Legacy fields
    logoUrl?: string;
    faviconUrl?: string;
    appIconUrl?: string;
    siteName?: string;
    giftBoxImageUrl?: string;
    giftBoxOutOfStock?: boolean; // THAY THẾ hideGiftBoxOption
    
    lightImageUrl?: string;
    lightPrice?: number;
    lightOutOfStock?: boolean;
    cardOutOfStock?: boolean;
    
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
    staffEmails?: string[];

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

    // Email Config
    disableThankYouEmail?: boolean;

    // Print Example Images & Pricing Config
    standardPrintImageUrl?: string;
    standardPrintOutOfStock?: boolean;
    premiumPrintImageUrl?: string;
    polaroidSampleImages?: string[];
    customPrintStandardPrice?: number;
    customPrintPremiumPrice?: number;
    polaroidPrice2?: number;
    polaroidPrice4?: number;

    // Shipping & Warehouse
    warehouseAddress?: string;
    googleMapsUrl?: string;
    museumSurcharge?: number;

    // Report Token for external sync API
    reportToken?: string;
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

/**
 * Returns the cached templates from localStorage.
 */
export const getCachedTemplates = (): any[] | null => {
    try {
        const cached = localStorage.getItem(TEMPLATES_CACHE_KEY);
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
            if (data.disableThankYouEmail === undefined) data.disableThankYouEmail = true;
            if (data.museumSurcharge === undefined) data.museumSurcharge = 70000;
            if (!data.reportToken) {
                data.reportToken = 'tl_token_' + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 10).toUpperCase();
            }
            
            // Persist to cache
            localStorage.setItem(CACHE_KEY, safeJsonStringify(data));
            return data;
        }
        return getCachedConfig() || { theme: DEFAULT_THEME, uploadedFonts: [], staff: [], b2bDiscountPercent: 5, disableThankYouEmail: true, museumSurcharge: 70000 };
    } catch (error: any) {
        console.warn("Firestore: Unable to fetch config. Using cache fallback.");
        return getCachedConfig();
    }
};

export const updateStoreConfig = async (config: Partial<StoreConfig>) => {
    try {
        const cleaned = cleanForFirestore(config);
        await setDoc(doc(db, 'config', CONFIG_DOC_ID), cleaned, { merge: true });
        // Update cache
        const current = getCachedConfig() || {};
        localStorage.setItem(CACHE_KEY, safeJsonStringify({ ...current, ...config }));
        return true;
    } catch (error) {
        console.error("Error saving config:", error);
        return false;
    }
};

export const getAdsCosts = async (startDate: Date, endDate: Date): Promise<Record<string, number>> => {
    try {
        // Use a subcollection of 'config' to leverage existing security rules
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        const q = query(
            collection(db, 'config', CONFIG_DOC_ID, 'ads_costs'),
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
        const cleaned = cleanForFirestore({ cost, updatedAt: Date.now() });
        await setDoc(doc(db, 'config', CONFIG_DOC_ID, 'ads_costs', date), cleaned);
        
        // Also update localStorage for immediate feedback/offline support
        const stored = localStorage.getItem('ads_costs');
        const allCosts: Record<string, number> = stored ? JSON.parse(stored) : {};
        allCosts[date] = cost;
        localStorage.setItem('ads_costs', safeJsonStringify(allCosts));
        
        return true;
    } catch (e) {
        console.error("Error saving ads cost:", e);
        return false;
    }
};
