
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
  
  const sliderProducts = useMemo(() => {
      if (templates && templates.length > 0) return templates.slice(0, 4);
      return COLLECTION_TEMPLATES.slice(0, 4);
  }, [templates]);

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

  const displayFeedbacks = (feedbacks && feedbacks.length > 0) ? feedbacks : [];

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

  // Feedback Scroll
  const feedbackScrollRef = useRef<HTMLDivElement>(null);
  const scrollFeedback = (direction: 'left' | 'right') => {
      if (feedbackScrollRef.current) {
          const scrollAmount = 320; // card width + margin
          if (direction === 'left') {
              feedbackScrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          } else {
              feedbackScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
      }
  };

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
                     className="group relative h-14 w-auto min-w-[200px] bg-black rounded-full flex items-center justify-center px-6 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:w-[260px] active:scale-95 shadow-xl hover:shadow-2xl overflow-hidden"
                   >
                     <div className="flex items-center justify-center gap-2 transition-transform duration-500 group-hover:translate-x-[-10px]">
                        <span className="text-2xl filter drop-shadow-sm relative bottom-[1px]">🎁</span>
                        <span className="text-white font-medium text-sm whitespace-nowrap">
                            Bắt đầu thiết kế
                        </span>
                     </div>

                     <div className="absolute right-5 opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e5a84b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
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

      <div className="py-12 bg-white">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-end mb-8">
              <div>
                  <h2 className="text-3xl md:text-4xl font-script text-luvin-pink mb-2">Lời yêu thương</h2>
                  <p className="text-gray-500 text-sm">Khách hàng nói gì về The Luvin</p>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => scrollFeedback('left')} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                      &larr;
                  </button>
                  <button onClick={() => scrollFeedback('right')} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                      &rarr;
                  </button>
              </div>
          </div>
          
          <div 
            ref={feedbackScrollRef}
            className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory no-scrollbar"
            style={{ scrollBehavior: 'smooth' }}
          >
            {displayFeedbacks.length > 0 ? (
                displayFeedbacks.map((feedback, index) => (
                    <div key={index} className="snap-center flex-shrink-0 w-80 bg-[#f9f4ef] p-6 rounded-2xl flex flex-col items-center border border-[#eee5db]">
                        <div className="w-full aspect-square rounded-xl overflow-hidden mb-4 shadow-sm bg-white">
                            <img src={feedback.imageUrl} alt={feedback.name} className="w-full h-full object-contain"/>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-2">
                                {[...Array(5)].map((_, i) => <span key={i} className="text-yellow-400 text-sm">★</span>)}
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{feedback.name}</p>
                            <p className="text-xs text-gray-500 italic mt-2 line-clamp-3">"{feedback.text}"</p>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-500 w-full py-10">Chưa có feedback nào.</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
