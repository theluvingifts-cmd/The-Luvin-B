
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Page, FeedbackItem, CollectionTemplate } from '../types';
import { COLLECTION_TEMPLATES, FEEDBACK_ITEMS } from '../constants';
import { StoreConfig } from '../services/configService';
import { formatCurrency } from '../utils/pricing';
import { getTotalOrderCount } from '../services/orderService';

interface HomePageProps {
    navigateTo: (page: Page) => void;
    config?: StoreConfig;
    feedbacks?: FeedbackItem[];
    templates?: CollectionTemplate[];
}

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

const FadeInImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ className, ...props }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: '#f0f0f0' }}>
            <img 
                {...props} 
                className={`transition-opacity duration-700 ease-in-out w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
};

export const HomePage: React.FC<HomePageProps> = ({ navigateTo, config, feedbacks, templates }) => {
  const heroImage = config?.heroImageUrl || 'https://res.cloudinary.com/dbdqd93km/image/upload/v1764516860/uwa2bkcqdog9yctdmett.png'; 
  const inspireImage = config?.inspireImageUrl || 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=1974&auto=format&fit=crop';
  
  const heroTitle = config?.heroTitle || 'Gói ghém yêu thương';
  const heroSubtitle = config?.heroSubtitle || 'trong từng mảnh ghép';
  
  const storyTitle = config?.homeStoryTitle || 'Hơn cả một món quà, <br/>đó là kỷ niệm.';
  const storyContent = config?.homeStoryContent || 'Chúng tôi tin rằng, món quà ý nghĩa nhất không nằm ở giá trị vật chất, mà ở câu chuyện nó mang theo.\nTại The Luvin, mỗi khung tranh là một cuốn nhật ký mở, nơi bạn kể lại hành trình yêu thương của mình qua những mảnh ghép nhỏ bé nhưng đầy màu sắc.\n\nDù là ngày kỷ niệm, sinh nhật hay một lời xin lỗi ngọt ngào, hãy để chúng tôi giúp bạn gói ghém cảm xúc ấy một cách trọn vẹn nhất.';

  const displayTemplates = (templates && templates.length > 0) ? templates.slice(0, 4) : COLLECTION_TEMPLATES.slice(0, 4);
  const rawFeedbacks = (feedbacks && feedbacks.length > 0) ? feedbacks : FEEDBACK_ITEMS;

  const carouselRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<any>(null);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  useEffect(() => {
      const fetchCount = async () => {
          const count = await getTotalOrderCount();
          setTotalOrders(count);
      };
      fetchCount();
  }, []);

  const infiniteFeedbacks = useMemo(() => {
      if (rawFeedbacks.length === 0) return [];
      return [...rawFeedbacks, ...rawFeedbacks, ...rawFeedbacks, ...rawFeedbacks];
  }, [rawFeedbacks]);

  useEffect(() => {
      const container = carouselRef.current;
      if (container && infiniteFeedbacks.length > 0) {
          const middleIndex = Math.floor(infiniteFeedbacks.length / 2);
          const firstCard = container.firstElementChild as HTMLElement;
          
          if (firstCard) {
              const cardWidth = firstCard.offsetWidth + 32;
              const centerOffset = (container.clientWidth / 2) - (firstCard.offsetWidth / 2);
              const startScroll = (middleIndex * cardWidth) - centerOffset;
              container.scrollTo({ left: startScroll, behavior: 'instant' as any });
          }
      }
  }, [infiniteFeedbacks]);

  useEffect(() => {
      const container = carouselRef.current;
      if (!container || infiniteFeedbacks.length === 0) return;

      const slideNext = () => {
          if (isPaused) return;
          const firstCard = container.firstElementChild as HTMLElement;
          if (!firstCard) return;
          const cardWidth = firstCard.offsetWidth + 32;
          const currentScroll = container.scrollLeft;
          const maxScroll = container.scrollWidth;
          const oneSetWidth = (maxScroll / 4);

          if (currentScroll >= oneSetWidth * 3) {
              container.scrollTo({ left: currentScroll - oneSetWidth, behavior: 'instant' as any });
              setTimeout(() => { container.scrollBy({ left: cardWidth, behavior: 'smooth' }); }, 20);
          } else if (currentScroll <= oneSetWidth) {
               container.scrollTo({ left: currentScroll + oneSetWidth, behavior: 'instant' as any });
               setTimeout(() => { container.scrollBy({ left: cardWidth, behavior: 'smooth' }); }, 20);
          } else {
              container.scrollBy({ left: cardWidth, behavior: 'smooth' });
          }
      };
      intervalRef.current = setInterval(slideNext, 3000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, infiniteFeedbacks]);

  return (
    <div className="font-body text-gray-800 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col lg:flex-row bg-[#fffbf0]">
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
                    <button onClick={() => navigateTo('builder')} className="bg-gray-900 text-white px-8 py-4 rounded-full font-bold text-sm tracking-wide hover:bg-luvin-pink transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 duration-300">Bắt đầu thiết kế</button>
                    <button onClick={() => navigateTo('collection')} className="px-8 py-4 rounded-full font-bold text-sm tracking-wide text-gray-900 border border-gray-300 hover:border-gray-900 transition-colors">Xem mẫu</button>
                </div>
            </div>
        </div>
        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative order-1 lg:order-2">
            <div className="absolute inset-0 bg-gray-100 lg:rounded-bl-[100px] overflow-hidden">
                <FadeInImage src={heroImage} alt="Hero" className="w-full h-full" loading="eager" />
                <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none"></div>
            </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-24 bg-white overflow-hidden">
          <div className="container mx-auto px-6">
              <div className="flex flex-col md:flex-row items-center gap-16">
                  <div className="w-full md:w-1/2 relative">
                      <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl relative z-10"><FadeInImage src={inspireImage} alt="Story" className="w-full h-full" /></div>
                  </div>
                  <div className="w-full md:w-1/2 text-center md:text-left">
                      <span className="text-luvin-pink font-bold tracking-widest text-xs uppercase mb-2 block">Our Story</span>
                      <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-6" dangerouslySetInnerHTML={{ __html: storyTitle }}></h2>
                      <div className="text-gray-600 mb-6 leading-loose whitespace-pre-line">{storyContent}</div>
                      <button onClick={() => navigateTo('about')} className="text-gray-900 font-bold border-b-2 border-gray-900 pb-1 hover:text-luvin-pink hover:border-luvin-pink transition-colors">Đọc thêm về chúng tôi</button>
                  </div>
              </div>
          </div>
      </section>

      {/* Featured Collection Section */}
      <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="font-heading text-4xl font-bold text-gray-900 mb-4">Bộ sưu tập nổi bật</h2>
                  <p className="text-gray-500">Đã có hơn {totalOrders || 'nhiều'} lượt đặt hàng trên toàn hệ thống</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {displayTemplates.map((item, index) => (
                      <div key={item.id || index} className="group flex flex-col bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 cursor-pointer" onClick={() => navigateTo('collection')}>
                          <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                              <FadeInImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-[8px] font-black text-primary uppercase shadow-sm">✨ Tùy chỉnh</div>
                          </div>
                          <div className="p-4 flex flex-col flex-grow text-center">
                              <h3 className="font-bold text-sm text-gray-800 group-hover:text-primary transition-colors line-clamp-1 mb-2">{item.name}</h3>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-auto">Thiết kế độc bản</p>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="text-center mt-16">
                  <button onClick={() => navigateTo('collection')} className="px-12 py-4 border-2 border-gray-900 rounded-full text-xs font-black uppercase tracking-widest text-gray-900 hover:bg-gray-900 hover:text-white transition-all shadow-md">Xem tất cả bộ sưu tập</button>
              </div>
          </div>
      </section>

      {/* Feedbacks Section */}
      <section className="py-24 bg-white border-t border-gray-100 overflow-hidden">
          <div className="container mx-auto px-6 mb-12 text-center">
              <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-3">Our feedbacks</h2>
              <p className="text-sm text-gray-500 tracking-wide uppercase">Khách hàng nói gì về The Luvin</p>
          </div>
          <div className="w-full overflow-hidden py-10" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
              <div ref={carouselRef} className="flex gap-8 overflow-x-auto no-scrollbar w-full px-[50vw] snap-x snap-mandatory" style={{ whiteSpace: 'nowrap' }}>
                  {infiniteFeedbacks.map((fb, idx) => (
                      <div key={idx} className="flex-shrink-0 w-[80vw] md:w-[350px] snap-center">
                          <div className="rounded-3xl overflow-hidden bg-white shadow-lg border border-gray-100">
                              <FadeInImage src={fb.imageUrl} alt={`Feedback`} className="w-full h-auto object-cover pointer-events-none select-none" loading="lazy" />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 bg-luvin-pink/10">
          <div className="container mx-auto px-6 text-center">
              <h2 className="font-heading text-3xl md:text-5xl font-bold text-gray-900 mb-6">Sẵn sàng tạo nên món quà đặc biệt?</h2>
              <p className="text-gray-600 mb-10 max-w-2xl mx-auto">Chỉ mất 5 phút để thiết kế một khung tranh LEGO độc đáo. Gửi gắm thông điệp của bạn ngay hôm nay.</p>
              <button onClick={() => navigateTo('builder')} className="bg-gray-900 text-white px-10 py-4 rounded-full font-bold text-base shadow-xl hover:bg-luvin-pink transition-all transform hover:-translate-y-1">Thiết kế ngay</button>
          </div>
      </section>
    </div>
  );
};
