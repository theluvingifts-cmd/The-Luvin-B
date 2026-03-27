
import React, { useState, useEffect } from 'react';
import type { Page } from '../types';
import { StoreConfig } from '../services/configService';
import { Logo } from './shared/Logo';
import { useLanguage } from '../src/contexts/LanguageContext';

interface HeaderProps {
    navigateTo: (page: Page) => void;
    cartCount: number;
    onCartClick: () => void;
    logoUrl: string;
    isCartShaking?: boolean;
    config?: StoreConfig; 
    currentPage?: Page;
}

export const Header: React.FC<HeaderProps> = ({ navigateTo, cartCount, onCartClick, logoUrl, isCartShaking, config, currentPage }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  // Dynamic Styles from Config
  const headerStyle = {
      backgroundColor: 'var(--header-bg)',
      color: 'var(--header-text)',
  };

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isMenuOpen]);
  
  const navItems: { label: string; page: Page }[] = [
    { label: t('nav.home'), page: 'home' }, 
    { label: t('nav.studio'), page: 'builder' }, 
    { label: t('nav.collection'), page: 'collection' }, 
    { label: t('nav.business'), page: 'business' },
    { label: t('nav.lookup'), page: 'order-lookup' },
  ];
  
  const handleNav = (page: Page) => { navigateTo(page); setIsMenuOpen(false); }

  return (
    <>
      <header 
        className="backdrop-blur-sm sticky top-0 z-40 shadow-sm border-b border-gray-200/50 transition-all duration-300"
        style={headerStyle}
      >
        <nav className="container mx-auto px-5 py-2.5 flex justify-between items-center">
          <Logo 
            url={logoUrl} 
            onClick={() => handleNav('home')} 
            className="h-9 sm:h-10"
          />
          
          <div className="hidden md:flex items-center space-x-6 font-body">
            {navItems.map(item => {
              const isActive = currentPage === item.page || (currentPage === 'home' && item.page === 'home' && !currentPage);
              return (
                <button 
                  key={item.page} 
                  onClick={() => handleNav(item.page)} 
                  className={`font-semibold text-sm transition-colors duration-200 ${isActive ? 'text-primary' : 'hover:text-primary'}`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* Language Switcher */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-2">
                <button 
                    onClick={() => setLanguage('vi')} 
                    className={`text-[10px] font-black uppercase tracking-widest transition-all ${language === 'vi' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    VI
                </button>
                <span className="text-gray-300 text-[10px]">|</span>
                <button 
                    onClick={() => setLanguage('en')} 
                    className={`text-[10px] font-black uppercase tracking-widest transition-all ${language === 'en' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    EN
                </button>
            </div>

            <button 
                id="cart-icon-desktop" 
                onClick={onCartClick} 
                className={`relative hover:text-primary transition-colors ${isCartShaking ? 'animate-cart-shake' : ''}`}
                style={{ color: 'inherit' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              {cartCount > 0 && <span className="absolute -top-2 -right-2.5 bg-primary text-white text-[10px] rounded-full h-4.5 w-4.5 min-w-[18px] flex items-center justify-center transition-transform duration-200 transform scale-100 shadow-sm font-bold border border-white">
                {cartCount}
              </span>}
            </button>
          </div>
          <div className="md:hidden flex items-center gap-3">
            {/* Language Switcher Mobile */}
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-2 py-1">
                <button onClick={() => setLanguage('vi')} className={`text-[8px] font-black ${language === 'vi' ? 'text-primary' : 'text-gray-400'}`}>VI</button>
                <button onClick={() => setLanguage('en')} className={`text-[8px] font-black ${language === 'en' ? 'text-primary' : 'text-gray-400'}`}>EN</button>
            </div>

            <button 
                id="cart-icon-mobile" 
                onClick={onCartClick} 
                className={`relative p-1 ${isCartShaking ? 'animate-cart-shake' : ''}`}
                style={{ color: 'inherit' }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                {cartCount > 0 && <span className="absolute -top-0.5 -right-1 bg-primary text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center shadow-sm font-bold border border-white">
                  {cartCount}
                </span>}
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="focus:outline-none p-1" style={{ color: 'inherit' }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu */}
      <div 
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isMenuOpen}
      >
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        ></div>
        <div className={`absolute top-0 right-0 h-full w-4/5 max-w-xs bg-site-bg text-site-text shadow-2xl transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
              <div className="p-5 flex justify-end border-b border-gray-100">
                <button onClick={() => setIsMenuOpen(false)} className="text-gray-500 hover:text-primary transition-colors">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <div className="flex flex-col items-start space-y-6 p-8 font-body">
                  {navItems.map(item => {
                    const isActive = currentPage === item.page;
                    return (
                        <button 
                          key={item.page} 
                          onClick={() => handleNav(item.page)} 
                          className={`text-xl font-semibold w-full text-left transition-colors ${isActive ? 'text-primary' : 'hover:text-primary'}`}
                        >
                          {item.label}
                        </button> 
                    );
                  })}
              </div>
            </div>
        </div>
      </div>
    </>
  );
};
