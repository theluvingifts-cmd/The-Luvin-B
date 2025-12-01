
import React, { useState, useEffect, useRef } from 'react';
import { Order } from '../types';
import { getOrderById, getOrdersByPhone, updateOrder } from '../services/orderService';
import { uploadToCloudinary } from '../services/uploadService';
import { MOCK_ORDERS } from '../constants';
import { formatCurrency } from '../utils/pricing';

// Orders that can be edited by customer must not have these statuses
const PACKED_STATUSES = ['Đang đóng hàng', 'Chờ chuyển hàng', 'Gửi hàng đi', 'Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'];

export const OrderLookupPage: React.FC<{onZoomImage: (url: string) => void; onEditOrder: (order: Order) => void}> = ({onZoomImage, onEditOrder}) => {
    const [orderCode, setOrderCode] = useState('');
    const [foundOrder, setFoundOrder] = useState<Order | null | 'not_found' | 'permission_error'>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [savedOrders, setSavedOrders] = useState<{id: string, date: number}[]>([]);
    
    // Upload state
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('my_orders') || '[]');
            if (Array.isArray(saved)) {
                setSavedOrders(saved);
            }
        } catch(e) {}
    }, []);

    const handleSearch = async (e?: React.FormEvent, codeOverride?: string) => {
        if (e) e.preventDefault();
        let codeToSearch = (codeOverride || orderCode).trim().toUpperCase();
        if (!codeToSearch) return;

        const isPhone = /^0\d{9}$/.test(codeToSearch);

        if (!isPhone && !codeToSearch.startsWith('#')) {
            codeToSearch = '#' + codeToSearch;
        }
        
        if (codeOverride) setOrderCode(codeToSearch);

        setIsLoading(true);
        setFoundOrder(null);
        
        try {
            let order: Order | null = null;

            if (isPhone) {
                const orders = await getOrdersByPhone(codeToSearch);
                if (orders.length > 0) {
                    order = orders[0];
                }
            } else {
                order = await getOrderById(codeToSearch);
                if (!order) {
                    order = MOCK_ORDERS[codeToSearch] || null;
                }
            }

            setFoundOrder(order || 'not_found');
        } catch (error: any) {
            console.error("Lỗi tra cứu đơn hàng:", error);
            if (error.code === 'permission-denied') {
                setFoundOrder('permission_error');
            } else {
                setFoundOrder('not_found');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && foundOrder && typeof foundOrder === 'object') {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    const success = await updateOrder(foundOrder.id, { 
                        paymentProofUrl: url,
                        paymentProofUploadedAt: new Date().toISOString()
                    });
                    
                    if (success) {
                        setFoundOrder({ 
                            ...foundOrder, 
                            paymentProofUrl: url, 
                            paymentProofUploadedAt: new Date().toISOString() 
                        });
                        alert("Đã gửi ảnh xác nhận thành công!");
                    } else {
                        alert("Lỗi cập nhật đơn hàng.");
                    }
                } else {
                    alert("Lỗi tải ảnh lên.");
                }
            } catch (error) {
                console.error(error);
                alert("Đã có lỗi xảy ra.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const StatusTracker: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
        const getStepIndex = (status: string) => {
            switch(status) {
                case 'Chờ thanh toán': return 0;
                case 'Đã xác nhận': return 1;
                case 'Ưu tiên xuất đơn':
                case 'Đang đóng hàng':
                case 'Chờ chuyển hàng':
                case 'Đang xử lý': 
                    return 2;
                case 'Gửi hàng đi':
                case 'Đang giao hàng': 
                    return 3;
                case 'Đã giao hàng': return 4;
                default: return -1; 
            }
        };

        const steps = ['Chờ thanh toán', 'Đã xác nhận', 'Đang xử lý', 'Đang giao hàng', 'Đã giao hàng'];
        const currentStepIndex = getStepIndex(currentStatus);

        return (
            <div className="relative my-8">
                <div className="flex justify-between items-start relative z-10">
                    {steps.map((step, index) => (
                        <div key={step} className="flex flex-col items-center" style={{ width: '20%' }}>
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${index <= currentStepIndex ? 'bg-luvin-pink border-luvin-pink shadow-md scale-110' : 'bg-white border-gray-300'}`}>
                                {index <= currentStepIndex && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <p className={`mt-2 text-[10px] sm:text-xs font-bold text-center transition-colors ${index <= currentStepIndex ? 'text-gray-900' : 'text-gray-400'}`}>{step}</p>
                        </div>
                    ))}
                </div>
                <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded-full -z-0">
                     <div 
                        className="h-full bg-luvin-pink transition-all duration-700 ease-out rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, (currentStepIndex / (steps.length - 1)) * 100))}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    const getVietQR = (order: Order) => {
        const BANK_ID = '970407';
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2';
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        const amount = order.amountToPay;
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };

    return (
        <div className="min-h-screen bg-[#fcf9f6] font-body text-gray-800">
            {/* Hero Section */}
            <div className="bg-white border-b border-gray-100 py-16 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-pink-50 rounded-full blur-3xl opacity-60 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none -translate-x-1/3 translate-y-1/3"></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-4">Tra Cứu Đơn Hàng</h1>
                    <p className="text-gray-500">Theo dõi hành trình món quà của bạn.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 py-12 -mt-8">
                <div className="max-w-3xl mx-auto space-y-8">
                    
                    {/* Search Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 transform -translate-y-4">
                        <form onSubmit={handleSearch} className="flex gap-3 max-w-lg mx-auto">
                            <input
                                type="text"
                                value={orderCode}
                                onChange={(e) => setOrderCode(e.target.value)}
                                placeholder="Mã đơn (#TLxxxxxx) hoặc SĐT"
                                className="flex-grow p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-luvin-pink focus:border-luvin-pink text-center uppercase font-bold text-lg outline-none bg-gray-50 focus:bg-white transition-colors"
                            />
                            <button type="submit" disabled={isLoading} className="bg-gray-900 text-white font-bold px-8 py-4 rounded-xl hover:bg-luvin-pink hover:text-gray-900 transition-all shadow-lg disabled:opacity-50 active:scale-95">
                                {isLoading ? '...' : 'Tìm kiếm'}
                            </button>
                        </form>
                        
                        {savedOrders.length > 0 && !foundOrder && (
                            <div className="mt-8 pt-6 border-t border-dashed border-gray-200">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">Đơn hàng gần đây</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {savedOrders.map((item, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => handleSearch(undefined, item.id)}
                                            className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-white hover:shadow-md hover:border-luvin-pink/30 transition-all group"
                                        >
                                            <div className="text-left">
                                                <p className="font-bold text-gray-800 text-sm">{item.id}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(item.date).toLocaleDateString('vi-VN')}</p>
                                            </div>
                                            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 group-hover:text-luvin-pink shadow-sm">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Loading & Errors */}
                    {isLoading && <div className="text-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-luvin-pink mx-auto"></div><p className="mt-4 text-gray-500 font-medium">Đang tìm dữ liệu...</p></div>}
                    
                    {foundOrder === 'not_found' && (
                        <div className="bg-red-50 border border-red-100 text-red-700 p-6 rounded-2xl text-center shadow-sm">
                            <div className="text-3xl mb-2">🤔</div>
                            <p className="font-bold">Không tìm thấy đơn hàng</p>
                            <p className="text-sm mt-1">Vui lòng kiểm tra lại mã đơn hàng hoặc số điện thoại.</p>
                        </div>
                    )}
                    
                    {foundOrder === 'permission_error' && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-2xl text-center shadow-sm">
                            <div className="text-3xl mb-2">🚧</div>
                            <p className="font-bold">Hệ thống đang bảo trì</p>
                            <p className="text-sm mt-1">
                                Vui lòng liên hệ Hotline <a href="https://zalo.me/0964393115" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-bold hover:text-luvin-pink underline">0964 393 115</a> để được hỗ trợ nhanh nhất.
                            </p>
                        </div>
                    )}

                    {/* Order Details */}
                    {foundOrder && typeof foundOrder === 'object' && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-lg animate-fade-in-up">
                            {/* Allow Editing if not packed */}
                            {!PACKED_STATUSES.includes(foundOrder.status) && (
                                <div className="absolute top-6 right-6">
                                    <button 
                                        onClick={() => onEditOrder(foundOrder as Order)}
                                        className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        Sửa đơn hàng
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Đơn hàng</p>
                                    <h2 className="font-heading font-bold text-3xl text-gray-900">{foundOrder.id}</h2>
                                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                        <span>📅 {foundOrder.createdAt ? new Date(foundOrder.createdAt).toLocaleDateString('vi-VN') : '---'}</span>
                                    </p>
                                    {foundOrder.trackingCode && (
                                        <p className="mt-2 text-sm">
                                            Mã vận đơn: <span className="bg-orange-100 text-orange-800 font-mono font-bold px-2 py-0.5 rounded">{foundOrder.trackingCode}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="mt-2 sm:mt-0">
                                    <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm ${foundOrder.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : foundOrder.status === 'Huỷ đơn' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {foundOrder.status}
                                    </span>
                                </div>
                            </div>

                            <StatusTracker currentStatus={foundOrder.status} />

                            {foundOrder.status === 'Chờ thanh toán' && (
                                <div className="mt-8 bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="font-bold text-gray-900 text-lg mb-2">Đơn hàng chưa thanh toán</h3>
                                        <p className="text-sm text-gray-600 mb-4">Vui lòng quét mã QR hoặc chuyển khoản để chúng tôi tiến hành làm đơn ngay cho bạn nhé.</p>
                                        
                                        <div className="space-y-2 bg-white/50 p-4 rounded-xl border border-yellow-100 inline-block md:block w-full">
                                            <p className="text-sm"><span className="text-gray-500">Ngân hàng:</span> <span className="font-bold">Techcombank</span></p>
                                            <p className="text-sm"><span className="text-gray-500">STK:</span> <span className="font-bold">65838666666</span></p>
                                            <p className="text-sm"><span className="text-gray-500">Chủ TK:</span> <span className="font-bold">NGO TRONG DUONG</span></p>
                                            <div className="mt-2 pt-2 border-t border-yellow-100">
                                                <p className="text-xs text-gray-500">Nội dung CK:</p>
                                                <p className="font-mono font-bold text-lg text-luvin-pink select-all">{foundOrder.id}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-shrink-0 bg-white p-2 border rounded-xl shadow-sm">
                                        <img src={getVietQR(foundOrder)} alt="Mã QR Thanh toán" className="w-40 h-40 object-contain rounded-lg" />
                                    </div>

                                    {/* Upload Payment Proof Section */}
                                    <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-yellow-200 pt-6 md:pt-0 md:pl-8">
                                        {foundOrder.paymentProofUrl ? (
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                                <p className="text-green-700 font-bold text-sm flex items-center justify-center gap-2 mb-2">
                                                    <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span> 
                                                    Đã gửi ảnh xác nhận
                                                </p>
                                                <img src={foundOrder.paymentProofUrl} alt="Proof" className="h-24 object-contain mx-auto border rounded bg-white shadow-sm" />
                                                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-gray-400 hover:text-gray-600 underline mt-2">Gửi ảnh khác</button>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-gray-700 mb-2">Đã chuyển khoản?</p>
                                                <p className="text-xs text-gray-500 mb-4">Gửi ảnh biên lai để đơn được xác nhận nhanh hơn.</p>
                                                <button 
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={isUploading}
                                                    className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 mx-auto disabled:opacity-50"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                    {isUploading ? 'Đang tải lên...' : 'Tải ảnh biên lai'}
                                                </button>
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept="image/*" 
                                            onChange={handleFileUpload} 
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 pt-8 border-t border-gray-100">
                                <div>
                                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 uppercase text-xs tracking-wider">Thông tin nhận hàng</h3>
                                    <div className="space-y-3 text-sm text-gray-600">
                                        <div className="flex gap-3"><span className="w-5 text-gray-400">👤</span> <span className="font-medium text-gray-900">{foundOrder.customer.name}</span></div>
                                        <div className="flex gap-3"><span className="w-5 text-gray-400">📞</span> <span className="font-medium">{foundOrder.customer.phone}</span></div>
                                        <div className="flex gap-3"><span className="w-5 text-gray-400">📍</span> <span>{foundOrder.customer.address}</span></div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 uppercase text-xs tracking-wider">Chi tiết sản phẩm</h3>
                                    <div className="space-y-4">
                                        {foundOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-4 bg-gray-50 p-3 rounded-xl">
                                                <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer flex-shrink-0" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)}>
                                                    {item.previewImageUrl && <img src={item.previewImageUrl} className="w-full h-full object-contain" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">Khung thiết kế riêng</p>
                                                    <p className="text-xs text-gray-500 mt-1">{item.characters.length} nhân vật • Khung {item.frameId}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                             <div className="mt-8 pt-4 border-t border-dashed border-gray-200 flex justify-between items-center">
                                <span className="text-gray-500 text-sm font-medium">Tổng thanh toán</span>
                                <span className="text-2xl font-bold text-luvin-pink">{formatCurrency(foundOrder.totalPrice)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
