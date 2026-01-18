
import React, { useEffect, useState, useRef } from 'react';
import { Order, Page } from '../types';
import { formatCurrency } from '../utils/pricing';
import { ZoomIcon } from '../components/ZoomIcon';
import { uploadToCloudinary } from '../services/uploadService';
import { updateOrder } from '../services/orderService';
import { verifyPaymentProof } from '../services/aiService';

declare var confetti: any;

interface OrderConfirmationPageProps {
    order: Order | null;
    navigateTo: (page: Page) => void;
    onZoomImage: (url: string) => void;
    actionType?: 'create' | 'update';
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({ order, navigateTo, onZoomImage, actionType = 'create' }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [proofUrl, setProofUrl] = useState<string | null>(order?.paymentProofUrl || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!order) {
            navigateTo('home');
        } else {
            if (typeof confetti === 'function') {
                const duration = 3 * 1000;
                const animationEnd = Date.now() + duration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
                const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
                const interval: any = setInterval(function() {
                    const timeLeft = animationEnd - Date.now();
                    if (timeLeft <= 0) return clearInterval(interval);
                    const particleCount = 50 * (timeLeft / duration);
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
                }, 250);
            }
        }
    }, [order, navigateTo]);
    
    if (!order) return null;

    const getVietQR = (order: Order) => {
        const BANK_ID = '970407'; 
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2';
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${order.amountToPay}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            
            try {
                // 1. Tải ảnh lên
                const url = await uploadToCloudinary(file);
                if (!url) throw new Error("Lỗi kết nối máy chủ.");
                
                setProofUrl(url);
                await updateOrder(order.id, { 
                    paymentProofUrl: url,
                    paymentProofUploadedAt: new Date().toISOString()
                });

                // 2. Chuyển ảnh sang Base64 để đối soát ngầm
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64 = reader.result as string;
                    
                    // Đối soát thanh toán ngầm
                    const result = await verifyPaymentProof(base64, order.amountToPay, order.id);
                    
                    if (result.isMatch) {
                        // Tự động cập nhật nếu khớp
                        await updateOrder(order.id, { 
                            status: 'Đã xác nhận',
                            amountPaid: result.detectedAmount,
                            amountToPay: Math.max(0, order.totalPrice - result.detectedAmount)
                        });
                        // Không thông báo "AI quét", đơn hàng sẽ tự đổi trạng thái trong database
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

    return (
        <div className="bg-gray-50 py-12">
            <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
                <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
                    <div className="text-center">
                        <div className="mb-4 text-5xl">🎉</div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                            {actionType === 'update' ? 'Cập nhật đơn hàng thành công!' : 'Đơn hàng đã được ghi nhận!'}
                        </h1>
                        <p className="mt-4 text-base text-gray-700">Mã đơn hàng: <span className="font-bold text-lg text-luvin-pink">{order.id}</span></p>
                    </div>
                    
                    <div className="mt-8 bg-gray-50 rounded-lg border p-6 text-center">
                        <h2 className="font-semibold text-gray-700">Quét mã QR để thanh toán</h2>
                        <img src={getVietQR(order)} alt="VietQR" className="mt-4 w-48 mx-auto border rounded-lg shadow-sm" />
                        
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 mb-2">Đã chuyển khoản?</h3>
                            
                            {proofUrl ? (
                                <div className="flex flex-col items-center">
                                    <div className="relative group w-32 h-40 mb-3 border rounded-lg overflow-hidden bg-white shadow-sm">
                                        <img src={proofUrl} alt="Payment Proof" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onZoomImage(proofUrl)} className="text-white text-xs font-bold underline">Xem ảnh</button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-green-600 font-bold mb-3 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                        Đã nhận biên lai. Hệ thống đang xác nhận.
                                    </p>
                                    <button onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 hover:underline font-bold">Gửi lại ảnh khác?</button>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs text-gray-500 mb-3">Tải ảnh biên lai để đơn hàng được <b>xác nhận tự động</b>.</p>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2 mx-auto disabled:opacity-50 shadow-lg active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        {isUploading ? 'Đang xử lý...' : 'Tải ảnh biên lai ngay'}
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </div>
                    </div>

                    <div className="mt-8 border-t pt-6">
                         <div className="text-sm space-y-2">
                            <div className="flex justify-between font-bold text-base"><span>Tổng cộng:</span><span>{formatCurrency(order.totalPrice)}</span></div>
                            <div className="flex justify-between font-bold text-base text-red-600"><span>Cần thanh toán:</span><span>{formatCurrency(order.amountToPay)}</span></div>
                         </div>
                         <button onClick={() => navigateTo('home')} className="w-full mt-6 py-3 border border-gray-300 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-colors">Về trang chủ</button>
                    </div>
                </div>
            </div>
        </div>
    )
};
