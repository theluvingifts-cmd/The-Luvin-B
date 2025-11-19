
// components/AdminPage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig } from '../types';
import { FRAME_OPTIONS } from '../constants';

// --- HELPER FUNCTIONS ---

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

// --- STATUS CONFIGURATION ---
const STATUS_CONFIG = [
    { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800', icon: '🕒' },
    { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800', icon: '🛡️' }, 
    { label: 'Ưu tiên xuất đơn', color: 'bg-pink-100 text-pink-800', icon: '⚡' },
    { label: 'Đang đóng hàng', color: 'bg-indigo-100 text-indigo-800', icon: '🎁' },
    { label: 'Chờ chuyển hàng', color: 'bg-purple-100 text-purple-800', icon: '✓' }, // Status after packing
    { label: 'Gửi hàng đi', color: 'bg-orange-100 text-orange-800', icon: '🚚' },
    { label: 'Đã giao hàng', color: 'bg-green-100 text-green-800', icon: '✅' },
    { label: 'Huỷ đơn', color: 'bg-red-100 text-red-800', icon: '❌' },
    { label: 'Xoá đơn', color: 'bg-gray-200 text-gray-800', icon: '🗑️', isAction: true }, // Special action
];

// --- COMPONENT: STATUS DROPDOWN ---
const StatusDropdown: React.FC<{ 
    currentStatus: string; 
    onStatusChange: (status: string) => void;
    onDelete?: () => void;
    isAdmin: boolean;
}> = ({ currentStatus, onStatusChange, onDelete, isAdmin }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentConfig = STATUS_CONFIG.find(s => s.label === currentStatus) || STATUS_CONFIG[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm ${currentConfig.color} bg-white border-gray-200 hover:bg-gray-50`}
            >
                {/* Minimal Icon */}
                <span>{currentConfig.icon}</span>
                <span>{currentStatus}</span>
                <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                    <div className="p-1">
                        {STATUS_CONFIG.map((status) => {
                            // Hide 'Delete' from list if not admin or for standard flow
                            if (status.isAction && !isAdmin) return null;

                            return (
                                <button
                                    key={status.label}
                                    onClick={() => {
                                        setIsOpen(false);
                                        if (status.isAction && status.label === 'Xoá đơn' && onDelete) {
                                            onDelete();
                                        } else {
                                            onStatusChange(status.label);
                                        }
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 hover:bg-gray-50 transition-colors ${status.label === currentStatus ? 'bg-blue-50 text-blue-600' : 'text-gray-700'} ${status.isAction ? 'text-red-600 hover:bg-red-50' : ''}`}
                                >
                                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-md text-xs">{status.icon}</span>
                                    {status.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- COMPONENT: FORM SẢN PHẨM (MODAL) ---
const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên sản phẩm</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" placeholder="Nhập tên..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm">
                                <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="hat">Mũ</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá (VNĐ)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">URL Hình ảnh</label>
                            <div className="flex gap-3">
                                <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="flex-grow p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" placeholder="https://..." />
                                {formData.imageUrl && <div className="w-10 h-10 border rounded bg-gray-100 flex-shrink-0 overflow-hidden"><img src={formData.imageUrl} alt="" className="w-full h-full object-contain" /></div>}
                            </div>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng (cm)</label>
                             <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                         <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao (cm)</label>
                             <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">Hủy bỏ</button>
                    <button onClick={() => onSave(formData)} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded transition-colors shadow-sm">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    );
};

// --- ADMIN PAGE ---
const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Mobile menu
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Edit Mode State
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);

    // Role Check
    const role = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        const ADMIN_EMAILS = ['jinbduong@gmail.com']; 
        if (ADMIN_EMAILS.includes(currentUser.email) || currentUser.email.includes('admin')) {
            return 'admin';
        }
        return 'warehouse';
    }, [currentUser]);

    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products'>('dashboard');

    // Time Filters
    const [filterTime, setFilterTime] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');

    // Inputs & Search
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchOrders();
                fetchProducts();
            } else {
                setCurrentUser(null);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
            setAdminDeadlineInput(selectedOrder.adminDeadline || '');
        }
    }, [selectedOrder]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            await signInWithEmailAndPassword(auth, email, loginPass);
        } catch (error: any) {
            setLoginError("Thông tin đăng nhập không chính xác.");
        }
    };

    const handleLogout = async () => { await signOut(auth); };
    const fetchOrders = async () => { const data = await getAllOrders(); setOrders(data); };
    const fetchProducts = async () => { const data = await getAllParts(); setProducts(data); };
    const handleSeedData = async () => { if (confirm("Thao tác này sẽ reset database về mặc định. Tiếp tục?")) { setLoading(true); await seedDatabase(); setLoading(false); fetchProducts(); } };
    const handleSaveProduct = async (part: LegoPart) => { setIsEditingProduct(false); if (editingPart) await updatePart(part.id, part); else await addPart(part); fetchProducts(); setEditingPart(null); };
    const handleDeleteProduct = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deletePart(id); fetchProducts(); } };
    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => { const success = await updateOrder(orderId, updates); if (success) { setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); if (showMsg) alert("Đã cập nhật!"); } };
    const handleSaveAdminInfo = () => { if (selectedOrder) { handleUpdate(selectedOrder.id, { internalNotes: noteInput, adminDeadline: adminDeadlineInput }); } };
    
    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XOÁ VĨNH VIỄN đơn hàng ${selectedOrder.id} không? Hành động này không thể hoàn tác.`)) {
            setLoading(true);
            await deleteOrder(selectedOrder.id);
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            setSelectedOrder(null);
            setLoading(false);
            alert('Đã xoá đơn hàng.');
        }
    };

    // --- EDIT ORDER LOGIC ---
    const startEditingOrder = () => {
        if (!selectedOrder) return;
        setEditForm({ ...selectedOrder });
        setIsEditingOrder(true);
    };

    const cancelEditingOrder = () => {
        setEditForm(null);
        setIsEditingOrder(false);
    };

    const saveOrderChanges = async () => {
        if (!editForm || !selectedOrder) return;
        
        setLoading(true);
        // Update logic for saving
        // We update: customer info, frame ids for items, and pricing
        await handleUpdate(selectedOrder.id, editForm, false);
        setIsEditingOrder(false);
        setEditForm(null);
        setLoading(false);
        alert("Đã lưu thay đổi!");
    };

    const handleEditFormChange = (field: string, value: any, nestedField?: string, itemIndex?: number) => {
        if (!editForm) return;
        
        setEditForm(prev => {
            if (!prev) return null;
            
            if (itemIndex !== undefined && nestedField === 'frameId') {
                 const newItems = [...prev.items];
                 newItems[itemIndex] = { ...newItems[itemIndex], frameId: value };
                 return { ...prev, items: newItems };
            }

            if (nestedField && field === 'customer') {
                return { ...prev, customer: { ...prev.customer, [nestedField]: value } };
            }

            if (field === 'delivery' && nestedField) {
                return { ...prev, delivery: { ...prev.delivery, [nestedField]: value } };
            }

            return { ...prev, [field]: value };
        });
    };


    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');
    const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN');

    // --- WAREHOUSE ACTION ---
    const handleMarkAsPacked = async () => {
        if (!selectedOrder || !currentUser) return;
        if (confirm(`Xác nhận bạn (${currentUser.email}) đã đóng gói đơn này?`)) {
            const now = new Date().toISOString();
            await handleUpdate(selectedOrder.id, { 
                status: 'Chờ chuyển hàng', // Auto switch to 'Ready to Ship'
                packedBy: currentUser.email,
                packedAt: now
            });
        }
    };

    // --- ADVANCED ANALYTICS LOGIC ---

    const analytics = useMemo(() => {
        // 1. Determine Date Range
        const now = new Date();
        let start = getStartOfDay(now);
        let end = getEndOfDay(now);
        let prevStart = getStartOfDay(now);
        let prevEnd = getEndOfDay(now);

        if (filterTime === 'yesterday') {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
            // Previous: Day before yesterday
            prevStart.setDate(prevStart.getDate() - 2);
            prevEnd.setDate(prevEnd.getDate() - 2);
        } else if (filterTime === '7days') {
            start.setDate(start.getDate() - 7);
            // Previous: 14 to 7 days ago
            prevStart.setDate(prevStart.getDate() - 14);
            prevEnd.setDate(prevEnd.getDate() - 7);
        } else if (filterTime === '30days') {
            start.setDate(start.getDate() - 30);
             // Previous: 60 to 30 days ago
            prevStart.setDate(prevStart.getDate() - 60);
            prevEnd.setDate(prevEnd.getDate() - 30);
        } else {
            // Today case, previous is yesterday
            prevStart.setDate(prevStart.getDate() - 1);
            prevEnd.setDate(prevEnd.getDate() - 1);
        }

        const getOrdersInPeriod = (s: Date, e: Date) => orders.filter(o => {
            const time = o.createdAt || Number(o.id.slice(3)) || 0; // Fallback for old data
            return time >= s.getTime() && time <= e.getTime();
        });

        const currentOrders = getOrdersInPeriod(start, end);
        const prevOrders = getOrdersInPeriod(prevStart, prevEnd);

        // 2. Calculate KPIs
        const revenue = currentOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const revenueGrowth = prevRevenue === 0 ? 100 : ((revenue - prevRevenue) / prevRevenue) * 100;

        const orderCount = currentOrders.length;
        const prevOrderCount = prevOrders.length;
        const orderGrowth = prevOrderCount === 0 ? 100 : ((orderCount - prevOrderCount) / prevOrderCount) * 100;

        // 3. Inventory Stats (From Current Period)
        const inventory = {
            frames: {} as Record<string, number>,
            charms: 0,
            parts: {
                hair: 0, face: 0, shirt: 0, pants: 0, accessory: 0, pet: 0, hat: 0
            }
        };

        currentOrders.forEach(order => {
            order.items.forEach(item => {
                // Frames
                inventory.frames[item.frameId] = (inventory.frames[item.frameId] || 0) + 1;
                
                // Charms
                item.draggableItems.forEach(di => {
                    if (di.type === 'charm') inventory.charms++;
                    else {
                         // Count accessories/pets added as draggable
                         if(inventory.parts[di.type] !== undefined) inventory.parts[di.type as keyof typeof inventory.parts]++;
                    }
                });

                // Characters
                item.characters.forEach(char => {
                    if (char.hair) inventory.parts.hair++;
                    if (char.face) inventory.parts.face++;
                    if (char.shirt) inventory.parts.shirt++;
                    if (char.pants) inventory.parts.pants++;
                    if (char.hat) inventory.parts.hat++;
                });
            });
        });

        // 4. Packing Performance (Current Period)
        const packerStats: Record<string, number> = {};
        currentOrders.forEach(order => {
            if (order.packedBy) {
                packerStats[order.packedBy] = (packerStats[order.packedBy] || 0) + 1;
            }
        });
        const packers = Object.entries(packerStats)
            .map(([email, count]) => ({ email, count }))
            .sort((a, b) => b.count - a.count);

        return {
            revenue, revenueGrowth,
            orderCount, orderGrowth,
            inventory,
            packers,
            dateLabel: filterTime === 'today' ? 'Hôm nay' : filterTime === 'yesterday' ? 'Hôm qua' : filterTime === '7days' ? '7 ngày qua' : '30 ngày qua'
        };
    }, [orders, filterTime]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = productCategory === 'all' || p.type === productCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, productSearch, productCategory]);

    const sortedOrders = useMemo(() => {
        let result = [...orders];
        if (sortMode === 'urgent') {
            result.sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                if (a.adminDeadline && !b.adminDeadline) return -1;
                if (!a.adminDeadline && b.adminDeadline) return 1;
                return 0;
            });
        } else {
            // Sort by createdAt if available, else id
            result.sort((a, b) => ((b.createdAt || 0) - (a.createdAt || 0)));
        }
        return result;
    }, [orders, sortMode]);

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-96 text-center">
                    <h1 className="text-2xl font-bold mb-1 text-gray-900">The Luvin Admin</h1>
                    <p className="text-gray-500 mb-8 text-sm">Vui lòng đăng nhập để tiếp tục</p>
                    <form onSubmit={handleLogin} className="space-y-4 text-left">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                            <input type="email" className="w-full p-2.5 border border-gray-300 rounded focus:border-gray-900 focus:ring-0 outline-none transition-colors bg-gray-50 focus:bg-white" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mật khẩu</label>
                            <input type="password" className="w-full p-2.5 border border-gray-300 rounded focus:border-gray-900 focus:ring-0 outline-none transition-colors bg-gray-50 focus:bg-white" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                        </div>
                        {loginError && <p className="text-red-600 text-sm mt-2">{loginError}</p>}
                        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-2.5 rounded hover:bg-black transition-colors mt-4">Đăng nhập</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Top Navigation */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        {/* Mobile Hamburger */}
                        <button className="md:hidden text-gray-700" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                        </button>
                        
                        <div className="text-xl font-bold tracking-tight">The Luvin <span className="font-normal text-gray-400">| {role === 'admin' ? 'Quản lý' : 'Kho vận'}</span></div>
                        
                        {/* Desktop Nav */}
                        <nav className="hidden md:flex gap-1">
                            {/* Warehouse CAN see Dashboard now */}
                             <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Dashboard</button>
                            
                            <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Đơn hàng</button>
                            
                            {role === 'admin' && (
                                <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Sản phẩm</button>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 font-medium hidden sm:block">{currentUser.email}</span>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 text-sm font-medium transition-colors">Đăng xuất</button>
                    </div>
                </div>
                
                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-2 shadow-lg">
                        <button onClick={() => {setActiveTab('dashboard'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Dashboard</button>
                        <button onClick={() => {setActiveTab('orders'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Đơn hàng</button>
                        {role === 'admin' && <button onClick={() => {setActiveTab('products'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Sản phẩm</button>}
                    </div>
                )}
            </header>

            <main className="max-w-[1600px] mx-auto py-8 px-4 sm:px-6">
                {/* --- DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Date Filter */}
                        <div className="flex justify-end space-x-2">
                            {(['today', 'yesterday', '7days', '30days'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterTime(t)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                                        filterTime === t 
                                        ? 'bg-gray-900 text-white border-gray-900' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                    }`}
                                >
                                    {t === 'today' ? 'Hôm nay' : t === 'yesterday' ? 'Hôm qua' : t === '7days' ? '7 ngày qua' : '30 ngày qua'}
                                </button>
                            ))}
                        </div>
                        
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* HIDE REVENUE FROM WAREHOUSE */}
                            {role === 'admin' && (
                                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doanh thu</p>
                                        <span className={`text-xs font-bold flex items-center ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {analytics.revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.revenueGrowth).toFixed(1)}%
                                        </span>
                                    </div>
                                    <p className="text-3xl font-light text-gray-900">{formatCurrency(analytics.revenue)}</p>
                                    <p className="text-xs text-gray-400 mt-2">So với kỳ trước</p>
                                </div>
                            )}
                            
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn hàng</p>
                                    <span className={`text-xs font-bold flex items-center ${analytics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {analytics.orderGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.orderGrowth).toFixed(1)}%
                                    </span>
                                </div>
                                <p className="text-3xl font-light text-gray-900">{analytics.orderCount}</p>
                                <p className="text-xs text-gray-400 mt-2">So với kỳ trước</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Charm đã dùng</p>
                                <p className="text-3xl font-light text-gray-900">{analytics.inventory.charms}</p>
                                <p className="text-xs text-gray-400 mt-2">Trong {analytics.dateLabel.toLowerCase()}</p>
                            </div>
                             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Hiệu suất đóng gói</p>
                                <div className="flex items-end gap-2">
                                    <p className="text-3xl font-light text-gray-900">{analytics.packers.length > 0 ? analytics.packers[0].count : 0}</p>
                                    <p className="text-sm font-medium text-gray-600 mb-1 truncate w-24">{analytics.packers.length > 0 ? analytics.packers[0].email.split('@')[0] : 'N/A'}</p>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Top 1 nhân viên kho</p>
                            </div>
                        </div>

                        {/* Inventory & Performance Tables */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Inventory Table */}
                            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-gray-100">
                                    <h3 className="font-bold text-gray-800">Chi tiết vật tư tiêu hao</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                            <tr>
                                                <th className="px-4 py-3">Loại</th>
                                                <th className="px-4 py-3 text-right">Số lượng</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {Object.entries(analytics.inventory.frames).map(([frameId, count]) => (
                                                <tr key={frameId}>
                                                    <td className="px-4 py-3 font-medium text-gray-700">Khung {frameId.toUpperCase()}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{count}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-pink-50/30">
                                                <td className="px-4 py-3 font-medium text-gray-700">Charm trang trí</td>
                                                <td className="px-4 py-3 text-right font-mono">{analytics.inventory.charms}</td>
                                            </tr>
                                            {Object.entries(analytics.inventory.parts).map(([partType, count]) => (
                                                <tr key={partType}>
                                                    <td className="px-4 py-3 font-medium text-gray-500 capitalize">Lego: {partType}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Staff Performance Table */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-fit">
                                <div className="p-4 border-b border-gray-100">
                                    <h3 className="font-bold text-gray-800">BXH Đóng gói</h3>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Nhân viên</th>
                                            <th className="px-4 py-3 text-right">SL Đơn</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {analytics.packers.length > 0 ? analytics.packers.map((p, i) => (
                                            <tr key={p.email}>
                                                <td className="px-4 py-3 flex items-center gap-2">
                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200'}`}>{i + 1}</span>
                                                    <span className="truncate w-32" title={p.email}>{p.email.split('@')[0]}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold">{p.count}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">Chưa có dữ liệu</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ORDERS --- */}
                {activeTab === 'orders' && (
                     <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
                        {/* Order List Sidebar */}
                        <div className={`lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2">
                                <button onClick={() => setSortMode('newest')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'newest' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>Mới nhất</button>
                                <button onClick={() => setSortMode('urgent')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'urgent' ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-500 hover:text-gray-900'}`}>Cần gấp</button>
                            </div>
                            <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                                {sortedOrders.map(order => (
                                    <div 
                                        key={order.id} 
                                        onClick={() => {
                                            setSelectedOrder(order); 
                                            setIsEditingOrder(false); // Reset edit mode when switching
                                        }} 
                                        className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-gray-50' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-mono font-medium ${order.isUrgent ? 'text-red-600' : 'text-gray-900'}`}>
                                                {order.id}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                                order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : 
                                                order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                             <p className="text-sm text-gray-600 truncate max-w-[150px]">{order.customer.name}</p>
                                             <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalPrice)}</p>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-gray-400">{order.createdAt ? formatDateTime(order.createdAt) : '---'}</p>
                                            {(order.adminDeadline || order.delivery.date) && (
                                                <p className="text-xs text-gray-500">
                                                    {order.adminDeadline ? `DL: ${formatDate(order.adminDeadline)}` : `Giao: ${formatDate(order.delivery.date)}`}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Detail View */}
                        <div className={`lg:w-2/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                            {selectedOrder ? (
                                <div className="flex flex-col h-full">
                                    {/* Header Detail */}
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
                                        <div className="flex items-start gap-2">
                                            <button onClick={() => setSelectedOrder(null)} className="lg:hidden text-gray-500 mr-2">←</button>
                                            <div>
                                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                                    {selectedOrder.id}
                                                    {selectedOrder.isUrgent && <span className="text-red-500 text-lg" title="Đơn gấp">🔥</span>}
                                                </h2>
                                                <p className="text-sm text-gray-500 mt-1">Đặt lúc: {selectedOrder.createdAt ? formatDateTime(selectedOrder.createdAt) : '---'}</p>
                                                {selectedOrder.packedBy && (
                                                    <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                                                        <span>✓</span>
                                                        Đã đóng gói bởi {selectedOrder.packedBy} lúc {selectedOrder.packedAt ? new Date(selectedOrder.packedAt).toLocaleTimeString('vi-VN') : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                             <div className="flex gap-2">
                                                {!isEditingOrder ? (
                                                    <button onClick={startEditingOrder} className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200">Sửa</button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={cancelEditingOrder} className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200">Huỷ</button>
                                                        <button onClick={saveOrderChanges} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Lưu</button>
                                                    </div>
                                                )}
                                             </div>
                                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <span className="text-xs font-medium text-gray-500">Đánh dấu Gấp</span>
                                                <input type="checkbox" className="accent-red-600 w-4 h-4" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} />
                                            </label>
                                        </div>
                                    </div>

                                    {/* EDITING MODE VS VIEW MODE */}
                                    <div className="flex-grow overflow-y-auto p-6 space-y-8">
                                        
                                        {/* Admin Notes Section */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú nội bộ</label>
                                                <textarea 
                                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" 
                                                    rows={2}
                                                    placeholder="Ghi chú cho admin..." 
                                                    value={noteInput} 
                                                    onChange={(e) => setNoteInput(e.target.value)} 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deadline Xưởng</label>
                                                <input 
                                                    type="date" 
                                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" 
                                                    value={adminDeadlineInput} 
                                                    onChange={(e) => setAdminDeadlineInput(e.target.value)} 
                                                />
                                                <div className="mt-2 text-right">
                                                     <button onClick={handleSaveAdminInfo} className="text-xs font-bold text-white bg-gray-900 px-3 py-1.5 rounded hover:bg-black transition-colors">Lưu Ghi chú</button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Columns */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Khách hàng</h3>
                                                <div className="space-y-2 text-sm text-gray-700">
                                                    {isEditingOrder && editForm ? (
                                                        <>
                                                            <div className="flex items-center gap-2"><span className="w-20 text-gray-500">Tên:</span> <input className="border rounded p-1 w-full" value={editForm.customer.name} onChange={e => handleEditFormChange('customer', e.target.value, 'name')} /></div>
                                                            <div className="flex items-center gap-2"><span className="w-20 text-gray-500">SĐT:</span> <input className="border rounded p-1 w-full" value={editForm.customer.phone} onChange={e => handleEditFormChange('customer', e.target.value, 'phone')} /></div>
                                                            <div className="flex items-center gap-2"><span className="w-20 text-gray-500">Email:</span> <input className="border rounded p-1 w-full" value={editForm.customer.email} onChange={e => handleEditFormChange('customer', e.target.value, 'email')} /></div>
                                                            <div className="flex items-start gap-2"><span className="w-20 text-gray-500">Địa chỉ:</span> <textarea className="border rounded p-1 w-full" rows={2} value={editForm.customer.address} onChange={e => handleEditFormChange('customer', e.target.value, 'address')} /></div>
                                                            <div className="flex items-start gap-2 mt-2"><span className="w-20 text-gray-500">Note:</span> <textarea className="border rounded p-1 w-full" rows={2} value={editForm.delivery.notes} onChange={e => handleEditFormChange('delivery', e.target.value, 'notes')} /></div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p><span className="text-gray-500 w-20 inline-block">Tên:</span> {selectedOrder.customer.name}</p>
                                                            <p><span className="text-gray-500 w-20 inline-block">SĐT:</span> {selectedOrder.customer.phone}</p>
                                                            <p><span className="text-gray-500 w-20 inline-block">Email:</span> {selectedOrder.customer.email}</p>
                                                            <p className="flex items-start"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Địa chỉ:</span> <span>{selectedOrder.customer.address}</span></p>
                                                            <p className="flex items-start mt-2"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Note:</span> <span className="italic bg-yellow-50 px-2 py-0.5 rounded text-gray-800">{selectedOrder.delivery.notes || 'Không có'}</span></p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Thanh toán & Vận chuyển</h3>
                                                <div className="space-y-2 text-sm text-gray-700">
                                                    <p><span className="text-gray-500 w-24 inline-block">Phương thức:</span> {selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Toàn bộ'}</p>
                                                    <p><span className="text-gray-500 w-24 inline-block">Vận chuyển:</span> {selectedOrder.shipping.method}</p>
                                                    <div className="border-t border-gray-100 my-2 pt-2">
                                                        {isEditingOrder && editForm ? (
                                                            <>
                                                                <div className="flex items-center gap-2 mb-2"><span className="w-24 text-gray-500">Tổng đơn:</span> <input type="number" className="border rounded p-1 w-32 font-bold" value={editForm.totalPrice} onChange={e => handleEditFormChange('totalPrice', Number(e.target.value))} /></div>
                                                                <div className="flex items-center gap-2"><span className="w-24 text-gray-500">Cần thu:</span> <input type="number" className="border rounded p-1 w-32 font-bold text-red-600" value={editForm.amountToPay} onChange={e => handleEditFormChange('amountToPay', Number(e.target.value))} /></div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p><span className="text-gray-500 w-24 inline-block">Tổng đơn:</span> <span className="font-bold">{formatCurrency(selectedOrder.totalPrice)}</span></p>
                                                                <p><span className="text-gray-500 w-24 inline-block">Cần thu:</span> <span className="font-bold text-red-600">{formatCurrency(selectedOrder.amountToPay)}</span></p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Products */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">Chi tiết sản phẩm</h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                {selectedOrder.items.map((item, idx) => (
                                                    <div key={idx} className="flex gap-4 border border-gray-100 rounded-lg p-4 items-start bg-white">
                                                        <div className="w-24 h-24 bg-gray-50 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                            {item.previewImageUrl ? <img src={item.previewImageUrl} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">No img</span>}
                                                        </div>
                                                        <div className="flex-grow">
                                                            {isEditingOrder && editForm ? (
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="font-bold text-gray-800">Khung:</span>
                                                                    <select 
                                                                        className="border rounded p-1 text-sm"
                                                                        value={editForm.items[idx].frameId}
                                                                        onChange={e => handleEditFormChange('items', e.target.value, 'frameId', idx)}
                                                                    >
                                                                        {FRAME_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <p className="font-bold text-gray-800 mb-1">Khung {item.frameId.toUpperCase()}</p>
                                                            )}
                                                            
                                                            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                                                                <li>{item.characters.length} nhân vật</li>
                                                                <li>Nền: {item.background.type}</li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2 justify-end items-center">
                                        
                                        {/* WAREHOUSE ACTION BUTTON */}
                                        {role === 'warehouse' && !selectedOrder.packedBy && selectedOrder.status !== 'Đã giao hàng' && (
                                            <button 
                                                onClick={handleMarkAsPacked}
                                                className="mr-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-md transition-colors flex items-center gap-2"
                                            >
                                                <span>✓</span>
                                                Xác nhận đã đóng gói
                                            </button>
                                        )}

                                        {/* STATUS DROPDOWN */}
                                        <StatusDropdown 
                                            currentStatus={selectedOrder.status} 
                                            onStatusChange={(st) => handleUpdate(selectedOrder.id, { status: st })}
                                            onDelete={handleDeleteOrder}
                                            isAdmin={role === 'admin'}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                                    <span className="text-4xl opacity-20">📦</span>
                                    <span>Chọn đơn hàng để xem chi tiết</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- PRODUCTS (ADMIN ONLY) --- */}
                {activeTab === 'products' && role === 'admin' && (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-140px)] animate-fade-in">
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-gray-900">Kho Sản phẩm</h2>
                                <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">{products.length}</span>
                            </div>
                            <div className="flex flex-grow md:flex-grow-0 gap-3 w-full md:w-auto">
                                <input 
                                    type="text" 
                                    placeholder="Tìm kiếm..." 
                                    className="p-2 border border-gray-300 rounded text-sm w-full md:w-64 focus:border-gray-900 focus:ring-0 outline-none" 
                                    value={productSearch} 
                                    onChange={e => setProductSearch(e.target.value)} 
                                />
                                <select 
                                    className="p-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:ring-0 outline-none" 
                                    value={productCategory} 
                                    onChange={e => setProductCategory(e.target.value)}
                                >
                                    <option value="all">Tất cả danh mục</option>
                                    <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option>
                                </select>
                                <button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-black whitespace-nowrap shadow-sm">Thêm mới</button>
                            </div>
                        </div>
                        
                        <div className="flex-grow overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">Hình ảnh</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Tên sản phẩm</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Loại</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Giá</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.length > 0 ? filteredProducts.map(part => (
                                        <tr key={part.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="p-3 border-b border-gray-100">
                                                <div className="w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                                                    <img src={part.imageUrl} alt="" className="w-full h-full object-contain" />
                                                </div>
                                            </td>
                                            <td className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900">{part.name}</td>
                                            <td className="p-3 border-b border-gray-100 text-sm text-gray-500 capitalize">{part.type}</td>
                                            <td className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900">{formatCurrency(part.price)}</td>
                                            <td className="p-3 border-b border-gray-100 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">Sửa</button>
                                                    <button onClick={() => handleDeleteProduct(part.id)} className="text-xs font-bold text-red-600 hover:underline bg-red-50 px-2 py-1 rounded">Xóa</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center text-gray-400 text-sm">Không tìm thấy sản phẩm nào.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                         {products.length === 0 && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center">
                                <button onClick={handleSeedData} className="text-xs text-gray-500 underline hover:text-gray-900">Database trống? Bấm để đồng bộ dữ liệu mẫu</button>
                            </div>
                         )}
                    </div>
                )}

                {isEditingProduct && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={() => setIsEditingProduct(false)} />}
                {loading && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50"><div className="text-gray-900 font-bold">Đang xử lý...</div></div>}
            </main>
        </div>
    );
};

export default AdminPage;
