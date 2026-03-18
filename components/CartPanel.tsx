
import React from 'react';
import { FrameConfig, LegoPart, Page } from '../types';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { FRAME_OPTIONS } from '../constants';
import { ZoomIcon } from './ZoomIcon';

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: FrameConfig[];
  onRemoveItem: (index: number) => void;
  onEditItem: (index: number) => void; 
  allParts: Record<string, LegoPart>;
  navigateTo: (page: Page) => void;
  onUpdateQuantity: (index: number, newQuantity: number) => void;
  onZoomImage: (url: string) => void;
  templates: any[];
}

export const CartPanel: React.FC<CartPanelProps> = ({ isOpen, onClose, cartItems, onRemoveItem, onEditItem, allParts, navigateTo, onUpdateQuantity, onZoomImage, templates }) => {
  const subtotal = cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS, templates).totalPrice * (item.quantity || 1), 0);
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  const percentage = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const handleCheckout = () => {
    onClose();
    navigateTo('checkout');
  };

  const handleViewCart = () => {
    onClose();
    navigateTo('cart');
  }

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'bg-black/40' : 'bg-transparent pointer-events-none'}`}>
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">Giỏ hàng</h2>
          <button onClick={onClose} className="p-1">&times;</button>
        </div>

        {cartItems.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                 {remaining > 0 ? (
                    <div className="space-y-1">
                        <p className="text-xs text-gray-600">
                            Thêm <span className="font-bold text-gray-900">{formatCurrency(remaining)}</span> để được <span className="font-bold text-green-600">Free Ship</span>
                        </p>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all duration-500" style={{width: `${percentage}%`}}></div>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                        <span>✨</span> Bạn đã được Miễn phí vận chuyển!
                    </p>
                )}
            </div>
        )}

        {cartItems.length === 0 ? (
          <p className="flex-grow flex items-center justify-center text-gray-500">Giỏ hàng trống.</p>
        ) : (
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {cartItems.map((item, index) => {
              const { totalPrice } = calculatePrice(item, allParts, FRAME_OPTIONS, templates);
              const frame = FRAME_OPTIONS.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
              const quantity = item.quantity || 1;

              return (
                <div key={index} className="flex gap-4">
                  <div 
                    className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded p-1 relative group"
                  >
                     {item.previewImageUrl ? (
                        <>
                            <img src={item.previewImageUrl} alt="Design Preview" className="w-full h-full object-contain" />
                            <div className="absolute bottom-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div 
                                    className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-full cursor-pointer pointer-events-auto scale-75"
                                    onClick={(e) => { e.stopPropagation(); onZoomImage(item.previewImageUrl!); }}
                                    title="Zoom"
                                >
                                    <ZoomIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">No Img</div>
                      )}
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-sm font-semibold">Khung LEGO tùy chỉnh</h3>
                    <p className="text-xs text-gray-500">{frame.name}</p>
                    <div className="flex justify-between items-end mt-1">
                        <p className="text-sm font-bold">{formatCurrency(totalPrice * quantity)}</p>
                        <div className="flex items-center border border-gray-300 rounded bg-white">
                            <button 
                                onClick={() => onUpdateQuantity(index, quantity - 1)}
                                className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                                disabled={quantity <= 1}
                            >-</button>
                            <span className="px-1.5 text-xs font-bold min-w-[16px] text-center">{quantity}</span>
                            <button 
                                onClick={() => onUpdateQuantity(index, quantity + 1)}
                                className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                            >+</button>
                        </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                      <button onClick={() => onRemoveItem(index)} className="text-red-500 self-start p-1 text-lg leading-none">&times;</button>
                      <button onClick={() => onEditItem(index)} className="text-blue-600 text-xs font-bold hover:underline">Sửa</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="p-4 border-t space-y-4">
          <div className="flex justify-between font-bold text-lg">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleViewCart} className="w-full bg-gray-200 text-gray-800 font-bold py-3 rounded hover:bg-gray-300">View cart</button>
            <button onClick={handleCheckout} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded hover:opacity-90">Checkout</button>
          </div>
        </div>
      </div>
    </div>
  );
};
