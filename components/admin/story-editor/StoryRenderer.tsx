
import React from 'react';
import { CollectionTemplate, LegoPart, FrameOption } from '../../../types';
import { StoryStyle, StoryAdjustments } from '../../../src/types/story';
import { calculatePrice, formatCurrency } from '../../../utils/pricing';
import { Logo } from '../../shared/Logo';
import { StoreConfig } from '../../../services/configService';

interface StoryRendererProps {
    template: CollectionTemplate;
    style: StoryStyle;
    adjustments: StoryAdjustments;
    parts: LegoPart[];
    frames: FrameOption[];
    logoUrl?: string;
    storeConfig?: StoreConfig;
    isExporting?: boolean;
}

export const StoryRenderer: React.FC<StoryRendererProps> = ({
    template: t,
    style,
    adjustments: adj,
    parts,
    frames,
    logoUrl,
    storeConfig,
    isExporting = false
}) => {
    const basePrice = adj.customPrice || (() => {
        // Priority: Calculate from config if parts are available
        if (t.config && parts.length > 0) {
            const partsMap = parts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            const { totalPrice } = calculatePrice(t.config, partsMap, frames);
            if (totalPrice > 0) return totalPrice;
        }
        
        // Fallback to static price
        return t.salePrice || t.price || 285000;
    })();

    const isGallery = (t.productLine || t.config?.productLine) === 'gallery';
    const items = t.config?.draggableItems || [];
    const charCount = t.config?.characters?.length || t.galleryOptions?.charCount || 0;
    const photoFrameCount = items.filter(i => i.frameUrl || i.type === 'frame').length || t.galleryOptions?.photoFrameCount || 0;
    const charmCount = items.filter(i => !i.frameUrl && i.type !== 'frame').length || 0;
    
    // Unified labeling for stats - cleaner and consistent
    const statsSegments = [];
    if (charCount > 0) statsSegments.push(`${charCount} nhân vật`);
    if (photoFrameCount > 0 && isGallery) statsSegments.push(`${photoFrameCount} khung ảnh`);
    if (charmCount > 0) statsSegments.push(`${charmCount} charm`);
    
    const combinedStatsLabel = statsSegments.join(', ');
    const itemStatsLabel = statsSegments.filter(s => !s.includes('nhân vật')).join(', ');

    // Ưu tiên màu từ storeConfig (theme của web) nếu không có tùy chỉnh
    const themeAccent = storeConfig?.theme?.global?.colors?.primary || '#E91E63';
    const accentColor = adj.accentColor || themeAccent;
    const textColor = adj.textColor || '#111827'; // gray-900
    const bgColor = adj.backgroundColor || (style === 'minimal' ? '#F9F9F9' : style === 'magazine' ? '#FFFFFF' : '#FFFBF0');

    const displayName = adj.customName || t.name;
    const displayNote = adj.customNote || "Các thông tin trong background bao gồm tên, ngày, ảnh v.v. đều có thể thay đổi sau khi đặt hàng. Shop sẽ liên hệ và gửi demo trước khi thực hiện.";

    const containerStyle = {
        width: '1080px',
        height: '1920px',
        backgroundColor: bgColor,
        color: textColor,
        opacity: adj.opacity,
        fontSize: `${16 * (adj.fontSizeScale || 1)}px`
    };

    if (style === 'magazine') {
        const magBgStyle = adj.backgroundColor ? { backgroundColor: bgColor } : {
            backgroundImage: `url('https://www.transparenttextures.com/patterns/paper.png')`,
            backgroundRepeat: 'repeat',
            backgroundColor: bgColor
        };

        return (
            <div className="w-[1080px] h-[1920px] flex flex-col items-center relative overflow-hidden font-sans" style={magBgStyle}>
                <style dangerouslySetInnerHTML={{ __html: `
                    @import url('https://fonts.googleapis.com/css2?family=Libre+Bodoni:ital,wght@0,400..700;1,400..700&display=swap');
                    .font-bodoni { font-family: 'Libre Bodoni', serif; }
                `}} />
                
                {!adj.hideBranding && (
                    <div className="mt-20 w-full px-20 z-20 flex flex-col items-center transition-transform duration-200" style={{ transform: `translateY(${adj.brandingY}px)` }}>
                        <div className="w-full flex justify-between items-center border-b-[6px] border-black pb-8 mb-4">
                            <div className="flex flex-col items-start">
                                <Logo url={logoUrl} className="h-24" textClassName="text-[80px]" style={{ color: textColor }} />
                                <p className="text-xl font-black tracking-[0.3em] mt-4 opacity-40 uppercase">Artisan Gifts • Est. 2024</p>
                            </div>
                            <div className="flex flex-col items-end text-right">
                                <p className="text-2xl font-black tracking-[0.4em] uppercase">Issue No. 24</p>
                                <p className="text-xl font-bold italic mt-1" style={{ color: accentColor }}>Special Edition</p>
                            </div>
                        </div>
                        <div className="w-full flex justify-between text-lg font-black uppercase tracking-[0.25em] pt-2 opacity-60">
                            <span>Personalized Design</span>
                            <span>Premium Quality</span>
                            <span>Handcrafted with Love</span>
                        </div>
                    </div>
                )}

                <div className="w-full flex-grow flex items-center justify-center p-24 z-10 transition-transform duration-200" style={{ transform: `translateY(${adj.imageY}px)` }}>
                    <div className="relative w-full max-w-[850px] aspect-[4/5] bg-white">
                        <div className="absolute -inset-10 bg-gray-50/50 -z-10 translate-x-6 translate-y-6 rounded-2xl"></div>
                        
                        <div className="w-full h-full overflow-hidden border-[16px] border-white shadow-[0_60px_120px_rgba(0,0,0,0.12)] relative rounded-sm bg-gray-50">
                            <img 
                                src={t.imageUrl} 
                                className="w-full h-full object-cover transition-transform duration-200" 
                                style={{ transform: `scale(${adj.imageScale})` }}
                                alt="" 
                                crossOrigin="anonymous" 
                            />
                        </div>

                        {!adj.hidePrice && (
                            <div className="absolute right-0 -bottom-16 flex flex-col items-end z-30 transition-transform duration-200" style={{ transform: `translateY(${adj.priceY}px)` }}>
                                <div className="bg-white px-10 py-6 shadow-2xl border-b-[8px]" style={{ borderBottomColor: accentColor }}>
                                    <p className="text-xl font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Price</p>
                                    <p className="text-7xl font-black text-gray-900 leading-none">{formatCurrency(basePrice)}</p>
                                </div>
                            </div>
                        )}

                        {!adj.hideSpecs && (
                            <div className="absolute -left-12 -bottom-2 rotate-[-3deg] bg-white border-[4px] border-black p-8 shadow-2xl z-20">
                                <p className="text-xl font-black uppercase tracking-widest text-black mb-2 border-b-2 border-black/10 pb-2">Technical specs</p>
                                <div className="flex items-center gap-4">
                                    {charCount > 0 && <span className="text-xl font-bold bg-black text-white px-4 py-1.5">{charCount} Figures</span>}
                                    <span className="text-xl font-bold text-gray-500 uppercase tracking-tighter">{itemStatsLabel}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {!adj.hideNote && (
                    <div className="w-full px-24 z-20 transition-transform duration-200" style={{ transform: `translateY(${adj.noteY}px)` }}>
                        <div className="bg-gray-50/80 backdrop-blur-sm border-l-8 p-8" style={{ borderLeftColor: accentColor }}>
                            <p className="text-[20px] font-bold text-slate-500 italic leading-relaxed">
                                {displayNote}
                            </p>
                        </div>
                    </div>
                )}

                <div className="w-full px-24 pb-24 pt-12 z-20 transition-transform duration-200" style={{ transform: `translateY(${adj.contentY}px)` }}>
                    <div className="grid grid-cols-5 gap-12 items-end">
                        <div className="col-span-3 flex flex-col gap-8">
                            <h2 className="text-6xl font-black tracking-tighter leading-tight text-black max-w-[15ch] uppercase">
                                {displayName}
                            </h2>
                            <div className="flex gap-4">
                                <div className="px-5 py-2 bg-black text-white text-sm font-black uppercase tracking-[0.2em]">Authentic</div>
                                <div className="px-5 py-2 border-2 border-black text-black text-sm font-black uppercase tracking-[0.2em]">Gift Set</div>
                            </div>
                        </div>

                        <div className="col-span-2 flex flex-col items-end gap-6 text-right">
                            <p className="text-[34px] font-black text-black leading-tight uppercase tracking-tighter">Order via Bio Link</p>
                            <p className="text-xl font-bold uppercase tracking-[0.3em] font-bodoni italic" style={{ color: accentColor }}>Premium Collection</p>
                            <div className="w-24 h-1 bg-black"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (style === 'minimal') {
        return (
            <div className="w-[1080px] h-[1920px] flex flex-col items-center justify-center p-24 relative overflow-hidden" style={{ backgroundColor: bgColor }}>
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-60"></div>
                
                <div className="z-10 w-full flex flex-col items-start h-full">
                    {!adj.hideBranding && (
                        <div className="flex justify-between items-start w-full mb-12 transition-transform duration-200" style={{ transform: `translateY(${adj.brandingY}px)` }}>
                            <div className="flex flex-col">
                                <p className="text-xl font-black tracking-[0.6em] mb-4 uppercase" style={{ color: accentColor }}>New Arrival</p>
                                <h2 className="text-[120px] font-black tracking-tighter leading-[0.8] mb-4" style={{ color: textColor }}>
                                    {displayName?.split(' ').slice(0, 2).join(' ')}<br/>
                                    <span className="text-gray-300 italic">{displayName?.split(' ').slice(2).join(' ')}</span>
                                </h2>
                            </div>
                            <Logo url={logoUrl} className="h-20" textClassName="text-4xl" style={{ color: textColor }} />
                        </div>
                    )}
                    
                    <div className="w-full flex-grow relative mb-12 transition-transform duration-200" style={{ transform: `translateY(${adj.imageY}px)` }}>
                        <div className="w-full h-full bg-white shadow-[0_80px_160px_rgba(0,0,0,0.08)] rounded-[48px] overflow-hidden p-6 relative">
                            <img 
                                src={t.imageUrl} 
                                className="w-full h-full object-cover rounded-[36px] transition-transform duration-200" 
                                style={{ transform: `scale(${adj.imageScale})` }}
                                alt="" 
                                crossOrigin="anonymous" 
                            />
                            <div className="absolute top-12 left-12">
                                <div className="px-6 py-2 bg-black text-white text-xl font-bold rounded-full shadow-xl">
                                    Collection Art
                                </div>
                            </div>
                        </div>
                    </div>

                    {!adj.hideNote && (
                        <div className="w-full mb-12 px-2 text-center transition-transform duration-200" style={{ transform: `translateY(${adj.noteY}px)` }}>
                            <p className="text-[18px] font-bold text-slate-400 italic">
                                {displayNote}
                            </p>
                        </div>
                    )}

                    <div className="w-full flex justify-between items-end border-t border-gray-100 pt-16 transition-transform duration-200" style={{ transform: `translateY(${adj.contentY}px)` }}>
                        {!adj.hideSpecs && (
                            <div className="flex flex-col gap-8">
                                <div className="flex gap-12">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Product Type</span>
                                        <span className="text-3xl font-black" style={{ color: textColor }}>{t.category || 'Special Edition'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Configuration</span>
                                        <span className="text-3xl font-black" style={{ color: textColor }}>{combinedStatsLabel}</span>
                                    </div>
                                </div>
                                <p className="text-xl font-bold text-gray-400 max-w-[300px]">Design your own story with The Luvin custom frames.</p>
                            </div>
                        )}

                        {!adj.hidePrice && (
                            <div className="text-right flex flex-col items-end transition-transform duration-200" style={{ transform: `translateY(${adj.priceY}px)` }}>
                                <div className="mb-4 text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>Available Now</div>
                                <p className="text-[90px] font-black leading-none tracking-tighter mb-4" style={{ color: textColor }}>{formatCurrency(basePrice)}</p>
                                <p className="text-2xl font-black uppercase tracking-[0.4em] border-b-4 pb-2" style={{ color: accentColor, borderColor: accentColor }}>Order Now</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (style === 'addons') {
        const addonBgStyle = {
            backgroundColor: bgColor,
            backgroundImage: `radial-gradient(circle at 20% 20%, ${accentColor}08 0%, transparent 40%), radial-gradient(circle at 80% 80%, ${accentColor}05 0%, transparent 40%)`
        };

        // Static list of addons to highlight with clear pricing as requested
        const addOnDetails = [
            { icon: '📸', name: 'In ảnh Polaroid', desc: 'In ảnh kỷ niệm theo yêu cầu, sắc nét.', price: 'Chỉ từ +5k/ảnh' },
            { icon: '💡', name: 'Hệ thống Đèn LED', desc: 'Đèn LED đa chế độ, lung linh ấm cúng.', price: 'Chỉ từ +30k' },
            { icon: '🎁', name: 'Hộp Quà & Thẻ', desc: 'Đóng gói sang trọng kèm thiệp viết tay.', price: 'Chỉ từ +25k' }
        ];

        return (
            <div className="w-[1080px] h-[1920px] flex flex-col items-center relative overflow-hidden font-sans" style={addonBgStyle}>
                {!adj.hideBranding && (
                    <div className="mt-16 w-full px-24 z-20 flex flex-col items-center transition-transform duration-200" style={{ transform: `translateY(${adj.brandingY}px)` }}>
                        <Logo url={logoUrl} className="h-20" textClassName="text-4xl" style={{ color: textColor }} />
                        <div className="h-0.5 w-20 bg-black/10 mt-4 rounded-full"></div>
                    </div>
                )}

                <div className="w-full flex flex-col items-center justify-center px-16 z-10 transition-transform duration-200 mt-2" style={{ transform: `translateY(${adj.imageY}px)` }}>
                    <div className="relative w-full max-w-[820px] aspect-[4/5]">
                        <div className="absolute -inset-5 bg-black/5 rounded-[40px] blur-2xl"></div>
                        <div className="w-full h-full overflow-hidden border-[8px] border-white shadow-2xl relative rounded-[32px] bg-gray-50">
                            <img 
                                src={t.imageUrl} 
                                className="w-full h-full object-cover transition-transform duration-200" 
                                style={{ transform: `scale(${adj.imageScale})` }}
                                alt="" 
                                crossOrigin="anonymous" 
                            />
                            
                            <div className="absolute top-6 left-6">
                                <div className="px-5 py-1.5 bg-white/90 backdrop-blur-md text-black text-lg font-black rounded-xl shadow-xl uppercase tracking-widest border border-white">
                                    Option ưu đãi
                                </div>
                            </div>
                        </div>

                        {!adj.hidePrice && (
                            <div className="absolute -right-4 -bottom-8 flex flex-col items-end z-30 transition-transform duration-200" style={{ transform: `translateY(${adj.priceY}px)` }}>
                                <div className="bg-white px-8 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.12)] rounded-[24px] border-b-[8px]" style={{ borderBottomColor: accentColor }}>
                                    <p className="text-4xl font-black leading-none" style={{ color: textColor }}>{formatCurrency(basePrice)}</p>
                                    <p className="text-base font-bold mt-1 opacity-50 uppercase tracking-[0.2em] text-center">Giá sản phẩm gốc</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full px-20 mt-8 z-20 transition-transform duration-200" style={{ transform: `translateY(${adj.contentY}px)` }}>
                    <h2 className="text-4xl font-black text-center mb-8 uppercase tracking-tighter" style={{ color: textColor }}>
                        Nâng cấp <span style={{ color: accentColor }}>linh hoạt</span> theo ý muốn
                    </h2>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {addOnDetails.map((addon, idx) => (
                            <div key={idx} className="bg-white/70 backdrop-blur-sm border border-white rounded-[28px] p-5 flex items-center gap-6 shadow-sm">
                                <div className="w-16 h-16 rounded-[20px] bg-white shadow-md flex items-center justify-center text-[32px]">
                                    {addon.icon}
                                </div>
                                <div className="flex flex-col flex-grow">
                                    <h4 className="text-xl font-black uppercase tracking-tight" style={{ color: textColor }}>{addon.name}</h4>
                                    <p className="text-lg font-bold text-gray-400 italic leading-tight">{addon.desc}</p>
                                </div>
                                <div className="px-4 py-2 bg-slate-900 rounded-full">
                                    <span className="text-white font-black text-lg whitespace-nowrap">{addon.price}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {!adj.hideNote && (
                    <div className="mt-12 w-full px-32 z-20 text-center transition-transform duration-200" style={{ transform: `translateY(${adj.noteY}px)` }}>
                        <div className="h-px w-20 bg-black/5 mx-auto mb-4"></div>
                        <p className="text-[19px] font-bold text-slate-400 italic leading-relaxed max-w-[800px] mx-auto">
                            {displayNote}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Default / Classic
    return (
        <div className="w-[1080px] h-[1920px] flex flex-col items-center justify-between pt-16 pb-24 px-16 relative" style={{ backgroundColor: bgColor }}>
            <div className="absolute top-[10%] -left-[10%] w-[500px] h-[500px] bg-white opacity-40 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[5%] -right-[5%] w-[400px] h-[400px] rounded-full blur-3xl" style={{ backgroundColor: `${accentColor}10` }}></div>

            {!adj.hideBranding && (
                <div className="z-10 flex flex-col items-center gap-6 transition-transform duration-200" style={{ transform: `translateY(${adj.brandingY}px)` }}>
                    <Logo url={logoUrl} className="h-32" textClassName="text-6xl" style={{ color: textColor }} />
                    <div className="h-2 w-48 bg-gray-900/10 rounded-full"></div>
                    {!adj.hideNote && (
                        <div className="max-w-[850px] text-center mt-2 px-4 transition-transform duration-200" style={{ transform: `translateY(${adj.noteY}px)` }}>
                            <p className="text-[20px] font-bold text-slate-500/80 italic leading-relaxed">
                                {displayNote}
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className="w-full flex-grow flex flex-col justify-center items-center z-10 transition-transform duration-200" style={{ transform: `translateY(${adj.imageY}px)` }}>
                <div className="w-full bg-white shadow-2xl rounded-[40px] p-6 flex flex-col">
                    <div className="aspect-square rounded-[24px] overflow-hidden bg-gray-50 border border-gray-100">
                        <img 
                            src={t.imageUrl} 
                            className="w-full h-full object-cover transition-transform duration-200" 
                            style={{ transform: `scale(${adj.imageScale})` }}
                            alt="" 
                            crossOrigin="anonymous" 
                        />
                    </div>
                    <div className="pt-10 pb-6 px-4 flex flex-col items-center text-center transition-transform duration-200" style={{ transform: `translateY(${adj.contentY}px)` }}>
                        <p className="text-sm font-extrabold uppercase tracking-[0.4em] mb-3" style={{ color: accentColor }}>{t.category || (t.productLine === 'gallery' ? 'MINIMALIST ART' : 'LEGO COLLECTION')}</p>
                        <h3 className="text-5xl font-bold tracking-tight leading-tight px-4" style={{ color: textColor }}>{displayName}</h3>
                        
                        {!adj.hideSpecs && (
                            <div className="flex items-center gap-6 mt-8">
                                {charCount > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">👤</div>
                                        <span className="text-xl font-bold text-gray-600">{charCount} nhân vật</span>
                                    </div>
                                )}
                                {itemStatsLabel && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">✨</div>
                                        <span className="text-xl font-bold text-gray-600">{itemStatsLabel}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {!adj.hidePrice && (
                            <div className="mt-10 flex flex-col items-center gap-2 transition-transform duration-200" style={{ transform: `translateY(${adj.priceY}px)` }}>
                                <p className="text-6xl font-black tracking-tighter" style={{ color: accentColor }}>
                                    {formatCurrency(basePrice)}
                                </p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                                    Tặng kèm Hộp, Túi và Thiệp
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!adj.hideBranding && (
                <div className="w-full h-64 z-10 flex flex-col items-center justify-end pb-12 opacity-30 px-16">
                    <p className="text-lg text-gray-400 font-bold uppercase tracking-[0.6em]">THELUVIN.VN</p>
                </div>
            )}
        </div>
    );
};
