
import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import type { Page, FrameConfig, LegoPart, Order, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption, CustomFont } from './types';
import { 
    LEGO_PARTS, 
    INITIAL_FRAME_CONFIG, 
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
import { db } from './config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

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
import { categorizeParts } from './utils/helpers';

// Helper: Map URL path to Page type
const getPageFromPath = (path: string): Page => {
    switch (path) {
        case '/': return 'home';
        case '/thiet-ke': return 'builder';
        case '/bo-suu-tap': return 'collection';
        case '/tra-cuu': return 'order-lookup';
        case '/gio-hang': return 'cart';
        case '/thanh-toan': return 'checkout';
        case '/doanh-nghiep': return 'business';
        case '/ve-chung-toi': return 'about';
        case '/bao-hanh': return 'warranty';
        case '/admin': return 'admin';
        default: return 'home';
    }
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(() => getPageFromPath(window.location.pathname));
  const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
  const [builderInitialStep, setBuilderInitialStep] = useState(1);
  const [cartItems, setCartItems] = useState<FrameConfig[]>(() => {
      try {
          const savedCart = localStorage.getItem('shopping_cart');
          return savedCart ? JSON.parse(savedCart) : [];
      } catch (error) { return []; }
  });

  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() => {
      try {
          const savedConfig = localStorage.getItem('store_config');
          return savedConfig ? JSON.parse(savedConfig) : {};
      } catch (e) { return {}; }
  });

  const [legoParts, setLegoParts] = useState(LEGO_PARTS);
  const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]); 
  const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [frames, setFrames] = useState<FrameOption[]>([]); 

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [lastOrderAction, setLastOrderAction] = useState<'create' | 'update'>('create');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null); 
  const [isCartShaking, setIsCartShaking] = useState(false);

  // ROUTING LOGIC: Điều hướng chuyên nghiệp
  const navigateTo = useCallback((page: Page, params?: Record<string, string>) => {
    let path = '/';
    switch (page) {
        case 'home': path = '/'; break;
        case 'builder': path = '/thiet-ke'; break;
        case 'collection': path = '/bo-suu-tap'; break;
        case 'order-lookup': path = '/tra-cuu'; break;
        case 'cart': path = '/gio-hang'; break;
        case 'checkout': path = '/thanh-toan'; break;
        case 'business': path = '/doanh-nghiep'; break;
        case 'about': path = '/ve-chung-toi'; break;
        case 'warranty': path = '/bao-hanh'; break;
        case 'admin': path = '/admin'; break;
        case 'order-confirmation': path = '/xac-nhan'; break;
    }

    if (params) {
        const query = new URLSearchParams(params).toString();
        path += `?${query}`;
    }

    if (page === 'builder') setBuilderInitialStep(1);

    window.history.pushState({}, '', path);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Lắng nghe nút BACK của trình duyệt
  useEffect(() => {
    const handlePopState = () => {
        setCurrentPage(getPageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // DEEP LINKING: Tự động tải mẫu từ URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mauId = searchParams.get('mau');
    
    if (mauId && templates.length > 0) {
        const template = templates.find(t => t.id === mauId);
        if (template) {
            setConfig({ ...template.config, templateId: template.id });
            setBuilderInitialStep(3);
            setCurrentPage('builder');
        }
    }
  }, [templates]);

  useEffect(() => {
      const fetchData = async () => {
          try {
            const [parts, bgs, fetchedConfig, tpls, fbs, fetchedFrames] = await Promise.all([
                getAllParts(), getAllBackgrounds(), getStoreConfig(),
                getAllTemplates(), getAllFeedbacks(), getAllFrames()
            ]);
            if (parts?.length) setLegoParts(categorizeParts(parts));
            if (bgs?.length) setBackgrounds(bgs);
            if (tpls?.length) setTemplates(tpls);
            // Fix error: setFeedbackItems -> setFeedbacks
            if (fbs?.length) setFeedbacks(fbs);
            if (fetchedFrames?.length) setFrames(fetchedFrames);
            if (fetchedConfig) setStoreConfig(fetchedConfig);
          } catch (error) { console.error("Initial fetch error:", error); }
      };
      fetchData();
  }, []);

  const allParts = useMemo(() => (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  const handleCustomizeTemplate = useCallback((template: CollectionTemplate) => {
      setConfig({ ...template.config, templateId: template.id });
      setBuilderInitialStep(3); 
      navigateTo('builder', { mau: template.id });
  }, [navigateTo]);

  const handleAddToCart = useCallback((newConfig: FrameConfig, openCart = true) => {
    setCartItems(prev => [...prev, { ...newConfig, quantity: 1 }]);
    setIsCartShaking(true);
    setTimeout(() => setIsCartShaking(false), 500); 
    if (openCart) setTimeout(() => setIsCartOpen(true), 800); 
  }, []);

  const handleUpdateCartItem = useCallback((updatedConfig: FrameConfig) => {
      if (editingCartIndex !== null) {
          setCartItems(prev => prev.map((item, i) => i === editingCartIndex ? { ...updatedConfig, quantity: item.quantity } : item)); 
          setEditingCartIndex(null);
          setConfig(INITIAL_FRAME_CONFIG); 
          navigateTo('cart');
      }
  }, [editingCartIndex, navigateTo]);

  const handleEditCartItem = useCallback((index: number) => {
      setConfig(cartItems[index]);
      setEditingCartIndex(index);
      setIsCartOpen(false);
      setBuilderInitialStep(4); 
      navigateTo('builder');
  }, [cartItems, navigateTo]);

  const handleRemoveCartItem = useCallback((index: number) => setCartItems(prev => prev.filter((_, i) => i !== index)), []);

  const handleUpdateCartQuantity = useCallback((index: number, newQuantity: number) => {
      if (newQuantity < 1) return;
      setCartItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item));
  }, []);

  const handlePlaceOrder = async (orderData: Omit<Order, 'status' | 'createdAt'>) => {
    setLastOrderAction(editingOrder ? 'update' : 'create');
    const res = await createOrder(orderData);
    if (res.success && res.data) {
        setCurrentOrder(res.data);
        setCartItems([]); 
        navigateTo('order-confirmation');
        sendOrderTelegram(res.data, storeConfig); 
    }
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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
                    config={config} setConfig={setConfig} navigateTo={navigateTo} onAddToCart={handleAddToCart} 
                    onUpdateCart={handleUpdateCartItem} showToast={showToast} legoParts={legoParts}
                    backgrounds={backgrounds} frames={frames} editingCartIndex={editingCartIndex} 
                    onCancelEdit={() => { setEditingCartIndex(null); navigateTo('cart'); }} onZoomImage={setZoomedImageUrl} 
                    logoUrl={storeConfig.logoUrl} initialStep={builderInitialStep} isEditingOrder={!!editingOrder} 
                    uploadedFonts={storeConfig.uploadedFonts || []}
                />
            )}
            {currentPage === 'collection' && <CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} />}
            {currentPage === 'cart' && <CartPage cartItems={cartItems} onRemoveItem={handleRemoveCartItem} onEditItem={handleEditCartItem} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={handleUpdateCartQuantity} onZoomImage={setZoomedImageUrl} isEditingOrder={!!editingOrder} />}
            {currentPage === 'checkout' && <CheckoutPage cartItems={cartItems} allParts={allParts} onPlaceOrder={handlePlaceOrder} onZoomImage={setZoomedImageUrl} initialOrder={editingOrder} />}
            {currentPage === 'order-confirmation' && <OrderConfirmationPage order={currentOrder} navigateTo={navigateTo} onZoomImage={setZoomedImageUrl} actionType={lastOrderAction} />}
            {/* Fix error: setPathname -> navigateTo('cart') */}
            {currentPage === 'order-lookup' && <OrderLookupPage onZoomImage={setZoomedImageUrl} onEditOrder={(o) => { setEditingOrder(o); navigateTo('cart'); }} />}
            {currentPage === 'admin' && <AdminPage />}
            {currentPage === 'about' && <AboutPage config={storeConfig} />}
            {currentPage === 'warranty' && <WarrantyPage config={storeConfig} />}
            {currentPage === 'business' && <BusinessPage config={storeConfig} legoParts={legoParts} />}
        </main>
        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} config={storeConfig} />}
        <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cartItems={cartItems} onRemoveItem={handleRemoveCartItem} onEditItem={handleEditCartItem} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={handleUpdateCartQuantity} onZoomImage={setZoomedImageUrl} />
        {zoomedImageUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImageUrl(null)}>
                <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
            </div>
        )}
        {toast && <div className={`fixed top-24 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.message}</div>}
    </div>
  );
};

export default App;
