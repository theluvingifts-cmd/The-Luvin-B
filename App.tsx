
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
import { ChatWidget } from './components/ChatWidget';

declare var confetti: any;

const CACHE_KEY_DESIGN = 'active_design_draft';

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
    if (!config) return;
    const title = config.seoTitle || "The Luvin - Thương hiệu quà tặng tinh tế";
    document.title = title;
    document.getElementById('og-title')?.setAttribute('content', title);
    document.getElementById('twitter-title')?.setAttribute('content', title);
    const desc = config.seoDescription || "Tạo nên món quà độc bản từ những mảnh ghép LEGO. Lưu giữ kỷ niệm theo cách riêng của bạn, tinh tế và đầy cảm xúc.";
    document.getElementById('meta-description')?.setAttribute('content', desc);
    document.getElementById('og-description')?.setAttribute('content', desc);
    document.getElementById('twitter-description')?.setAttribute('content', desc);
    
    const shareImage = config.seoImageUrl || config.logoUrl || "https://res.cloudinary.com/dbdqd93km/image/upload/v1763705477/ce3r3dzdpp2gn5nv3jdx.png";
    document.getElementById('og-image')?.setAttribute('content', shareImage);
    document.getElementById('twitter-image')?.setAttribute('content', shareImage);
    
    if (config.faviconUrl) {
        const faviconLink = document.getElementById('favicon-link') as HTMLLinkElement;
        if (faviconLink) faviconLink.href = config.faviconUrl;
    }
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  
  const [config, setConfig] = useState<FrameConfig>(() => {
    try {
        const saved = localStorage.getItem(CACHE_KEY_DESIGN);
        return saved ? JSON.parse(saved) : INITIAL_FRAME_CONFIG;
    } catch (e) {
        return INITIAL_FRAME_CONFIG;
    }
  });

  useEffect(() => {
    localStorage.setItem(CACHE_KEY_DESIGN, JSON.stringify(config));
  }, [config]);

  const [builderInitialStep, setBuilderInitialStep] = useState(1);
  const [cartItems, setCartItems] = useState<FrameConfig[]>(() => {
      try {
          const savedCart = localStorage.getItem('shopping_cart');
          return savedCart ? JSON.parse(savedCart) : [];
      } catch (error) {
          return [];
      }
  });

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [lastOrderAction, setLastOrderAction] = useState<'create' | 'update'>('create');

  useEffect(() => {
      try {
          localStorage.setItem('shopping_cart', JSON.stringify(cartItems));
      } catch (error) {
          console.warn("LocalStorage is full, cannot save cart items.");
      }
  }, [cartItems]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null); 
  
  const [legoParts, setLegoParts] = useState(LEGO_PARTS);
  const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]); 
  const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [frames, setFrames] = useState<FrameOption[]>([]); 

  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() => {
      try {
          const savedConfig = localStorage.getItem('store_config');
          return savedConfig ? JSON.parse(savedConfig) : {};
      } catch (e) {
          return {};
      }
  });

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
              root.style.setProperty('--header-bg', sections.header.backgroundColor || 'rgba(255, 255, 255, 0.8)');
              root.style.setProperty('--header-text', sections.header.textColor || '#1f2937');
          }
          if (sections.footer) {
              root.style.setProperty('--footer-bg', sections.footer.backgroundColor || '#ffffff');
              root.style.setProperty('--footer-text', sections.footer.textColor || '#374151');
          }
      }
      
      loadUploadedFonts(uploadedFonts);
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
          } catch (error) {
              console.error("Initial fetch error:", error);
          }
      };
      fetchData();
      const unsubscribe = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
          if (docSnap.exists()) {
              const updatedConfig = docSnap.data() as StoreConfig;
              setStoreConfig(updatedConfig);
              try {
                  localStorage.setItem('store_config', JSON.stringify(updatedConfig));
              } catch(e) {}
              updateMetaTags(updatedConfig);
          }
      });
      return () => unsubscribe();
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
    window.scrollTo(0, 0);
  };

  const handleCustomizeTemplate = (template: CollectionTemplate) => {
      const newConfig = { ...template.config, templateId: template.id };
      setConfig(newConfig);
      setBuilderInitialStep(3); 
      setCurrentPage('builder');
      window.scrollTo(0, 0);
  };

  useEffect(() => {
      const checkHash = () => { if (window.location.hash === '#/admin') setCurrentPage('admin'); };
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

  const handleRemoveCartItem = (index: number) => setCartItems(prev => prev.filter((_, i) => i !== index));

  const handleUpdateCartQuantity = (index: number, newQuantity: number) => {
      if (newQuantity < 1) return;
      setCartItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item));
  };

  const handleEditOrder = (order: Order) => {
      setCartItems(order.items);
      setEditingOrder(order);
      navigateTo('cart');
  };

  const handlePlaceOrder = async (orderData: Omit<Order, 'status' | 'createdAt'>) => {
    if (editingOrder) {
        setLastOrderAction('update');
        const oldParts = countPartsInOrder(editingOrder.items);
        const newParts = countPartsInOrder(orderData.items);
        const stockAdjustments: Record<string, number> = {};
        const allKeys = new Set([...Object.keys(oldParts), ...Object.keys(newParts)]);
        allKeys.forEach(partId => {
            const oldQty = oldParts[partId] || 0;
            const newQty = newParts[partId] || 0;
            const diff = oldQty - newQty; 
            if (diff !== 0) stockAdjustments[partId] = diff;
        });
        if (Object.keys(stockAdjustments).length > 0) await adjustStock(stockAdjustments);
        const success = await updateOrder(editingOrder.id, {
            ...orderData,
            status: orderData.totalPrice !== editingOrder.totalPrice ? 'Chờ thanh toán' : editingOrder.status
        });
        if (success) {
            const updatedOrder = { 
                ...editingOrder, 
                ...orderData,
                status: orderData.totalPrice !== editingOrder.totalPrice ? 'Chờ thanh toán' : editingOrder.status
            };
            setCurrentOrder(updatedOrder);
            setCartItems([]);
            setEditingOrder(null);
            navigateTo('order-confirmation');
            sendOrderTelegram(updatedOrder, storeConfig); 
        } else throw new Error("Không thể cập nhật đơn hàng.");
        return;
    }
    setLastOrderAction('create');
    const res = await createOrder(orderData);
    if (res.success && res.data) {
        setCurrentOrder(res.data);
        try {
            const rawSaved = localStorage.getItem('my_orders');
            let saved = rawSaved ? JSON.parse(rawSaved) : [];
            const newEntry = { id: res.data.id, date: Date.now() };
            const updated = [newEntry, ...saved.filter((o: any) => o.id !== res.data.id)].slice(0, 5);
            localStorage.setItem('my_orders', JSON.stringify(updated));
        } catch (e) {}
        setCartItems([]); 
        navigateTo('order-confirmation');
        sendOrderEmail(res.data);
        sendOrderTelegram(res.data, storeConfig); 
    } else throw new Error("Lỗi kết nối cơ sở dữ liệu.");
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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
            {currentPage === 'builder' && (
                <BuilderPage 
                    config={config} setConfig={setConfig} navigateTo={navigateTo} onAddToCart={handleAddToCart} 
                    onUpdateCart={handleUpdateCartItem} showToast={showToast} legoParts={legoParts}
                    backgrounds={backgrounds} frames={frames} editingCartIndex={editingCartIndex} 
                    onCancelEdit={handleCancelEdit} onZoomImage={setZoomedImageUrl} logoUrl={storeConfig.logoUrl}
                    initialStep={builderInitialStep} isEditingOrder={!!editingOrder} uploadedFonts={storeConfig.uploadedFonts || []}
                />
            )}
            {currentPage === 'collection' && <CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} />}
            {currentPage === 'cart' && <CartPage cartItems={cartItems} onRemoveItem={handleRemoveCartItem} onEditItem={handleEditCartItem} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={handleUpdateCartQuantity} onZoomImage={setZoomedImageUrl} isEditingOrder={!!editingOrder} />}
            {currentPage === 'checkout' && <CheckoutPage cartItems={cartItems} allParts={allParts} onPlaceOrder={handlePlaceOrder} onZoomImage={setZoomedImageUrl} initialOrder={editingOrder} />}
            {currentPage === 'order-confirmation' && <OrderConfirmationPage order={currentOrder} navigateTo={navigateTo} onZoomImage={setZoomedImageUrl} actionType={lastOrderAction} />}
            {currentPage === 'order-lookup' && <OrderLookupPage onZoomImage={setZoomedImageUrl} onEditOrder={handleEditOrder} />}
            {currentPage === 'admin' && <AdminPage />}
            {currentPage === 'about' && <AboutPage config={storeConfig} />}
            {currentPage === 'warranty' && <WarrantyPage config={storeConfig} />}
            {currentPage === 'business' && <BusinessPage config={storeConfig} legoParts={legoParts} />}
        </main>
        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} config={storeConfig} />}
        {currentPage !== 'admin' && <ChatWidget config={storeConfig} />}
        <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cartItems={cartItems} onRemoveItem={handleRemoveCartItem} onEditItem={handleEditCartItem} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={handleUpdateCartQuantity} onZoomImage={setZoomedImageUrl} />
        {zoomedImageUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImageUrl(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg></button>
                <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        )}
        {toast && <div className={`fixed top-24 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transform transition-all duration-300 animate-fade-in-down ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.message}</div>}
    </div>
  );
};

export default App;
