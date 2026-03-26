
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Page, FeedbackItem, CollectionTemplate } from '../types';
import { COLLECTION_TEMPLATES, FEEDBACK_ITEMS } from '../constants';
import { StoreConfig, getCachedConfig } from '../services/configService';
import { formatCurrency } from '../utils/pricing';
import { getTotalOrderCount } from '../services/orderService';
import { useLanguage } from '../src/contexts/LanguageContext';

interface HomePageProps {
    navigateTo: (page: Page) => void;
    config?: StoreConfig;
    feedbacks?: FeedbackItem[];
    templates?: CollectionTemplate[];
}

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

/**
 * Skeleton Components for Text
 */
const TextSkeleton: React.FC<{ className: string }> = ({ className }) => (
    <div className={`bg-gray-200 animate-pulse rounded-lg ${className}`}></div>
);

export const HomePage: React.FC<HomePageProps> = ({ navigateTo, config: propConfig, feedbacks, templates }) => {
  const { t } = useLanguage();
  // 1. Initialize from Cache immediately for instant render
  const [localConfig, setLocalConfig] = useState<StoreConfig | null>(() => getCachedConfig());

  // 2. Sync with Prop when server data arrives
  useEffect(() => {
    if (propConfig && Object.keys(propConfig).length > 0) {
        setLocalConfig(propConfig);
    }
  }, [propConfig]);

  const displayTemplates = (templates && templates.length > 0) ? templates.slice(0, 4) : COLLECTION_TEMPLATES.slice(0, 4);
  const rawFeedbacks = (feedbacks && feedbacks.length > 0) ? feedbacks : FEEDBACK_ITEMS;

  const carouselRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<any>(null);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  useEffect(() => {
      const fetchCount = async () => {
          const count = await getTotalOrderCount();
          // Multiply real count by 10 to create FOMO effect as requested
          setTotalOrders(count * 10);
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
      <section className="relative min-h-[85vh] flex flex-col lg:flex-row bg-[#fffbf0]">
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 md:px-16 lg:px-24 py-12 lg:py-0 z-10 order-2 lg:order-1">
            <div className="animate-fade-in space-y-6 text-left">
                <div className="flex items-center gap-3">
                    <span className="h-px w-12 bg-luvin-pink"></span>
                    <span className="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase">The Luvin Gifts</span>
                </div>
                <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl leading-[1.1] text-gray-900">
                    {localConfig?.heroTitle ? (
                        localConfig.heroTitle
                    ) : (
                        <TextSkeleton className="h-16 w-3/4 mb-4" />
                    )} 
                    <br/>
                    {localConfig?.heroSubtitle ? (
                        <span className="text-luvin-pink italic font-light">{localConfig.heroSubtitle}</span>
                    ) : (
                        <TextSkeleton className="h-10 w-1/2" />
                    )}
                </h1>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-md">
                    {t('home.cta_desc')}
                </p>
                <div className="pt-4 flex gap-4">
                    <button onClick={() => navigateTo('builder')} className="bg-gray-900 text-white px-8 py-4 rounded-full font-bold text-sm tracking-wide hover:bg-luvin-pink transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 duration-300">{t('home.start_design')}</button>
                    <button onClick={() => navigateTo('collection')} className="px-8 py-4 rounded-full font-bold text-sm tracking-wide text-gray-900 border border-gray-300 hover:border-gray-900 transition-colors">{t('home.view_templates')}</button>
                </div>
            </div>
        </div>
        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative order-1 lg:order-2">
            <div className="absolute inset-0 bg-gray-100 lg:rounded-bl-[100px] overflow-hidden">
                {localConfig?.heroImageUrl ? (
                    <FadeInImage src={localConfig.heroImageUrl} alt="Hero" className="w-full h-full" loading="eager" />
                ) : (
                    <div className="w-full h-full bg-gray-200 animate-pulse"></div>
                )}
                <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none"></div>
            </div>
        </div>
      </section>

      {/* Trust Bar Section - CẬP NHẬT: Thông tin xử lý đơn hàng chính xác */}
      <section className="bg-white py-12 border-b border-gray-50">
          <div className="container mx-auto px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
                  {[
                      { icon: '⚡', title: t('home.features.f1_title'), desc: t('home.features.f1_desc') },
                      { icon: '🎨', title: t('home.features.f2_title'), desc: t('home.features.f2_desc') },
                      { icon: '🎁', title: t('home.features.f3_title'), desc: t('home.features.f3_desc') },
                      { icon: '🛡️', title: t('home.features.f4_title'), desc: t('home.features.f4_desc') }
                  ].map((feature, i) => (
                      <div key={i} className="flex flex-col items-center text-center p-4 group hover:bg-gray-50 rounded-2xl transition-colors duration-300">
                          <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">{feature.icon}</span>
                          <h4 className="font-bold text-gray-900 text-sm mb-1 uppercase tracking-tighter">{feature.title}</h4>
                          <p className="text-[10px] text-gray-400 font-bold leading-tight max-w-[120px] mx-auto uppercase">{feature.desc}</p>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* Brand Story */}
      <section className="py-24 bg-white overflow-hidden">
          <div className="container mx-auto px-6">
              <div className="flex flex-col md:flex-row items-center gap-16">
                  <div className="w-full md:w-1/2 relative">
                      <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl relative z-10">
                        {localConfig?.inspireImageUrl ? (
                            <FadeInImage src={localConfig.inspireImageUrl} alt="Story" className="w-full h-full" />
                        ) : (
                            <div className="w-full h-full bg-gray-200 animate-pulse"></div>
                        )}
                      </div>
                  </div>
                  <div className="w-full md:w-1/2 text-center md:text-left">
                      <span className="text-luvin-pink font-bold tracking-widest text-xs uppercase mb-2 block">Our Story</span>
                      <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                          {localConfig?.homeStoryTitle ? (
                              <span dangerouslySetInnerHTML={{ __html: localConfig.homeStoryTitle }}></span>
                          ) : (
                              <TextSkeleton className="h-12 w-full max-w-sm mx-auto md:mx-0" />
                          )}
                      </h2>
                      <div className="text-gray-600 mb-6 leading-loose whitespace-pre-line text-left">
                          {localConfig?.homeStoryContent ? (
                              localConfig.homeStoryContent
                          ) : (
                              <div className="space-y-2">
                                  <TextSkeleton className="h-4 w-full" />
                                  <TextSkeleton className="h-4 w-full" />
                                  <TextSkeleton className="h-4 w-5/6" />
                              </div>
                          )}
                      </div>
                      <button onClick={() => navigateTo('about')} className="text-gray-900 font-bold border-b-2 border-gray-900 pb-1 hover:text-luvin-pink hover:border-luvin-pink transition-colors">{t('home.read_more')}</button>
                  </div>
              </div>
          </div>
      </section>

      {/* Featured Collection Section */}
      <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="font-heading text-4xl font-bold text-gray-900 mb-4">{t('home.featured_collection')}</h2>
                  <p className="text-gray-500">{t('home.orders_count').replace('{count}', (totalOrders || '1.500').toString())}</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {displayTemplates.map((item, index) => (
                      <div key={item.id || index} className="group flex flex-col bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 cursor-pointer" onClick={() => navigateTo('collection')}>
                          <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                              <FadeInImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-[8px] font-black text-primary uppercase shadow-sm">✨ {t('common.customize')}</div>
                          </div>
                          <div className="p-4 flex flex-col flex-grow text-center">
                              <h3 className="font-bold text-sm text-gray-800 group-hover:text-primary transition-colors line-clamp-1 mb-2">{item.name}</h3>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-auto">Thiết kế độc bản</p>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="text-center mt-16">
                  <button onClick={() => navigateTo('collection')} className="px-12 py-4 border-2 border-gray-900 rounded-full text-xs font-black uppercase tracking-widest text-gray-900 hover:bg-gray-900 hover:text-white transition-all shadow-md">{t('home.view_all_collection')}</button>
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
              <h2 className="font-heading text-3xl md:text-5xl font-bold text-gray-900 mb-6">{t('home.ready_to_create')}</h2>
              <p className="text-gray-600 mb-10 max-w-2xl mx-auto">{t('home.cta_desc')}</p>
              <button onClick={() => navigateTo('builder')} className="bg-gray-900 text-white px-10 py-4 rounded-full font-bold text-base shadow-xl hover:bg-luvin-pink transition-all transform hover:-translate-y-1">{t('home.design_now')}</button>
          </div>
      </section>
    </div>
  );
};
