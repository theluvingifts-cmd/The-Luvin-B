import React, { useEffect, useState, useRef } from 'react';
import { Order, Page } from '../types';
import { formatCurrency } from '../utils/pricing';
import { ZoomIcon } from '../components/ZoomIcon';
import { uploadFile } from '../services/uploadService';
import { updateOrder } from '../services/orderService';
import { dataURLToBlob } from '../utils/helpers';

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

                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    const particleCount = 50 * (timeLeft / duration);
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
                }, 250);
            }
        }
    }, [order, navigateTo]);
    
    if (!order) return null;

    const totalQuantity = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const giftBoxFee = order.addGiftBox ? 30000 * totalQuantity : 0;
    const amountRemaining = order.totalPrice - order.amountToPay;
    
    const getVietQR = (order: Order) => {
        const BANK_ID = '970407'; 
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2';
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        const amount = order.amountToPay;
        
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadFile(file, 'temp');
                if (url) {
                    const success = await updateOrder(order.id, { 
                        paymentProofUrl: url,
                        paymentProofUploadedAt: new Date().toISOString()
                    });
                    
                    if (success) {
                        setProofUrl(url);
                        alert("Đã gửi ảnh xác nhận thành công! Chúng tôi sẽ kiểm tra sớm.");
                    } else {
                        alert("Lỗi cập nhật đơn hàng. Vui lòng thử lại.");
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

    return (
        <div className="bg-gray-50 py-12">
            <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
                <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
                    <div className="text-center">
                        <div className="mb-4 text-5xl">🎉</div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                            {actionType === 'update' ? 'Cập nhật đơn hàng thành công!' : 'Đơn hàng của bạn đã được ghi nhận!'}
                        </h1>
                        <p className="mt-2 text-sm text-gray-600">
                            {actionType === 'update' 
                                ? 'Thông tin đơn hàng đã được thay đổi. Chúng tôi sẽ cập nhật lại quy trình xử lý.'
                                : 'Cảm ơn bạn đã đặt hàng. Vui lòng hoàn tất thanh toán để chúng tôi xử lý đơn hàng của bạn.'}
                        </p>
                        <p className="mt-4 text-base text-gray-700">Mã đơn hàng của bạn là: <span className="font-bold text-lg text-luvin-pink">{order.id}</span></p>
                    </div>
                    
                    <div className="mt-8 bg-gray-50 rounded-lg border p-6 text-center">
                        <h2 className="font-semibold text-gray-700">Quét mã QR để thanh toán</h2>
                        <img src={getVietQR(order)} alt="VietQR" className="mt-4 w-48 mx-auto border rounded-lg" />
                        <div className="mt-4 bg-white p-3 rounded-lg border inline-block w-full max-w-xs">
                           <p className="text-xs text-gray-500">Nội dung chuyển khoản:</p>
                           <p className="font-bold text-gray-800 tracking-wider text-lg">{order.id}</p>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 mb-2">Đã chuyển khoản?</h3>
                            {proofUrl ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-full max-w-xs bg-green-50 border border-green-200 rounded-lg p-3 mb-2 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs">✓</div>
                                        <span className="text-sm text-green-700 font-medium">Đã gửi ảnh xác nhận</span>
                                    </div>
                                    <img src={proofUrl} alt="Payment Proof" className="w-32 h-auto object-contain border rounded mb-2" />
                                    <button onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 hover:underline">Gửi lại ảnh khác?</button>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs text-gray-500 mb-3">Tải ảnh biên lai để đơn hàng được xác nhận nhanh hơn.</p>
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

                    <div className="mt-8 border-t pt-6">
                         <h2 className="font-bold text-lg mb-4">Tóm tắt đơn hàng</h2>
                         <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg border p-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-16 object-contain bg-white border rounded cursor-pointer group relative" onClick={() => order.items[0].previewImageUrl && onZoomImage(order.items[0].previewImageUrl)}>
                                    <img src={order.items[0].previewImageUrl} className="w-full h-full object-contain" alt="preview" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIcon className="w-8 h-8 text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Khung tùy chỉnh x {totalQuantity}</p>
                                  </div>
                                </div>
                                <p className="font-semibold">{formatCurrency(order.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0))}</p>
                            </div>

                            {order.extraCharms && order.extraCharms.length > 0 && (
                                <div className="bg-pink-50/30 rounded-lg border border-pink-100 p-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Phụ kiện thêm</h3>
                                    <div className="space-y-3">
                                        {Array.from(new Set(order.extraCharms.map(c => c.id))).map(id => {
                                            const charm = order.extraCharms!.find(c => c.id === id)!;
                                            const count = order.extraCharms!.filter(c => c.id === id).length;
                                            return (
                                                <div key={id} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-3">
                                                        <img src={charm.imageUrl} className="w-8 h-8 object-contain bg-white rounded border" alt="" />
                                                        <span className="font-medium">{charm.name} <span className="text-gray-400">x{count}</span></span>
                                                    </div>
                                                    <span className="font-semibold">{formatCurrency((charm.price || 0) * count)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="text-sm space-y-2">
                                <div className="flex justify-between"><span>Tạm tính:</span><span className="font-medium">{formatCurrency(order.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) + (order.extraCharms?.reduce((sum, c) => sum + (c.price || 0), 0) || 0))}</span></div>
                                <div className="flex justify-between">
                                    <span>Phí vận chuyển:</span>
                                    {order.shipping.fee === 0 && order.shipping.method === 'standard' ? (
                                        <span className="font-bold text-green-600">Miễn phí</span>
                                    ) : (
                                        <span className="font-medium">{formatCurrency(order.shipping.fee)}</span>
                                    )}
                                </div>
                                {order.addGiftBox && <div className="flex justify-between"><span>Hộp quà ({totalQuantity} tranh):</span><span className="font-medium">{formatCurrency(giftBoxFee)}</span></div>}
                                {order.discountAmount && order.discountAmount > 0 && (
                                    <div className="flex justify-between text-green-600 font-bold">
                                        <span>Giảm giá:</span>
                                        <span>-{formatCurrency(order.discountAmount)}</span>
                                    </div>
                                )}
                                <div className="border-t my-2"></div>
                                <div className="flex justify-between font-bold text-base"><span>Tổng cộng:</span><span>{formatCurrency(order.totalPrice)}</span></div>
                                <div className="flex justify-between font-bold text-base text-red-600"><span>Cần thanh toán:</span><span>{formatCurrency(order.amountToPay)}</span></div>
                                <div className="flex justify-between text-xs text-gray-500"><span>Còn lại (thanh toán khi nhận hàng):</span><span>{formatCurrency(amountRemaining)}</span></div>
                            </div>
                            
                            <div className="border-t pt-4 text-sm space-y-1">
                                <p><span className="font-semibold">Giao đến:</span> {order.customer.name}</p>
                                <p><span className="font-semibold">Địa chỉ:</span> {order.customer.address}</p>
                                <p><span className="font-semibold">SĐT:</span> {order.customer.phone}</p>
                                {order.customer.demoContact && <p><span className="font-semibold text-luvin-pink">Liên hệ gửi demo:</span> {order.customer.demoContact}</p>}
                                <p><span className="font-semibold">Ngày nhận mong muốn:</span> {new Date(order.delivery.date).toLocaleDateString('vi-VN')}</p>
                                {order.delivery.notes && (
                                    <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-100 italic text-gray-700">
                                        <span className="font-semibold not-italic">Ghi chú của bạn:</span> {order.delivery.notes}
                                    </div>
                                )}
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    )
};
