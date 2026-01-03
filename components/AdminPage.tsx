
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder, countPartsInOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase, adjustStock, reorderParts } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds, reorderBackgrounds } from '../services/backgroundService';
import { getAllTemplates, addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../services/templateService';
import { getAllFeedbacks, addFeedback, updateFeedback, deleteFeedback, seedFeedbacks } from '../services/feedbackService';
import { getAllFrames, addFrame, updateFrame, deleteFrame, seedFrames } from '../services/frameService'; 
import { uploadToCloudinary } from '../services/uploadService'; 
import { updateStoreConfig, getStoreConfig, StoreConfig } from '../services/configService'; 
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem, PresetBackground, OutfitColor, CollectionTemplate, FeedbackItem, FrameOption } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS, INITIAL_FRAME_CONFIG } from '../constants';

// Import các form chuyên nghiệp
import { BackgroundForm } from './admin/forms/BackgroundForm';

const CHARACTER_BASE_PRICE = 10000;
const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const getStartOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

const getEndOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
};

const getCountdownText = (dateString: string) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(dateString);
    delivery.setHours(0, 0, 0, 0);
    
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return <span className="text-red-600 font-bold text-[10px] block mt-0.5">Trễ {Math.abs(diffDays)} ngày</span>;
    if (diffDays === 0) return <span className="text-orange-600 font-bold text-[10px] block mt-0.5">Hôm nay</span>;
    if (diffDays === 1) return <span className="text-green-600 font-bold text-[10px] block mt-0.5">Ngày mai</span>;
    return <span className="text-blue-600 font-medium text-[10px] block mt-0.5">Còn {diffDays} ngày</span>;
};

type MainTab = 'dashboard' | 'orders' | 'products' | 'backgrounds' | 'templates' | 'feedbacks' | 'frames' | 'config' | 'marketing' | 'customers';

const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true); 
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]);
    const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [frames, setFrames] = useState<FrameOption[]>([]);
    
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
    const [storeConfig, setStoreConfig] = useState<StoreConfig>({});

    const [isEditingBackground, setIsEditingBackground] = useState(false);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthChecking(false);
            if (user) {
                setCurrentUser(user);
                fetchOrders(); fetchProducts(); fetchBackgrounds(); fetchTemplates(); fetchFeedbacks(); fetchConfig(); fetchFrames();
            } else {
                setCurrentUser(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchOrders = async () => { const data = await getAllOrders(); setOrders(data); };
    const fetchProducts = async () => { const data = await getAllParts(); setProducts(data); };
    const fetchBackgrounds = async () => { const data = await getAllBackgrounds(); setBackgrounds(data); };
    const fetchTemplates = async () => { const data = await getAllTemplates(); setTemplates(data); };
    const fetchFeedbacks = async () => { const data = await getAllFeedbacks(); setFeedbacks(data); };
    const fetchFrames = async () => { const data = await getAllFrames(); setFrames(data); };
    const fetchConfig = async () => {
        const cfg = await getStoreConfig();
        if (cfg) setStoreConfig(cfg);
    }

    const handleSaveBackground = async (bg: PresetBackground) => { 
        setLoading(true);
        setIsEditingBackground(false); 
        if (editingBg) await updateBackground(bg.id, bg); 
        else await addBackground(bg); 
        await fetchBackgrounds(); 
        setEditingBg(null); 
        setLoading(false);
    };

    if (!currentUser) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-96 text-center">
                <h1 className="text-2xl font-bold mb-1 text-gray-900">The Luvin Admin</h1>
                <p className="text-gray-500 mb-8 text-sm">Vui lòng đăng nhập</p>
                <form onSubmit={async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, loginPass); } catch (err) { setLoginError('Lỗi đăng nhập'); } }} className="space-y-4 text-left">
                    <input type="email" placeholder="Email" className="w-full p-2 border rounded" value={email} onChange={e => setEmail(e.target.value)} />
                    <input type="password" placeholder="Mật khẩu" className="w-full p-2 border rounded" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                    {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
                    <button type="submit" className="w-full bg-gray-900 text-white font-bold py-2 rounded">Đăng nhập</button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Header đơn giản để minh họa */}
            <div className="bg-white border-b p-4 flex gap-4">
                <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
                <button onClick={() => setActiveTab('products')}>Sản phẩm</button>
            </div>

            <main className="p-8">
                {activeTab === 'products' && (
                    <div>
                        <button onClick={() => { setEditingBg(null); setIsEditingBackground(true); }} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">Thêm Background</button>
                        <div className="grid grid-cols-4 gap-4">
                            {backgrounds.map(bg => (
                                <div key={bg.id} className="border p-4 bg-white rounded">
                                    <p className="font-bold">{bg.name}</p>
                                    <button onClick={() => { setEditingBg(bg); setIsEditingBackground(true); }} className="text-blue-600 underline">Sửa</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
            
            {/* Modal bản mới nhất */}
            {isEditingBackground && (
                <BackgroundForm 
                    initialData={editingBg} 
                    onSave={handleSaveBackground} 
                    onCancel={() => { setIsEditingBackground(false); setEditingBg(null); }} 
                />
            )}
        </div>
    );
};

export default AdminPage;
