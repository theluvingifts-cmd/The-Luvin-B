
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
          <div className="bg-gray-100 flex flex-col justify-center items-center p-8 md:p-16 h-[500px] md:h-[600px] relative">
              {sliderProducts.length > 0 ? (
                  <>
                    <div className="relative w-full max-w-xs aspect-square">
                        {sliderProducts.map((product, index) => (
                            <img 
                                key={product.id} 
                                src={product.imageUrl} 
                                alt={product.name}
                                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ease-in-out ${activeSlide === index ? 'opacity-100' : 'opacity-0'}`}
                            />
                        ))}
                    </div>
                    <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/50 p-2 rounded-full hover:bg-white transition-colors z-10">&larr;</button>
                    <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/50 p-2 rounded-full hover:bg-white transition-colors z-10">&rarr;</button>
                    <div className="flex gap-3 my-6">
                        {sliderProducts.map((_, index) => (
                            <button 
                                key={index}
                                onClick={() => setActiveSlide(index)}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${activeSlide === index ? 'bg-gray-800 scale-125' : 'bg-gray-400 hover:bg-gray-400'}`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                    <div className="text-center h-20">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Featured</p>
                        <h3 className="font-semibold text-lg mt-1">{sliderProducts[activeSlide].name}</h3>
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
