
import React from 'react';
import { FrameConfig, LegoPart, Page } from '../types';
import { calculatePrice, formatCurrency } from '../utils/pricing';
import { FRAME_OPTIONS } from '../constants';
import { ZoomIcon } from '../components/ZoomIcon';

interface CartPageProps {
    cartItems: FrameConfig[]; 
    onRemoveItem: (index: number) => void; 
    onEditItem: (index: number) => void; 
    allParts: Record<string, LegoPart>; 
    navigateTo: (page: Page) => void;
    onUpdateQuantity: (index: number, newQuantity: number) => void;
    onZoomImage: (url: string) => void;
    isEditingOrder?: boolean;
    templates: any[];
}

export const CartPage: React.FC<CartPageProps> = ({ cartItems, onRemoveItem, onEditItem, allParts, navigateTo, onUpdateQuantity, onZoomImage, isEditingOrder, templates }) => {
    const totalCartPrice = cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS, templates).totalPrice * (item.quantity || 1), 0);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <h1 className="text-5xl font-heading text-center text-luvin-pink mb-8">{isEditingOrder ? 'Sửa chi tiết đơn hàng' : 'Giỏ hàng của bạn'}</h1>
            {cartItems.length === 0 ? (
                <p className="text-center text-gray-600 font-body text-lg">Giỏ hàng đang trống.</p>
            ) : (
                <div className="max-w-4xl mx-auto">
                    <div className="space-y-6">
                        {cartItems.map((item, index) => {
                            const { totalPrice } = calculatePrice(item, allParts, FRAME_OPTIONS, templates);
                            const frame = FRAME_OPTIONS.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
                            const quantity = item.quantity || 1;
                            
                            return (
                                <div key={index} className="bg-white rounded-lg shadow-md p-4 flex flex-col sm:flex-row items-center gap-4">
                                    <div 
                                        className="w-40 h-40 flex-shrink-0 bg-gray-100 rounded-md p-2 relative group"
                                    >
                                      {item.previewImageUrl ? (
                                        <>
                                            <img src={item.previewImageUrl} alt="Design Preview" className="w-full h-full object-contain" />
                                            <div className="absolute bottom-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <div 
                                                    className="bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full cursor-pointer pointer-events-auto"
                                                    onClick={(e) => { e.stopPropagation(); onZoomImage(item.previewImageUrl!); }}
                                                    title="Zoom"
                                                >
                                                    <ZoomIcon className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </>
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Img</div>
                                      )}
                                    </div>
                                    <div className="flex-grow text-center sm:text-left">
                                        <h3 className="font-bold text-lg font-body text-luvin-pink">Khung tùy chỉnh</h3>
                                        <p className="text-sm text-gray-600">Kích thước: {frame.name}</p>
                                        <p className="text-sm text-gray-600">Số nhân vật: {item.characters.length}</p>
                                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                                            <span className="text-sm font-medium">Số lượng:</span>
                                            <div className="flex items-center border border-gray-300 rounded">
                                                <button 
                                                    onClick={() => onUpdateQuantity(index, quantity - 1)}
                                                    className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                                                    disabled={quantity <= 1}
                                                >-</button>
                                                <span className="px-2 py-1 text-sm font-bold min-w-[20px] text-center">{quantity}</span>
                                                <button 
                                                    onClick={() => onUpdateQuantity(index, quantity + 1)}
                                                    className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-center sm:text-right">
                                        <p className="font-bold text-lg text-luvin-pink">{formatCurrency(totalPrice * quantity)}</p>
                                        <p className="text-xs text-gray-500">({formatCurrency(totalPrice)} / cái)</p>
                                        <div className="flex justify-center sm:justify-end gap-3 mt-2">
                                            <button onClick={() => onEditItem(index)} className="text-sm text-blue-600 hover:underline font-semibold">Sửa</button>
                                            <button onClick={() => onRemoveItem(index)} className="text-sm text-red-500 hover:underline">Xóa</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center text-2xl font-bold font-body text-luvin-pink">
                            <span>Tổng cộng:</span>
                            <span>{formatCurrency(totalCartPrice)}</span>
                        </div>
                        <button onClick={() => navigateTo('checkout')} className="mt-4 w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-lg hover:opacity-90 transition-colors">
                            {isEditingOrder ? 'Tiếp tục (Nhập địa chỉ)' : 'Tiến hành thanh toán'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
