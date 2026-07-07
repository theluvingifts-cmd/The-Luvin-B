
import React from 'react';
import { FrameConfig, LegoPart, Page, CollectionTemplate, FrameOption } from '../types';
import { calculatePrice, formatCurrency } from '../utils/pricing';
import { FRAME_OPTIONS } from '../constants';
import { ZoomIcon } from '../components/ZoomIcon';
import { useLanguage } from '../src/contexts/LanguageContext';
import { CharacterPreview } from '../components/shared/CharacterPreview';

interface CartPageProps {
    cartItems: FrameConfig[]; 
    onRemoveItem: (index: number) => void; 
    onEditItem: (index: number) => void; 
    allParts: Record<string, LegoPart>; 
    navigateTo: (page: Page) => void;
    onUpdateQuantity: (index: number, newQuantity: number) => void;
    onZoomImage: (url: string) => void;
    isEditingOrder?: boolean;
    templates: CollectionTemplate[];
    frames: FrameOption[];
}

export const CartPage: React.FC<CartPageProps> = ({ cartItems, onRemoveItem, onEditItem, allParts, navigateTo, onUpdateQuantity, onZoomImage, isEditingOrder, templates, frames }) => {
    const { t } = useLanguage();
    const totalCartPrice = cartItems.reduce((total, item) => total + calculatePrice(item, allParts, frames, templates).totalPrice * (item.quantity || 1), 0);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <h1 className="text-5xl font-heading text-center text-luvin-pink mb-8">{isEditingOrder ? t('cart.edit_details') : t('cart.title')}</h1>
            {cartItems.length === 0 ? (
                <p className="text-center text-gray-600 font-body text-lg">{t('cart.empty')}.</p>
            ) : (
                <div className="max-w-4xl mx-auto">
                    <div className="space-y-6">
                        {cartItems.map((item, index) => {
                            const { totalPrice } = calculatePrice(item, allParts, frames, templates);
                            const frame = frames.find(f => f.id === item.frameId) || frames[0] || FRAME_OPTIONS[0];
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
                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{t('checkout.no_image')}</div>
                                      )}
                                    </div>
                                    <div className="flex-grow text-center sm:text-left">
                                        <h3 className="font-bold text-lg font-body text-luvin-pink">
                                            {item.frameId === 'accessory-only' 
                                                ? (item.draggableItems[0] ? (allParts[item.draggableItems[0].partId]?.name || 'Linh kiện lẻ') : 'Linh kiện lẻ') 
                                                : t('order_lookup.frame_lego', { name: frame.name })}
                                        </h3>
                                        <p className="text-sm text-gray-600">{t('common.price')}: {formatCurrency(totalPrice)}</p>
                                        <p className="text-sm text-gray-600">
                                            {item.frameId === 'accessory-only' 
                                                ? 'Mua lẻ linh kiện / dịch vụ thêm' 
                                                : t('order_lookup.item_desc', { count: item.characters.length, bg: item.background.type === 'color' ? t('order_lookup.bg_color') : t('order_lookup.bg_image') })}
                                        </p>
                                        {item.galleryOptions && (
                                            <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 items-center">
                                                {item.galleryOptions.photoFrameCount && <span className="text-xs text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded-full shadow-sm">📸 {item.galleryOptions.photoFrameCount} Khung ảnh</span>}
                                                {item.galleryOptions.lightCount && <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full shadow-sm">💡 {item.galleryOptions.lightCount} Đèn led</span>}
                                                {item.galleryOptions.assembly && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${item.galleryOptions.assembly === 'pre-assembled' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                                        {item.galleryOptions.assembly === 'pre-assembled' ? `✨ ${t('studio.museum.assembly_pre')}` : `✂️ ${t('studio.museum.assembly_diy')}`}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Character & Charm Previews */}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {item.characters.map((char, cIdx) => (
                                                <div key={cIdx} className="relative group">
                                                    <CharacterPreview character={char} size="sm" />
                                                    <div className="absolute -top-1 -right-1 bg-white border border-pink-200 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center text-pink-600 shadow-sm leading-none">
                                                        {cIdx + 1}
                                                    </div>
                                                </div>
                                            ))}
                                            {item.draggableItems.filter(di => di.type === 'charm' || di.type === 'pet').slice(0, 6).map((di, diIdx) => {
                                                const part = allParts[di.partId];
                                                if (!part) return null;
                                                return (
                                                    <div key={diIdx} className="w-10 h-10 bg-white border border-gray-100 rounded-lg p-1 flex items-center justify-center">
                                                        <img src={part.imageUrl} className="w-full h-full object-contain" alt="charm" />
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                                            <span className="text-sm font-medium">{t('common.quantity')}:</span>
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
                                        <p className="font-bold tracking-tight text-lg text-luvin-pink">{formatCurrency(totalPrice * quantity)}</p>
                                        <p className="text-xs text-gray-500">({formatCurrency(totalPrice)} / {t('common.item')})</p>
                                        <div className="flex justify-center sm:justify-end gap-3 mt-2">
                                            {item.frameId !== 'accessory-only' && (
                                                <button onClick={() => onEditItem(index)} className="text-sm text-blue-600 hover:underline font-semibold">{t('cart.edit')}</button>
                                            )}
                                            <button onClick={() => onRemoveItem(index)} className="text-sm text-red-500 hover:underline">{t('cart.remove')}</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center text-2xl font-bold font-body text-luvin-pink">
                            <span>{t('cart.summary')}:</span>
                            <span>{formatCurrency(totalCartPrice)}</span>
                        </div>
                        <button onClick={() => navigateTo('checkout')} className="mt-4 w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-lg hover:opacity-90 transition-colors">
                            {isEditingOrder ? t('common.next') : t('cart.checkout')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
