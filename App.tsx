
import React, { useState, useMemo, useEffect } from 'react';
import type { Page, FrameConfig, LegoPart, Order, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption } from './types';
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
import { getStoreConfig } from './services/configService'; 
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

  const [logoUrl, setLogoUrl] = useState<string>(() => {
      try {
          const cached = localStorage.getItem('app_config');
          return cached ? JSON.parse(cached).logoUrl || "" : "";
      } catch (e) { return ""; }
  });
  
  const [heroImageUrl, setHeroImageUrl] = useState<string | undefined>(() => {
      try {
          const cached = localStorage.getItem('app_config');
          return cached ? JSON.parse(cached).heroImageUrl : undefined;
      } catch (e) { return undefined; }
  });

  const [inspireImageUrl, setInspireImageUrl] = useState<string | undefined>(() => {
      try {
          const cached = localStorage.getItem('app_config');
          return cached ? JSON.parse(cached).inspireImageUrl : undefined;
      } catch (e) { return undefined; }
  });

  // State for cart animation
  const [isCartShaking, setIsCartShaking] = useState(false);

  useEffect(() => {
      try {
          const cached = localStorage.getItem('app_config');
          if (cached) {
              const config = JSON.parse(cached);
              if (config.faviconUrl) {
                  const link = document.querySelector("link[rel~='icon']");
                  if (link instanceof HTMLLinkElement) {
                      link.href = config.faviconUrl;
                  } else {
                      const newLink = document.createElement('link');
                      newLink.rel = 'icon';
                      newLink.href = config.faviconUrl;
                      document.head.appendChild(newLink);
                  }
              }
          }
      } catch(e) {}
  }, []);

  useEffect(() => {
      const fetchData = async () => {
          try {
            const [parts, bgs, storeConfig, tpls, fbs, fetchedFrames] = await Promise.all([
                getAllParts(), 
                getAllBackgrounds(), 
                getStoreConfig(),
                getAllTemplates(),
                getAllFeedbacks(),
                getAllFrames()
            ]);
            
            if (parts && parts.length > 0) {
                setLegoParts(categorizeParts(parts));
            }
            if (bgs && bgs.length > 0) {
                setBackgrounds(bgs);
            }
            if (tpls && tpls.length > 0) {
                setTemplates(tpls);
            }
            if (fbs && fbs.length > 0) {
                setFeedbacks(fbs);
            }
            if (fetchedFrames && fetchedFrames.length > 0) {
                setFrames(fetchedFrames);
            }

            if (storeConfig) {
                localStorage.setItem('app_config', JSON.stringify(storeConfig));

                if (storeConfig.logoUrl) setLogoUrl(storeConfig.logoUrl);
                if (storeConfig.heroImageUrl) setHeroImageUrl(storeConfig.heroImageUrl);
                if (storeConfig.inspireImageUrl) setInspireImageUrl(storeConfig.inspireImageUrl);
                
                if (storeConfig.faviconUrl) {
                    const link = document.querySelector("link[rel~='icon']");
                    if (link instanceof HTMLLinkElement) {
                        link.href = storeConfig.faviconUrl;
                    } else {
                        const newLink = document.createElement('link');
                        newLink.rel = 'icon';
                        newLink.href = storeConfig.faviconUrl;
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
    // Trigger animation callback
    triggerCartShake();
    if (openCart) {
        // Wait slightly for animation to land before opening cart if desired
        // But for better UX with micro-interaction, usually we don't auto-open
        // if we show the flying animation. 
        // We will keep openCart logic but maybe add delay?
        // Actually, if micro interaction is present, usually we DON'T open the cart automatically
        // to let the user see the fly effect. 
        // Let's modify behavior: if animation triggers, we might NOT want to open cart immediately.
        // However, the prop says "openCart". Let's respect it for now.
        setTimeout(() => setIsCartOpen(true), 800); 
    }
  };

  const triggerCartShake = () => {
      setIsCartShaking(true);
      setTimeout(() => setIsCartShaking(false), 500); // Duration of css animation
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

  if (isAppLoading && !logoUrl) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-pink-50 text-luvin-pink">
              <div className="animate-pulse flex flex-col items-center">
                  <svg className="w-16 h-16 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 1.5C12 1.5 12 5.5 15 8.5C18 11.5 22.5 12 22.5 12C22.5 12 18 12.5 15 15.5C12 18.5 12 22.5 12 22.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 22.5C12 22.5 12 18.5 9 15.5C6 12.5 1.5 12 1.5 12C1.5 12 6 11.5 9 8.5C12 5.5 12 1.5 12 1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="font-heading text-2xl tracking-wider">The Luvin</span>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
         {currentPage !== 'admin' && (
             <Header 
                navigateTo={navigateTo} 
                cartCount={cartItems.length} 
                onCartClick={() => setIsCartOpen(true)} 
                logoUrl={logoUrl} 
                isCartShaking={isCartShaking}
             />
        )}
        
        <main className="flex-grow">
            {currentPage === 'home' && <HomePage navigateTo={navigateTo} heroImage={heroImageUrl} inspireImage={inspireImageUrl} feedbacks={feedbacks} templates={templates} />}
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
                    logoUrl={logoUrl}
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

        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} />}

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
