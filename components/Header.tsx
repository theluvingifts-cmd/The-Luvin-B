
import React, { useState, useEffect } from 'react';
import type { Page } from '../types';
import { StoreConfig } from '../services/configService';

interface HeaderProps {
    navigateTo: (page: Page) => void;
    cartCount: number;
    onCartClick: () => void;
    logoUrl: string;
    isCartShaking?: boolean;
    config?: StoreConfig; // Add config prop
}

export const Header: React.FC<HeaderProps> = ({ navigateTo, cartCount, onCartClick, logoUrl, isCartShaking, config }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    { label: 'Trang chủ', page: 'home' }, 
    { label: 'Thiết kế', page: 'builder' }, 
    { label: 'Bộ sưu tập', page: 'collection' }, 
    { label: 'Tra cứu', page: 'order-lookup' },
    { label: 'Về chúng tôi', page: 'about' },
  ];
  
  const handleNav = (page: Page) => { navigateTo(page); setIsMenuOpen(false); }

  return (
    <>
      <header 
        className="backdrop-blur-sm sticky top-0 z-40 shadow-sm border-b border-gray-200/50 transition-colors duration-300"
        style={headerStyle}
      >
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="cursor-pointer" onClick={() => handleNav('home')}>
              {logoUrl ? (
                  <img src={logoUrl} alt="The Luvin" className="h-12 object-contain" />
              ) : (
                  <span className="font-heading text-2xl font-bold text-primary">The Luvin</span>
              )}
          </div>
          <div className="hidden md:flex items-center space-x-6 font-body">
            {navItems.map(item => (
              <button 
                key={item.page} 
                onClick={() => handleNav(item.page)} 
                className="hover:text-primary transition-colors font-semibold text-sm"
                style={{ color: 'inherit' }}
              >
                {item.label}
              </button>
            ))}
            <button 
                id="cart-icon-desktop" 
                onClick={onCartClick} 
                className={`relative hover:text-primary transition-colors ${isCartShaking ? 'animate-cart-shake' : ''}`}
                style={{ color: 'inherit' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path></svg>
              {cartCount > 0 && <span className="absolute -top-1 -right-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center transition-transform duration-200 transform scale-100 shadow-sm font-bold">{cartCount}</span>}
            </button>
          </div>
          <div className="md:hidden flex items-center gap-4">
            <button 
                id="cart-icon-mobile" 
                onClick={onCartClick} 
                className={`relative ${isCartShaking ? 'animate-cart-shake' : ''}`}
                style={{ color: 'inherit' }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path></svg>
                {cartCount > 0 && <span className="absolute -top-1 -right-2 bg-primary text-white text-xs rounded-full h-4 w-4 flex items-center justify-center shadow-sm font-bold">{cartCount}</span>}
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="focus:outline-none" style={{ color: 'inherit' }}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
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
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <div className="flex flex-col items-start space-y-6 p-8 font-body">
                  {navItems.map(item => ( 
                    <button 
                      key={item.page} 
                      onClick={() => handleNav(item.page)} 
                      className="hover:text-primary text-xl font-semibold w-full text-left"
                    >
                      {item.label}
                    </button> 
                  ))}
              </div>
            </div>
        </div>
      </div>
    </>
  );
};
