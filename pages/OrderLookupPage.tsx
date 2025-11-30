
import React, { useState, useEffect, useRef } from 'react';
import { Order } from '../types';
import { getOrderById, getOrdersByPhone, updateOrder } from '../services/orderService';
import { uploadToCloudinary } from '../services/uploadService';
import { MOCK_ORDERS } from '../constants';

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
                <div className="flex justify-between items-start">
                    {steps.map((step, index) => (
                        <div key={step} className="z-10 text-center" style={ { width: `${100 / steps.length}%` }}>
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-colors duration-500 relative ${index <= currentStepIndex ? 'bg-luvin-pink' : 'bg-gray-300'}`}>
                                {index <= currentStepIndex && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <p className={`mt-2 text-[10px] sm:text-xs font-semibold ${index <= currentStepIndex ? 'text-luvin-pink' : 'text-gray-500'}`}>{step}</p>
                        </div>
                    ))}
                </div>
                <div className="absolute top-3 left-0 right-0 h-0.5 -z-0" style={{ padding: '0 10%' }}>
                    <div className="w-full h-full bg-gray-200"></div>
                     <div 
                        className="absolute left-0 top-0 h-full bg-luvin-pink transition-all duration-500"
                        style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
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
        <div className="container mx-auto px-4 sm:px-6 py-8 min-h-[60vh]">
            <div className="max-w-3xl mx-auto">
                <div className="text-center">
                    <h1 className="text-4xl sm:text-5xl font-heading text-luvin-pink mb-4">Tra cứu đơn hàng</h1>
                    <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto mt-6">
                        <input
                            type="text"
                            value={orderCode}
                            onChange={(e) => setOrderCode(e.target.value)}
                            placeholder="#TLxxxxxx hoặc SĐT"
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-luvin-pink focus:border-luvin-pink text-center uppercase"
                        />
                        <button type="submit" disabled={isLoading} className="bg-luvin-pink text-gray-800 font-bold px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50">
                            {isLoading ? '...' : 'Tra cứu'}
                        </button>
                    </form>
                    <p className="text-xs text-gray-500 mt-2">Nhập mã đơn hàng (có dấu #) hoặc số điện thoại đặt hàng</p>
                    
                    {savedOrders.length > 0 && !foundOrder && (
                        <div className="mt-8 max-w-md mx-auto">
                            <p className="text-sm text-gray-500 mb-3 font-medium">Đơn hàng của bạn (trên thiết bị này):</p>
                            <div className="space-y-2">
                                {savedOrders.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => handleSearch(undefined, item.id)}
                                        className="bg-white border border-gray-200 p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="text-left">
                                            <p className="font-bold text-gray-800">{item.id}</p>
                                            <p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                        <span className="text-xs font-bold text-luvin-pink group-hover:underline">Xem ngay &rarr;</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-10 min-h-[300px]">
                    {isLoading && <p className="text-center">Đang tìm kiếm...</p>}
                    {foundOrder === 'not_found' && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
                            Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn hàng hoặc số điện thoại.
                        </div>
                    )}
                    {foundOrder === 'permission_error' && (
                        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded-lg text-center">
                            <p className="font-bold">Hệ thống đang bảo trì</p>
                            <p className="text-sm mt-1">
                                Tính năng tra cứu đang được nâng cấp. Vui lòng inbox Fanpage hoặc gọi Hotline <a href="https://zalo.me/0964393115" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-bold hover:text-luvin-pink transition-colors">0964 393 115</a> để được hỗ trợ kiểm tra đơn hàng nhanh nhất.
                            </p>
                        </div>
                    )}
                    {foundOrder && typeof foundOrder === 'object' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-md relative">
                            {/* Allow Editing if not packed */}
                            {!PACKED_STATUSES.includes(foundOrder.status) && (
                                <div className="absolute top-6 right-6">
                                    <button 
                                        onClick={() => onEditOrder(foundOrder as Order)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        Sửa đơn hàng
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="font-bold text-lg">Chi tiết đơn hàng <span className="text-luvin-pink">{foundOrder.id}</span></h2>
                                    <p className="text-sm text-gray-500">
                                        Ngày đặt: {foundOrder.createdAt ? new Date(foundOrder.createdAt).toLocaleDateString('vi-VN') : '---'}
                                    </p>
                                </div>
                                <div className="mt-8 sm:mt-0">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${foundOrder.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {foundOrder.status}
                                    </span>
                                </div>
                            </div>

                            <StatusTracker currentStatus={foundOrder.status} />

                            {foundOrder.status === 'Chờ thanh toán' && (
                                <div className="mt-6 bg-white border border-yellow-200 rounded-lg p-6 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
                                    <h3 className="font-bold text-gray-800 mb-1">Đơn hàng chưa thanh toán</h3>
                                    <p className="text-sm text-gray-500 mb-4">Quét mã QR để thanh toán ngay</p>
                                    
                                    <div className="bg-white p-2 border rounded-xl shadow-sm inline-block">
                                        <img src={getVietQR(foundOrder)} alt="Mã QR Thanh toán" className="w-48 h-48 object-contain rounded-lg" />
                                    </div>
                                    
                                    <div className="mt-4 space-y-1">
                                        <p className="text-sm font-bold text-gray-800">Techcombank - 65838666666</p>
                                        <p className="text-sm">Chủ TK: NGO TRONG DUONG</p>
                                        <div className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded text-xs text-gray-600">
                                            Nội dung: <span className="font-bold text-gray-900 select-all">{foundOrder.id}</span>
                                        </div>
                                    </div>

                                    {/* Upload Payment Proof Section */}
                                    <div className="mt-6 pt-6 border-t border-gray-100 w-full max-w-sm">
                                        {foundOrder.paymentProofUrl ? (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                                <p className="text-green-700 font-bold text-sm flex items-center justify-center gap-2">
                                                    <span>✓</span> Đã gửi ảnh xác nhận
                                                </p>
                                                <p className="text-xs text-green-600 mt-1 mb-2">Đang chờ shop kiểm tra...</p>
                                                <img src={foundOrder.paymentProofUrl} alt="Proof" className="h-20 object-contain mx-auto border rounded bg-white" />
                                                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-gray-400 underline mt-2">Gửi ảnh khác</button>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 mb-3">Đã chuyển khoản? Gửi ảnh biên lai để xác nhận nhanh hơn:</p>
                                                <button 
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={isUploading}
                                                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Thông tin nhận hàng</h3>
                                    <p><span className="font-semibold">Người nhận:</span> {foundOrder.customer.name}</p>
                                    <p><span className="font-semibold">SĐT:</span> {foundOrder.customer.phone}</p>
                                    <p><span className="font-semibold">Địa chỉ:</span> {foundOrder.customer.address}</p>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Đơn hàng</h3>
                                    <div className="space-y-2">
                                        {foundOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-100 rounded border overflow-hidden cursor-pointer" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)}>
                                                    {item.previewImageUrl && <img src={item.previewImageUrl} className="w-full h-full object-contain" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">Khung thiết kế</p>
                                                    <p className="text-xs text-gray-500">{item.characters.length} nhân vật</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                             <div className="mt-6 pt-4 border-t text-right">
                                <p className="text-lg">Tổng tiền: <span className="font-bold text-luvin-pink">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(foundOrder.totalPrice)}</span></p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
