
import React from 'react';
import { formatCurrency, FREE_SHIPPING_THRESHOLD, PriceBreakdownItem } from '../../utils/pricing';
import { useLanguage } from '../../src/contexts/LanguageContext';

const DesignerCommitment: React.FC = () => {
    const { t } = useLanguage();
    return (
    <div className="mt-8 mb-6 animate-fade-in text-left">
        <div className="bg-white border-2 border-green-500 rounded-[2rem] p-5 shadow-[0_10px_30px_rgba(34,197,94,0.12)] overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700 pointer-events-none"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shadow-sm border border-green-100 flex-shrink-0">
                        <span className="text-xl animate-pulse">🛡️</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-heading text-lg font-black text-green-700 uppercase tracking-tight">{t('studio.absolute_peace_of_mind')}</h4>
                        <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                            {t('studio.free_100')}
                        </span>
                    </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: t('studio.designer_commitment_desc') }} />
            </div>
        </div>
    </div>
    );
};

const UrgencyFlashSale: React.FC<{ timeLeft: number }> = ({ timeLeft }) => {
    const { t } = useLanguage();
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formatTime = (val: number) => val.toString().padStart(2, '0');

    return (
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-4 mb-4 text-white shadow-lg animate-pulse">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🔥</span>
                    <div className="text-left">
                        <p className="font-black text-sm uppercase tracking-wider">{t('studio.last_minute_offer')}</p>
                        <p className="text-[10px] opacity-90 font-bold">{t('studio.last_minute_offer_desc')}</p>
                    </div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg font-mono font-bold text-lg border border-white/30">
                    {formatTime(minutes)}:{formatTime(seconds)}
                </div>
            </div>
        </div>
    );
};

export const Step4Summary: React.FC<{ 
    totalPrice: number; 
    priceBreakdown: PriceBreakdownItem[]; 
    frameName: string; 
    charCount: number; 
    onAddToCart: () => void; 
    onBuyNow: () => void; 
    isSaving: boolean; 
    isEditingOrder?: boolean;
    urgencyTimeLeft: number;
}> = ({ totalPrice, priceBreakdown, frameName, charCount, onAddToCart, onBuyNow, isSaving, isEditingOrder, urgencyTimeLeft }) => {
  const { t } = useLanguage();
  const remainingForFreeShip = FREE_SHIPPING_THRESHOLD - totalPrice;
  const hasCustomPrint = priceBreakdown.some(item => item.label.includes('In mặt riêng') || item.label.includes(t('studio.custom_print')));

  return (
    <div className="text-left">
        {!isEditingOrder && urgencyTimeLeft > 0 && <UrgencyFlashSale timeLeft={urgencyTimeLeft} />}
        
        <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
                <span>{t('studio.invoice_details')}</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{t('studio.character_count', { count: charCount })}</span>
            </h4>
            
            <div className="space-y-2 text-sm text-gray-700 max-h-60 overflow-y-auto custom-scrollbar pr-1 text-left">
                {priceBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-1">
                        <div className="flex flex-col">
                            <span className={item.isBase ? 'font-semibold text-gray-800' : 'text-gray-600'}>
                                {item.label}
                            </span>
                            {item.details && <span className="text-[10px] text-gray-400 italic">{item.details}</span>}
                        </div>
                        <div className="text-right">
                            {item.originalValue !== undefined && item.originalValue > item.value && (
                                <span className="block text-[10px] text-gray-400 line-through">
                                    {formatCurrency(item.originalValue)}
                                </span>
                            )}
                            <span className={`font-medium ${item.value > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                {item.value > 0 ? formatCurrency(item.value) : t('studio.free')}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="border-t border-gray-200 my-3 pt-2">
                <div className="flex justify-between text-base font-bold text-gray-800 items-center">
                    <span>{t('studio.subtotal')}</span>
                    <span className="text-xl text-luvin-pink">{formatCurrency(totalPrice)}</span>
                </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200 mt-2">
                {remainingForFreeShip > 0 ? (
                    <p className="text-xs text-gray-600 text-center" dangerouslySetInnerHTML={{ __html: t('studio.buy_more_for_freeship', { amount: formatCurrency(remainingForFreeShip) }) }} />
                ) : (
                    <p className="text-xs text-green-600 font-bold text-center flex items-center justify-center gap-1">
                        <span>🎉</span> {t('studio.freeship_eligible')}
                    </p>
                )}
            </div>
        </div>

        {/* Included Gifts Notification */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-4 animate-fade-in text-left">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <h4 className="font-black text-[11px] text-blue-900 uppercase tracking-widest">Sản phẩm bao gồm:</h4>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center p-2 bg-white/60 rounded-xl border border-blue-50">
                    <span className="text-lg mb-1">🎁</span>
                    <span className="text-[9px] font-black text-blue-800 uppercase text-center">{t('studio.include_box')}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/60 rounded-xl border border-blue-50">
                    <span className="text-lg mb-1">🛍️</span>
                    <span className="text-[9px] font-black text-blue-800 uppercase text-center">{t('studio.include_bag')}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/60 rounded-xl border border-blue-50">
                    <span className="text-lg mb-1">✉️</span>
                    <span className="text-[9px] font-black text-blue-800 uppercase text-center">{t('studio.include_card')}</span>
                </div>
            </div>
        </div>

        {hasCustomPrint && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4 flex gap-3 items-start animate-fade-in text-left">
                <span className="text-xl">⚠️</span>
                <div>
                    <p className="font-bold text-amber-900 text-sm mb-1">{t('studio.custom_print')}</p>
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">{t('studio.custom_print_notice')}</p>
                </div>
            </div>
        )}

        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mt-4 flex gap-3 items-start animate-fade-in text-left">
            <span className="text-xl">📅</span>
            <div>
                <p className="font-bold text-indigo-900 text-sm mb-1">{t('studio.early_bird_tip')}</p>
                <div className="text-xs text-indigo-700 leading-relaxed">
                    <p dangerouslySetInnerHTML={{ __html: t('studio.handcrafted_notice') }} />
                    <p dangerouslySetInnerHTML={{ __html: t('studio.early_bird_desc') }} />
                </div>
            </div>
        </div>

        <div className="mt-6 space-y-4">
            {!isEditingOrder && <DesignerCommitment />}
            
            <div className="flex flex-col sm:flex-row gap-3">
                {!isEditingOrder && (
                    <button 
                        onClick={onBuyNow} 
                        disabled={isSaving} 
                        className="flex-1 bg-luvin-pink text-gray-800 font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <span className="animate-spin h-5 w-5 border-2 border-gray-800 border-t-transparent rounded-full"></span>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                {t('studio.buy_now_checkout')}
                            </>
                        )}
                    </button>
                )}
                <button 
                    onClick={onAddToCart} 
                    disabled={isSaving} 
                    className={`flex-1 font-bold py-4 rounded-2xl text-base transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        isEditingOrder 
                            ? 'bg-luvin-pink text-gray-800 hover:opacity-90 shadow-lg' 
                            : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                >
                    {isSaving ? (
                        <span className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            {isEditingOrder ? t('studio.save_design') : t('studio.add_to_cart')}
                        </>
                    )}
                </button>
            </div>
        </div>
    </div>
  );
};
