
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, FeedbackItem, CollectionTemplate } from '../types';
import { COLLECTION_TEMPLATES } from '../constants';

interface HomePageProps {
    navigateTo: (page: Page) => void;
    heroImage?: string;
    inspireImage?: string;
    feedbacks?: FeedbackItem[];
    templates?: CollectionTemplate[];
}

export const HomePage: React.FC<HomePageProps> = ({ navigateTo, heroImage, inspireImage, feedbacks, templates }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  
  // --- FEEDBACK LOGIC (JS Infinite Scroll) ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [isHover, setIsHover] = useState(false);

  // Tạo danh sách lặp lại đủ dài để scroll vô tận (x3)
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

  const heroStyle = heroImage ? {backgroundImage: `url(${heroImage})`} : { backgroundColor: '#fce7f3' }; 
  const inspireStyle = inspireImage ? {backgroundImage: `url(${inspireImage})`} : { backgroundColor: '#e5e7eb' };

  const snowStyle = `
    @keyframes fall {
      0% { transform: translateY(-10vh) translateX(-10px); opacity: 0; }
      20% { opacity: 0.6; }
      100% { transform: translateY(100vh) translateX(10px); opacity: 0; }
    }
    .snowflake-minimal {
      position: absolute;
      top: -10px;
      color: #cbd5e1; 
      animation: fall linear infinite;
      font-size: 10px;
      pointer-events: none;
    }
  `;

  return (
    <div className="section-theme text-[var(--color-text)]">
      <style>{snowStyle}</style>
      <div className="flex flex-col min-h-[calc(100vh-80px)]">
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 relative">
          {/* Left Side (Product Section) */}
          <div className="hidden md:block bg-cover bg-center relative z-10" style={heroStyle}></div>
          
          {/* Right Side */}
          <div className="flex flex-col justify-center items-center p-12 text-center relative overflow-hidden bg-[var(--color-background)]">
               <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="snowflake-minimal" style={{
                      left: `${Math.random() * 100}%`,
                      animationDuration: `${10 + Math.random() * 10}s`, 
                      animationDelay: `${Math.random() * 10}s`,
                      opacity: 0.3 + Math.random() * 0.2
                    }}>❄</div>
                  ))}
               </div>

               <div className="relative z-10 flex flex-col items-center">
                   <div className="mb-10 text-center">
                       <p className="text-[10px] font-bold text-gray-400 tracking-[0.3em] uppercase mb-4">Christmas Edition</p>
                       <h1 className="text-5xl md:text-7xl font-heading text-[var(--color-text)] leading-[1.1]">
                          Unique for <br/>
                          <span className="italic font-light text-[var(--color-accent)]">every moment</span>
                       </h1>
                   </div>

                   <button
                     onClick={() => navigateTo('builder')}
                     className="group relative h-16 bg-black rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)] w-[220px] hover:w-[300px] active:scale-95"
                   >
                     <div className="flex items-center justify-center gap-3 transition-transform duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:-translate-x-4">
                        <span className="text-2xl filter drop-shadow-sm pb-1">🎁</span>
                        <span className="text-white font-bold text-base whitespace-nowrap tracking-wide">
                            Bắt đầu thiết kế
                        </span>
                     </div>

                     <div className="absolute right-5 opacity-0 translate-x-12 scale-50 transition-all duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100">
                        <div className="bg-white/15 p-2 rounded-full backdrop-blur-md">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </div>
                     </div>
                   </button>
               </div>
          </div>
        </div>
      </div>

      {/* FEATURED / INSPIRE SECTION */}
      <div className="w-full bg-[var(--color-background)] py-16 md:py-24">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                
                {/* Left: Mood Image */}
                <div className="h-[400px] md:h-[600px] w-full rounded-2xl overflow-hidden shadow-lg relative group order-2 md:order-1">
                     <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" 
                        style={inspireStyle}
                     ></div>
                     <div className="absolute inset-0 bg-black/5"></div>
                </div>

                {/* Right: Product Interaction */}
                <div className="flex flex-col items-center justify-center text-center relative order-1 md:order-2">
                    
                    {/* Floating Product Card */}
                    <div 
                        className="relative w-64 h-64 md:w-96 md:h-96 bg-white rounded-xl shadow-xl p-6 mb-10 cursor-pointer transition-transform duration-300 hover:-translate-y-2 select-none"
                        onClick={handleNext}
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

                    {/* Elegant Navigation Controls */}
                    <div className="flex items-center gap-8 mb-8 select-none">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            className="group text-gray-400 hover:text-gray-900 transition-colors p-2"
                        >
                            <svg width="40" height="16" viewBox="0 0 40 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="transform group-hover:-translate-x-1 transition-transform">
                                <path d="M0 8H40M0 8L8 1M0 8L8 15" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>

                        <div className="font-serif text-2xl text-[var(--color-text)] tracking-wider">
                            {String(activeSlide + 1).padStart(2, '0')}
                            <span className="text-base text-gray-400 mx-2 font-sans italic opacity-60">/ {String(sliderProducts.length).padStart(2, '0')}</span>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            className="group text-gray-400 hover:text-gray-900 transition-colors p-2"
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
                            <h3 className="font-heading text-4xl md:text-5xl text-[var(--color-text)] leading-tight">
                                {sliderProducts[activeSlide].name}
                            </h3>
                            <div className="pt-4">
                                <button 
                                    onClick={() => navigateTo('collection')}
                                    className="text-sm border-b border-gray-800 pb-1 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all font-medium"
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
      <div className="py-12 md:py-20 bg-white overflow-hidden border-t border-gray-100">
        <div className="container mx-auto px-6 mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-body font-bold text-[#3e2b25] text-left">Our feedbacks</h2>
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
                        onDragStart={(e) => e.preventDefault()} // Prevent native drag
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
