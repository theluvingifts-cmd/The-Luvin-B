
import React, { useState, useEffect, useRef } from 'react';
import { Order, FrameOption } from '../types';
import { getOrderById, getOrdersByPhone, updateOrder } from '../services/orderService';
import { uploadToCloudinary } from '../services/uploadService';
import { verifyPaymentProof } from '../services/aiService';
import { MOCK_ORDERS, FRAME_OPTIONS } from '../constants';
import { formatCurrency } from '../utils/pricing';
import { getAllFrames } from '../services/frameService';

export const OrderLookupPage: React.FC<{onZoomImage: (url: string) => void; onEditOrder: (order: Order) => void}> = ({onZoomImage, onEditOrder}) => {
    const [orderCode, setOrderCode] = useState('');
    const [foundOrder, setFoundOrder] = useState<Order | null | 'not_found' | 'permission_error'>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getAllFrames().then(fetched => { if (fetched && fetched.length > 0) setFrames(fetched); });
    }, []);

    const handleSearch = async (e?: React.FormEvent, codeOverride?: string) => {
        if (e) e.preventDefault();
        let codeToSearch = (codeOverride || orderCode).trim().toUpperCase();
        if (!codeToSearch) return;
        const isPhone = /^0\d{9}$/.test(codeToSearch);
        if (!isPhone && !codeToSearch.startsWith('#')) codeToSearch = '#' + codeToSearch;
        if (codeOverride) setOrderCode(codeToSearch);
        setIsLoading(true); setFoundOrder(null);
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && foundOrder && typeof foundOrder === 'object') {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (!url) throw new Error("Lỗi tải ảnh");
                
                await updateOrder(foundOrder.id, { 
                    paymentProofUrl: url,
                    paymentProofUploadedAt: new Date().toISOString()
                });
                
                setFoundOrder({ ...foundOrder, paymentProofUrl: url });

                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64 = reader.result as string;
                    
                    const result = await verifyPaymentProof(base64, foundOrder.amountToPay, foundOrder.id);
                    
                    if (result.isMatch) {
                        await updateOrder(foundOrder.id, { 
                            status: 'Đã xác nhận',
                            amountPaid: result.detectedAmount,
                            amountToPay: Math.max(0, foundOrder.totalPrice - result.detectedAmount)
                        });
                        setFoundOrder(prev => (prev && typeof prev === 'object') ? { ...prev, status: 'Đã xác nhận' } : prev);
                    }
                };
                reader.readAsDataURL(file);

            } catch (error: any) {
                alert(error.message || "Đã có lỗi xảy ra.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const StatusTracker: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
        const steps = [ { label: 'Thanh toán', icon: '💳' }, { label: 'Thiết kế', icon: '📐' }, { label: 'Đóng gói', icon: '🎁' }, { label: 'Đang giao', icon: '🚚' }, { label: 'Hoàn thành', icon: '❤️' } ];
        const getStepIndex = (status: string) => {
            switch(status) {
                case 'Chờ thanh toán': return 0;
                case 'Đã xác nhận': case 'Chưa thiết kế': return 1;
                case 'Ưu tiên xuất đơn': case 'Đang đóng hàng': return 2;
                case 'Chờ chuyển hàng': case 'Gửi hàng đi': case 'Đang giao hàng': return 3;
                case 'Đã giao hàng': return 4;
                default: return 0; 
            }
        };
        const currentStepIndex = getStepIndex(currentStatus);
        const progressPercentage = (currentStepIndex / (steps.length - 1)) * 100;
        return (
            <div className="mb-8 px-0 sm:px-4 w-full">
                <div className="relative">
                    <div className="absolute top-4 sm:top-5 left-0 w-full h-1 bg-gray-100 rounded-full -z-10"></div>
                    <div className="absolute top-4 sm:top-5 left-0 h-1 bg-luvin-pink rounded-full -z-10 transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
                    <div className="flex justify-between items-start w-full">
                        {steps.map((step, index) => (
                            <div key={index} className="flex flex-col items-center flex-1">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 bg-white ${index <= currentStepIndex ? 'border-luvin-pink text-luvin-pink shadow-md' : 'border-gray-200 text-gray-300'}`}>
                                    <span className="text-xs sm:text-sm">{index <= currentStepIndex ? step.icon : (index + 1)}</span>
                                </div>
                                <p className={`mt-2 text-center text-[9px] sm:text-xs font-bold ${index <= currentStepIndex ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-body text-gray-800 pb-20">
            <div className="bg-gradient-to-b from-pink-50 to-white py-12 text-center relative overflow-hidden">
                <div className="relative z-10 container mx-auto px-4">
                    <h1 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-3">Tra Cứu Đơn Hàng</h1>
                    <p className="text-gray-500 text-sm">Kiểm tra trạng thái đơn hàng của bạn chỉ trong vài giây.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-8 relative z-20">
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                            <input type="text" value={orderCode} onChange={e => setOrderCode(e.target.value)} placeholder="Mã đơn (#TLxxxxxx) hoặc SĐT" className="flex-grow pl-4 pr-4 py-3.5 border border-gray-200 rounded-xl outline-none uppercase font-medium" />
                            <button type="submit" disabled={isLoading} className="bg-gray-900 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-luvin-pink transition-all shadow-md active:scale-95">Tra cứu</button>
                        </form>
                    </div>

                    {foundOrder && typeof foundOrder === 'object' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-fade-in-up">
                            <div className="bg-gray-50/80 p-6 border-b flex justify-between items-center">
                                <h2 className="font-heading font-bold text-2xl text-gray-900">{foundOrder.id}</h2>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${foundOrder.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{foundOrder.status}</span>
                            </div>

                            <div className="p-8">
                                <StatusTracker currentStatus={foundOrder.status} />

                                {foundOrder.status === 'Chờ thanh toán' && (
                                    <div className="mb-8 bg-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
                                        <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex-shrink-0">
                                            <img src={`https://img.vietqr.io/image/970407-65838666666-compact2.png?amount=${foundOrder.amountToPay}&addInfo=${foundOrder.id}&accountName=TheLuvin`} className="w-32 h-32 object-contain" />
                                        </div>
                                        <div className="flex-grow text-center sm:text-left">
                                            <h3 className="font-bold text-gray-900 mb-2">Xác nhận thanh toán nhanh</h3>
                                            <p className="text-sm text-gray-600 mb-4">Gửi biên lai để hệ thống <b>tự động kiểm tra</b> và xác nhận đơn hàng.</p>
                                            
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md flex items-center gap-2 mx-auto sm:mx-0"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                {isUploading ? 'Đang tải...' : 'Gửi ảnh biên lai'}
                                            </button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
