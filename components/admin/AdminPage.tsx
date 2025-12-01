
import React, { useState, useEffect, useMemo } from 'react';
import { getAllOrders } from '../../services/orderService';
import { getAllParts } from '../../services/productService';
import { getAllBackgrounds } from '../../services/backgroundService';
import { getAllTemplates } from '../../services/templateService';
import { getAllFeedbacks } from '../../services/feedbackService';
import { getAllFrames } from '../../services/frameService';
import { getStoreConfig, StoreConfig } from '../../services/configService';
import { auth } from '../../config/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import type { Order, LegoPart, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption, StaffRole } from '../../types';

import { AdminLogin } from '../admin/AdminLogin';
import { AdminDashboard } from '../admin/AdminDashboard';
import { AdminOrders } from '../admin/AdminOrders';
import { AdminProducts } from '../admin/AdminProducts';
import { AdminConfig } from '../admin/AdminConfig';

type MainTab = 'dashboard' | 'orders' | 'products' | 'config';

const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [activeTab, setActiveTab] = useState<MainTab>('dashboard');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]);
    const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [frames, setFrames] = useState<FrameOption[]>([]);
    const [storeConfig, setStoreConfig] = useState<StoreConfig>({});

    useEffect(() => {
        // Fetch config immediately to determine roles
        const init = async () => {
            const config = await getStoreConfig();
            if (config) setStoreConfig(config);
            
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                setIsAuthChecking(false);
                if (user) {
                    setCurrentUser(user);
                    fetchData();
                } else {
                    setCurrentUser(null);
                }
            });
            return unsubscribe;
        };
        init();
    }, []);

    const fetchData = async () => {
        const [o, p, b, t, fb, fr] = await Promise.all([
            getAllOrders(), getAllParts(), getAllBackgrounds(), getAllTemplates(), getAllFeedbacks(), getAllFrames()
        ]);
        setOrders(o); setProducts(p); setBackgrounds(b); setTemplates(t); setFeedbacks(fb); setFrames(fr);
    };

    const handleLogout = async () => { await signOut(auth); };

    // DYNAMIC ROLE DETERMINATION
    const role: StaffRole | null = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        
        // 1. Super Admin Hardcode (Fallback)
        const SUPER_ADMINS = ['jinbduong@gmail.com']; 
        if (SUPER_ADMINS.includes(currentUser.email)) {
            return 'admin';
        }

        // 2. Check Dynamic List from Config
        if (storeConfig.staff) {
            const staffMember = storeConfig.staff.find(s => s.email === currentUser.email);
            if (staffMember) {
                return staffMember.role;
            }
        }

        return null; // Not authorized
    }, [currentUser, storeConfig]);

    const canViewDashboard = role === 'admin';
    const canManageProducts = role === 'admin';
    const canManageConfig = role === 'admin';

    // Redirect warehouse staff to orders tab if they land on dashboard
    useEffect(() => {
        if (role === 'warehouse' && (activeTab === 'dashboard' || activeTab === 'products' || activeTab === 'config')) {
            setActiveTab('orders');
        }
    }, [role, activeTab]);

    if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;
    
    // If logged in but no role assigned -> Access Denied
    if (currentUser && !role) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
                <div className="text-red-600 text-5xl">⛔</div>
                <h2 className="text-xl font-bold text-gray-800">Truy cập bị từ chối</h2>
                <p className="text-gray-600">Tài khoản {currentUser.email} chưa được cấp quyền truy cập Admin.</p>
                <button onClick={handleLogout} className="text-blue-600 hover:underline font-bold">Đăng xuất</button>
            </div>
        );
    }

    if (!currentUser) return <AdminLogin />;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
                    <div className="h-14 sm:h-16 flex justify-between items-center">
                        <div className="flex items-center gap-4 lg:gap-8">
                            <div className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap flex items-center gap-2">
                                <span>The Luvin</span>
                                <span className="font-normal text-gray-400 text-xs sm:text-sm bg-gray-100 px-2 py-0.5 rounded-full">Quản lý</span>
                            </div>
                            <nav className="hidden md:flex gap-6">
                                 {canViewDashboard && <button onClick={() => setActiveTab('dashboard')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Dashboard</button>}
                                <button onClick={() => setActiveTab('orders')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'orders' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Đơn hàng</button>
                                {canManageProducts && <button onClick={() => setActiveTab('products')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'products' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Sản phẩm</button>}
                                {canManageConfig && <button onClick={() => setActiveTab('config')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'config' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Cấu hình</button>}
                            </nav>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="flex flex-col items-end leading-tight">
                                <span className="text-xs text-gray-500 font-medium hidden sm:block">{currentUser.email}</span>
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {role === 'admin' ? 'Admin' : 'Staff'}
                                </span>
                            </div>
                            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-2 hover:bg-gray-100 rounded-full transition-colors" title="Đăng xuất">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                {/* Mobile Navigation */}
                <div className="md:hidden border-t border-gray-100 overflow-x-auto no-scrollbar bg-white">
                    <nav className="flex px-4 gap-4 min-w-max">
                         {canViewDashboard && (
                            <button 
                                onClick={() => setActiveTab('dashboard')} 
                                className={`py-3 px-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}
                            >
                                Dashboard
                            </button>
                         )}
                        <button 
                            onClick={() => setActiveTab('orders')} 
                            className={`py-3 px-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'orders' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}
                        >
                            Đơn hàng
                        </button>
                        {canManageProducts && (
                            <button 
                                onClick={() => setActiveTab('products')} 
                                className={`py-3 px-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'products' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}
                            >
                                Sản phẩm
                            </button>
                        )}
                        {canManageConfig && (
                            <button 
                                onClick={() => setActiveTab('config')} 
                                className={`py-3 px-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'config' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}
                            >
                                Cấu hình
                            </button>
                        )}
                    </nav>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto py-4 sm:py-8 px-2 sm:px-6">
                {activeTab === 'dashboard' && canViewDashboard && <AdminDashboard orders={orders} products={products} frames={frames} />}
                {activeTab === 'orders' && <AdminOrders orders={orders} setOrders={setOrders} products={products} frames={frames} currentUser={currentUser} role={role} onRefreshProducts={async () => setProducts(await getAllParts())} />}
                {activeTab === 'products' && canManageProducts && <AdminProducts products={products} frames={frames} backgrounds={backgrounds} onRefreshProducts={async () => setProducts(await getAllParts())} onRefreshFrames={async () => setFrames(await getAllFrames())} onRefreshBackgrounds={async () => setBackgrounds(await getAllBackgrounds())} />}
                {activeTab === 'config' && canManageConfig && <AdminConfig storeConfig={storeConfig} setStoreConfig={setStoreConfig} templates={templates} feedbacks={feedbacks} onRefreshTemplates={async () => setTemplates(await getAllTemplates())} onRefreshFeedbacks={async () => setFeedbacks(await getAllFeedbacks())} />}
            </main>
        </div>
    );
};

export default AdminPage;
