
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { getAllParts } from '../services/productService';
import { getAllBackgrounds } from '../services/backgroundService';
import { getAllTemplates } from '../services/templateService';
import { getAllFeedbacks } from '../services/feedbackService';
import { getAllFrames } from '../services/frameService';
import { getStoreConfig, StoreConfig } from '../services/configService';
import type { Order, LegoPart, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption, StaffRole } from '../types';

import { AdminLogin } from '../components/admin/AdminLogin';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { AdminOrders } from '../components/admin/AdminOrders';
import { AdminProducts } from '../components/admin/AdminProducts';
import { AdminConfig } from '../components/admin/AdminConfig';
import { AdminVouchers } from '../components/admin/AdminVouchers';
import { AdminCustomers } from '../components/admin/AdminCustomers';
import { AdminDesign } from '../components/admin/AdminDesign';
import { Logo } from '../components/shared/Logo';

type MainTab = 'dashboard' | 'orders' | 'products' | 'config' | 'marketing' | 'customers' | 'design';

const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [activeTab, setActiveTab] = useState<MainTab>('dashboard');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]);
    const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
    const [feedbacks, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [frames, setFrames] = useState<FrameOption[]>([]);
    const [storeConfig, setStoreConfig] = useState<StoreConfig>({});

    // Sync activeTab with URL Hash
    const parseAdminHash = () => {
        const hash = window.location.hash.replace(/^#\/?/, '');
        const parts = hash.split('/');
        if (parts[0] === 'admin' && parts[1]) {
            setActiveTab(parts[1] as MainTab);
        }
    };

    useEffect(() => {
        parseAdminHash();
        window.addEventListener('hashchange', parseAdminHash);
        return () => window.removeEventListener('hashchange', parseAdminHash);
    }, []);

    const handleTabChange = (tab: MainTab) => {
        setActiveTab(tab);
        window.location.hash = `#/admin/${tab}`;
    };

    useEffect(() => {
        const init = async () => {
            const config = await getStoreConfig();
            if (config) setStoreConfig(config);
            
            const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
                setIsAuthChecking(false);
                if (user) {
                    setCurrentUser(user);
                    fetchInitialData();
                    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
                    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
                        const ordersData: Order[] = [];
                        snapshot.forEach((doc) => {
                            ordersData.push(doc.data() as Order);
                        });
                        setOrders(ordersData);
                    });
                    return () => unsubscribeOrders();
                } else {
                    setCurrentUser(null);
                }
            });
            return unsubscribeAuth;
        };
        init();
    }, []);

    const fetchInitialData = async () => {
        const [p, b, t, fb, fr] = await Promise.all([
            getAllParts(), getAllBackgrounds(), getAllTemplates(), getAllFeedbacks(), getAllFrames()
        ]);
        setProducts(p); setBackgrounds(b); setTemplates(t); setFeedbackItems(fb); setFrames(fr);
    };

    const handleLogout = async () => { await signOut(auth); };

    const role: StaffRole | null = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        if (currentUser.email === 'jinbduong@gmail.com' || currentUser.email.includes('admin')) return 'admin';
        if (storeConfig.staff) {
            const staffMember = storeConfig.staff.find(s => s.email === currentUser.email);
            if (staffMember) return staffMember.role;
        }
        return 'warehouse';
    }, [currentUser, storeConfig]);

    useEffect(() => {
        if (role === 'warehouse' && ['dashboard', 'products', 'config', 'marketing', 'customers', 'design'].includes(activeTab)) {
            handleTabChange('orders');
        }
    }, [role, activeTab]);

    if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;
    if (!currentUser) return <AdminLogin />;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
                    <div className="h-14 sm:h-16 flex justify-between items-center">
                        <div className="flex items-center gap-4 lg:gap-8">
                            <Logo url={storeConfig.logoUrl} className="h-8" textClassName="text-lg" />
                            <nav className="hidden md:flex gap-1">
                                 {role === 'admin' && <button onClick={() => handleTabChange('dashboard')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Dashboard</button>}
                                <button onClick={() => handleTabChange('orders')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Đơn hàng</button>
                                {role === 'admin' && (
                                    <>
                                        <button onClick={() => handleTabChange('products')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'products' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Sản phẩm</button>
                                        <button onClick={() => handleTabChange('customers')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'customers' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Khách hàng</button>
                                        <button onClick={() => handleTabChange('marketing')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'marketing' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Marketing</button>
                                        <button onClick={() => handleTabChange('design')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'design' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Studio Design</button>
                                        <button onClick={() => handleTabChange('config')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Cấu hình</button>
                                    </>
                                )}
                            </nav>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{role === 'admin' ? 'Admin' : 'Staff'}</span>
                            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-2 hover:bg-gray-100 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg></button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto py-4 sm:py-8 px-2 sm:px-6">
                {activeTab === 'dashboard' && role === 'admin' && <AdminDashboard orders={orders} products={products} frames={frames} />}
                {activeTab === 'orders' && <AdminOrders orders={orders} setOrders={setOrders} products={products} frames={frames} currentUser={currentUser} role={role} onRefreshProducts={async () => setProducts(await getAllParts())} />}
                {activeTab === 'products' && role === 'admin' && <AdminProducts products={products} frames={frames} backgrounds={backgrounds} templates={templates} onRefreshProducts={async () => setProducts(await getAllParts())} onRefreshFrames={async () => setFrames(await getAllFrames())} onRefreshBackgrounds={async () => setBackgrounds(await getAllBackgrounds())} onRefreshTemplates={async () => setTemplates(await getAllTemplates())} />}
                {activeTab === 'config' && role === 'admin' && <AdminConfig storeConfig={storeConfig} setStoreConfig={setStoreConfig} feedbacks={feedbacks} onRefreshFeedbacks={async () => setFeedbackItems(await getAllFeedbacks())} />}
                {activeTab === 'marketing' && role === 'admin' && <AdminVouchers />}
                {activeTab === 'customers' && role === 'admin' && <AdminCustomers orders={orders} />}
                {activeTab === 'design' && role === 'admin' && <AdminDesign />}
            </main>
        </div>
    );
};

export default AdminPage;
