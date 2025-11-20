import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds } from '../services/backgroundService';
import { uploadToCloudinary } from '../services/uploadService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem, PresetBackground, OutfitColor } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../constants';

// --- UTILS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const CHARACTER_BASE_PRICE = 10000;

const isNearDeadline = (dateString: string) => {
    if (!dateString) return false;
    const target = new Date(dateString);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
};

// --- CONFIGS ---
const STATUS_CONFIG = [
    { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800', icon: '🕒' },
    { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800', icon: '🛡️' }, 
    { label: 'Ưu tiên xuất đơn', color: 'bg-pink-100 text-pink-800', icon: '⚡' },
    { label: 'Đang đóng hàng', color: 'bg-indigo-100 text-indigo-800', icon: '🎁' },
    { label: 'Chờ chuyển hàng', color: 'bg-purple-100 text-purple-800', icon: '✓' }, 
    { label: 'Gửi hàng đi', color: 'bg-orange-100 text-orange-800', icon: '🚚' },
    { label: 'Đã giao hàng', color: 'bg-green-100 text-green-800', icon: '✅' },
    { label: 'Huỷ đơn', color: 'bg-red-100 text-red-800', icon: '❌' },
];

const FILTER_TABS = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending', label: 'Chờ xử lý', statuses: ['Chờ thanh toán', 'Đã xác nhận'] },
    { id: 'processing', label: 'Đang làm', statuses: ['Ưu tiên xuất đơn', 'Đang đóng hàng'] },
    { id: 'shipping', label: 'Giao vận', statuses: ['Chờ chuyển hàng', 'Gửi hàng đi'] },
    { id: 'completed', label: 'Hoàn thành', statuses: ['Đã giao hàng'] },
    { id: 'cancelled', label: 'Đã huỷ', statuses: ['Huỷ đơn'] },
];

// --- SUB-COMPONENTS ---

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config = STATUS_CONFIG.find(s => s.label === status) || STATUS_CONFIG[0];
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${config.color}`}>
            {config.icon} {status}
        </span>
    );
};

const ZoomModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <img src={url} className="max-w-full max-h-full object-contain" alt="Zoom" />
        <button className="absolute top-4 right-4 text-white text-4xl">&times;</button>
    </div>
);

// --- MAIN COMPONENT ---

const AdminPage: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Order | null>(null);
    const [zoomedImg, setZoomedImg] = useState<string | null>(null);

    // AUTH
    useEffect(() => {
        return onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);
                loadData();
            } else {
                setUser(null);
            }
        });
    }, []);

    const loadData = async () => {
        const [o, p] = await Promise.all([getAllOrders(), getAllParts()]);
        setOrders(o);
        setProducts(p);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try { await signInWithEmailAndPassword(auth, email, pass); } catch { alert('Sai mật khẩu'); }
    };

    const role = useMemo(() => {
        if (!user) return null;
        // Hardcoded admins, everyone else is warehouse
        const ADMINS = ['jinbduong@gmail.com', 'admin@theluvin.com'];
        return (ADMINS.includes(user.email) || user.email.includes('admin')) ? 'admin' : 'warehouse';
    }, [user]);

    // SORTING & FILTERING
    const processedOrders = useMemo(() => {
        let list = [...orders];
        const filter = FILTER_TABS.find(f => f.id === activeFilter);
        
        // Filter
        if (filter && filter.statuses) {
            list = list.filter(o => filter.statuses?.includes(o.status));
        }

        // Sort: Urgent > Near Deadline > Newest
        list.sort((a, b) => {
            if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
            const aNear = isNearDeadline(a.delivery.date);
            const bNear = isNearDeadline(b.delivery.date);
            if (aNear !== bNear) return aNear ? -1 : 1;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        return list;
    }, [orders, activeFilter]);

    // UPDATING & CALCULATING PRICE
    const recalculateTotal = (order: Order): Order => {
        let total = 0;
        order.items.forEach(item => {
            const frame = FRAME_OPTIONS.find(f => f.id === item.frameId);
            if (frame) total += frame.price;
            
            // Base character price
            total += item.characters.length * CHARACTER_BASE_PRICE;

            // Add-ons
            item.characters.forEach(char => {
                if (char.customPrintPrice) total += char.customPrintPrice;
                // Check parts prices (hair, hat, etc.)
                ['hair', 'hat', 'shirt', 'pants'].forEach(key => {
                    const part = (char as any)[key] as LegoPart | undefined;
                    if (part?.price) total += part.price;
                });
                if (char.selectedShirtColor?.price) total += char.selectedShirtColor.price;
                if (char.selectedPantsColor?.price) total += char.selectedPantsColor.price;
            });

            // Accessories
            item.draggableItems.forEach(d => {
                const part = products.find(p => p.id === d.partId);
                if (part?.price) total += part.price;
            });
        });

        const ship = order.shipping.fee || 0;
        const box = order.addGiftBox ? 30000 : 0;
        const finalTotal = total + ship + box;
        
        // Keep deposit ratio
        const ratio = order.totalPrice > 0 ? order.amountToPay / order.totalPrice : 1;
        // Or just standard rule: if deposit method, re-calc 70%
        const amountToPay = order.payment.method === 'deposit' ? Math.round(finalTotal * 0.7) : finalTotal;

        return { ...order, totalPrice: finalTotal, amountToPay };
    };

    const handleSaveOrder = async () => {
        if (!editData || !selectedOrder) return;
        // Recalculate before saving
        const finalOrder = recalculateTotal(editData);
        await updateOrder(finalOrder.id, finalOrder);
        setOrders(prev => prev.map(o => o.id === finalOrder.id ? finalOrder : o));
        setSelectedOrder(finalOrder);
        setIsEditing(false);
        setEditData(null);
        alert('Đã lưu thay đổi!');
    };

    const handleStatusChange = async (status: string) => {
        if (!selectedOrder) return;
        await updateOrder(selectedOrder.id, { status });
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status } : o));
        setSelectedOrder(prev => prev ? { ...prev, status } : null);
    };

    const handleUpdate = async (orderId: string, updates: Partial<Order>) => {
        await updateOrder(orderId, updates);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
             setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
        }
    };

    const handleWarehouseAction = async () => {
        if (!selectedOrder || !user) return;
        if(confirm('Xác nhận đã đóng gói đơn này?')) {
            const updates = {
                status: 'Chờ chuyển hàng',
                packedBy: user.email,
                packedAt: new Date().toISOString()
            };
            await updateOrder(selectedOrder.id, updates);
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...updates } : o));
            setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
        }
    };

    // --- RENDER ---
    if (!user) return (
        <div className="h-screen flex items-center justify-center bg-gray-100">
            <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-80">
                <h2 className="text-2xl font-bold mb-4 text-center">Admin Login</h2>
                <input className="w-full border p-2 mb-2 rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
                <input className="w-full border p-2 mb-4 rounded" type="password" placeholder="Mật khẩu" value={pass} onChange={e=>setPass(e.target.value)}/>
                <button className="w-full bg-black text-white py-2 rounded font-bold">Đăng nhập</button>
            </form>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
            {/* HEADER */}
            <header className="bg-white border-b h-14 flex items-center justify-between px-4 flex-shrink-0 z-20">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-800">The Luvin</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${role === 'admin' ? 'bg-black text-white' : 'bg-indigo-100 text-indigo-700'}`}>{role}</span>
                </div>
                <button onClick={() => signOut(auth)} className="text-sm text-red-500 font-semibold">Đăng xuất</button>
            </header>

            {/* TABS */}
            <div className="bg-white border-b overflow-x-auto no-scrollbar flex-shrink-0">
                <div className="flex px-4">
                    {FILTER_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveFilter(tab.id)}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeFilter === tab.id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                            <span className="ml-1.5 text-xs bg-gray-100 px-1.5 rounded-full">{orders.filter(o => tab.statuses?.includes(o.status)).length || (tab.id==='all'?orders.length:0)}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex flex-1 overflow-hidden relative">
                
                {/* ORDER LIST */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-4 pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {processedOrders.map(order => (
                            <div 
                                key={order.id} 
                                onClick={() => setSelectedOrder(order)}
                                className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md relative ${selectedOrder?.id === order.id ? 'ring-2 ring-black border-transparent' : 'border-gray-200'}`}
                            >
                                {order.isUrgent && <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">GẤP</span>}
                                {isNearDeadline(order.delivery.date) && !order.isUrgent && <span className="absolute top-3 right-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">SẮP ĐẾN HẠN</span>}

                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-lg">{order.id}</span>
                                </div>
                                <div className="mb-3">
                                    <StatusBadge status={order.status} />
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p className="font-semibold text-gray-900">{order.customer.name}</p>
                                    <p>Giao: <span className="font-medium">{new Date(order.delivery.date).toLocaleDateString('vi-VN')}</span></p>
                                    <p>Tổng: <span className="font-bold text-black">{formatCurrency(order.totalPrice)}</span></p>
                                </div>
                            </div>
                        ))}
                        {processedOrders.length === 0 && <div className="col-span-full text-center py-10 text-gray-400">Không có đơn hàng nào.</div>}
                    </div>
                </div>

                {/* DRAWER (SIDE PANEL) */}
                <div className={`fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${selectedOrder ? 'translate-x-0' : 'translate-x-full'}`}>
                    {selectedOrder && (
                        <>
                            {/* DRAWER HEADER */}
                            <div className="h-14 border-b flex items-center justify-between px-4 bg-gray-50 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg">{selectedOrder.id}</h3>
                                    {isEditing && <span className="bg-yellow-300 text-yellow-900 text-[10px] font-bold px-2 rounded">ĐANG SỬA</span>}
                                </div>
                                <button onClick={() => { setSelectedOrder(null); setIsEditing(false); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-xl">&times;</button>
                            </div>

                            {/* DRAWER BODY */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                
                                {/* 1. ADMIN CONTROLS */}
                                {role === 'admin' && !isEditing && (
                                    <div className="bg-gray-100 p-3 rounded-lg flex gap-2">
                                        <button onClick={() => { setEditData(selectedOrder); setIsEditing(true); }} className="flex-1 bg-white border shadow-sm py-2 rounded font-semibold text-sm hover:bg-gray-50">✏️ Chỉnh sửa đơn</button>
                                        <button onClick={() => { if(confirm('Xóa đơn này?')) { deleteOrder(selectedOrder.id); setSelectedOrder(null); loadData(); } }} className="px-3 bg-white border shadow-sm rounded text-red-600 hover:bg-red-50">🗑️</button>
                                        <button onClick={() => handleUpdate(selectedOrder.id, { isUrgent: !selectedOrder.isUrgent })} className={`px-3 border shadow-sm rounded font-bold ${selectedOrder.isUrgent ? 'bg-red-100 text-red-600' : 'bg-white text-gray-400'}`}>!</button>
                                    </div>
                                )}

                                {/* 2. CUSTOMER INFO */}
                                <div className="border rounded-lg p-4 bg-white shadow-sm">
                                    <h4 className="font-bold text-gray-900 mb-3 border-b pb-2">Khách hàng & Vận chuyển</h4>
                                    {isEditing && editData ? (
                                        <div className="space-y-3">
                                            <input className="w-full border p-2 rounded text-sm" value={editData.customer.name} onChange={e => setEditData({...editData, customer: {...editData.customer, name: e.target.value}})} placeholder="Tên khách" />
                                            <input className="w-full border p-2 rounded text-sm" value={editData.customer.phone} onChange={e => setEditData({...editData, customer: {...editData.customer, phone: e.target.value}})} placeholder="SĐT" />
                                            <textarea className="w-full border p-2 rounded text-sm" value={editData.customer.address} onChange={e => setEditData({...editData, customer: {...editData.customer, address: e.target.value}})} placeholder="Địa chỉ" rows={2} />
                                            <input type="date" className="w-full border p-2 rounded text-sm" value={editData.delivery.date} onChange={e => setEditData({...editData, delivery: {...editData.delivery, date: e.target.value}})} />
                                            <textarea className="w-full border p-2 rounded text-sm bg-yellow-50" value={editData.internalNotes || ''} onChange={e => setEditData({...editData, internalNotes: e.target.value})} placeholder="Ghi chú nội bộ (Admin only)" />
                                        </div>
                                    ) : (
                                        <div className="text-sm space-y-2">
                                            <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Tên:</span> <span className="col-span-2 font-medium">{selectedOrder.customer.name}</span></div>
                                            <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">SĐT:</span> <span className="col-span-2 font-medium select-all text-blue-600">{selectedOrder.customer.phone}</span></div>
                                            <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Địa chỉ:</span> <span className="col-span-2 select-all">{selectedOrder.customer.address}</span></div>
                                            <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Deadline:</span> <span className={`col-span-2 font-bold ${isNearDeadline(selectedOrder.delivery.date) ? 'text-red-600' : 'text-green-600'}`}>{selectedOrder.delivery.date}</span></div>
                                            {selectedOrder.internalNotes && <div className="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-yellow-800 text-xs italic">Note: {selectedOrder.internalNotes}</div>}
                                            {selectedOrder.delivery.notes && <div className="mt-2 p-2 bg-gray-50 border rounded text-gray-600 text-xs">Khách note: {selectedOrder.delivery.notes}</div>}
                                        </div>
                                    )}
                                </div>

                                {/* 3. ORDER ITEMS (THE CORE PART) */}
                                <div className="space-y-4">
                                    {(isEditing && editData ? editData.items : selectedOrder.items).map((item, idx) => (
                                        <div key={idx} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                            {/* Item Header */}
                                            <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                                                <span className="font-bold text-sm">Sản phẩm #{idx + 1}</span>
                                                {isEditing && editData && (
                                                    <select 
                                                        className="text-xs border rounded p-1"
                                                        value={item.frameId}
                                                        onChange={e => {
                                                            const newItems = [...editData.items];
                                                            newItems[idx].frameId = e.target.value;
                                                            setEditData(recalculateTotal({...editData, items: newItems}));
                                                        }}
                                                    >
                                                        {FRAME_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                    </select>
                                                )}
                                                {!isEditing && <span className="text-xs bg-white px-2 py-1 rounded border">{FRAME_OPTIONS.find(f=>f.id===item.frameId)?.name}</span>}
                                            </div>

                                            <div className="p-3 flex flex-col sm:flex-row gap-4">
                                                {/* Preview Image */}
                                                <div className="w-full sm:w-1/3 aspect-square bg-gray-100 rounded-lg border flex items-center justify-center overflow-hidden relative group">
                                                    {item.previewImageUrl ? (
                                                        <>
                                                            <img src={item.previewImageUrl} className="w-full h-full object-contain" />
                                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => setZoomedImg(item.previewImageUrl!)}>
                                                                <span className="text-white font-bold border border-white px-3 py-1 rounded-full text-xs">Phóng to</span>
                                                            </div>
                                                        </>
                                                    ) : <span className="text-xs text-gray-400">No preview</span>}
                                                </div>

                                                {/* Details List */}
                                                <div className="flex-1 space-y-3">
                                                    
                                                    {/* Characters */}
                                                    <div>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <h5 className="text-xs font-bold uppercase text-gray-500">Nhân vật ({item.characters.length})</h5>
                                                            {isEditing && editData && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const newItems = [...editData.items];
                                                                        newItems[idx].characters.push({ id: Date.now(), x: 50, y: 50, rotation: 0, scale: 1 });
                                                                        setEditData(recalculateTotal({...editData, items: newItems}));
                                                                    }}
                                                                    className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold"
                                                                >
                                                                    + Thêm
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {item.characters.map((char, cIdx) => (
                                                                <div key={cIdx} className="bg-gray-50 p-2 rounded border text-xs relative">
                                                                    <span className="font-bold block mb-1 text-gray-700">NV {cIdx+1}</span>
                                                                    {isEditing && editData ? (
                                                                        <div className="grid grid-cols-2 gap-1">
                                                                            {['hair', 'face', 'shirt', 'pants', 'hat'].map(partType => (
                                                                                 <select 
                                                                                    key={partType}
                                                                                    className="border rounded p-1 w-full"
                                                                                    value={(char as any)[partType]?.id || ''}
                                                                                    onChange={e => {
                                                                                        const part = products.find(p => p.id === e.target.value);
                                                                                        const newItems = [...editData.items];
                                                                                        // @ts-ignore
                                                                                        newItems[idx].characters[cIdx][partType] = part;
                                                                                        // If changing shirt/pants, reset color to default or keep if logic allows
                                                                                        setEditData(recalculateTotal({...editData, items: newItems}));
                                                                                    }}
                                                                                 >
                                                                                     <option value="">- {partType} -</option>
                                                                                     {products.filter(p => p.type === partType).map(p => <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price)})</option>)}
                                                                                 </select>
                                                                            ))}
                                                                            <button onClick={() => {
                                                                                const newItems = [...editData.items];
                                                                                newItems[idx].characters = newItems[idx].characters.filter((_, i) => i !== cIdx);
                                                                                setEditData(recalculateTotal({...editData, items: newItems}));
                                                                            }} className="col-span-2 bg-red-100 text-red-600 py-1 rounded font-bold mt-1">Xoá NV này</button>
                                                                        </div>
                                                                    ) : (
                                                                        <ul className="space-y-0.5 text-gray-600">
                                                                            <li>Tóc: <b>{char.hair?.name || 'Không'}</b></li>
                                                                            <li>Mặt: <b>{char.face?.name || 'Mặc định'}</b></li>
                                                                            <li>Áo: <b>{char.shirt?.name}</b> {char.selectedShirtColor && <span className="inline-block w-2 h-2 rounded-full ml-1 border" style={{backgroundColor: char.selectedShirtColor.hex}}></span>}</li>
                                                                            <li>Quần: <b>{char.pants?.name}</b> {char.selectedPantsColor && <span className="inline-block w-2 h-2 rounded-full ml-1 border" style={{backgroundColor: char.selectedPantsColor.hex}}></span>}</li>
                                                                            {char.hat && <li>Mũ: <b>{char.hat.name}</b></li>}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Accessories */}
                                                    {item.draggableItems.length > 0 && (
                                                        <div>
                                                            <h5 className="text-xs font-bold uppercase text-gray-500 mb-1">Phụ kiện</h5>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.draggableItems.map((acc, aIdx) => {
                                                                    const part = products.find(p => p.id === acc.partId);
                                                                    return (
                                                                        <span key={aIdx} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">
                                                                            {part?.name || (acc.type === 'charm' ? 'Charm ảnh' : 'Unknown')}
                                                                        </span>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 4. FINANCIAL SUMMARY */}
                                <div className="bg-gray-50 rounded-lg p-4 border space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Tổng tiền hàng</span> <span>{formatCurrency((isEditing && editData ? editData.totalPrice : selectedOrder.totalPrice) - (selectedOrder.shipping.fee || 0) - (selectedOrder.addGiftBox ? 30000 : 0))}</span></div>
                                    <div className="flex justify-between"><span>Phí vận chuyển</span> <span>{formatCurrency(selectedOrder.shipping.fee || 0)}</span></div>
                                    {selectedOrder.addGiftBox && <div className="flex justify-between"><span>Hộp quà</span> <span>{formatCurrency(30000)}</span></div>}
                                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                                        <span>Tổng cộng</span>
                                        <span>{formatCurrency(isEditing && editData ? editData.totalPrice : selectedOrder.totalPrice)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-red-600">
                                        <span>Cần thu (COD/CK)</span>
                                        <span>{formatCurrency(isEditing && editData ? editData.amountToPay : selectedOrder.amountToPay)}</span>
                                    </div>
                                </div>

                                <div className="h-20"></div> {/* Spacer */}
                            </div>

                            {/* DRAWER FOOTER ACTIONS */}
                            <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                {isEditing ? (
                                    <div className="flex gap-3">
                                        <button onClick={() => { setIsEditing(false); setEditData(null); }} className="flex-1 py-3 bg-gray-200 rounded-lg font-bold text-gray-700">Huỷ</button>
                                        <button onClick={handleSaveOrder} className="flex-1 py-3 bg-black text-white rounded-lg font-bold">Lưu thay đổi</button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {role === 'admin' && (
                                            <select 
                                                className="w-full p-3 border rounded-lg bg-gray-50 font-medium mb-2"
                                                value={selectedOrder.status}
                                                onChange={e => handleStatusChange(e.target.value)}
                                            >
                                                {STATUS_CONFIG.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                                            </select>
                                        )}
                                        
                                        {/* Warehouse Main Action */}
                                        {role === 'warehouse' && !selectedOrder.packedBy && (
                                            <button onClick={handleWarehouseAction} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-lg shadow-lg text-lg hover:bg-indigo-700 active:scale-95 transition-transform flex items-center justify-center gap-2">
                                                <span>📦</span> Xác nhận đã đóng gói
                                            </button>
                                        )}
                                        {selectedOrder.packedBy && (
                                            <div className="w-full py-3 bg-green-100 text-green-800 font-bold rounded-lg text-center border border-green-200 flex flex-col items-center">
                                                <span>✅ Đã đóng gói</span>
                                                <span className="text-[10px] font-normal opacity-75">Bởi {selectedOrder.packedBy} lúc {new Date(selectedOrder.packedAt!).toLocaleTimeString('vi-VN')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {zoomedImg && <ZoomModal url={zoomedImg} onClose={() => setZoomedImg(null)} />}
        </div>
    );
};

export default AdminPage;