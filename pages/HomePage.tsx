
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, FeedbackItem, CollectionTemplate } from '../types';
import { COLLECTION_TEMPLATES } from '../constants';
import { StoreConfig } from '../services/configService';

interface HomePageProps {
    navigateTo: (page: Page) => void;
    config?: StoreConfig;
    feedbacks?: FeedbackItem[];
    templates?: CollectionTemplate[];
}

export const HomePage: React.FC<HomePageProps> = ({ navigateTo, config, feedbacks, templates }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Destructure content from config with fallbacks
  const heroImage = config?.heroImageUrl;
  const inspireImage = config?.inspireImageUrl;
  const heroTitle = config?.heroTitle || 'Unique for';
  const heroSubtitle = config?.heroSubtitle || 'every moment';
  const heroBgColor = config?.theme?.sections?.hero?.backgroundColor || '#fffbf0';
  const heroTextColor = config?.theme?.sections?.hero?.textColor || '#3a2a28';
  const heroHeadingColor = config?.theme?.sections?.hero?.headingColor || '#111827';

  // --- FEEDBACK LOGIC (JS Infinite Scroll) ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [isHover, setIsHover] = useState(false);

  const displayFeedbacks = useMemo(() => {
      const raw = (feedbacks && feedbacks.length > 0) ? feedbacks : [];
      if (raw.length === 0) return [];
      return [...raw, ...raw, ...raw, ...raw];
  }, [feedbacks]);

  // Auto Scroll Effect
  useEffect(() => {
      const scrollContainer = scrollRef.current;
      if (!scrollContainer || displayFeedbacks.length === 0) return;

      const scrollStep = () => {
          if (!isDown && !isHover) {
              if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth / 2) {
                  scrollContainer.scrollLeft = scrollContainer.scrollLeft - (scrollContainer.scrollWidth / 2);
              } else {
                  scrollContainer.scrollLeft += 1; 
              }
          }
      };
      const intervalId = setInterval(scrollStep, 30);
      return () => clearInterval(intervalId);
  }, [isDown, isHover, displayFeedbacks]);

  // Drag Events
  const handleMouseDown = (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      setIsDown(true);
      setStartX(e.pageX - scrollRef.current.offsetLeft);
      setScrollLeftState(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => { setIsDown(false); setIsHover(false); };
  const handleMouseUp = () => { setIsDown(false); };
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDown || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 2; 
      scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  const sliderProducts = useMemo(() => {
      if (templates && templates.length > 0) return templates.slice(0, 4);
      return COLLECTION_TEMPLATES.slice(0, 4);
  }, [templates]);

  // Hero Slider Logic
  useEffect(() => {
    const interval = setInterval(() => {
      handleNext();
    }, 5000); 
    return () => clearInterval(interval);
  }, [sliderProducts]);

  const handlePrev = () => { setActiveSlide(prev => (prev - 1 + sliderProducts.length) % sliderProducts.length); };
  const handleNext = () => { setActiveSlide(prev => (prev + 1) % sliderProducts.length); };

  const heroStyle = heroImage ? {backgroundImage: `url(${heroImage})`} : { backgroundColor: 'var(--color-secondary)' }; 
  const inspireStyle = inspireImage ? {backgroundImage: `url(${inspireImage})`} : { backgroundColor: '#e5e7eb' };

  return (
    <div>
      <div className="flex flex-col min-h-[calc(100vh-80px)]">
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 relative">
          {/* Left Side (Product Section) */}
          <div className="hidden md:block bg-cover bg-center relative z-10" style={heroStyle}></div>
          
          {/* Right Side */}
          <div 
            className="flex flex-col justify-center items-center p-12 text-center relative overflow-hidden transition-colors duration-300" 
            style={{ backgroundColor: heroBgColor, color: heroTextColor }}
          >
               <div className="relative z-10 flex flex-col items-center">
                   <div className="mb-10 text-center">
                       <p className="text-[10px] font-bold opacity-60 tracking-[0.3em] uppercase mb-4">Christmas Edition</p>
                       <h1 className="text-5xl md:text-7xl font-heading leading-[1.1]" style={{ color: heroHeadingColor }}>
                          {heroTitle} <br/>
                          <span className="italic font-light text-accent">{heroSubtitle}</span>
                       </h1>
                   </div>

                   <button
                     onClick={() => navigateTo('builder')}
                     className="group relative h-16 bg-black rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl overflow-hidden transition-all duration-300 w-[220px] hover:w-[260px] active:scale-95"
                   >
                     <div className="flex items-center justify-center gap-3 transition-transform duration-300 group-hover:-translate-x-2">
                        <span className="text-2xl filter drop-shadow-sm pb-1">🎁</span>
                        <span className="text-white font-bold text-base whitespace-nowrap tracking-wide">
                            Bắt đầu thiết kế
                        </span>
                     </div>
                     <div className="absolute right-6 opacity-0 translate-x-12 scale-50 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                     </div>
                   </button>
               </div>
          </div>
        </div>
      </div>

      {/* FEATURED / INSPIRE SECTION */}
      <div className="w-full py-16 md:py-24" style={{ backgroundColor: heroBgColor }}>
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                
                {/* Left: Mood Image */}
                <div className="h-[400px] md:h-[600px] w-full rounded-2xl overflow-hidden shadow-lg relative group order-2 md:order-1 border-4 border-white">
                     <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" 
                        style={inspireStyle}
                     ></div>
                </div>

                {/* Right: Product Interaction */}
                <div className="flex flex-col items-center justify-center text-center relative order-1 md:order-2">
                    
                    {/* Floating Product Card */}
                    <div 
                        className="relative w-64 h-64 md:w-96 md:h-96 bg-white rounded-xl shadow-xl p-6 mb-10 cursor-pointer transition-transform duration-300 hover:-translate-y-2 select-none border border-gray-100"
                        onClick={handleNext}
                        style={{ borderRadius: 'var(--radius-global)' }}
                    >
                        {sliderProducts.length > 0 ? sliderProducts.map((product, index) => (
                            <div 
                                key={product.id}
                                className={`absolute inset-6 transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                                    activeSlide === index 
                                        ? 'opacity-100 scale-100 translate-x-0' 
                                        : 'opacity-0 scale-95 translate-x-4 pointer-events-none'
                                }`}
                            >
                                <img 
                                    src={product.imageUrl} 
                                    alt={product.name}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        )) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">No products</div>
                        )}
                    </div>

                    {/* Navigation Controls */}
                    <div className="flex items-center gap-8 mb-8 select-none">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            className="group text-gray-400 hover:text-primary transition-colors p-2"
                        >
                            <svg width="40" height="16" viewBox="0 0 40 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="transform group-hover:-translate-x-1 transition-transform">
                                <path d="M0 8H40M0 8L8 1M0 8L8 15" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>

                        <div className="font-heading text-2xl text-gray-900 tracking-wider">
                            {String(activeSlide + 1).padStart(2, '0')}
                            <span className="text-base text-gray-400 mx-2 font-sans italic opacity-60">/ {String(sliderProducts.length).padStart(2, '0')}</span>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            className="group text-gray-400 hover:text-primary transition-colors p-2"
                        >
                            <svg width="40" height="16" viewBox="0 0 40 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="transform group-hover:translate-x-1 transition-transform">
                                <path d="M40 8H0M40 8L32 1M40 8L32 15" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>

                    {/* Text Content */}
                    {sliderProducts.length > 0 && (
                        <div className="space-y-3 animate-fade-in">
                            <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 uppercase">Featured Collection</p>
                            <h3 className="font-heading text-4xl md:text-5xl text-gray-800 leading-tight">
                                {sliderProducts[activeSlide].name}
                            </h3>
                            <div className="pt-4">
                                <button 
                                    onClick={() => navigateTo('collection')}
                                    className="text-sm border-b border-gray-800 pb-1 hover:text-primary hover:border-primary transition-all font-medium"
                                >
                                    Xem chi tiết
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
      </div>

      {/* FEEDBACK SECTION */}
      <div className="py-12 md:py-20 bg-site-bg overflow-hidden border-t border-gray-100">
        <div className="container mx-auto px-6 mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-site-text text-left">Our feedbacks</h2>
        </div>
        
        {/* JS Infinite Scroll Container */}
        <div 
            className="w-full overflow-x-hidden cursor-grab active:cursor-grabbing"
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHover(true)}
        >
            <div className="flex w-max gap-5 md:gap-8 px-4">
                {displayFeedbacks.length > 0 ? displayFeedbacks.map((feedback, index) => (
                    <div 
                        key={`${feedback.id}-${index}`} 
                        className="relative flex-shrink-0 transition-transform duration-300 hover:scale-105 hover:z-10 w-[200px] md:w-[300px]"
                        onDragStart={(e) => e.preventDefault()} 
                    >
                        <div className="w-full rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-white select-none">
                            <img 
                                src={feedback.imageUrl} 
                                alt={feedback.name} 
                                className="w-full h-auto object-contain block bg-[#fcfcfc] pointer-events-none"
                                loading="lazy"
                            />
                        </div>
                    </div>
                )) : (
                    <div className="w-screen flex justify-center items-center text-gray-400 h-40">
                        {feedbacks ? "Loading feedbacks..." : "Chưa có feedback nào để hiển thị."}
                    </div>
                )}
            </div>
        </div>
      </div>

    </div>
  );
};
