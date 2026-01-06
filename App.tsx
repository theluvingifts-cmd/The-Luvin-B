
import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import type { Page, FrameConfig, LegoPart, Order, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption, CustomFont } from './types';
import { 
    LEGO_PARTS, 
    INITIAL_FRAME_CONFIG, 
} from './constants';
import { createOrder } from './services/orderService'; 
import { getAllParts } from './services/productService'; 
import { getAllBackgrounds } from './services/backgroundService'; 
import { getStoreConfig, StoreConfig } from './services/configService'; 
import { getAllTemplates } from './services/templateService'; 
import { getAllFeedbacks } from './services/feedbackService'; 
import { getAllFrames } from './services/frameService'; 
import { sendOrderTelegram } from './services/telegramService'; 

import AdminPage from './pages/AdminPage'; 
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartPanel } from './components/CartPanel';
import { HomePage } from './pages/HomePage';
import { BuilderPage } from './pages/BuilderPage';
import { CollectionPage } from './pages/CollectionPage';
import { CatalogPage } from './pages/CatalogPage'; // Trang mới
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { OrderLookupPage } from './pages/OrderLookupPage';
import { AboutPage } from './pages/AboutPage';
import { WarrantyPage } from './pages/WarrantyPage';
import { BusinessPage } from './pages/BusinessPage'; 
import { categorizeParts } from './utils/helpers';

const getPageFromPath = (path: string): Page => {
    switch (path) {
        case '/': return 'home';
        case '/thiet-ke': return 'builder';
        case '/bo-suu-tap': return 'collection';
        case '/catalog': return 'catalog'; // Route mới
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
  const [cartItems, setCartItems] = useState<FrameConfig[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({});
  const [legoParts, setLegoParts] = useState(LEGO_PARTS);
  const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]); 
  const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [frames, setFrames] = useState<FrameOption[]>([]); 
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartShaking, setIsCartShaking] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [lastOrderAction, setLastOrderAction] = useState<'create' | 'update'>('create');

  const navigateTo = useCallback((page: Page, params?: Record<string, string>) => {
    let path = '/';
    switch (page) {
        case 'home': path = '/'; break;
        case 'builder': path = '/thiet-ke'; break;
        case 'collection': path = '/bo-suu-tap'; break;
        case 'catalog': path = '/catalog'; break;
        case 'order-lookup': path = '/tra-cuu'; break;
        case 'cart': path = '/gio-hang'; break;
        case 'checkout': path = '/thanh-toan'; break;
        case 'business': path = '/doanh-nghiep'; break;
        case 'about': path = '/ve-chung-toi'; break;
        case 'warranty': path = '/bao-hanh'; break;
        case 'admin': path = '/admin'; break;
    }
    if (params) {
        const query = new URLSearchParams(params).toString();
        path += `?${query}`;
    }
    window.history.pushState({}, '', path);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePopState = () => setCurrentPage(getPageFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
            if (fbs?.length) setFeedbacks(fbs);
            if (fetchedFrames?.length) setFrames(fetchedFrames);
            if (fetchedConfig) setStoreConfig(fetchedConfig);
          } catch (error) { console.error(error); }
      };
      fetchData();
  }, []);

  const allParts = useMemo(() => (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  const handleCustomizeTemplate = useCallback((template: CollectionTemplate) => {
      setConfig({ ...template.config, templateId: template.id });
      setBuilderInitialStep(3); 
      navigateTo('builder', { mau: template.id });
  }, [navigateTo]);

  return (
    <div className="min-h-screen flex flex-col bg-site-bg text-site-text">
        {currentPage !== 'admin' && (
             <Header 
                navigateTo={navigateTo} cartCount={cartItems.length} onCartClick={() => setIsCartOpen(true)} 
                logoUrl={storeConfig.logoUrl || ''} isCartShaking={isCartShaking} config={storeConfig} currentPage={currentPage}
             />
        )}
        <main className="flex-grow">
            {currentPage === 'home' && <HomePage navigateTo={navigateTo} config={storeConfig} feedbacks={feedbacks} templates={templates} />}
            {currentPage === 'catalog' && <CatalogPage legoParts={legoParts} frames={frames} templates={templates} onCustomize={handleCustomizeTemplate} onZoom={setZoomedImageUrl} />}
            {currentPage === 'builder' && (
                <BuilderPage 
                    config={config} setConfig={setConfig} navigateTo={navigateTo} onAddToCart={(c) => setCartItems(p => [...p, c])} 
                    onUpdateCart={(c) => {}} showToast={() => {}} legoParts={legoParts}
                    backgrounds={backgrounds} frames={frames} editingCartIndex={editingCartIndex} 
                    onCancelEdit={() => {}} onZoomImage={setZoomedImageUrl} 
                    logoUrl={storeConfig.logoUrl} initialStep={builderInitialStep} isEditingOrder={false} 
                    uploadedFonts={storeConfig.uploadedFonts || []}
                />
            )}
            {currentPage === 'collection' && <CollectionPage navigateTo={navigateTo} onCustomize={handleCustomizeTemplate} templates={templates} onZoomImage={setZoomedImageUrl} allParts={allParts} frames={frames} />}
            {currentPage === 'cart' && <CartPage cartItems={cartItems} onRemoveItem={(i) => {}} onEditItem={(i) => {}} allParts={allParts} navigateTo={navigateTo} onUpdateQuantity={() => {}} onZoomImage={setZoomedImageUrl} isEditingOrder={false} />}
            {currentPage === 'order-lookup' && <OrderLookupPage onZoomImage={setZoomedImageUrl} onEditOrder={() => {}} />}
            {currentPage === 'admin' && <AdminPage />}
            {currentPage === 'about' && <AboutPage config={storeConfig} />}
            {currentPage === 'warranty' && <WarrantyPage config={storeConfig} />}
            {currentPage === 'business' && <BusinessPage config={storeConfig} legoParts={legoParts} />}
        </main>
        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} config={storeConfig} />}
        {zoomedImageUrl && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImageUrl(null)}>
                <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
        )}
    </div>
  );
};

export default App;
