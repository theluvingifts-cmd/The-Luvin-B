
import React, { useState, useEffect, memo } from 'react';
import type { Page } from '../types';
import { StoreConfig } from '../services/configService';

interface HeaderProps {
    navigateTo: (page: Page) => void;
    cartCount: number;
    onCartClick: () => void;
    logoUrl: string;
    isCartShaking?: boolean;
    config?: StoreConfig; 
    currentPage?: Page;
}

export const Header: React.FC<HeaderProps> = memo(({ navigateTo, cartCount, onCartClick, logoUrl, isCartShaking, config, currentPage }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const navItems: { label: string; page: Page; path: string }[] = [
    { label: 'Trang chủ', page: 'home', path: '/' }, 
    { label: 'Thiết kế', page: 'builder', path: '/thiet-ke' }, 
    { label: 'Bộ sưu tập', page: 'collection', path: '/bo-suu-tap' }, 
    { label: 'Doanh nghiệp', page: 'business', path: '/doanh-nghiep' },
    { label: 'Tra cứu', page: 'order-lookup', path: '/tra-cuu' },
  ];
  
  const handleNav = (page: Page, e?: React.MouseEvent) => { 
    if (e) e.preventDefault();
    navigateTo(page); 
    setIsMenuOpen(false); 
  };

  return (
    <>
      <header 
        className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-md py-2' : 'bg-white py-4'} border-b border-gray-100`}
      >
        <nav className="container mx-auto px-4 md:px-6 flex justify-between items-center">
          <a href="/" onClick={(e) => handleNav('home', e)} className="flex items-center">
              {logoUrl ? (
                  <img src={logoUrl} alt="The Luvin" className="h-10 md:h-12 object-contain" />
              ) : (
                  <span className="font-heading text-xl md:text-2xl font-bold text-primary">The Luvin</span>
              )}
          </a>

          <div className="hidden md:flex items-center space-x-8 font-body">
            {navItems.map(item => {
              const isActive = currentPage === item.page;
              return (
                <a 
                  key={item.page} 
                  href={item.path}
                  onClick={(e) => handleNav(item.page, e)} 
                  className={`text-sm font-bold transition-all relative py-1 ${isActive ? 'text-primary' : 'text-gray-600 hover:text-primary'}`}
                >
                  {item.label}
                  {isActive && <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary rounded-full"></span>}
                </a>
              );
            })}
            
            <button 
                onClick={onCartClick} 
                className={`relative p-2 rounded-full hover:bg-pink-50 transition-all ${isCartShaking ? 'animate-cart-shake' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path></svg>
              {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center shadow-sm font-black border-2 border-white">{cartCount}</span>}
            </button>
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button onClick={onCartClick} className={`relative p-2 ${isCartShaking ? 'animate-cart-shake' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path></svg>
                {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] rounded-full h-4.5 w-4.5 flex items-center justify-center font-black border-2 border-white">{cartCount}</span>}
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7"></path></svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Slide-out */}
      <div className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
        <div className={`absolute top-0 right-0 h-full w-[280px] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-6">
                <div className="flex justify-between items-center mb-8">
                    <span className="font-heading font-bold text-lg text-primary">Menu</span>
                    <button onClick={() => setIsMenuOpen(false)} className="text-gray-400">✕</button>
                </div>
                <div className="flex flex-col space-y-4">
                    {navItems.map(item => (
                        <a 
                          key={item.page} 
                          href={item.path}
                          onClick={(e) => handleNav(item.page, e)}
                          className={`text-base font-bold p-3 rounded-xl transition-all ${currentPage === item.page ? 'bg-pink-50 text-primary' : 'text-gray-600'}`}
                        >
                          {item.label}
                        </a>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </>
  );
}));
