
import React, { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import type { Page, FrameConfig, LegoPart, Order, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption, CustomFont } from './types';
import { 
    LEGO_PARTS, 
    INITIAL_FRAME_CONFIG, 
    COLLECTION_TEMPLATES, 
    FEEDBACK_ITEMS, 
    FRAME_OPTIONS,
} from './constants';
import { createOrder, updateOrder, countPartsInOrder } from './services/orderService'; 
import { getAllParts, adjustStock } from './services/productService'; 
import { getAllBackgrounds } from './services/backgroundService'; 
import { getStoreConfig, DEFAULT_THEME, StoreConfig } from './services/configService'; 
import { getAllTemplates } from './services/templateService'; 
import { getAllFeedbacks } from './services/feedbackService'; 
import { getAllFrames } from './services/frameService'; 
import { sendOrderEmail } from './services/emailService'; 
import { sendOrderTelegram } from './services/telegramService'; 

import AdminPage from './pages/AdminPage'; 
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartPanel } from './components/CartPanel';
import { HomePage } from './pages/HomePage';
import { BuilderPage } from './pages/BuilderPage';
import { CollectionPage } from './pages/CollectionPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { OrderLookupPage } from './pages/OrderLookupPage';
import { AboutPage } from './pages/AboutPage';
import { WarrantyPage } from './pages/WarrantyPage';
import { BusinessPage } from './pages/BusinessPage'; 
import { QuotationPage } from './pages/QuotationPage'; // NEW
import { categorizeParts } from './utils/helpers';

declare var confetti: any;

const loadGoogleFont = (fontName: string) => {
    if (!fontName) return;
    if (['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'].includes(fontName)) {
        const linkId = `font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
            document.head.appendChild(link);
        }
    }
};

const loadUploadedFonts = (fonts: CustomFont[]) => {
    const styleId = 'uploaded-custom-fonts';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    
    let css = '';
    fonts.forEach(font => {
        const safeName = font.name.replace(/[^a-zA-Z0-9\s]/g, '');
        css += `
            @font-face {
                font-family: '${safeName}';
                src: url('${font.url}');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
        `;
    });
    style.innerHTML = css;
};

const updateMetaTags = (config: StoreConfig) => {
    if (config.seoTitle) {
        document.title = config.seoTitle;
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', config.seoTitle);
        document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', config.seoTitle);
    }
    if (config.seoDescription) {
        document.querySelector('meta[name="description"]')?.setAttribute('content', config.seoDescription);
        document.querySelector('meta[property="og:description"]')?.setAttribute('content', config.seoDescription);
        document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', config.seoDescription);
    }
    if (config.seoImageUrl) {
        document.querySelector('meta[property="og:image"]')?.setAttribute('content', config.seoImageUrl);
        document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', config.seoImageUrl);
    }
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
      if (window.location.hash === '#/bao-gia-si') return 'quotation-client';
      return 'home';
  });
  const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
  const [builderInitialStep, setBuilderInitialStep] = useState(1);
  const [cartItems, setCartItems] = useState<FrameConfig[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [lastOrderAction, setLastOrderAction] = useState<'create' | 'update'>('create');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null); 
  const [legoParts, setLegoParts] = useState(LEGO_PARTS);
  const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]); 
  const [templates, setTemplates] = useState<CollectionTemplate[]>(COLLECTION_TEMPLATES);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(FEEDBACK_ITEMS);
  const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS); 
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({});
  const [isCartShaking, setIsCartShaking] = useState(false);

  const applyTheme = (themeData: typeof DEFAULT_THEME, uploadedFonts: CustomFont[] = []) => {
      const root = document.documentElement;
      const { global, sections } = themeData;
      root.style.setProperty('--color-primary', global.colors.primary);
      root.style.setProperty('--color-secondary', global.colors.secondary);
      root.style.setProperty('--color-text', global.colors.text);
      root.style.setProperty('--color-bg', global.colors.background);
      root.style.setProperty('--color-accent', global.colors.accent);
      const cleanHeadingFont = global.typography.headingFont.replace(/['"]/g, '');
      const cleanBodyFont = global.typography.bodyFont.replace(/['"]/g, '');
      root.style.setProperty('--font-heading', `'${cleanHeadingFont}'`);
      root.style.setProperty('--font-body', `'${cleanBodyFont}'`);
      root.style.setProperty('--radius-global', global.borderRadius);
      if (sections) {
          if (sections.header) {
              root.style.setProperty('--header-bg', sections.header.backgroundColor || 'rgba(255,255,255,0.8)');
              root.style.setProperty('--header-text', sections.header.textColor || '#1f2937');
          }
          if (sections.footer) {
              root.style.setProperty('--footer-bg', sections.footer.backgroundColor || '#ffffff');
              root.style.setProperty('--footer-text', sections.footer.textColor || '#374151');
          }
      }
      loadUploadedFonts(uploadedFonts);
      const isCustomHeading = uploadedFonts.some(f => f.name === cleanHeadingFont);
      const isCustomBody = uploadedFonts.some(f => f.name === cleanBodyFont);
      if (!isCustomHeading) loadGoogleFont(cleanHeadingFont);
      if (!isCustomBody) loadGoogleFont(cleanBodyFont);
  };

  useLayoutEffect(() => {
      if (storeConfig.theme) {
          applyTheme(storeConfig.theme, storeConfig.uploadedFonts || []);
      } else {
          applyTheme(DEFAULT_THEME, []);
      }
  }, [storeConfig]);

  useEffect(() => {
      const fetchData = async () => {
          try {
            const [parts, bgs, fetchedConfig, tpls, fbs, fetchedFrames] = await Promise.all([
                getAllParts(), 
                getAllBackgrounds(), 
                getStoreConfig(),
                getAllTemplates(),
                getAllFeedbacks(),
                getAllFrames()
            ]);
            if (parts && parts.length > 0) setLegoParts(categorizeParts(parts));
            if (bgs && bgs.length > 0) setBackgrounds(bgs);
            if (tpls && tpls.length > 0) setTemplates(tpls);
            if (fbs && fbs.length > 0) setFeedbacks(fbs);
            if (fetchedFrames && fetchedFrames.length > 0) setFrames(fetchedFrames);
            if (fetchedConfig) {
                setStoreConfig(fetchedConfig);
                updateMetaTags(fetchedConfig);
            }
          } catch (error) { console.error("Initial fetch error:", error); }
      };
      fetchData();
  }, []);

  const allParts = useMemo(() => (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  const navigateTo = (page: Page) => {
    if (page === 'builder') setBuilderInitialStep(1);
    if (editingOrder && page !== 'cart' && page !== 'checkout' && page !== 'builder') {
       if (window.confirm("Bạn đang sửa đơn hàng. Rời đi sẽ hủy bỏ các thay đổi?")) {
           setEditingOrder(null);
           setCartItems([]);
       } else return;
    }
    setCurrentPage(page);
    if (page === 'quotation-client') window.location.hash = '#/bao-gia-si';
    else if (page !== 'admin') window.location.hash = '';
    window.scrollTo(0, 0);
  };

  useEffect(() => {
      const checkHash = () => {
          if (window.location.hash === '#/admin') setCurrentPage('admin');
          if (window.location.hash === '#/bao-gia-si') setCurrentPage('quotation-client');
      };
      checkHash();
      window.addEventListener('hashchange', checkHash);
      return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleAddToCart = (newConfig: FrameConfig, openCart = true) => {
    setCartItems(prev => [...prev, { ...newConfig, quantity: 1 }]);
    setIsCartShaking(true);
    setTimeout(() => setIsCartShaking(false), 500); 
    if (openCart) setTimeout(() => setIsCartOpen(true), 800); 
  };

  const handlePlaceOrder = async (orderData: Omit<Order, 'status' | 'createdAt'>) => {
    setLastOrderAction('create');
    const res = await createOrder(orderData);
    if (res.success && res.data) {
        setCurrentOrder(res.data);
        setCartItems([]); 
        navigateTo('order-confirmation');
        sendOrderEmail(res.data);
        sendOrderTelegram(res.data, storeConfig); 
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-site-bg text-site-text transition-colors duration-300">
         {currentPage !== 'admin' && (
             <Header 
                navigateTo={navigateTo} 
                cartCount={cartItems.length} 
                onCartClick={() => setIsCartOpen(true)} 
                logoUrl={storeConfig.logoUrl || ''} 
                isCartShaking={isCartShaking}
                config={storeConfig}
                currentPage={currentPage}
             />
        )}
        <main className="flex-grow">
            {currentPage === 'home' && <HomePage navigateTo={navigateTo} config={storeConfig} feedbacks={feedbacks} templates={templates} />}
            {currentPage === 'builder' && <BuilderPage config={config} setConfig={setConfig} navigateTo={navigateTo} onAddToCart={handleAddToCart} onUpdateCart={()=>{}} showToast={()=>{}} legoParts={legoParts} backgrounds={backgrounds} frames={frames} editingCartIndex={null} onCancelEdit={()=>{}} onZoomImage={setZoomedImageUrl} logoUrl={storeConfig.logoUrl} initialStep={builderInitialStep} uploadedFonts={storeConfig.uploadedFonts || []} />}
            {currentPage === 'collection' && <CollectionPage navigateTo={navigateTo} onCustomize={()=>{}} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} />}
            {currentPage === 'cart' && <CartPage cartItems={cartItems} onRemoveItem={()=>{}} onEditItem={()=>{}} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={()=>{}} onZoomImage={setZoomedImageUrl} />}
            {currentPage === 'checkout' && <CheckoutPage cartItems={cartItems} allParts={allParts} onPlaceOrder={handlePlaceOrder} onZoomImage={(url) => setZoomedImageUrl(url)} />}
            {currentPage === 'order-confirmation' && <OrderConfirmationPage order={currentOrder} navigateTo={navigateTo} onZoomImage={setZoomedImageUrl} actionType={lastOrderAction} />}
            {currentPage === 'order-lookup' && <OrderLookupPage onZoomImage={setZoomedImageUrl} onEditOrder={()=>{}} />}
            {currentPage === 'admin' && <AdminPage />}
            {currentPage === 'about' && <AboutPage config={storeConfig} />}
            {currentPage === 'warranty' && <WarrantyPage config={storeConfig} />}
            {currentPage === 'business' && <BusinessPage config={storeConfig} />}
            {currentPage === 'quotation-client' && <QuotationPage frames={frames} config={storeConfig} />}
        </main>
        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} config={storeConfig} />}
        <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cartItems={cartItems} onRemoveItem={()=>{}} onEditItem={()=>{}} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={()=>{}} onZoomImage={setZoomedImageUrl} />
    </div>
  );
};
export default App;
