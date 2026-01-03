
import React, { useState, useEffect, useRef } from 'react';
import { Order, FrameOption } from '../types';
import { getOrderById, getOrdersByPhone, updateOrder } from '../services/orderService';
import { uploadToCloudinary } from '../services/uploadService';
import { MOCK_ORDERS, FRAME_OPTIONS } from '../constants';
import { formatCurrency } from '../utils/pricing';
import { getAllFrames } from '../services/frameService';
import { ZoomIcon } from '../components/ZoomIcon';

const PACKED_STATUSES = ['Đang đóng hàng', 'Chờ chuyển hàng', 'Gửi hàng đi', 'Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'];

export const OrderLookupPage: React.FC<{onZoomImage: (url: string) => void; onEditOrder: (order: Order) => void}> = ({onZoomImage, onEditOrder}) => {
    const [orderCode, setOrderCode] = useState('');
    const [foundOrder, setFoundOrder] = useState<Order | null | 'not_found' | 'permission_error'>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [savedOrders, setSavedOrders] = useState<{id: string, date: number}[]>([]);
    const [frames, setFrames] = useState<FrameOption[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('my_orders') || '[]');
            if (Array.isArray(saved)) setSavedOrders(saved);
        } catch(e) {}
        getAllFrames().then(f => setFrames(f));
    }, []);

    const handleSearch = async (e?: React.FormEvent, codeOverride?: string) => {
        if (e) e.preventDefault();
        let codeToSearch = (codeOverride || orderCode).trim().toUpperCase();
        if (!codeToSearch) return;
        const isPhone = /^0\d{9}$/.test(codeToSearch);
        if (!isPhone && !codeToSearch.startsWith('#')) codeToSearch = '#' + codeToSearch;
        if (codeOverride) setOrderCode(codeToSearch);

        setIsLoading(true);
        setFoundOrder(null);
        try {
            let order: Order | null = null;
            if (isPhone) {
                const orders = await getOrdersByPhone(codeToSearch);
                if (orders.length > 0) order = orders[0];
            } else {
                order = await getOrderById(codeToSearch);
                if (!order) order = MOCK_ORDERS[codeToSearch] || null;
            }
            setFoundOrder(order || 'not_found');
        } catch (error: any) {
            setFoundOrder(error.code === 'permission-denied' ? 'permission_error' : 'not_found');
        } finally {
            setIsLoading(false);
        }
    };

    const StatusTracker: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
        const steps = [
            { label: 'Chờ thanh toán', icon: '💳' },
            { label: 'Đã xác nhận', icon: '📦' },
            { label: 'Đang xử lý', icon: '⚙️' },
            { label: 'Đang giao', icon: '🚚' },
            { label: 'Hoàn thành', icon: '❤️' }
        ];
        const getStepIndex = (s: string) => {
            if (['Huỷ đơn', 'Xoá đơn'].includes(s)) return -1;
            if (s === 'Chờ thanh toán') return 0;
            if (s === 'Đã xác nhận') return 1;
            if (['Ưu tiên xuất đơn', 'Đang đóng hàng', 'Chờ chuyển hàng'].includes(s)) return 2;
            if (['Gửi hàng đi', 'Đang giao hàng'].includes(s)) return 3;
            if (s === 'Đã giao hàng') return 4;
            return 0;
        };
        const currentIdx = getStepIndex(currentStatus);
        if (currentIdx === -1) return <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center font-bold mb-6">Đơn hàng đã bị huỷ</div>;
        return (
            <div className="mb-8 w-full relative flex justify-between">
                <div className="absolute top-4 left-0 w-full h-1 bg-gray-100 -z-10"></div>
                <div className="absolute top-4 left-0 h-1 bg-luvin-pink -z-10 transition-all duration-1000" style={{ width: `${(currentIdx / (steps.length-1)) * 100}%` }}></div>
                {steps.map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white ${idx <= currentIdx ? 'border-luvin-pink text-luvin-pink' : 'border-gray-200 text-gray-300'}`}>{step.icon}</div>
                        <p className={`mt-2 text-[9px] font-bold ${idx <= currentIdx ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</p>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-body pb-20">
            <div className="bg-white py-12 text-center border-b"><h1 className="text-3xl font-heading font-bold">Tra Cứu Đơn Hàng</h1></div>
            <div className="container mx-auto px-4 -mt-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-white rounded-2xl shadow-xl p-6 border">
                        <form onSubmit={handleSearch} className="flex gap-3">
                            <input value={orderCode} onChange={e => setOrderCode(e.target.value)} placeholder="Mã đơn (#TLxxxxxx) hoặc SĐT" className="flex-grow p-3 border rounded-xl outline-none focus:ring-2 focus:ring-luvin-pink uppercase" />
                            <button type="submit" disabled={isLoading} className="bg-gray-900 text-white font-bold px-6 rounded-xl hover:bg-luvin-pink transition-all">Tìm kiếm</button>
                        </form>
                    </div>

                    {foundOrder && typeof foundOrder === 'object' && (
                        <div className="bg-white rounded-2xl border shadow-xl overflow-hidden animate-fade-in">
                            <div className="bg-gray-50 p-6 border-b flex justify-between items-center">
                                <div><h2 className="font-heading font-bold text-2xl">{foundOrder.id}</h2><p className="text-sm text-gray-500">Trạng thái: {foundOrder.status}</p></div>
                                {!PACKED_STATUSES.includes(foundOrder.status) && <button onClick={() => onEditOrder(foundOrder)} className="bg-white border px-4 py-2 rounded-xl text-sm font-bold shadow-sm">Sửa đơn hàng</button>}
                            </div>
                            <div className="p-6 md:p-8">
                                <StatusTracker currentStatus={foundOrder.status} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-1">Chi tiết sản phẩm</h4>
                                        {foundOrder.items.map((item, idx) => (
                                            <div key={idx} className="border rounded-xl p-3 space-y-3 bg-white">
                                                <div className="flex gap-3">
                                                    <img src={item.previewImageUrl} className="w-16 h-16 object-contain rounded border" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)} />
                                                    <div className="flex-grow">
                                                        <p className="font-bold text-sm text-gray-800">Khung LEGO {item.frameId.toUpperCase()}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold">{item.characters.length} nhân vật x {item.quantity || 1}</p>
                                                    </div>
                                                </div>

                                                {/* HIỂN THỊ THÔNG TIN KHÁCH ĐÃ ĐIỀN ĐỂ KHÁCH ĐỐI SOÁT */}
                                                {item.customFormData && Object.keys(item.customFormData).length > 0 && (
                                                    <div className="p-3 bg-pink-50/50 border border-pink-100 rounded-lg">
                                                        <p className="text-[9px] font-black text-pink-600 uppercase mb-2">✨ Thông tin in ấn bạn đã cung cấp:</p>
                                                        <div className="space-y-1.5">
                                                            {Object.entries(item.customFormData).map(([key, value]) => {
                                                                if (!value) return null;
                                                                const isImage = value.startsWith('data:image') || value.startsWith('http');
                                                                return (
                                                                    <div key={key} className="flex justify-between items-start text-xs border-b border-pink-100/30 pb-1 last:border-0">
                                                                        <span className="text-gray-500 font-medium capitalize">{key}:</span>
                                                                        {isImage ? (
                                                                            <img src={value} className="w-8 h-8 rounded border border-pink-200 object-cover cursor-zoom-in" onClick={() => onZoomImage(value)} />
                                                                        ) : (
                                                                            <span className="font-bold text-gray-800 text-right max-w-[150px] truncate">{value}</span>
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
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-1 mb-4">Thông tin người nhận</h4>
                                        <div className="bg-gray-50 p-4 rounded-xl text-sm space-y-2">
                                            <p><span className="text-gray-500 inline-block w-20">Người nhận:</span> <strong>{foundOrder.customer.name}</strong></p>
                                            <p><span className="text-gray-500 inline-block w-20">SĐT:</span> <strong>{foundOrder.customer.phone}</strong></p>
                                            <p><span className="text-gray-500 inline-block w-20">Địa chỉ:</span> {foundOrder.customer.address}</p>
                                            <div className="border-t pt-2 mt-2 font-bold text-lg text-luvin-pink flex justify-between">
                                                <span>Tổng cộng:</span>
                                                <span>{formatCurrency(foundOrder.totalPrice)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
