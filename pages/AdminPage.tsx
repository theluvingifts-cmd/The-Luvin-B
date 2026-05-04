
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
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
import { AdminCollaborators } from '../components/admin/AdminCollaborators';
import { Logo } from '../components/shared/Logo';

type MainTab = 'dashboard' | 'orders' | 'products' | 'config' | 'marketing' | 'customers' | 'design' | 'collaborators';

interface AdminPageProps {
    showToast?: (message: string, type: 'success' | 'error') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ showToast }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);

    const [orders, setOrders] = useState<Order[]>([]);
    const isInitialLoadRef = React.useRef(true);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]);
    const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
    const [feedbacks, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [frames, setFrames] = useState<FrameOption[]>([]);
    const [storeConfig, setStoreConfig] = useState<StoreConfig>({});

    // Hàm chuyển tab tập trung
    const handleTabChange = (tab: MainTab) => {
        setActiveTab(tab);
        navigate(`/admin/${tab}`);
    };

    // Sync activeTab với URL khi load trang hoặc nhấn Back
    useEffect(() => {
        const parts = location.pathname.split('/');
        if (parts[1] === 'admin' && parts[2]) {
            setActiveTab(parts[2] as MainTab);
        } else if (parts[1] === 'admin' && !parts[2]) {
            setActiveTab('dashboard');
        }
    }, [location]);

    useEffect(() => {
        let unsubscribeOrders: (() => void) | null = null;

        const init = async () => {
            const config = await getStoreConfig();
            if (config) {
                setStoreConfig(config);
                setIsConfigLoaded(true);
            }
            
            const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
                setIsAuthChecking(false);
                if (user) {
                    setCurrentUser(user);
                    fetchInitialData();
                    
                    // Cleanup previous listener if any
                    if (unsubscribeOrders) {
                        unsubscribeOrders();
                        unsubscribeOrders = null;
                    }

                    // Listen to orders real-time - Remove lookback filter by default to restore visibility of all history
                    const ordersCollection = collection(db, 'orders');
                    const ordersQuery = query(ordersCollection, orderBy('createdAt', 'desc'));

                    isInitialLoadRef.current = true; // Reset flag cho listener mới
                    unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
                        const ordersData: Order[] = [];
                        snapshot.forEach((doc) => {
                            ordersData.push(doc.data() as Order);
                        });
                        
                        // Tự động load orders khi có đơn mới
                        const hasNewAdded = snapshot.docChanges().some(change => change.type === 'added');
                        if (hasNewAdded && !isInitialLoadRef.current) {
                            handleTabChange('orders');
                            if (showToast) showToast("🔔 CÓ ĐƠN HÀNG MỚI!", 'success');
                            // Sound notification
                            try {
                                const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3');
                                audio.volume = 0.5;
                                audio.play().catch(() => {});
                            } catch (e) {}
                        }

                        setOrders(ordersData);
                        isInitialLoadRef.current = false;
                    }, (error) => {
                        console.error("Firestore onSnapshot Error:", error);
                        // Case: Missing index or permissions
                        if (error.code === 'failed-precondition') {
                            if (showToast) showToast("Đang khởi tạo chỉ mục database, vui lòng đợi 1 phút...", 'error');
                        } else if (showToast) {
                            showToast(`Lỗi đồng bộ đơn hàng: ${error.message}`, 'error');
                        }
                    });
                } else {
                    setCurrentUser(null);
                    if (unsubscribeOrders) {
                        unsubscribeOrders();
                        unsubscribeOrders = null;
                    }
                }
            });

            return () => {
                unsubscribeAuth();
                if (unsubscribeOrders) unsubscribeOrders();
            };
        };

        const cleanup = init();
        return () => {
             cleanup.then(fn => fn && fn());
        };
    }, []);

    const fetchInitialData = async () => {
        const [p, b, t, fb, fr] = await Promise.all([
            getAllParts(), getAllBackgrounds(), getAllTemplates(), getAllFeedbacks(), getAllFrames()
        ]);
        setProducts(p); setBackgrounds(b); setTemplates(t); setFeedbackItems(fb); setFrames(fr);
    };

    const handleLogout = async () => { await signOut(auth); };

    // DETERMINATION ROLE CẢI TIẾN: Tránh redirect nhầm khi chưa load xong config
    const role: StaffRole | null = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        
        // 1. Super Admin Hardcode
        const adminEmails = ['jinbduong@gmail.com', 'theluvin.gifts@gmail.com', 'theluvingifts@gmail.com'];
        if (adminEmails.includes(currentUser.email) || currentUser.email.includes('admin')) {
            return 'admin';
        }

        // 2. Check Staff List từ database
        if (storeConfig.staff && storeConfig.staff.length > 0) {
            const staffMember = storeConfig.staff.find(s => s.email === currentUser.email);
            if (staffMember) return staffMember.role;
        }

        // Nếu đã load xong config mà vẫn không thấy trong list -> Mặc định là warehouse
        return isConfigLoaded ? 'warehouse' : null;
    }, [currentUser, storeConfig, isConfigLoaded]);

    // Redirect duy nhất cho nhân viên kho (chỉ được xem Đơn hàng)
    useEffect(() => {
        if (role === 'warehouse') {
            const restrictedTabs = ['dashboard', 'products', 'config', 'marketing', 'customers', 'design'];
            if (restrictedTabs.includes(activeTab)) {
                handleTabChange('orders');
            }
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
                            <Logo url={storeConfig.logoUrl} className="h-8" textClassName="text-lg" onClick={() => handleTabChange('dashboard')} />
                            <nav className="hidden md:flex gap-1">
                                 {role === 'admin' && <button onClick={() => handleTabChange('dashboard')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Dashboard</button>}
                                <button onClick={() => handleTabChange('orders')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Đơn hàng</button>
                                {role === 'admin' && (
                                    <>
                                        <button onClick={() => handleTabChange('products')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'products' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Sản phẩm</button>
                                        <button onClick={() => handleTabChange('customers')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'customers' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Khách hàng</button>
                                        <button onClick={() => handleTabChange('marketing')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'marketing' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Marketing</button>
                                        <button onClick={() => handleTabChange('collaborators')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'collaborators' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Cộng tác viên</button>
                                        <button onClick={() => handleTabChange('design')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'design' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Studio Design</button>
                                        <button onClick={() => handleTabChange('config')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>Cấu hình</button>
                                    </>
                                )}
                            </nav>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="hidden lg:flex flex-col items-end mr-2">
                                <span className="text-[9px] text-gray-400 font-mono leading-none">{currentUser.uid}</span>
                                <span className="text-[10px] text-gray-500 font-bold leading-none">{currentUser.email}</span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{role === 'admin' ? 'Admin' : 'Staff'}</span>
                            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-2 hover:bg-gray-100 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg></button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation - Cố định lỗi sự kiện onClick */}
                <div className="md:hidden border-t border-gray-100 overflow-x-auto no-scrollbar bg-white">
                    <nav className="flex px-4 gap-4 min-w-max">
                         {role === 'admin' && (
                            <button 
                                onClick={() => handleTabChange('dashboard')} 
                                className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}
                            >
                                Dashboard
                            </button>
                         )}
                        <button 
                            onClick={() => handleTabChange('orders')} 
                            className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'orders' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}
                        >
                            Đơn hàng
                        </button>
                        {role === 'admin' && (
                            <>
                                <button onClick={() => handleTabChange('products')} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'products' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Sản phẩm</button>
                                <button onClick={() => handleTabChange('customers')} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'customers' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Khách hàng</button>
                                <button onClick={() => handleTabChange('marketing')} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'marketing' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Marketing</button>
                                <button onClick={() => handleTabChange('collaborators')} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'collaborators' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>CTV</button>
                                <button onClick={() => handleTabChange('design')} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'design' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Design</button>
                                <button onClick={() => handleTabChange('config')} className={`py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'config' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Cấu hình</button>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto py-4 sm:py-8 px-2 sm:px-6">
                {activeTab === 'dashboard' && role === 'admin' && <AdminDashboard orders={orders} products={products} frames={frames} />}
                {activeTab === 'orders' && <AdminOrders orders={orders} setOrders={setOrders} products={products} frames={frames} backgrounds={backgrounds} templates={templates} currentUser={currentUser} role={role} onRefreshProducts={async () => setProducts(await getAllParts())} />}
                {activeTab === 'products' && role === 'admin' && <AdminProducts products={products} frames={frames} backgrounds={backgrounds} templates={templates} onRefreshProducts={async () => setProducts(await getAllParts())} onRefreshFrames={async () => setFrames(await getAllFrames())} onRefreshBackgrounds={async () => setBackgrounds(await getAllBackgrounds())} onRefreshTemplates={async () => setTemplates(await getAllTemplates())} showToast={showToast} />}
                {activeTab === 'config' && role === 'admin' && <AdminConfig storeConfig={storeConfig} setStoreConfig={setStoreConfig} feedbacks={feedbacks} onRefreshFeedbacks={async () => setFeedbackItems(await getAllFeedbacks())} />}
                {activeTab === 'marketing' && role === 'admin' && <AdminVouchers />}
                {activeTab === 'customers' && role === 'admin' && <AdminCustomers orders={orders} />}
                {activeTab === 'collaborators' && role === 'admin' && <AdminCollaborators orders={orders} />}
                {activeTab === 'design' && role === 'admin' && <AdminDesign showToast={showToast} />}
            </main>
        </div>
    );
};

export default AdminPage;
