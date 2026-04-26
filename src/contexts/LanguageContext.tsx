
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'vi' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

import { translations } from '../translations';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('app_language');
        return (saved === 'en' || saved === 'vi') ? saved : 'en';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('app_language', lang);
    };

    const t = (key: string, params?: Record<string, any>): string => {
        const keys = key.split('.');
        let current: any = translations[language];
        
        let found = true;
        for (const k of keys) {
            if (current && current[k]) {
                current = current[k];
            } else {
                found = false;
                break;
            }
        }

        if (!found) {
            // Fallback to Vietnamese
            current = translations['vi'];
            for (const k of keys) {
                if (current && current[k]) {
                    current = current[k];
                } else {
                    return key;
                }
            }
        }
        
        if (typeof current !== 'string') return key;

        if (params) {
            Object.keys(params).forEach(p => {
                current = current.replace(`{${p}}`, params[p]);
            });
        }
        
        return current;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
