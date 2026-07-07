import React, { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
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
import { getAllTemplates, updateTemplate } from './services/templateService'; 
import { getAllFeedbacks } from './services/feedbackService'; 
import { getAllFrames } from './services/frameService'; 
import { sendOrderEmail } from './services/emailService'; 
import { sendOrderTelegram } from './services/telegramService'; 
import { slugify } from './utils/helpers';
import { db } from './config/firebase';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';

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
import { CharacterCatalogPage } from './pages/CharacterCatalogPage';
import CollaboratorPage from './pages/CollaboratorPage';
import { categorizeParts, safeJsonStringify } from './utils/helpers';

declare var confetti: any;

const CACHE_KEY_DESIGN = 'active_design_draft';

const loadUploadedFonts = (fonts: CustomFont[]) => {
    if (!fonts || fonts.length === 0) return;
    
    const styleId = 'uploaded-custom-fonts-global';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    
    let css = '';
    fonts.forEach(font => {
        // Chuẩn hóa tên font: Loại bỏ ký tự lạ để khớp với CSS selector
        const safeName = font.name.replace(/[^a-zA-Z0-9\s-]/g, '');
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
    
    const shareImage = config.seoImageUrl || config.logoUrl || "";
    document.getElementById('og-image')?.setAttribute('content', shareImage);
    document.getElementById('twitter-image')?.setAttribute('content', shareImage);
    
    // Update PWA icons dynamically if possible
    const iconToUse = config.appIconUrl || config.logoUrl;
    if (iconToUse) {
        const appleTouchIcon = (document.getElementById('apple-touch-icon') || document.querySelector('link[rel="apple-touch-icon"]')) as HTMLLinkElement;
        if (appleTouchIcon) appleTouchIcon.href = iconToUse;
    }
    
    if (config.faviconUrl) {
        const faviconLink = document.getElementById('favicon-link') as HTMLLinkElement;
        if (faviconLink) faviconLink.href = config.faviconUrl;
    }
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Referral Tracking & Legacy Redirects
  useEffect(() => {
    // Handle /studio legacy path
    if (location.pathname === '/studio') {
      navigate('/builder/3', { replace: true });
      return;
    }

    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referred_by', ref);
      // Optional: Clean up URL
      const newParams = new URLSearchParams(location.search);
      newParams.delete('ref');
      const newSearch = newParams.toString();
      navigate({
        pathname: location.pathname,
        search: newSearch ? `?${newSearch}` : ''
      }, { replace: true });
    }
  }, [location, navigate]);
  
  // Determine currentPage from location for Header/Footer visibility
  const currentPage = useMemo<Page>(() => {
    const path = location.pathname.split('/')[1] || 'home';
    const validPages: Page[] = ['home', 'builder', 'collection', 'lego-collection', 'gallery-collection', 'feedback', 'order-lookup', 'contact', 'cart', 'checkout', 'order-confirmation', 'admin', 'about', 'warranty', 'business', 'ctv'];
    return validPages.includes(path as Page) ? (path as Page) : 'home';
  }, [location]);
  
  const [config, setConfig] = useState<FrameConfig>(() => {
    try {
        const saved = localStorage.getItem(CACHE_KEY_DESIGN);
        return saved ? JSON.parse(saved) : INITIAL_FRAME_CONFIG;
    } catch (e) {
        return INITIAL_FRAME_CONFIG;
    }
  });

  useEffect(() => {
    localStorage.setItem(CACHE_KEY_DESIGN, safeJsonStringify(config));
  }, [config]);

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
          localStorage.setItem('shopping_cart', safeJsonStringify(cartItems));
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
  const [isLoadingParts, setIsLoadingParts] = useState(true);

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

  const refreshTemplates = async () => {
    try {
        const tpls = await getAllTemplates();
        if (tpls && tpls.length > 0) setTemplates(tpls);
    } catch (error) {
        console.error("Error refreshing templates:", error);
    }
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
                updateMetaTags(fetchedConfig);
                // FIX: Nạp font ngay khi nhận được config từ server
                if (fetchedConfig.uploadedFonts) {
                    loadUploadedFonts(fetchedConfig.uploadedFonts);
                }
            }
            setIsLoadingParts(false);
          } catch (error) {
              console.error("Initial fetch error:", error);
              setIsLoadingParts(false);
          }
      };
    fetchData();
    
    // Config listener
    const unsubscribeConfig = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
        if (docSnap.exists()) {
            const updatedConfig = docSnap.data() as StoreConfig;
            setStoreConfig(updatedConfig);
            try {
                localStorage.setItem('store_config', safeJsonStringify(updatedConfig));
            } catch(e) {}
            updateMetaTags(updatedConfig);
            if (updatedConfig.uploadedFonts) {
                loadUploadedFonts(updatedConfig.uploadedFonts);
            }
        }
    });

    // Templates listener - Cập nhật mẫu mới real-time
    const unsubscribeTemplates = onSnapshot(query(collection(db, 'templates'), orderBy('order', 'asc')), (querySnapshot) => {
        const tpls: CollectionTemplate[] = [];
        querySnapshot.forEach((doc) => {
            tpls.push(doc.data() as CollectionTemplate);
        });
        if (tpls.length > 0) {
            setTemplates(tpls);
            // Cập nhật cache local
            try {
                localStorage.setItem('cached_templates', safeJsonStringify(tpls));
            } catch(e) {}
        }
    }, (error) => {
        console.error("Templates snapshot error:", error);
    });

    // Real-time parts listener
    const unsubscribeParts = onSnapshot(collection(db, 'lego_parts'), (querySnapshot) => {
        const parts: LegoPart[] = [];
        querySnapshot.forEach((doc) => {
            parts.push(doc.data() as LegoPart);
        });
        if (parts.length > 0) {
            setLegoParts(categorizeParts(parts));
        }
    }, (error) => {
        console.error("Parts snapshot error:", error);
    });

    // Real-time frames listener
    const unsubscribeFrames = onSnapshot(collection(db, 'frames'), (querySnapshot) => {
        const framesData: FrameOption[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as FrameOption;
            framesData.push({ ...data, id: doc.id });
        });
        if (framesData.length > 0) {
            framesData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
            setFrames(framesData);
        }
    }, (error) => {
        console.error("Frames snapshot error:", error);
    });

    return () => {
        unsubscribeConfig();
        unsubscribeTemplates();
        unsubscribeParts();
        unsubscribeFrames();
    };
}, []);

  // Migration logic for "Khung bảo tàng" and "Graduation 8" price
  // Clear stale hardcoded price migration logic to rely on database values
  useEffect(() => {
    // Migration logic removed to prevent incorrect hardcoded prices
  }, [templates]);

  const allParts = useMemo(() => {
    const base = (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>);
    const virtualServices: Record<string, LegoPart> = {
        'srv-giftbox': { id: 'srv-giftbox', name: 'Hộp quà cao cấp The Luvin', price: 30000, type: 'accessory', imageUrl: '/src/assets/images/srv_giftbox_1782720591249.jpg', widthCm: 10, heightCm: 10 },
        'srv-light': { id: 'srv-light', name: 'Đèn LED đom đóm lung linh', price: 20000, type: 'accessory', imageUrl: '/src/assets/images/srv_light_1782720604384.jpg', widthCm: 10, heightCm: 10 },
        'srv-flower': { id: 'srv-flower', name: 'Hoa mini trang trí kèm', price: 15000, type: 'accessory', imageUrl: '/src/assets/images/srv_flower_1782720618289.jpg', widthCm: 10, heightCm: 10 },
        'srv-card': { id: 'srv-card', name: 'Thiệp viết tay theo yêu cầu', price: 10000, type: 'accessory', imageUrl: '/src/assets/images/srv_card_1782720631994.jpg', widthCm: 10, heightCm: 10 },
        'srv-polaroid': { id: 'srv-polaroid', name: 'In thêm 1 ảnh Polaroid lẻ', price: 10000, type: 'accessory', imageUrl: '/src/assets/images/srv_polaroid_1782720644820.jpg', widthCm: 10, heightCm: 10 }
    };
    return { ...base, ...virtualServices };
  }, [legoParts]);

  const navigateTo = (page: Page) => {
    if (editingOrder && page !== 'cart' && page !== 'checkout' && page !== 'builder') {
       if (window.confirm("Bạn đang sửa đơn hàng. Rời đi sẽ hủy bỏ các thay đổi?")) {
           setEditingOrder(null);
           setCartItems([]);
       } else return;
    }
    
    if (page === 'home') navigate('/');
    else if (page === 'builder') navigate('/builder/3');
    else if (page === 'lego-collection') navigate('/collection/lego');
    else if (page === 'gallery-collection') navigate('/collection/gallery');
    else navigate(`/${page}`);
    
    window.scrollTo(0, 0);
  };

  const handleCustomizeTemplate = (template: CollectionTemplate) => {
      const newConfig: FrameConfig = { 
          ...template.config, 
          templateId: template.id,
          productLine: template.productLine || 'lego' 
      };
      setConfig(newConfig);
      navigate('/builder/3');
      window.scrollTo(0, 0);
  };

  useEffect(() => {
      // No longer needed with react-router-dom
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
      const item = cartItems[index];
      setConfig(item);
      setEditingCartIndex(index);
      setIsCartOpen(false);

      if (item.templateId) {
          const template = templates.find(t => t.id === item.templateId);
          if (template) {
              const productLine = template.productLine || 'lego';
              const category = slugify(template.category || 'all');
              navigate(`/collection/${productLine}/${category}/${item.templateId}`);
              return;
          }
      }
      navigate('/builder/4');
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
        // Refresh templates to show new purchase counts
        refreshTemplates();
        try {
            const rawSaved = localStorage.getItem('my_orders');
            let saved = rawSaved ? JSON.parse(rawSaved) : [];
            const newEntry = { id: res.data.id, date: Date.now() };
            const updated = [newEntry, ...saved.filter((o: any) => o.id !== res.data.id)].slice(0, 5);
            localStorage.setItem('my_orders', safeJsonStringify(updated));
        } catch (e) {}
        setCartItems([]); 
        navigateTo('order-confirmation');
        sendOrderEmail(res.data);
        sendOrderTelegram(res.data, storeConfig); 
    } else throw new Error(res.error?.message || "Lỗi kết nối cơ sở dữ liệu.");
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
            <Routes>
                <Route path="/" element={<HomePage navigateTo={navigateTo} config={storeConfig} feedbacks={feedbacks} templates={templates} />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="/studio" element={<Navigate to="/builder/3" replace />} />
                <Route path="/builder" element={<Navigate to="/builder/1" replace />} />
                <Route path="/builder/:stepId" element={
                    <BuilderPage 
                        config={config} setConfig={setConfig} navigateTo={navigateTo} onAddToCart={handleAddToCart} 
                        onUpdateCart={handleUpdateCartItem} showToast={showToast} legoParts={legoParts}
                        backgrounds={backgrounds} frames={frames} editingCartIndex={editingCartIndex} 
                        onCancelEdit={handleCancelEdit} onZoomImage={setZoomedImageUrl} logoUrl={storeConfig.logoUrl}
                        isEditingOrder={!!editingOrder} uploadedFonts={storeConfig.uploadedFonts || []}
                        isLoadingParts={isLoadingParts} templates={templates} storeConfig={storeConfig}
                    />
                } />
                <Route path="/collection" element={<Navigate to="/collection/lego" replace />} />
                <Route path="/collection/:productLine" element={<CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} onAddToCart={handleAddToCart} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} isLoadingParts={isLoadingParts} editingCartIndex={editingCartIndex} initialConfig={config} onUpdateCart={handleUpdateCartItem} onCancelEdit={handleCancelEdit} storeConfig={storeConfig} />} />
                <Route path="/collection/:productLine/:category" element={<CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} onAddToCart={handleAddToCart} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} isLoadingParts={isLoadingParts} editingCartIndex={editingCartIndex} initialConfig={config} onUpdateCart={handleUpdateCartItem} onCancelEdit={handleCancelEdit} storeConfig={storeConfig} />} />
                <Route path="/collection/:productLine/:category/:templateId" element={<CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} onAddToCart={handleAddToCart} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} isLoadingParts={isLoadingParts} editingCartIndex={editingCartIndex} initialConfig={config} onUpdateCart={handleUpdateCartItem} onCancelEdit={handleCancelEdit} storeConfig={storeConfig} />} />
                <Route path="/lego-collection" element={<CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} onAddToCart={handleAddToCart} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} isLoadingParts={isLoadingParts} productLine="lego" editingCartIndex={editingCartIndex} initialConfig={config} onUpdateCart={handleUpdateCartItem} onCancelEdit={handleCancelEdit} storeConfig={storeConfig} />} />
                <Route path="/gallery-collection" element={<CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} onAddToCart={handleAddToCart} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} isLoadingParts={isLoadingParts} productLine="gallery" editingCartIndex={editingCartIndex} initialConfig={config} onUpdateCart={handleUpdateCartItem} onCancelEdit={handleCancelEdit} storeConfig={storeConfig} />} />
                <Route path="/cart" element={<CartPage cartItems={cartItems} onRemoveItem={handleRemoveCartItem} onEditItem={handleEditCartItem} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={handleUpdateCartQuantity} onZoomImage={setZoomedImageUrl} isEditingOrder={!!editingOrder} templates={templates} frames={frames} />} />
                <Route path="/checkout" element={<CheckoutPage cartItems={cartItems} allParts={allParts} onPlaceOrder={handlePlaceOrder} onZoomImage={setZoomedImageUrl} initialOrder={editingOrder} templates={templates} frames={frames} />} />
                <Route path="/order-confirmation" element={<OrderConfirmationPage order={currentOrder} navigateTo={navigateTo} onZoomImage={setZoomedImageUrl} actionType={lastOrderAction} />} />
                <Route path="/order-lookup" element={<OrderLookupPage onZoomImage={setZoomedImageUrl} onEditOrder={handleEditOrder} />} />
                <Route path="/admin/*" element={<AdminPage showToast={showToast} />} />
                <Route path="/ctv" element={<CollaboratorPage />} />
                <Route path="/about" element={<AboutPage config={storeConfig} />} />
                <Route path="/warranty" element={<WarrantyPage config={storeConfig} />} />
                <Route path="/business" element={<BusinessPage config={storeConfig} legoParts={legoParts} />} />
                <Route path="/catalog" element={<CharacterCatalogPage />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </main>
        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} config={storeConfig} />}
        <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cartItems={cartItems} onRemoveItem={handleRemoveCartItem} onEditItem={handleEditCartItem} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={handleUpdateCartQuantity} onZoomImage={setZoomedImageUrl} templates={templates} frames={frames} />
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