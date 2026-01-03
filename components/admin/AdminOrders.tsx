
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, LegoPart, FrameOption, LegoCharacterConfig, DraggableItem, FrameConfig } from '../../types';
import { updateOrder, deleteOrder, countPartsInOrder } from '../../services/orderService';
import { adjustStock } from '../../services/productService';
import { calculatePrice, formatCurrency } from '../../utils/pricing';
import { StatusDropdown } from './shared/StatusDropdown';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';
import { ZoomIcon } from '../ZoomIcon';
import FramePreview from '../FramePreview';

const STATUS_CONFIG = [
    { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800', icon: '🕒' },
    { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800', icon: '🛡️' }, 
    { label: 'Ưu tiên xuất đơn', color: 'bg-pink-100 text-pink-800', icon: '⚡' },
    { label: 'Đang đóng hàng', color: 'bg-indigo-100 text-indigo-800', icon: '🎁' },
    { label: 'Chờ chuyển hàng', color: 'bg-purple-100 text-purple-800', icon: '✓' }, 
    { label: 'Gửi hàng đi', color: 'bg-orange-100 text-orange-800', icon: '🚚' },
    { label: 'Đã giao hàng', color: 'bg-green-100 text-green-800', icon: '✅' },
    { label: 'Huỷ đơn', color: 'bg-red-100 text-red-800', icon: '❌' },
    { label: 'Xoá đơn', color: 'bg-gray-200 text-gray-800', icon: '🗑️', isAction: true }, 
];

const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');
const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN');

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

const getVietQR = (order: Order) => {
    const BANK_ID = '970407'; 
    const ACCOUNT_NO = '65838666666';
    const TEMPLATE = 'compact2';
    const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
    const amount = order.amountToPay || order.totalPrice;
    return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
};

const downloadImage = async (url: string, filename: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(url, '_blank');
    }
};

interface AdminOrdersProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    products: LegoPart[];
    frames: FrameOption[];
    currentUser: any;
    role: 'admin' | 'warehouse' | null;
    onRefreshProducts: () => void;
}

export const AdminOrders: React.FC<AdminOrdersProps> = ({ orders, setOrders, products, frames, currentUser, role, onRefreshProducts }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);
    const [amountPaidInput, setAmountPaidInput] = useState(0);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [orderTab, setOrderTab] = useState<'active' | 'history'>('active');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [orderSearch, setOrderSearch] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [addingAccessoryToItemIndex, setAddingAccessoryToItemIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const canCancelOrder = role === 'admin';
    const canDeleteOrder = role === 'admin';

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
            setAdminDeadlineInput(selectedOrder.adminDeadline || '');
        }
    }, [selectedOrder]);

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);

    const filteredOrders = useMemo(() => {
        let result = [...orders];
        if (orderTab === 'active') result = result.filter(o => !['Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'].includes(o.status));
        else result = result.filter(o => ['Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'].includes(o.status));
        if (orderSearch.trim()) {
            const s = orderSearch.toLowerCase();
            result = result.filter(o => o.id.toLowerCase().includes(s) || o.customer.phone.includes(s) || (o.customer.name && o.customer.name.toLowerCase().includes(s)));
        }
        if (filterStatus !== 'all') result = result.filter(o => o.status === filterStatus);
        if (sortMode === 'urgent') result.sort((a, b) => (a.isUrgent === b.isUrgent ? 0 : a.isUrgent ? -1 : 1));
        else result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return result;
    }, [orders, orderTab, sortMode, filterStatus, orderSearch]);

    const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => {
        const success = await updateOrder(orderId, updates); 
        if (success) { 
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); 
            if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); 
            if (showMsg) alert("Đã cập nhật!"); 
        }
    };

    const handleConfirmPayment = async () => {
        if (!selectedOrder) return;
        const expected = selectedOrder.payment.method === 'deposit' ? Math.round(selectedOrder.totalPrice * 0.7) : selectedOrder.totalPrice;
        await handleUpdate(selectedOrder.id, { status: 'Đã xác nhận', amountPaid: expected, amountToPay: selectedOrder.totalPrice - expected });
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 relative">
            {/* List Sidebar */}
            <div className={`lg:w-1/3 w-full bg-white border-r flex flex-col ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 bg-gray-50 border-b space-y-2">
                    <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                        <button onClick={() => setOrderTab('active')} className={`flex-1 py-2 text-xs font-bold rounded ${orderTab === 'active' ? 'bg-white shadow' : 'text-gray-500'}`}>Đang xử lý</button>
                        <button onClick={() => setOrderTab('history')} className={`flex-1 py-2 text-xs font-bold rounded ${orderTab === 'history' ? 'bg-white shadow' : 'text-gray-500'}`}>Lịch sử</button>
                    </div>
                    <input type="text" placeholder="Tìm kiếm..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full p-2 border rounded text-sm" />
                </div>
                <div className="overflow-y-auto flex-grow divide-y">
                    {paginatedOrders.map(order => (
                        <div key={order.id} onClick={() => setSelectedOrder(order)} className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-blue-50' : ''}`}>
                            <div className="flex justify-between font-bold text-sm"><span>{order.id}</span><span>{formatCurrency(order.totalPrice, 'admin')}</span></div>
                            <div className="text-xs text-gray-500 mt-1">{order.customer.name} • {order.customer.phone}</div>
                            <div className="text-[10px] mt-2 bg-gray-100 w-max px-2 py-0.5 rounded-full">{order.status}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail Content */}
            <div className={`lg:w-2/3 w-full bg-white flex flex-col ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                {selectedOrder ? (
                    <div className="flex-grow overflow-y-auto">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedOrder(null)} className="lg:hidden text-gray-500 mr-2 font-bold">&larr;</button>
                                <h2 className="text-2xl font-bold">{selectedOrder.id}</h2>
                                <StatusDropdown currentStatus={selectedOrder.status} onStatusChange={s => handleUpdate(selectedOrder.id, { status: s })} canCancel={role === 'admin'} canDelete={role === 'admin'} />
                            </div>
                            {selectedOrder.status === 'Chờ thanh toán' && (
                                <button onClick={handleConfirmPayment} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Xác nhận thanh toán</button>
                            )}
                        </div>

                        <div className="p-6 space-y-8">
                            {/* CUSTOM FORM DATA SECTION - MOVED TO TOP FOR VISIBILITY */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-sm font-black text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span>📝</span> Thông tin thiết kế theo yêu cầu (Form)
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {selectedOrder.items.map((item, itemIdx) => (
                                        <div key={itemIdx} className="bg-white border border-blue-100 rounded-lg p-4">
                                            <p className="text-xs font-bold text-gray-400 mb-3 border-b pb-1">SẢN PHẨM {itemIdx + 1}: Khung {item.frameId.toUpperCase()}</p>
                                            
                                            {item.customFormData && Object.keys(item.customFormData).length > 0 ? (
                                                <div className="space-y-4">
                                                    {Object.entries(item.customFormData).map(([fieldId, value]) => {
                                                        const isImage = typeof value === 'string' && value.startsWith('data:image');
                                                        const isUrl = typeof value === 'string' && value.startsWith('http');
                                                        
                                                        // Get label from formFields if exists, else use raw id
                                                        const fieldObj = item.formFields?.find(f => f.id === fieldId);
                                                        const label = fieldObj?.label || fieldId;

                                                        return (
                                                            <div key={fieldId} className="flex flex-col gap-1.5">
                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{label}:</span>
                                                                
                                                                {(isImage || isUrl) ? (
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-20 h-20 bg-gray-100 rounded border border-blue-200 overflow-hidden cursor-pointer flex-shrink-0" onClick={() => setZoomedImageUrl(value)}>
                                                                            <img src={value} className="w-full h-full object-cover" alt="customer input" />
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => downloadImage(value, `TL_${selectedOrder.id}_Item${itemIdx+1}_${label}.png`)}
                                                                            className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 transition-colors"
                                                                        >
                                                                            Tải ảnh khách gửi
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-gray-800 font-bold bg-gray-50 p-2 rounded border border-gray-100 select-all">
                                                                        {value || '---'}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400 italic">Khách không nhập thêm thông tin cho món này.</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="font-bold border-b pb-2 uppercase text-xs text-gray-400">Khách hàng</h3>
                                    <div className="text-sm space-y-1">
                                        <p><b>{selectedOrder.customer.name}</b></p>
                                        <p className="text-blue-600 font-bold">{selectedOrder.customer.phone}</p>
                                        <p>{selectedOrder.customer.address}</p>
                                        <p className="mt-2 text-xs italic bg-yellow-50 p-2 rounded border border-yellow-100">" {selectedOrder.delivery.notes} "</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-bold border-b pb-2 uppercase text-xs text-gray-400">Thanh toán</h3>
                                    <div className="text-sm space-y-2 bg-gray-50 p-4 rounded-xl border">
                                        <div className="flex justify-between"><span>Tổng đơn:</span><span className="font-bold">{formatCurrency(selectedOrder.totalPrice, 'admin')}</span></div>
                                        <div className="flex justify-between text-green-600"><span>Đã thu:</span><span className="font-bold">{formatCurrency(selectedOrder.amountPaid || 0, 'admin')}</span></div>
                                        <div className="flex justify-between text-red-600 border-t pt-2 mt-1"><span>Còn lại (COD):</span><span className="font-black text-lg">{formatCurrency(selectedOrder.totalPrice - (selectedOrder.amountPaid || 0), 'admin')}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold border-b pb-2 uppercase text-xs text-gray-400">Sản phẩm chi tiết</h3>
                                <div className="space-y-4">
                                    {selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 border p-4 rounded-xl shadow-sm">
                                            <div className="w-24 h-24 bg-gray-50 rounded border overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => setZoomedImageUrl(item.previewImageUrl || null)}>
                                                <img src={item.previewImageUrl} className="w-full h-full object-contain" />
                                            </div>
                                            <div className="flex-grow">
                                                <p className="font-bold">Khung {item.frameId.toUpperCase()}</p>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {item.characters.map((char, cIdx) => (
                                                        <div key={cIdx} className="text-xs bg-gray-100 p-2 rounded">
                                                            <b>NV {cIdx + 1}:</b> {char.hair?.name}, {char.face?.name}, {char.shirt?.name}, {char.pants?.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-gray-400 italic">Chọn một đơn hàng để xử lý</div>
                )}
            </div>

            {zoomedImageUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImageUrl(null)}>
                    <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain" />
                </div>
            )}
        </div>
    );
};
