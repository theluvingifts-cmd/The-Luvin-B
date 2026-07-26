
import React from 'react';
import { FrameConfig } from '../../types';
import { formatCurrency, FREE_SHIPPING_THRESHOLD, PriceBreakdownItem } from '../../utils/pricing';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Scissors, ShieldCheck, Zap, ShoppingCart, Clock, Info } from 'lucide-react';
import { motion } from 'motion/react';

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
    config: FrameConfig;
    setConfig: (c: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => void;
    totalPrice: number; 
    priceBreakdown: PriceBreakdownItem[]; 
    frameName: string; 
    productLine?: string;
    charCount: number; 
    onAddToCart: () => void; 
    onBuyNow: () => void; 
    isSaving: boolean; 
    isEditingOrder?: boolean;
    urgencyTimeLeft: number;
}> = ({ config, setConfig, totalPrice, priceBreakdown, frameName, productLine, charCount, onAddToCart, onBuyNow, isSaving, isEditingOrder, urgencyTimeLeft }) => {
  const { t } = useLanguage();
  const remainingForFreeShip = FREE_SHIPPING_THRESHOLD - totalPrice;
  const hasCustomPrint = priceBreakdown.some(item => item.label.includes('In mặt riêng') || item.label.includes(t('studio.custom_print')));
  const isMuseumStyle = config.isMuseumStyle || productLine === 'gallery';

  let museumSurcharge = 70000;
  try {
      const cached = typeof window !== 'undefined' ? (localStorage.getItem('store_config') || localStorage.getItem('store_config_cache')) : null;
      if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.museumSurcharge === 'number') {
              museumSurcharge = parsed.museumSurcharge;
          }
      }
  } catch (e) {}

  const handleAssemblyChange = (val: 'diy' | 'pre-assembled') => {
      setConfig(prev => ({
          ...prev,
          galleryOptions: {
              ...prev.galleryOptions,
              assembly: val
          }
      }));
  };

  return (
    <div className="text-left">
        {!isEditingOrder && urgencyTimeLeft > 0 && <UrgencyFlashSale timeLeft={urgencyTimeLeft} />}
        
        {isMuseumStyle && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                    <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                        <Info className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-tight">Tùy chọn hoàn thiện Bảo Tàng</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleAssemblyChange('diy')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 ${
                            (config.galleryOptions?.assembly !== 'pre-assembled')
                                ? 'bg-white border-indigo-500 shadow-md scale-105' 
                                : 'bg-indigo-50/50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                        <span className="text-xl">🧩</span>
                        <span className="text-xs font-bold leading-none">Khách tự lắp</span>
                        <span className="text-[10px] opacity-70">Miễn phí</span>
                    </button>
                    <button 
                        onClick={() => handleAssemblyChange('pre-assembled')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 ${
                            (config.galleryOptions?.assembly === 'pre-assembled')
                                ? 'bg-white border-indigo-500 shadow-md scale-105' 
                                : 'bg-indigo-50/50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                        <span className="text-xl">✨</span>
                        <span className="text-xs font-bold leading-none">The Luvin lắp sẵn</span>
                        <span className="text-[10px] opacity-70">+{formatCurrency(museumSurcharge)}</span>
                    </button>
                </div>
            </div>
        )}

        <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
                <span>{t('studio.invoice_details')}</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{t('studio.character_count', { count: charCount })}</span>
            </h4>
            
            <div className="space-y-2 text-sm text-gray-700 max-h-60 overflow-y-auto custom-scrollbar pr-1 text-left">
                {priceBreakdown.map((item, index) => {
                    const isOOS = item.details?.includes('Hết hàng');
                    return (
                        <div key={index} className={`flex justify-between items-center py-1 ${isOOS ? 'opacity-50 grayscale' : ''}`}>
                            <div className="flex flex-col">
                                <span className={item.isBase ? 'font-semibold text-gray-800' : 'text-gray-600'}>
                                    {item.label}
                                </span>
                                {item.details && <span className={`text-[10px] italic ${isOOS ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{item.details}</span>}
                            </div>
                            <div className="text-right">
                                {item.originalValue !== undefined && item.originalValue > item.value && (
                                    <span className="block text-[10px] text-gray-400 line-through">
                                        {formatCurrency(item.originalValue)}
                                    </span>
                                )}
                                <span className={`font-medium ${isOOS ? 'text-gray-400' : item.value > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {isOOS ? '0 ₫' : (item.value > 0 ? formatCurrency(item.value) : t('studio.free'))}
                                </span>
                            </div>
                        </div>
                    );
                })}
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

        {hasCustomPrint && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4 flex gap-3 items-start animate-fade-in text-left">
                <span className="text-xl">⚠️</span>
                <div>
                    <p className="font-bold text-amber-900 text-sm mb-1">{t('studio.custom_print')}</p>
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">{t('studio.custom_print_notice')}</p>
                </div>
            </div>
        )}

        {productLine === 'gallery' && (
            <div className="bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-2.5 mt-4 flex items-center justify-center gap-2 animate-fade-in shadow-sm">
                <Scissors className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[10px] text-amber-800 font-bold italic">
                    Lưu ý: Ảnh in rời khách tự cắt và dán vào khung mini
                </p>
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
