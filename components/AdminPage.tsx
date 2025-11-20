
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds } from '../services/backgroundService';
import { uploadToCloudinary } from '../services/uploadService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem, PresetBackground } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../constants';

// --- CONSTANTS & HELPERS ---

const formatCurrency = (amount: number, context: 'price' | 'payment' = 'price') => {
  if (amount === 0 && context === 'price') return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const CHARACTER_BASE_PRICE = 10000;

const isNearDeadline = (dateString: string) => {
    if (!dateString) return false;
    const target = new Date(dateString);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Warning if deadline is today or within next 3 days
    return diffDays >= -1 && diffDays <= 3;
};

const STATUS_CONFIG = [
    { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🕒', group: 'pending' },
    { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🛡️', group: 'pending' }, 
    { label: 'Ưu tiên xuất đơn', color: 'bg-pink-100 text-pink-800 border-pink-200', icon: '⚡', group: 'processing' },
    { label: 'Đang đóng hàng', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: '🎁', group: 'processing' },
    { label: 'Chờ chuyển hàng', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '📦', group: 'shipping' }, 
    { label: 'Gửi hàng đi', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🚚', group: 'shipping' },
    { label: 'Đã giao hàng', color: 'bg-green-100 text-green-800 border-green-200', icon: '✅', group: 'completed' },
    { label: 'Huỷ đơn', color: 'bg-red-100 text-red-800 border-red-200', icon: '❌', group: 'cancelled' },
    { label: 'Xoá đơn', color: 'bg-gray-200 text-gray-800 border-gray-300', icon: '🗑️', isAction: true, group: 'action' },
];

const FILTER_TABS = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending', label: 'Chờ xử lý', statuses: ['Chờ thanh toán', 'Đã xác nhận'] },
    { id: 'processing', label: 'Đang làm', statuses: ['Ưu tiên xuất đơn', 'Đang đóng hàng'] },
    { id: 'shipping', label: 'Giao vận', statuses: ['Chờ chuyển hàng', 'Gửi hàng đi'] },
    { id: 'completed', label: 'Hoàn thành', statuses: ['Đã giao hàng'] },
    { id: 'cancelled', label: 'Đã huỷ', statuses: ['Huỷ đơn'] },
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
        <div className="relative inline-block" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm whitespace-nowrap ${currentConfig.color} hover:brightness-95`}
            >
                <span>{currentConfig.icon}</span>
                <span>{currentStatus}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto py-1">
                        {STATUS_CONFIG.map((status) => {
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
                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-3 hover:bg-gray-50 transition-colors ${status.label === currentStatus ? 'bg-blue-50 text-blue-600' : 'text-gray-700'} ${status.isAction ? 'text-red-600 hover:bg-red-50' : ''}`}
                                >
                                    <span className="w-5 text-center">{status.icon}</span>
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

// --- MAIN ADMIN PAGE ---
const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);

    // --- AUTH & ROLE ---
    const role = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        const ADMIN_EMAILS = ['jinbduong@gmail.com', 'admin@theluvin.com']; 
        // Check if email contains 'admin' or is in the list
        if (ADMIN_EMAILS.includes(currentUser.email) || currentUser.email.includes('admin')) {
            return 'admin';
        }
        return 'warehouse';
    }, [currentUser]);

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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            await signInWithEmailAndPassword(auth, email, loginPass);
        } catch (error: any) {
            setLoginError("Thông tin đăng nhập không chính xác.");
        }
    };

    const fetchOrders = async () => { const data = await getAllOrders(); setOrders(data); };
    const fetchProducts = async () => { const data = await getAllParts(); setProducts(data); };

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => { 
        const success = await updateOrder(orderId, updates); 
        if (success) { 
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); 
            if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); 
            if (showMsg) alert("Đã cập nhật!"); 
        } 
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (confirm(`XOÁ VĨNH VIỄN đơn ${selectedOrder.id}?`)) {
            await deleteOrder(selectedOrder.id);
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            setSelectedOrder(null);
        }
    };

    // --- SORTING & FILTERING ---
    const filteredAndSortedOrders = useMemo(() => {
        let result = [...orders];
        
        // 1. Filter by Status Group
        const activeFilter = FILTER_TABS.find(f => f.id === activeStatusFilter);
        if (activeFilter && activeFilter.id !== 'all') {
            result = result.filter(o => activeFilter.statuses?.includes(o.status));
        }

        // 2. Strict Sorting Logic
        result.sort((a, b) => {
            // Priority 1: Urgent Flag (Set by Admin)
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;

            // Priority 2: Near Deadline (System calculated)
            const aNear = isNearDeadline(a.delivery.date);
            const bNear = isNearDeadline(b.delivery.date);
            if (aNear && !bNear) return -1;
            if (!aNear && bNear) return 1;

            // Priority 3: Date Created (Newest First)
            return (b.createdAt || 0) - (a.createdAt || 0);
        });

        return result;
    }, [orders, activeStatusFilter]);

    // --- PRICE CALCULATION ---
    const calculateOrderPrice = (order: Order, allParts: LegoPart[]) => {
        let subtotal = 0;
        const partLookup = allParts.reduce((acc, p) => ({...acc, [p.id]: p}), {} as Record<string, LegoPart>);

        order.items.forEach(item => {
            const frame = FRAME_OPTIONS.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
            subtotal += frame.price;
            subtotal += item.characters.length * CHARACTER_BASE_PRICE;
            
            item.characters.forEach(char => {
                if (char.customPrintPrice) subtotal += char.customPrintPrice;
                ['hair', 'hat', 'shirt', 'pants'].forEach(k => {
                    // Use part ID to lookup current price if possible, else fallback to embedded price
                    // @ts-ignore
                    const partId = char[k]?.id;
                    if (partId && partLookup[partId]) {
                        subtotal += partLookup[partId].price;
                    } else {
                         // @ts-ignore
                        subtotal += (char[k]?.price || 0);
                    }
                });
                if (char.selectedShirtColor?.price) subtotal += char.selectedShirtColor.price;
                if (char.selectedPantsColor?.price) subtotal += char.selectedPantsColor.price;
            });

            item.draggableItems.forEach(di => {
                if (di.type !== 'charm' && partLookup[di.partId]) {
                    subtotal += partLookup[di.partId].price;
                } else if (di.type !== 'charm') {
                    // Fallback if part not found in current DB but exists in order
                    const embeddedPart = LEGO_PARTS.accessory.find(p => p.id === di.partId) || LEGO_PARTS.pet.find(p => p.id === di.partId);
                     if(embeddedPart) subtotal += embeddedPart.price;
                }
            });
        });

        const giftBoxFee = order.addGiftBox ? 30000 : 0;
        const shippingFee = order.shipping.fee || 0;
        const totalPrice = subtotal + giftBoxFee + shippingFee;
        
        // Recalculate amount to pay based on method
        let amountToPay = totalPrice;
        if (order.payment.method === 'deposit') amountToPay = Math.round(totalPrice * 0.7);

        return { totalPrice, amountToPay };
    };

    // --- EDIT HANDLERS ---
    const startEditing = () => {
        if (!selectedOrder) return;
        setEditForm(JSON.parse(JSON.stringify(selectedOrder)));
        setIsEditingOrder(true);
    };

    const updateEditForm = (updater: (prev: Order) => Order) => {
        setEditForm(prev => {
            if (!prev) return null;
            const updated = updater(prev);
            const { totalPrice, amountToPay } = calculateOrderPrice(updated, products);
            return { ...updated, totalPrice, amountToPay };
        });
    };

    const handleSaveEdit = async () => {
        if (!editForm || !selectedOrder) return;
        await handleUpdate(selectedOrder.id, editForm, false);
        setIsEditingOrder(false);
        setEditForm(null);
        alert("Đã lưu thay đổi!");
    };

    // --- WAREHOUSE HANDLER ---
    const handleMarkAsPacked = async () => {
        if (!selectedOrder || !currentUser) return;
        if (confirm(`Xác nhận đã đóng gói đơn ${selectedOrder.id}?`)) {
            await handleUpdate(selectedOrder.id, { 
                status: 'Chờ chuyển hàng', 
                packedBy: currentUser.email,
                packedAt: new Date().toISOString()
            });
        }
    };

    if (!currentUser) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-lg w-96">
                <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">Admin Login</h1>
                <p className="text-center text-gray-500 text-sm mb-6">Hệ thống quản lý đơn hàng The Luvin</p>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="email" placeholder="Email" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                    <input type="password" placeholder="Mật khẩu" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                    {loginError && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{loginError}</p>}
                    <button className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-black transition-colors">Đăng nhập</button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
            {/* --- LEFT: ORDER LIST & FILTERS --- */}
            <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${selectedOrder ? 'w-1/2 hidden lg:flex' : 'w-full'}`}>
                
                {/* HEADER */}
                <header className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h1 className="font-bold text-xl text-gray-900">The Luvin <span className="text-xs font-normal bg-gray-100 px-2 py-0.5 rounded text-gray-500 ml-2">{role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'KHO VẬN'}</span></h1>
                        <p className="text-xs text-gray-500 mt-1">Xin chào, {currentUser.email}</p>
                    </div>
                    <button onClick={() => signOut(auth)} className="text-sm text-gray-500 hover:text-red-500 font-medium underline">Đăng xuất</button>
                </header>

                {/* FILTER TABS */}
                <div className="bg-white border-b px-4 py-2 overflow-x-auto no-scrollbar flex-shrink-0">
                    <div className="flex gap-2">
                        {FILTER_TABS.map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveStatusFilter(tab.id)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2
                                    ${activeStatusFilter === tab.id ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {tab.label}
                                {tab.id !== 'all' && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeStatusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                        {orders.filter(o => tab.statuses?.includes(o.status)).length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ORDER LIST */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {filteredAndSortedOrders.map(order => (
                        <div 
                            key={order.id} 
                            onClick={() => { setSelectedOrder(order); setIsEditingOrder(false); }}
                            className={`bg-white border rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all relative group
                                ${selectedOrder?.id === order.id ? 'ring-2 ring-gray-800 border-transparent shadow-md' : 'border-gray-200'}
                            `}
                        >
                            {/* BADGES */}
                            <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                                {order.isUrgent && <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm animate-pulse">🔥 GẤP</span>}
                                {isNearDeadline(order.delivery.date) && !order.isUrgent && ['Chờ thanh toán', 'Đã xác nhận', 'Ưu tiên xuất đơn', 'Đang đóng hàng', 'Chờ chuyển hàng'].includes(order.status) && <span className="bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded">⚠️ SẮP HẠN</span>}
                            </div>

                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-gray-900">{order.id}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_CONFIG.find(s=>s.label===order.status)?.color}`}>{order.status}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="opacity-60">👤</span>
                                    <span className="font-medium truncate">{order.customer.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="opacity-60">📅</span>
                                    <span className={`${isNearDeadline(order.delivery.date) ? 'text-orange-600 font-bold' : ''}`}>{new Date(order.delivery.date).toLocaleDateString('vi-VN')}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                                {order.items[0]?.previewImageUrl && (
                                    <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden border">
                                        <img src={order.items[0].previewImageUrl} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="flex-1 text-xs text-gray-500">
                                    {order.items.length} khung, {order.items.reduce((acc, i) => acc + i.characters.length, 0)} nhân vật
                                </div>
                                <span className="font-bold text-gray-900">{formatCurrency(order.totalPrice)}</span>
                            </div>
                        </div>
                    ))}
                    {filteredAndSortedOrders.length === 0 && (
                        <div className="text-center py-20 text-gray-400">
                            <p className="text-4xl mb-2">📭</p>
                            <p>Không tìm thấy đơn hàng nào</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- RIGHT: ORDER DETAIL DRAWER --- */}
            {selectedOrder && (
                <div className="w-full lg:w-[500px] xl:w-[600px] bg-white border-l h-full shadow-2xl flex flex-col absolute right-0 top-0 z-20 lg:relative transition-transform duration-300">
                    
                    {/* DRAWER HEADER */}
                    <div className="px-6 py-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-xl">{selectedOrder.id}</h2>
                                <StatusDropdown 
                                    currentStatus={selectedOrder.status} 
                                    onStatusChange={(s) => handleUpdate(selectedOrder.id, { status: s }, false)} 
                                    onDelete={handleDeleteOrder}
                                    isAdmin={role === 'admin'}
                                />
                            </div>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="lg:hidden bg-gray-100 p-2 rounded-full hover:bg-gray-200">✕</button>
                    </div>

                    {/* DRAWER CONTENT */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        
                        {/* 1. ADMIN CONTROL PANEL (Role: Admin) */}
                        <div className={`p-4 rounded-xl border ${selectedOrder.internalNotes || selectedOrder.isUrgent ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Điều hành & Ghi chú</h3>
                                {role === 'admin' && !isEditingOrder && (
                                    <button onClick={startEditing} className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-gray-50 shadow-sm flex items-center gap-1">
                                        ✏️ Sửa đơn
                                    </button>
                                )}
                            </div>
                            
                            {/* Notes Input */}
                            <textarea 
                                className="w-full text-sm p-3 border rounded-lg bg-white min-h-[80px] focus:ring-2 focus:ring-yellow-400 outline-none resize-none" 
                                value={isEditingOrder && editForm ? (editForm.internalNotes || '') : (selectedOrder.internalNotes || '')} 
                                onChange={e => isEditingOrder ? updateEditForm(prev => ({...prev, internalNotes: e.target.value})) : handleUpdate(selectedOrder.id, { internalNotes: e.target.value }, false)}
                                placeholder="Ghi chú nội bộ cho team..."
                                readOnly={role !== 'admin'}
                            />
                            
                            {role === 'admin' && (
                                <div className="flex items-center gap-4 mt-3">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={isEditingOrder && editForm ? (editForm.isUrgent || false) : (selectedOrder.isUrgent || false)} 
                                            onChange={e => isEditingOrder ? updateEditForm(prev => ({...prev, isUrgent: e.target.checked})) : handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                        <span className="font-bold text-red-600">Đánh dấu GẤP</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* 2. CUSTOMER INFO */}
                        <div>
                            <h3 className="font-bold text-gray-900 border-b pb-2 mb-4">Thông tin nhận hàng</h3>
                            {isEditingOrder && editForm ? (
                                <div className="grid grid-cols-1 gap-3 bg-gray-50 p-4 rounded-lg border">
                                    <input value={editForm.customer.name} onChange={e => updateEditForm(prev => ({...prev, customer: {...prev.customer, name: e.target.value}}))} className="p-2 border rounded text-sm" placeholder="Tên khách hàng" />
                                    <input value={editForm.customer.phone} onChange={e => updateEditForm(prev => ({...prev, customer: {...prev.customer, phone: e.target.value}}))} className="p-2 border rounded text-sm" placeholder="Số điện thoại" />
                                    <textarea value={editForm.customer.address} onChange={e => updateEditForm(prev => ({...prev, customer: {...prev.customer, address: e.target.value}}))} className="p-2 border rounded text-sm" placeholder="Địa chỉ" rows={2} />
                                    <input type="date" value={editForm.delivery.date} onChange={e => updateEditForm(prev => ({...prev, delivery: {...prev.delivery, date: e.target.value}}))} className="p-2 border rounded text-sm" />
                                </div>
                            ) : (
                                <div className="text-sm space-y-2 text-gray-700">
                                    <div className="flex"><span className="w-24 font-medium text-gray-500">Người nhận:</span> <span>{selectedOrder.customer.name}</span></div>
                                    <div className="flex"><span className="w-24 font-medium text-gray-500">Điện thoại:</span> <span className="font-mono">{selectedOrder.customer.phone}</span></div>
                                    <div className="flex"><span className="w-24 font-medium text-gray-500">Địa chỉ:</span> <span>{selectedOrder.customer.address}</span></div>
                                    <div className="flex"><span className="w-24 font-medium text-gray-500">Ngày nhận:</span> <span className="font-bold">{new Date(selectedOrder.delivery.date).toLocaleDateString('vi-VN')}</span></div>
                                    {selectedOrder.delivery.notes && <div className="mt-2 bg-yellow-50 p-2 rounded text-gray-800 border border-yellow-100 text-xs">Note khách: {selectedOrder.delivery.notes}</div>}
                                </div>
                            )}
                        </div>

                        {/* 3. ITEMS & EDITING */}
                        <div>
                            <h3 className="font-bold text-gray-900 border-b pb-2 mb-4">Chi tiết đơn hàng</h3>
                            <div className="space-y-6">
                                {(isEditingOrder && editForm ? editForm.items : selectedOrder.items).map((item, idx) => {
                                    const frameName = FRAME_OPTIONS.find(f => f.id === item.frameId)?.name;
                                    return (
                                        <div key={idx} className="border rounded-xl overflow-hidden shadow-sm">
                                            {/* Header of Item */}
                                            <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                                                <span className="font-bold text-sm">Khung #{idx + 1} - {frameName}</span>
                                                {isEditingOrder && (
                                                    <select 
                                                        value={item.frameId} 
                                                        onChange={e => updateEditForm(prev => {
                                                            const newItems = [...prev.items];
                                                            newItems[idx].frameId = e.target.value;
                                                            return {...prev, items: newItems};
                                                        })}
                                                        className="text-xs border rounded p-1 ml-2"
                                                    >
                                                        {FRAME_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                    </select>
                                                )}
                                            </div>

                                            <div className="p-4">
                                                {/* Preview Image */}
                                                <div className="aspect-square bg-gray-100 rounded-lg border mb-4 overflow-hidden flex items-center justify-center">
                                                    {item.previewImageUrl ? (
                                                        <img src={item.previewImageUrl} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="text-xs text-gray-400">Chưa có ảnh preview</span>
                                                    )}
                                                </div>

                                                {/* Characters List */}
                                                <div className="space-y-3">
                                                    {item.characters.map((char, cIdx) => (
                                                        <div key={cIdx} className="bg-white border border-gray-200 rounded-lg p-3 text-sm relative group">
                                                            {isEditingOrder && (
                                                                <button 
                                                                    onClick={() => updateEditForm(prev => {
                                                                        const newItems = [...prev.items];
                                                                        newItems[idx].characters = newItems[idx].characters.filter((_, i) => i !== cIdx);
                                                                        return {...prev, items: newItems};
                                                                    })}
                                                                    className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs shadow-sm z-10"
                                                                >×</button>
                                                            )}
                                                            
                                                            <div className="font-bold text-xs text-gray-500 mb-2 uppercase tracking-wide">Nhân vật {cIdx + 1}</div>
                                                            
                                                            {isEditingOrder ? (
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {['hair', 'face', 'shirt', 'pants'].map(part => (
                                                                        <div key={part}>
                                                                            <label className="text-[10px] text-gray-400 uppercase block mb-0.5">{part}</label>
                                                                            <select 
                                                                                // @ts-ignore
                                                                                value={char[part]?.id || ''}
                                                                                onChange={e => {
                                                                                    const newPart = products.find(p => p.id === e.target.value);
                                                                                    updateEditForm(prev => {
                                                                                        const newItems = [...prev.items];
                                                                                        // @ts-ignore
                                                                                        newItems[idx].characters[cIdx][part] = newPart;
                                                                                        return {...prev, items: newItems};
                                                                                    });
                                                                                }}
                                                                                className="w-full text-xs border rounded p-1.5 bg-gray-50"
                                                                            >
                                                                                <option value="">--Chọn--</option>
                                                                                {products.filter(p => p.type === part).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                            </select>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                                    <div className="flex justify-between"><span className="text-gray-500">Tóc:</span> <span>{char.hair?.name || '-'}</span></div>
                                                                    <div className="flex justify-between"><span className="text-gray-500">Mặt:</span> <span>{char.face?.name || '-'}</span></div>
                                                                    <div className="flex justify-between"><span className="text-gray-500">Áo:</span> <span>{char.shirt?.name || '-'}</span></div>
                                                                    <div className="flex justify-between"><span className="text-gray-500">Quần:</span> <span>{char.pants?.name || '-'}</span></div>
                                                                    {char.hat && <div className="flex justify-between col-span-2 border-t border-dashed pt-1 mt-1"><span className="text-gray-500">Mũ:</span> <span>{char.hat.name}</span></div>}
                                                                    {char.customPrintPrice && <div className="col-span-2 text-blue-600 font-bold text-xs mt-1">+ In yêu cầu</div>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {/* Add Character Button (Edit Mode) */}
                                                {isEditingOrder && (
                                                    <button 
                                                        onClick={() => updateEditForm(prev => {
                                                            const newItems = [...prev.items];
                                                            newItems[idx].characters.push({ id: Date.now(), x: 50, y: 50, rotation: 0, scale: 1 });
                                                            return {...prev, items: newItems};
                                                        })}
                                                        className="w-full mt-3 py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 text-xs font-bold hover:bg-gray-50 hover:text-gray-700 transition-colors"
                                                    >
                                                        + THÊM NHÂN VẬT
                                                    </button>
                                                )}

                                                {/* Accessories List */}
                                                {item.draggableItems.length > 0 && (
                                                    <div className="mt-4 pt-3 border-t border-gray-100">
                                                        <h4 className="text-xs font-bold text-gray-500 mb-2">PHỤ KIỆN</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {item.draggableItems.map((di, diIdx) => {
                                                                const partName = products.find(p => p.id === di.partId)?.name || di.type;
                                                                return (
                                                                    <span key={diIdx} className="bg-gray-100 border px-2 py-1 rounded text-xs flex items-center gap-1">
                                                                        {partName}
                                                                        {isEditingOrder && (
                                                                            <button 
                                                                                onClick={() => updateEditForm(prev => {
                                                                                    const newItems = [...prev.items];
                                                                                    newItems[idx].draggableItems = newItems[idx].draggableItems.filter((_, i) => i !== diIdx);
                                                                                    return {...prev, items: newItems};
                                                                                })}
                                                                                className="text-red-500 font-bold ml-1 hover:bg-red-100 rounded-full w-4 h-4 flex items-center justify-center"
                                                                            >×</button>
                                                                        )}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 4. WAREHOUSE PACKING INFO */}
                        {selectedOrder.packedBy && (
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
                                <div className="text-2xl">✅</div>
                                <div>
                                    <p className="font-bold text-green-800">Đã đóng gói xong</p>
                                    <p className="text-green-700 text-sm mt-1">Nhân viên: {selectedOrder.packedBy}</p>
                                    <p className="text-green-700 text-sm">Thời gian: {new Date(selectedOrder.packedAt!).toLocaleString('vi-VN')}</p>
                                </div>
                            </div>
                        )}

                        {/* Spacer for footer */}
                        <div className="h-20"></div>
                    </div>

                    {/* DRAWER FOOTER - ACTION BAR */}
                    <div className="p-4 border-t bg-white sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                        {isEditingOrder ? (
                            <div className="flex gap-3">
                                <button onClick={() => { setIsEditingOrder(false); setEditForm(null); }} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50">Huỷ bỏ</button>
                                <button onClick={handleSaveEdit} className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-black shadow-lg">Lưu thay đổi ({formatCurrency(editForm?.totalPrice || 0)})</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Tổng giá trị đơn hàng</span>
                                    <span className="font-bold text-lg">{formatCurrency(selectedOrder.totalPrice)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pb-2 border-b border-dashed">
                                    <span className="text-gray-600">Cần thu (COD/CK)</span>
                                    <span className="font-bold text-xl text-red-600">{formatCurrency(selectedOrder.amountToPay)}</span>
                                </div>

                                {role === 'warehouse' && !selectedOrder.packedBy && (
                                    <button 
                                        onClick={handleMarkAsPacked} 
                                        className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 text-base"
                                    >
                                        <span>📦</span> Xác nhận đã đóng gói
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
