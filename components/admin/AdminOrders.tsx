import React, { useState } from 'react';
import { Order, LegoPart, FrameOption } from '../../types';
import { updateOrder, deleteOrder } from '../../services/orderService';
import { formatCurrency } from '../../utils/pricing';
import { StatusDropdown } from './shared/StatusDropdown';

interface AdminOrdersProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    products: LegoPart[];
    frames: FrameOption[];
    currentUser: any;
    role: any;
    onRefreshProducts: () => Promise<void>;
}

export const AdminOrders: React.FC<AdminOrdersProps> = ({ 
    orders, 
    setOrders, 
    products, 
    frames, 
    currentUser, 
    role, 
    onRefreshProducts 
}) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orderSearch, setOrderSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Fix: Helper function to download customer-uploaded images
    const downloadImage = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpdate = async (orderId: string, updates: Partial<Order>) => {
        setLoading(true);
        const success = await updateOrder(orderId, updates);
        if (success) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
            }
        } else {
            alert("Lỗi cập nhật đơn hàng.");
        }
        setLoading(false);
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (confirm(`Bạn chắc chắn muốn XOÁ VĨNH VIỄN đơn hàng ${selectedOrder.id}?`)) {
            setLoading(true);
            const success = await deleteOrder(selectedOrder.id);
            if (success) {
                setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
                setSelectedOrder(null);
            }
            setLoading(false);
        }
    };

    const filteredOrders = React.useMemo(() => {
        let result = [...orders];
        if (orderSearch) {
            const search = orderSearch.toLowerCase();
            result = result.filter(o => o.id.toLowerCase().includes(search) || o.customer.phone.includes(search));
        }
        if (filterStatus !== 'all') {
            result = result.filter(o => o.status === filterStatus);
        }
        return result.sort((a, b) => b.createdAt - a.createdAt);
    }, [orders, orderSearch, filterStatus]);

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
            {/* List Sidebar */}
            <div className={`lg:w-1/3 w-full bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b bg-gray-50 flex flex-col gap-2">
                    <input 
                        type="text" 
                        placeholder="Tìm mã đơn hoặc SĐT..." 
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-full p-2.5 border rounded-lg text-sm bg-white"
                    />
                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full p-2 border rounded-lg text-sm bg-white"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="Chờ thanh toán">Chờ thanh toán</option>
                        <option value="Đã xác nhận">Đã xác nhận</option>
                        <option value="Đang đóng hàng">Đang đóng hàng</option>
                        <option value="Đã giao hàng">Đã giao hàng</option>
                        <option value="Huỷ đơn">Huỷ đơn</option>
                    </select>
                </div>
                <div className="overflow-y-auto flex-grow divide-y">
                    {filteredOrders.map(order => (
                        <div 
                            key={order.id} 
                            onClick={() => setSelectedOrder(order)}
                            className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-blue-50' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-gray-900">{order.id}</span>
                                <span className="text-[10px] font-bold uppercase text-gray-400">{order.status}</span>
                            </div>
                            <p className="text-sm text-gray-600">{order.customer.name}</p>
                            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className={`lg:w-2/3 w-full bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                {selectedOrder ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedOrder(null)} className="lg:hidden p-2 bg-gray-100 rounded-full">&larr;</button>
                                <h2 className="text-2xl font-black text-gray-900">{selectedOrder.id}</h2>
                                <StatusDropdown 
                                    currentStatus={selectedOrder.status}
                                    onStatusChange={(status) => handleUpdate(selectedOrder.id, { status })}
                                    canCancel={role === 'admin'}
                                    canDelete={role === 'admin'}
                                    onDelete={handleDeleteOrder}
                                />
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            <div>
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest border-b pb-2 mb-4">Sản phẩm chi tiết</h3>
                                <div className="space-y-6">
                                    {selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="border rounded-2xl p-5 bg-gray-50/50">
                                            <div className="flex gap-4 mb-6">
                                                <div className="w-24 h-24 bg-white border-2 border-white shadow-sm rounded-xl overflow-hidden flex-shrink-0">
                                                    <img src={item.previewImageUrl} className="w-full h-full object-contain" alt="Preview" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-gray-800 mb-1">Khung {item.frameId.toUpperCase()}</p>
                                                    <p className="text-xs font-bold text-gray-400 uppercase">{item.characters.length} nhân vật • {item.background.type === 'color' ? 'Nền màu' : 'Nền ảnh'}</p>
                                                </div>
                                            </div>

                                            {/* CUSTOMER FORM DATA SECTION (Step 2 inputs) - INTEGRATED SNIPPET FIX */}
                                            {item.customFormData && Object.keys(item.customFormData).length > 0 && (
                                                <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl">
                                                    <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span> 📝 Thông tin tùy chỉnh (Khách nhập)
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {Object.entries(item.customFormData).map(([key, value]) => {
                                                            if (!value) return null;
                                                            
                                                            // Handle array of images
                                                            if (Array.isArray(value)) {
                                                                return (
                                                                    <div key={key} className="flex flex-col gap-2">
                                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{key}:</span>
                                                                        <div className="flex flex-wrap gap-3">
                                                                            {value.map((img, i) => (
                                                                                <div key={i} className="flex flex-col items-center gap-1.5">
                                                                                    <div className="w-14 h-14 rounded-xl border-2 border-white shadow-sm bg-white overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => setZoomedImageUrl(img)}>
                                                                                        <img src={img} className="w-full h-full object-cover" />
                                                                                    </div>
                                                                                    <button onClick={() => downloadImage(img, `TL_${selectedOrder.id}_${key}_${i+1}.png`)} className="text-[9px] text-blue-600 font-black uppercase hover:underline">Lưu</button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            const isSingleImage = typeof value === 'string' && value.startsWith('data:');
                                                            return (
                                                                <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight sm:w-32 flex-shrink-0">{key}:</span>
                                                                    {isSingleImage ? (
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-14 h-14 rounded-xl border-2 border-white shadow-sm bg-white overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => setZoomedImageUrl(value)}>
                                                                                <img src={value} className="w-full h-full object-cover" />
                                                                            </div>
                                                                            <button onClick={() => downloadImage(value, `TL_${selectedOrder.id}_${key}.png`)} className="text-[10px] text-blue-600 font-black uppercase hover:underline">Lưu ảnh</button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-sm font-bold text-gray-800 break-words">{(value as React.ReactNode)}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-gray-300 gap-4">
                        <span className="text-5xl opacity-20">📦</span>
                        <p className="italic font-medium">Chọn một đơn hàng để xem chi tiết.</p>
                    </div>
                )}
            </div>

            {/* Local Zoom UI */}
            {zoomedImageUrl && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-fade-in" onClick={() => setZoomedImageUrl(null)}>
                    <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="Preview" />
                    <button className="absolute top-6 right-6 text-white text-4xl font-light hover:scale-110 transition-transform">&times;</button>
                </div>
            )}

            {loading && (
                <div className="fixed inset-0 z-[110] bg-black/30 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-4">
                        <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-black text-gray-800 uppercase tracking-widest text-sm">Đang xử lý...</span>
                    </div>
                </div>
            )}
        </div>
    );
};