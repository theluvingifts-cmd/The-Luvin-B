
import React from 'react';
import { FrameConfig, LegoPart, Page, CollectionTemplate, FrameOption } from '../types';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { FRAME_OPTIONS } from '../constants';
import { ZoomIcon } from './ZoomIcon';
import { useLanguage } from '../src/contexts/LanguageContext';

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
  templates: CollectionTemplate[];
  frames: FrameOption[];
}

export const CartPanel: React.FC<CartPanelProps> = ({ isOpen, onClose, cartItems, onRemoveItem, onEditItem, allParts, navigateTo, onUpdateQuantity, onZoomImage, templates, frames }) => {
  const { t } = useLanguage();
  const subtotal = cartItems.reduce((total, item) => total + calculatePrice(item, allParts, frames, templates).totalPrice * (item.quantity || 1), 0);
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  const percentage = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const hasCustomPrint = cartItems.some(item => {
    const { priceBreakdown } = calculatePrice(item, allParts, frames, templates);
    return priceBreakdown.some(pb => pb.label.includes('In mặt riêng') || pb.label.includes(t('studio.custom_print')));
  });

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
        className={`fixed top-0 right-0 h-full w-[90%] sm:w-full max-w-sm bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">{t('cart.title')}</h2>
          <button onClick={onClose} className="p-2 text-2xl leading-none hover:bg-gray-100 rounded-full transition-colors">&times;</button>
        </div>

        {cartItems.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                 {remaining > 0 ? (
                    <div className="space-y-1.5">
                        <p className="text-[10px] sm:text-xs text-gray-600" dangerouslySetInnerHTML={{ __html: t('cart.add_more_for_freeship').replace('{amount}', formatCurrency(remaining)) }} />
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all duration-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" style={{width: `${percentage}%`}}></div>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        {t('cart.freeship_reached')}
                    </p>
                )}
            </div>
        )}

        {cartItems.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-3xl opacity-50">🛒</div>
              <p className="text-gray-500 font-medium">{t('cart.empty')}</p>
              <button onClick={onClose} className="text-luvin-pink font-bold hover:underline">{t('cart.continue_shopping')}</button>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {cartItems.map((item, index) => {
              const { totalPrice } = calculatePrice(item, allParts, frames, templates);
              const frame = frames.find(f => f.id === item.frameId) || frames[0] || FRAME_OPTIONS[0];
              const quantity = item.quantity || 1;

              return (
                <div key={index} className="flex gap-3 sm:gap-4 group">
                  <div 
                    className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-50 rounded-lg border border-gray-100 p-1 relative overflow-hidden"
                  >
                     {item.previewImageUrl ? (
                        <>
                            <img src={item.previewImageUrl} alt="Design Preview" className="w-full h-full object-contain" />
                            <div className="absolute bottom-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div 
                                    className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-tl-lg cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); onZoomImage(item.previewImageUrl!); }}
                                    title="Zoom"
                                >
                                    <ZoomIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                                </div>
                            </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">No Img</div>
                      )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-800 truncate">{t('cart.custom_lego_frame')}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-500 truncate mb-1">{frame.name}</p>
                    {item.galleryOptions && (
                        <div className="flex gap-2 mb-1">
                            {item.galleryOptions.photoFrameCount && <span className="text-[9px] bg-pink-50 text-pink-600 px-1.5 rounded-md font-bold">{item.galleryOptions.photoFrameCount} Khung ảnh</span>}
                            {item.galleryOptions.lightCount && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 rounded-md font-bold">{item.galleryOptions.lightCount} Đèn led</span>}
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-sm font-bold tracking-tight text-luvin-pink">{formatCurrency(totalPrice * quantity)}</p>
                        <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                            <button 
                                onClick={() => onUpdateQuantity(index, Math.max(1, quantity - 1))}
                                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 transition-colors"
                                disabled={quantity <= 1}
                            >-</button>
                            <span className="px-1 text-xs font-bold min-w-[20px] text-center">{quantity}</span>
                            <button 
                                onClick={() => onUpdateQuantity(index, quantity + 1)}
                                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 transition-colors"
                            >+</button>
                        </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between items-end">
                      <button onClick={() => onRemoveItem(index)} className="text-gray-300 hover:text-red-500 transition-colors p-1" title={t('cart.remove')}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <button onClick={() => onEditItem(index)} className="text-blue-500 text-[10px] font-black uppercase tracking-tighter hover:text-blue-700 transition-colors">{t('cart.edit')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="p-4 border-t bg-white space-y-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
          {hasCustomPrint && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 flex gap-2 items-start animate-fade-in">
                  <span className="text-sm">⚠️</span>
                  <p className="text-[10px] text-amber-800 font-medium leading-tight">{t('studio.custom_print_notice')}</p>
              </div>
          )}
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('cart.subtotal')}</span>
            <span className="text-xl font-bold tracking-tighter text-gray-800">{formatCurrency(subtotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleViewCart} className="w-full bg-gray-100 text-gray-600 font-black uppercase tracking-tight py-3.5 rounded-xl text-xs hover:bg-gray-200 transition-all active:scale-[0.98]">{t('cart.view_cart')}</button>
            <button onClick={handleCheckout} className="w-full bg-luvin-pink text-gray-800 font-black uppercase tracking-tight py-3.5 rounded-xl text-xs hover:opacity-90 shadow-md shadow-pink-100 transition-all active:scale-[0.98]">{t('cart.checkout')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
