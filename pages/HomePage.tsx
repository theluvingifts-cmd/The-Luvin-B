
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Page, FeedbackItem, CollectionTemplate } from '../types';
import { COLLECTION_TEMPLATES, FEEDBACK_ITEMS } from '../constants';
import { StoreConfig } from '../services/configService';
import { formatCurrency } from '../utils/pricing';

interface HomePageProps {
    navigateTo: (page: Page) => void;
    config?: StoreConfig;
    feedbacks?: FeedbackItem[];
    templates?: CollectionTemplate[];
}

// SVG Icons for Value Props
const Icons = {
    Personalized: () => (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-luvin-pink">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
    ),
    Quality: () => (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-luvin-pink">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
    ),
    Gift: () => (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-luvin-pink">
            <rect x="3" y="8" width="18" height="4" rx="1"/>
            <path d="M12 8v13"/>
            <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
            <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
        </svg>
    )
};

// --- IMPROVEMENT: Component for Smooth Image Loading ---
const FadeInImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ className, style, ...props }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: '#f3f4f6', ...style }}>
            <img 
                {...props} 
                className={`transition-opacity duration-700 ease-in-out w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
};

export const HomePage: React.FC<HomePageProps> = ({ navigateTo, config, feedbacks, templates }) => {
  // --- CONFIG DATA ---
  const heroImage = config?.heroImageUrl || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=2070&auto=format&fit=crop'; 
  const inspireImage = config?.inspireImageUrl || 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=1974&auto=format&fit=crop';
  
  const heroTitle = config?.heroTitle || 'Gói ghém yêu thương';
  const heroSubtitle = config?.heroSubtitle || 'trong từng mảnh ghép';
  
  // Story Config
  const storyTitle = config?.homeStoryTitle || 'Hơn cả một món quà, <br/>đó là kỷ niệm.';
  const storyContent = config?.homeStoryContent || 'Chúng tôi tin rằng, món quà ý nghĩa nhất không nằm ở giá trị vật chất, mà ở câu chuyện nó mang theo.\nTại The Luvin, mỗi khung tranh là một cuốn nhật ký mở, nơi bạn kể lại hành trình yêu thương của mình qua những mảnh ghép nhỏ bé nhưng đầy màu sắc.\n\nDù là ngày kỷ niệm, sinh nhật hay một lời xin lỗi ngọt ngào, hãy để chúng tôi giúp bạn gói ghém cảm xúc ấy một cách trọn vẹn nhất.';

  const displayTemplates = (templates && templates.length > 0) ? templates.slice(0, 4) : COLLECTION_TEMPLATES.slice(0, 4);
  const rawFeedbacks = (feedbacks && feedbacks.length > 0) ? feedbacks : FEEDBACK_ITEMS;

  // --- INFINITE AUTO SLIDE LOGIC (STEPPED) ---
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<any>(null);

  // 1. Tạo danh sách lặp đủ dài (4 bộ) để giả lập vô tận
  const infiniteFeedbacks = useMemo(() => {
      if (rawFeedbacks.length === 0) return [];
      // Bộ 1, Bộ 2, Bộ 3, Bộ 4
      return [...rawFeedbacks, ...rawFeedbacks, ...rawFeedbacks, ...rawFeedbacks];
  }, [rawFeedbacks]);

  // 2. Xử lý khởi tạo vị trí (Bắt đầu ở giữa)
  useEffect(() => {
      const container = carouselRef.current;
      if (container && infiniteFeedbacks.length > 0) {
          // Tính toán vị trí phần tử giữa của danh sách
          // Ví dụ: 20 phần tử, bắt đầu ở index 10
          const middleIndex = Math.floor(infiniteFeedbacks.length / 2);
          const firstCard = container.firstElementChild as HTMLElement;
          
          if (firstCard) {
              const cardWidth = firstCard.offsetWidth + 32; // width + gap
              const centerOffset = (container.clientWidth / 2) - (firstCard.offsetWidth / 2);
              const startScroll = (middleIndex * cardWidth) - centerOffset;
              
              // Scroll ngay lập tức không animation
              container.scrollTo({ left: startScroll, behavior: 'instant' as any });
          }
      }
  }, [infiniteFeedbacks]);

  // 3. Xử lý Auto-Slide từng bước (Step by Step)
  useEffect(() => {
      const container = carouselRef.current;
      if (!container || infiniteFeedbacks.length === 0) return;

      const slideNext = () => {
          if (isPaused) return;

          const firstCard = container.firstElementChild as HTMLElement;
          if (!firstCard) return;

          const cardWidth = firstCard.offsetWidth + 32; // width + gap (gap-8 = 32px)
          const currentScroll = container.scrollLeft;
          const maxScroll = container.scrollWidth;
          const oneSetWidth = (maxScroll / 4); // Chiều dài 1 bộ gốc

          // Logic Reset Vô Tận:
          // Nếu đã cuộn quá bộ thứ 3 (gần hết), nhảy lùi về bộ thứ 2 (vị trí tương đương) ngay lập tức
          if (currentScroll >= oneSetWidth * 3) {
              container.scrollTo({ left: currentScroll - oneSetWidth, behavior: 'instant' as any });
              setTimeout(() => {
                  container.scrollBy({ left: cardWidth, behavior: 'smooth' });
              }, 20);
          } 
          // Ngược lại, nếu đang ở đầu (bộ 1), nhảy tới bộ 2
          else if (currentScroll <= oneSetWidth) {
               container.scrollTo({ left: currentScroll + oneSetWidth, behavior: 'instant' as any });
               setTimeout(() => {
                  container.scrollBy({ left: cardWidth, behavior: 'smooth' });
              }, 20);
          }
          else {
              // Bình thường: Trượt sang phải 1 card
              container.scrollBy({ left: cardWidth, behavior: 'smooth' });
          }
      };

      // Set interval 3 giây trượt 1 lần
      intervalRef.current = setInterval(slideNext, 3000);

      return () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
      };
  }, [isPaused, infiniteFeedbacks]);


  return (
    <div className="font-body text-gray-800 overflow-x-hidden">
      
      {/* 1. HERO SECTION - Split Layout */}
      <section className="relative min-h-[90vh] flex flex-col lg:flex-row bg-[#fffbf0]">
        
        {/* Left Content */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 md:px-16 lg:px-24 py-12 lg:py-0 z-10 order-2 lg:order-1">
            <div className="animate-fade-in space-y-6">
                <div className="flex items-center gap-3">
                    <span className="h-px w-12 bg-luvin-pink"></span>
                    <span className="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase">The Luvin Gifts</span>
                </div>
                
                <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl leading-[1.1] text-gray-900">
                    {heroTitle} <br/>
                    <span className="text-luvin-pink italic font-light">{heroSubtitle}</span>
                </h1>
                
                <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-md">
                    Tạo nên món quà độc bản từ những mảnh ghép LEGO. Lưu giữ kỷ niệm theo cách riêng của bạn, tinh tế và đầy cảm xúc.
                </p>

                <div className="pt-4 flex gap-4">
                    <button 
                        onClick={() => navigateTo('builder')}
                        className="bg-gray-900 text-white px-8 py-4 rounded-full font-bold text-sm tracking-wide hover:bg-luvin-pink transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 duration-300"
                    >
                        Bắt đầu thiết kế
                    </button>
                    <button 
                        onClick={() => navigateTo('collection')}
                        className="px-8 py-4 rounded-full font-bold text-sm tracking-wide text-gray-900 border border-gray-300 hover:border-gray-900 transition-colors"
                    >
                        Xem mẫu có sẵn
                    </button>
                </div>
            </div>
        </div>

        {/* Right Image - Rounded Shape */}
        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative order-1 lg:order-2">
            <div className="absolute inset-0 bg-gray-100 lg:rounded-bl-[100px] overflow-hidden">
                {/* --- IMPROVEMENT: Use FadeInImage and eager loading --- */}
                <FadeInImage 
                    src={heroImage} 
                    alt="Hero" 
                    className="w-full h-full"
                    loading="eager" 
                />
                <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none"></div>
            </div>
            
            {/* Floating Badge */}
            <div className="absolute bottom-8 left-8 lg:bottom-16 lg:-left-16 bg-white p-4 rounded-2xl shadow-xl animate-bounce hidden md:block max-w-[200px]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-50 rounded-full flex items-center justify-center text-xl">🎁</div>
                    <div>
                        <p className="text-xs font-bold text-gray-900">Món quà ý nghĩa</p>
                        <p className="text-[10px] text-gray-500">Được yêu thích nhất</p>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* 2. VALUE PROPOSITION */}
      <section className="py-20 bg-[#f9f4ef]">
          <div className="container mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                  <div className="flex flex-col items-center space-y-4">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-2">
                          <Icons.Personalized />
                      </div>
                      <h3 className="font-heading text-xl font-bold">Cá nhân hóa độc bản</h3>
                      <p className="text-sm text-gray-600 leading-relaxed max-w-xs">Tự do tùy chỉnh nhân vật, trang phục và thông điệp riêng biệt cho người thương.</p>
                  </div>
                  <div className="flex flex-col items-center space-y-4">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-2">
                          <Icons.Quality />
                      </div>
                      <h3 className="font-heading text-xl font-bold">Chất lượng cao cấp</h3>
                      <p className="text-sm text-gray-600 leading-relaxed max-w-xs">Mảnh ghép LEGO sắc nét, khung tranh gỗ bền đẹp, hoàn thiện tỉ mỉ từng chi tiết.</p>
                  </div>
                  <div className="flex flex-col items-center space-y-4">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-2">
                          <Icons.Gift />
                      </div>
                      <h3 className="font-heading text-xl font-bold">Đóng gói quà tặng</h3>
                      <p className="text-sm text-gray-600 leading-relaxed max-w-xs">Hộp quà sang trọng, kèm thiệp viết tay, sẵn sàng để trao gửi ngay lập tức.</p>
                  </div>
              </div>
          </div>
      </section>

      {/* 3. BRAND STORY - Emotional Connection */}
      <section className="py-24 bg-white overflow-hidden">
          <div className="container mx-auto px-6">
              <div className="flex flex-col md:flex-row items-center gap-16">
                  <div className="w-full md:w-1/2 relative">
                      <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl relative z-10">
                          {/* --- IMPROVEMENT: Use FadeInImage --- */}
                          <FadeInImage src={inspireImage} alt="Story" className="w-full h-full" />
                      </div>
                      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-luvin-pink/10 rounded-full blur-3xl z-0"></div>
                      <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl z-0"></div>
                  </div>
                  <div className="w-full md:w-1/2 text-center md:text-left">
                      <span className="text-luvin-pink font-bold tracking-widest text-xs uppercase mb-2 block">Our Story</span>
                      <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-6" dangerouslySetInnerHTML={{ __html: storyTitle }}></h2>
                      <div className="text-gray-600 mb-6 leading-loose whitespace-pre-line">{storyContent}</div>
                      <button onClick={() => navigateTo('about')} className="text-gray-900 font-bold border-b-2 border-gray-900 pb-1 hover:text-luvin-pink hover:border-luvin-pink transition-colors">
                          Đọc thêm về chúng tôi
                      </button>
                  </div>
              </div>
          </div>
      </section>

      {/* 4. FEATURED COLLECTION - Grid Layout */}
      <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="font-heading text-4xl font-bold text-gray-900 mb-4">Bộ sưu tập nổi bật</h2>
                  <p className="text-gray-500">Những thiết kế được yêu thích nhất tháng này</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {displayTemplates.map((item, index) => (
                      <div key={item.id || index} className="group cursor-pointer" onClick={() => navigateTo('collection')}>
                          <div className="relative aspect-square overflow-hidden rounded-2xl bg-white shadow-sm mb-4">
                              {/* --- IMPROVEMENT: Use FadeInImage --- */}
                              <FadeInImage 
                                  src={item.imageUrl} 
                                  alt={item.name} 
                                  className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-110" 
                              />
                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                  <button className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold text-sm shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                      Tùy chỉnh ngay
                                  </button>
                              </div>
                          </div>
                          <div className="text-center">
                              <h3 className="font-bold text-lg text-gray-800 group-hover:text-luvin-pink transition-colors">{item.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">Thiết kế tùy chỉnh</p>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="text-center mt-12">
                  <button 
                      onClick={() => navigateTo('collection')}
                      className="px-10 py-3 border border-gray-300 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all"
                  >
                      Xem tất cả mẫu
                  </button>
              </div>
          </div>
      </section>

      {/* 5. FEEDBACK - Infinite Step-by-Step Carousel */}
      <section className="py-24 bg-white border-t border-gray-100 overflow-hidden">
          <div className="container mx-auto px-6 mb-12 text-center">
              <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-3">Our feedbacks</h2>
              <p className="text-sm text-gray-500 tracking-wide uppercase">Khách hàng nói gì về The Luvin</p>
          </div>

          <div 
              className="w-full overflow-hidden py-10"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
          >
              <div 
                  ref={carouselRef}
                  className="flex gap-8 overflow-x-auto no-scrollbar w-full px-[50vw] snap-x snap-mandatory" 
                  style={{ whiteSpace: 'nowrap' }}
              >
                  {infiniteFeedbacks.map((fb, idx) => (
                      <div 
                          key={idx} 
                          className="flex-shrink-0 w-[80vw] md:w-[350px] snap-center"
                      >
                          <div className="rounded-3xl overflow-hidden bg-white shadow-lg border border-gray-100">
                              {/* --- IMPROVEMENT: Use FadeInImage --- */}
                              <FadeInImage 
                                  src={fb.imageUrl} 
                                  alt={`Feedback`} 
                                  className="w-full h-auto object-cover pointer-events-none select-none"
                                  loading="lazy"
                              />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* 6. CALL TO ACTION FOOTER */}
      <section className="py-20 bg-luvin-pink/10">
          <div className="container mx-auto px-6 text-center">
              <h2 className="font-heading text-3xl md:text-5xl font-bold text-gray-900 mb-6">
                  Sẵn sàng tạo nên món quà đặc biệt?
              </h2>
              <p className="text-gray-600 mb-10 max-w-2xl mx-auto">
                  Chỉ mất 5 phút để thiết kế một khung tranh LEGO độc đáo. Gửi gắm thông điệp của bạn ngay hôm nay.
              </p>
              <button 
                  onClick={() => navigateTo('builder')}
                  className="bg-gray-900 text-white px-10 py-4 rounded-full font-bold text-base shadow-xl hover:bg-luvin-pink transition-all transform hover:-translate-y-1"
              >
                  Thiết kế ngay
              </button>
          </div>
      </section>

    </div>
  );
};
