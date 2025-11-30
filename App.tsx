
import React, { useState, useMemo, useEffect } from 'react';
import type { Page, FrameConfig, LegoPart, Order, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption, CustomFont } from './types';
import { 
    LEGO_PARTS, 
    INITIAL_FRAME_CONFIG, 
    COLLECTION_TEMPLATES, 
    FEEDBACK_ITEMS, 
    FRAME_OPTIONS,
} from './constants';
import { createOrder } from './services/orderService'; 
import { getAllParts } from './services/productService'; 
import { getAllBackgrounds } from './services/backgroundService'; 
import { getStoreConfig, DEFAULT_THEME, StoreConfig } from './services/configService'; 
import { getAllTemplates } from './services/templateService'; 
import { getAllFeedbacks } from './services/feedbackService'; 
import { getAllFrames } from './services/frameService'; 
import { sendOrderEmail } from './services/emailService'; 

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
import { categorizeParts } from './utils/helpers';

declare var confetti: any;

// Helper để load font Google
const loadGoogleFont = (fontName: string) => {
    if (!fontName) return;
    // Nếu là font tùy chỉnh (đã có trong danh sách upload), không load từ Google
    // Logic kiểm tra font tùy chỉnh sẽ được xử lý ở applyTheme
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

// Helper để load Custom Fonts từ danh sách
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
        // Simple sanitization for font name
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

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
  
  const [builderInitialStep, setBuilderInitialStep] = useState(1);

  const [cartItems, setCartItems] = useState<FrameConfig[]>(() => {
      try {
          const savedCart = localStorage.getItem('shopping_cart');
          return savedCart ? JSON.parse(savedCart) : [];
      } catch (error) {
          console.error("Failed to load cart from storage", error);
          return [];
      }
  });

  useEffect(() => {
      try {
          localStorage.setItem('shopping_cart', JSON.stringify(cartItems));
      } catch (error) {
          console.error("Failed to save cart to storage", error);
      }
  }, [cartItems]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true); 
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null); 
  
  const [legoParts, setLegoParts] = useState(LEGO_PARTS);
  const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]); 
  const [templates, setTemplates] = useState<CollectionTemplate[]>(COLLECTION_TEMPLATES);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(FEEDBACK_ITEMS);
  const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS); 

  const [storeConfig, setStoreConfig] = useState<StoreConfig>({});

  // State for cart animation
  const [isCartShaking, setIsCartShaking] = useState(false);

  // Function to apply theme variables to DOM
  const applyTheme = (themeData: typeof DEFAULT_THEME, uploadedFonts: CustomFont[] = []) => {
      const root = document.documentElement;
      const { global, sections } = themeData;

      // Global Colors
      root.style.setProperty('--color-primary', global.colors.primary);
      root.style.setProperty('--color-secondary', global.colors.secondary);
      root.style.setProperty('--color-text', global.colors.text);
      root.style.setProperty('--color-bg', global.colors.background);
      root.style.setProperty('--color-accent', global.colors.accent);

      // Typography
      // Remove unsafe characters from font names for CSS variables
      const cleanHeadingFont = global.typography.headingFont.replace(/['"]/g, '');
      const cleanBodyFont = global.typography.bodyFont.replace(/['"]/g, '');

      root.style.setProperty('--font-heading', `'${cleanHeadingFont}'`);
      root.style.setProperty('--font-body', `'${cleanBodyFont}'`);
      
      // Border Radius
      root.style.setProperty('--radius-global', global.borderRadius);

      // Section Specifics
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

      // Load Custom Fonts
      loadUploadedFonts(uploadedFonts);

      // Load Google Fonts (only if they are not custom uploaded ones)
      // We assume if it's in uploadedFonts, it's already handled by loadUploadedFonts via @font-face
      const isCustomHeading = uploadedFonts.some(f => f.name === cleanHeadingFont);
      const isCustomBody = uploadedFonts.some(f => f.name === cleanBodyFont);

      if (!isCustomHeading) loadGoogleFont(cleanHeadingFont);
      if (!isCustomBody) loadGoogleFont(cleanBodyFont);
  };

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
                if (fetchedConfig.theme) {
                    applyTheme(fetchedConfig.theme, fetchedConfig.uploadedFonts || []);
                } else {
                    applyTheme(DEFAULT_THEME, []);
                }

                if (fetchedConfig.faviconUrl) {
                    const link = document.querySelector("link[rel~='icon']");
                    if (link instanceof HTMLLinkElement) {
                        link.href = fetchedConfig.faviconUrl;
                    } else {
                        const newLink = document.createElement('link');
                        newLink.rel = 'icon';
                        newLink.href = fetchedConfig.faviconUrl;
                        document.head.appendChild(newLink);
                    }
                }
            }
          } catch (error) {
              console.error("Initial fetch error:", error);
          } finally {
              setIsAppLoading(false);
          }
      };
      fetchData();
  }, []);

  const allParts = useMemo(() => (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  const navigateTo = (page: Page) => {
    if (page === 'builder') {
        setBuilderInitialStep(1);
    }
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const handleCustomizeTemplate = (templateConfig: FrameConfig) => {
      setConfig(templateConfig);
      setBuilderInitialStep(3); 
      setCurrentPage('builder');
      window.scrollTo(0, 0);
  };

  useEffect(() => {
      const checkHash = () => {
          if (window.location.hash === '#/admin') {
              setCurrentPage('admin');
          }
      };
      checkHash();
      window.addEventListener('hashchange', checkHash);
      return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleAddToCart = (newConfig: FrameConfig, openCart = true) => {
    setCartItems(prev => [...prev, { ...newConfig, quantity: 1 }]);
    triggerCartShake();
    if (openCart) {
        setTimeout(() => setIsCartOpen(true), 800); 
    }
  };

  const triggerCartShake = () => {
      setIsCartShaking(true);
      setTimeout(() => setIsCartShaking(false), 500); 
  };

  const handleUpdateCartItem = (updatedConfig: FrameConfig) => {
      if (editingCartIndex !== null) {
          setCartItems(prev => prev.map((item, i) => i === editingCartIndex ? { ...updatedConfig, quantity: item.quantity } : item)); 
          setEditingCartIndex(null);
          setConfig(INITIAL_FRAME_CONFIG); 
          setIsCartOpen(true); 
      }
  };

  const handleEditCartItem = (index: number) => {
      setConfig(cartItems[index]);
      setEditingCartIndex(index);
      setIsCartOpen(false);
      setBuilderInitialStep(4); 
      navigateTo('builder');
  };

  const handleCancelEdit = () => {
      setEditingCartIndex(null);
      setConfig(INITIAL_FRAME_CONFIG);
      setIsCartOpen(true);
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCartQuantity = (index: number, newQuantity: number) => {
      if (newQuantity < 1) return;
      setCartItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item));
  };

  const handlePlaceOrder = async (orderData: Omit<Order, 'status' | 'createdAt'>) => {
    const res = await createOrder(orderData);
    if (res.success && res.data) {
        setCurrentOrder(res.data);
        
        try {
            const rawSaved = localStorage.getItem('my_orders');
            let saved: { id: string; date: number }[] = [];
            if (rawSaved) {
                const parsed = JSON.parse(rawSaved);
                if (Array.isArray(parsed)) {
                    saved = parsed as { id: string; date: number }[];
                }
            }
            
            const newEntry = { id: res.data.id, date: Date.now() };
            const updated = [newEntry, ...saved.filter((o) => o.id !== res.data.id)].slice(0, 5);
            localStorage.setItem('my_orders', JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save local order history", e);
        }

        setCartItems([]); 
        navigateTo('order-confirmation');
        sendOrderEmail(res.data);
    } else {
        alert("Lỗi đặt hàng. Vui lòng thử lại.");
    }
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (isAppLoading && !storeConfig.logoUrl) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-pink-50 text-luvin-pink">
              <div className="animate-pulse flex flex-col items-center">
                  <span className="font-heading text-2xl tracking-wider">The Luvin</span>
              </div>
          </div>
      )
  }

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
            {currentPage === 'builder' && (
                <BuilderPage 
                    config={config} 
                    setConfig={setConfig} 
                    navigateTo={navigateTo} 
                    onAddToCart={handleAddToCart} 
                    onUpdateCart={handleUpdateCartItem} 
                    showToast={showToast}
                    legoParts={legoParts}
                    backgrounds={backgrounds}
                    frames={frames}
                    editingCartIndex={editingCartIndex} 
                    onCancelEdit={handleCancelEdit} 
                    onZoomImage={setZoomedImageUrl} 
                    logoUrl={storeConfig.logoUrl}
                    initialStep={builderInitialStep}
                />
            )}
            {currentPage === 'collection' && <CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} />}
            {currentPage === 'cart' && <CartPage 
                cartItems={cartItems} 
                onRemoveItem={handleRemoveCartItem} 
                onEditItem={handleEditCartItem} 
                allParts={allParts} 
                navigateTo={navigateTo}
                onUpdateQuantity={handleUpdateCartQuantity}
                onZoomImage={setZoomedImageUrl} 
            />}
            {currentPage === 'checkout' && <CheckoutPage cartItems={cartItems} allParts={allParts} onPlaceOrder={handlePlaceOrder} onZoomImage={(url) => setZoomedImageUrl(url)} />}
            {currentPage === 'order-confirmation' && <OrderConfirmationPage order={currentOrder} navigateTo={navigateTo} onZoomImage={setZoomedImageUrl} />}
            {currentPage === 'order-lookup' && <OrderLookupPage onZoomImage={setZoomedImageUrl} />}
            {currentPage === 'admin' && <AdminPage />}
            {currentPage === 'about' && <AboutPage />}
            {currentPage === 'warranty' && <WarrantyPage />}
        </main>

        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} config={storeConfig} />}

        <CartPanel 
            isOpen={isCartOpen} 
            onClose={() => setIsCartOpen(false)} 
            cartItems={cartItems} 
            onRemoveItem={handleRemoveCartItem} 
            onEditItem={handleEditCartItem}
            allParts={allParts} 
            navigateTo={navigateTo}
            onUpdateQuantity={handleUpdateCartQuantity}
            onZoomImage={setZoomedImageUrl} 
        />

        {zoomedImageUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImageUrl(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        )}

        {toast && (
            <div className={`fixed top-24 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transform transition-all duration-300 animate-fade-in-down ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.message}
            </div>
        )}
    </div>
  );
};

export default App;
