
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
  // Logic: [Set 1] [Set 2] [Set 3]
  // Khi scroll hết Set 1, ta reset về 0. Người dùng sẽ không nhận ra vì Set 2 bắt đầu giống hệt Set 1.
  const displayFeedbacks = useMemo(() => {
      const raw = (feedbacks && feedbacks.length > 0) ? feedbacks : [];
      if (raw.length === 0) return [];
      // Nhân 4 lần để đảm bảo luôn đủ độ dài lấp đầy màn hình trước khi logic reset hoạt động
      return [...raw, ...raw, ...raw, ...raw];
  }, [feedbacks]);

  // Auto Scroll Effect
  useEffect(() => {
      const scrollContainer = scrollRef.current;
      if (!scrollContainer || displayFeedbacks.length === 0) return;

      const scrollStep = () => {
          // Chỉ tự động trượt khi không kéo chuột và không hover
          if (!isDown && !isHover) {
              if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth / 2) {
                  // Reset về đầu (hoặc vị trí tương ứng) khi đi quá nửa
                  // Để mượt mà, ta reset về: hiện tại - (tổng / 2)
                  scrollContainer.scrollLeft = scrollContainer.scrollLeft - (scrollContainer.scrollWidth / 2);
              } else {
                  scrollContainer.scrollLeft += 1; // Tốc độ trượt: 1px mỗi chu kỳ
              }
          }
      };

      // Tốc độ: 30ms = ~33fps, đủ chậm để xem
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

  const handleMouseLeave = () => {
      setIsDown(false);
      setIsHover(false);
  };

  const handleMouseUp = () => {
      setIsDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDown || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 2; // Tốc độ kéo (x2 cho nhạy)
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
    }, 4000);
    return () => clearInterval(interval);
  }, [sliderProducts]);

  const handlePrev = () => {
    setActiveSlide(prev => (prev - 1 + sliderProducts.length) % sliderProducts.length);
  };
  const handleNext = () => {
    setActiveSlide(prev => (prev + 1) % sliderProducts.length);
  };

  const heroStyle = heroImage ? {backgroundImage: `url(${heroImage})`} : { backgroundColor: '#fce7f3' }; 
  const inspireStyle = inspireImage ? {backgroundImage: `url(${inspireImage})`} : { backgroundColor: '#fce7f3' };

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
    <div>
      <style>{snowStyle}</style>
      <div className="flex flex-col min-h-[calc(100vh-80px)]">
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 relative">
          {/* Left Side (Product Section) */}
          <div className="hidden md:block bg-cover bg-center relative z-10" style={heroStyle}></div>
          
          {/* Right Side */}
          <div className="flex flex-col justify-center items-center p-12 text-center relative overflow-hidden bg-[#fffbf0]">
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
                       <h1 className="text-5xl md:text-7xl font-brand-heading text-gray-900 leading-[1.1]">
                          Unique for <br/>
                          <span className="italic font-light text-[#e5a84b]">every moment</span>
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
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e5a84b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </div>
                     </div>
                   </button>
               </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto my-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 items-center">
          <div className="h-[500px] md:h-[600px] bg-cover bg-center" style={inspireStyle}></div>
          <div className="bg-gray-100 flex flex-col justify-center items-center p-8 md:p-16 h-[500px] md:h-[600px] relative select-none">
              {sliderProducts.length > 0 ? (
                  <>
                    {/* Product Image - Click to Next */}
                    <div 
                        className="relative w-full max-w-xs aspect-square cursor-pointer active:scale-95 transition-transform duration-300"
                        onClick={handleNext}
                    >
                        {sliderProducts.map((product, index) => (
                            <img 
                                key={product.id} 
                                src={product.imageUrl} 
                                alt={product.name}
                                className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${activeSlide === index ? 'opacity-100 scale-100' : 'opacity-0 scale-90 translate-y-4'}`}
                            />
                        ))}
                    </div>
                    
                    {/* Editorial Navigation */}
                    <div className="w-full max-w-xs mt-10 flex items-center justify-between gap-6">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            className="group p-2 -ml-2"
                        >
                            <svg width="32" height="12" viewBox="0 0 32 12" fill="none" className="text-gray-400 group-hover:text-gray-900 transition-colors">
                                <path d="M0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM32 5.25L1 5.25V6.75L32 6.75V5.25Z" fill="currentColor"/>
                            </svg>
                        </button>

                        <div className="flex-grow flex flex-col items-center gap-3">
                            <span className="font-serif text-base italic text-gray-400">
                                <span className="text-gray-900 not-italic font-sans font-bold">0{activeSlide + 1}</span> / 0{sliderProducts.length}
                            </span>
                            <div className="w-full h-px bg-gray-300 relative">
                                <div 
                                    className="absolute top-0 left-0 h-full bg-gray-900 transition-all duration-500 ease-out"
                                    style={{ 
                                        width: `${((activeSlide + 1) / sliderProducts.length) * 100}%` 
                                    }}
                                ></div>
                            </div>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            className="group p-2 -mr-2"
                        >
                            <svg width="32" height="12" viewBox="0 0 32 12" fill="none" className="text-gray-400 group-hover:text-gray-900 transition-colors">
                                <path d="M31.5303 6.53033C31.8232 6.23744 31.8232 5.76256 31.5303 5.46967L26.7574 0.696699C26.4645 0.403806 25.9896 0.403806 25.6967 0.696699C25.4038 0.989593 25.4038 1.46447 25.6967 1.75736L29.9393 6L25.6967 10.2426C25.4038 10.5355 25.4038 11.0104 25.6967 11.3033C25.9896 11.5962 26.4645 11.5962 26.7574 11.3033L31.5303 6.53033ZM0 6.75H31V5.25H0V6.75Z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>

                    <div className="text-center mt-8">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">Featured</p>
                        <h3 className="font-brand-heading text-3xl md:text-4xl text-gray-900 leading-tight">
                            {sliderProducts[activeSlide].name}
                        </h3>
                    </div>
                  </>
              ) : (
                  <p className="text-gray-500">Chưa có sản phẩm nổi bật.</p>
              )}
          </div>
        </div>
      </div>

      {/* FEEDBACK SECTION */}
      <div className="py-12 md:py-20 bg-white overflow-hidden">
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
