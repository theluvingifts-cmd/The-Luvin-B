
import React, { useEffect } from 'react';
import { Order, Page } from '../types';
import { formatCurrency } from '../utils/pricing';
import { ZoomIcon } from '../components/ZoomIcon';

declare var confetti: any;

export const OrderConfirmationPage: React.FC<{ order: Order | null, navigateTo: (page: Page) => void, onZoomImage: (url: string) => void }> = ({ order, navigateTo, onZoomImage }) => {
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

    const amountRemaining = order.totalPrice - order.amountToPay;
    
    const getVietQR = (order: Order) => {
        const BANK_ID = '970407'; 
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2';
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        const amount = order.amountToPay;
        
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };

    return (
        <div className="bg-gray-50 py-12">
            <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
                <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
                    <div className="text-center">
                        <div className="mb-4 text-5xl">🎉</div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Đơn hàng của bạn đã được ghi nhận!</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Cảm ơn bạn đã đặt hàng. Vui lòng hoàn tất thanh toán để chúng tôi xử lý đơn hàng của bạn.
                        </p>
                        <p className="mt-4 text-base text-gray-700">Mã đơn hàng của bạn là: <span className="font-bold text-lg text-luvin-pink">{order.id}</span></p>
                    </div>
                    
                    <div className="mt-8 bg-gray-50 rounded-lg border p-6 text-center">
                        <h2 className="font-semibold text-gray-700">Quét mã QR để thanh toán</h2>
                        <img src={getVietQR(order)} alt="VietQR" className="mt-4 w-48 mx-auto border rounded-lg" />
                        <div className="mt-4 bg-white p-3 rounded-lg border">
                           <p className="text-xs text-gray-500">Nội dung chuyển khoản:</p>
                           <p className="font-bold text-gray-800 tracking-wider">{order.id}</p>
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
                                    <p className="font-semibold">Khung tùy chỉnh x {order.items.length}</p>
                                  </div>
                                </div>
                                <p className="font-semibold">{formatCurrency(order.totalPrice - order.shipping.fee - (order.addGiftBox ? 30000 : 0))}</p>
                            </div>

                            <div className="text-sm space-y-2">
                                <div className="flex justify-between"><span>Tạm tính:</span><span className="font-medium">{formatCurrency(order.totalPrice - order.shipping.fee - (order.addGiftBox ? 30000 : 0))}</span></div>
                                <div className="flex justify-between">
                                    <span>Phí vận chuyển:</span>
                                    {order.shipping.fee === 0 && order.shipping.method === 'standard' ? (
                                        <span className="font-bold text-green-600">Miễn phí</span>
                                    ) : (
                                        <span className="font-medium">{formatCurrency(order.shipping.fee)}</span>
                                    )}
                                </div>
                                {order.addGiftBox && <div className="flex justify-between"><span>Hộp quà:</span><span className="font-medium">{formatCurrency(30000)}</span></div>}
                                <div className="border-t my-2"></div>
                                <div className="flex justify-between font-bold text-base"><span>Tổng cộng:</span><span>{formatCurrency(order.totalPrice)}</span></div>
                                <div className="flex justify-between font-bold text-base text-red-600"><span>Cần thanh toán:</span><span>{formatCurrency(order.amountToPay)}</span></div>
                                <div className="flex justify-between text-xs text-gray-500"><span>Còn lại (thanh toán khi nhận hàng):</span><span>{formatCurrency(amountRemaining)}</span></div>
                            </div>
                            
                            <div className="border-t pt-4 text-sm space-y-1">
                                <p><span className="font-semibold">Giao đến:</span> {order.customer.name}</p>
                                <p><span className="font-semibold">Địa chỉ:</span> {order.customer.address}</p>
                                <p><span className="font-semibold">SĐT:</span> {order.customer.phone}</p>
                                <p><span className="font-semibold">Ngày nhận mong muốn:</span> {new Date(order.delivery.date).toLocaleDateString('vi-VN')}</p>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    )
};
