
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ThemeConfig, CustomFont, StaffMember } from '../types';

const CONFIG_DOC_ID = 'general';
const CACHE_KEY = 'store_config_cache';

export interface ChatExample {
    question: string;
    answer: string;
}

export interface StoreConfig {
    logoUrl?: string;
    faviconUrl?: string;
    siteName?: string;
    giftBoxImageUrl?: string;
    giftBoxOutOfStock?: boolean;
    
    heroImageUrl?: string;
    inspireImageUrl?: string;
    
    address?: string;
    hotline?: string;
    email?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;

    heroTitle?: string;
    heroSubtitle?: string;
    
    homeStoryTitle?: string;
    homeStoryContent?: string;

    theme?: ThemeConfig;
    uploadedFonts?: CustomFont[];
    
    staff?: StaffMember[];

    dailyAdsBudget?: number; 
    
    b2bDiscountPercent?: number;

    telegramBotToken?: string;
    telegramChatId?: string;

    seoTitle?: string;
    seoDescription?: string;
    seoImageUrl?: string;

    // Chatbot Config
    chatbotEnabled?: boolean;
    chatbotInstruction?: string;
    chatbotWelcomeMessage?: string;
    chatbotExamples?: ChatExample[];
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
            if (!data.chatbotExamples) data.chatbotExamples = [];
            if (data.b2bDiscountPercent === undefined) data.b2bDiscountPercent = 5;
            
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
        const stored = localStorage.getItem('ads_costs');
        const allCosts: Record<string, number> = stored ? JSON.parse(stored) : {};
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
        return {};
    }
};

export const saveAdsCost = async (date: string, cost: number) => {
    try {
        const stored = localStorage.getItem('ads_costs');
        const allCosts: Record<string, number> = stored ? JSON.parse(stored) : {};
        allCosts[date] = cost;
        localStorage.setItem('ads_costs', JSON.stringify(allCosts));
        return true;
    } catch (e) {
        return false;
    }
};
