
import React, { useState, useMemo, useRef } from 'react';
import { StoreConfig } from '../services/configService';
import { Page, FrameOption, LegoPart } from '../types';
import { formatCurrency } from '../utils/pricing';

const B2B_HERO_IMG = "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop";

interface BusinessPageProps {
    config?: StoreConfig;
    navigateTo?: (page: Page) => void;
    frames: FrameOption[];
    products: LegoPart[];
}

export const BusinessPage: React.FC<BusinessPageProps> = ({ config, navigateTo, frames, products }) => {
    // State cho Configurator
    const [selFrameId, setSelFrameId] = useState('sm');
    const [selNVCount, setSelNVCount] = useState(1);
    const [hasHair, setHasHair] = useState(true);
    const [charmTier, setCharmTier] = useState<'none' | 'normal' | 'vip'>('normal');
    const [charmQty, setCharmQty] = useState(1);
    const [orderQuantity, setOrderQuantity] = useState(10);
    const [showCharmModal, setShowCharmModal] = useState(false);
    
    const quotationRef = useRef<HTMLDivElement>(null);

    // Lọc danh sách charm thực tế từ database
    const dbCharms = useMemo(() => {
        return products.filter(p => p.type === 'accessory' || p.type === 'pet');
    }, [products]);

    const currentFrame = useMemo(() => frames.find(f => f.id === selFrameId) || frames[0], [selFrameId, frames]);

    /**
     * LOGIC TÍNH GIÁ CHÍNH XÁC (YÊU CẦU):
     * 1. Cấu hình lẻ = Giá khung + (10k nhân vật + (có tóc ? 25k : 0)) * Số nhân vật
     * 2. Giá sỉ cơ bản = Cấu hình lẻ * 0.95 (Giảm 5%)
     * 3. Giá cuối = Giá sỉ cơ bản + (Giá Charm * Số lượng charm)
     */
    const retailSetupPrice = useMemo(() => {
        const baseFrame = currentFrame?.price || 210000;
        const charPartPrice = 10000 + (hasHair ? 25000 : 0);
        return baseFrame + (charPartPrice * selNVCount);
    }, [currentFrame, selNVCount, hasHair]);

    const unitWholesalePrice = useMemo(() => {
        const wholesaleBase = Math.round(retailSetupPrice * 0.95);
        let charmAddon = 0;
        if (charmTier === 'normal') charmAddon = 10000 * charmQty;
        if (charmTier === 'vip') charmAddon = 25000 * charmQty;
        return wholesaleBase + charmAddon;
    }, [retailSetupPrice, charmTier, charmQty]);

    const totalOrderPrice = unitWholesalePrice * orderQuantity;
    const savingPerUnit = (retailSetupPrice + (charmTier === 'normal' ? 15000 * charmQty : charmTier === 'vip' ? 35000 * charmQty : 0)) - unitWholesalePrice;

    const handleContactZalo = () => {
        const hotline = config?.hotline?.replace(/\s/g, '') || '0964393115';
        const message = encodeURIComponent(
            `Chào The Luvin, mình cần báo giá sỉ cho doanh nghiệp:\n` +
            `- Khung: ${currentFrame.name} + ${selNVCount} NV (${hasHair ? 'Có tóc' : 'Không tóc'})\n` +
            `- Phụ kiện: Gói ${charmTier} (${charmQty} cái/khung)\n` +
            `- Số lượng: ${orderQuantity} khung\n` +
            `- Đơn giá sỉ: ${formatCurrency(unitWholesalePrice)}\n` +
            `Dự kiến tổng: ${formatCurrency(totalOrderPrice)}`
        );
        window.open(`https://zalo.me/${hotline}?text=${message}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-white font-body text-site-text transition-colors duration-300">
            {/* Hero Section */}
            <div className="relative h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                    <img src={B2B_HERO_IMG} className="w-full h-full object-cover" alt="Business Office" />
                    <div className="absolute inset-0 bg-gray-900/60 mix-blend-multiply"></div>
                </div>
                <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
                    <span className="text-white/80 font-bold tracking-[0.2em] text-[10px] uppercase mb-4 block">The Luvin Corporate</span>
                    <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6 leading-tight">
                        Quà Tặng <span className="text-primary italic">Doanh Nghiệp</span> <br/>
                        Đẳng Cấp & Tinh Tế
                    </h1>
                    <button 
                        onClick={() => quotationRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="bg-primary text-white px-10 py-4 rounded-full font-bold text-sm tracking-wide hover:bg-white hover:text-primary transition-all shadow-lg transform hover:-translate-y-1"
                    >
                        Tự tính báo giá sỉ ngay
                    </button>
                </div>
            </div>

            {/* Configurator Area */}
            <section ref={quotationRef} className="py-20 bg-pink-50/30 scroll-mt-20">
                <div className="container mx-auto px-4 max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">Dự Toán Ngân Sách Sỉ</h2>
                        <p className="text-gray-500 mt-2 text-sm italic">* Đơn giá sỉ được áp dụng giảm 5% so với giá cấu hình lẻ.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* LEFT: Selections */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* 1. Frame Selection */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100">
                                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
                                    <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                                    Chọn loại khung
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {frames.map(f => (
                                        <button 
                                            key={f.id}
                                            onClick={() => setSelFrameId(f.id)}
                                            className={`p-4 border-2 rounded-2xl text-left transition-all ${selFrameId === f.id ? 'border-primary bg-pink-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                        >
                                            <p className="font-bold text-xs text-gray-800">{f.name}</p>
                                            <p className="text-[9px] text-gray-400 mt-1">{f.frameWidthCm}x{f.frameHeightCm}cm</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Character Logic */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100">
                                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
                                    <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                                    Nhân vật & Linh kiện
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <button 
                                            key={n}
                                            onClick={() => setSelNVCount(n)}
                                            className={`px-5 py-2.5 rounded-xl border-2 font-bold text-xs transition-all ${selNVCount === n ? 'border-primary bg-primary text-white shadow-md' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                                        >
                                            {n} Nhân vật
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                    <div>
                                        <p className="text-xs font-bold text-gray-700">Lấy linh kiện Tóc cho nhân vật?</p>
                                        <p className="text-[10px] text-gray-500">+25.000đ / nhân vật</p>
                                    </div>
                                    <button 
                                        onClick={() => setHasHair(!hasHair)}
                                        className={`w-14 h-7 rounded-full relative transition-colors ${hasHair ? 'bg-primary' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${hasHair ? 'left-8' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>

                            {/* 3. Charm Selection */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-xs uppercase tracking-widest">
                                        <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                                        Gói Charm trang trí
                                    </h3>
                                    <button 
                                        onClick={() => setShowCharmModal(true)}
                                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        🔍 Xem danh sách Charm
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div 
                                        onClick={() => setCharmTier('normal')}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${charmTier === 'normal' ? 'border-primary bg-pink-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                    >
                                        <span className="text-xl block mb-1">🎀</span>
                                        <p className="font-bold text-xs text-gray-800">Gói Tiêu chuẩn</p>
                                        <p className="text-[10px] text-primary font-bold">10.000đ/cái</p>
                                    </div>
                                    <div 
                                        onClick={() => setCharmTier('vip')}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${charmTier === 'vip' ? 'border-primary bg-pink-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                    >
                                        <span className="text-xl block mb-1">👑</span>
                                        <p className="font-bold text-xs text-gray-800">Gói Premium VIP</p>
                                        <p className="text-[10px] text-primary font-bold">25.000đ/cái</p>
                                    </div>
                                </div>
                                {charmTier !== 'none' && (
                                    <div className="bg-gray-50 p-4 rounded-2xl flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-600">Số lượng charm / mỗi khung:</span>
                                            <div className="flex items-center gap-2">
                                                {[1, 2, 3, 4, 5].map(q => (
                                                    <button 
                                                        key={q} 
                                                        onClick={() => setCharmQty(q)}
                                                        className={`w-8 h-8 rounded-full border-2 text-[10px] font-bold transition-all ${charmQty === q ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-400'}`}
                                                    >
                                                        {q}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Quantity */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">4. Số lượng đặt sỉ</h3>
                                    <p className="text-[10px] text-gray-400 mt-1">Áp dụng sỉ từ 10 sản phẩm</p>
                                </div>
                                <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-2xl">
                                    <button onClick={() => setOrderQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold text-xl">-</button>
                                    <input type="number" className="w-16 bg-transparent text-center font-heading font-bold text-xl outline-none" value={orderQuantity} onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                                    <button onClick={() => setOrderQuantity(q => q + 1)} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold text-xl">+</button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Summary Card */}
                        <div className="lg:col-span-5 sticky top-24">
                            <div className="bg-gray-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-6 right-[-35px] bg-red-500 text-white px-10 py-1 font-bold text-[10px] rotate-45 shadow-lg flex flex-col items-center">
                                    <span>CHIẾT KHẤU</span>
                                    <span className="text-sm">-5%</span>
                                </div>

                                <h2 className="text-xl font-heading font-bold mb-8 border-b border-white/10 pb-4">Tóm tắt báo giá</h2>
                                
                                <div className="space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Sản phẩm chính</p>
                                            <p className="text-sm font-medium">Khung {currentFrame.name} + {selNVCount} NV</p>
                                            <p className="text-[10px] text-gray-500 italic">{hasHair ? 'Đã bao gồm tóc' : 'Không lấy tóc'}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[10px] text-gray-500 line-through">{formatCurrency(retailSetupPrice)}</span>
                                            <span className="font-mono text-sm font-bold text-primary">{formatCurrency(Math.round(retailSetupPrice * 0.95))}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Phụ kiện Charm</p>
                                            <p className="text-sm font-medium">{charmTier === 'none' ? 'Không lấy' : `Gói ${charmTier} (x${charmQty} cái)`}</p>
                                        </div>
                                        <span className="font-mono text-sm">+{formatCurrency(charmTier === 'normal' ? 10000 * charmQty : charmTier === 'vip' ? 25000 * charmQty : 0)}</span>
                                    </div>

                                    <div className="pt-6 border-t border-white/10 space-y-3">
                                        <div className="flex justify-between items-center text-gray-300">
                                            <span className="text-sm">Đơn giá sỉ / khung:</span>
                                            <span className="text-xl font-bold text-white">{formatCurrency(unitWholesalePrice)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-300">
                                            <span className="text-sm">Tổng số lượng sỉ:</span>
                                            <span className="text-lg font-bold">x {orderQuantity}</span>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t-2 border-white/10 flex justify-between items-center">
                                        <span className="text-lg font-bold uppercase tracking-tighter">Tổng dự toán:</span>
                                        <div className="text-right">
                                            <span className="block text-3xl font-heading font-bold text-white">{formatCurrency(totalOrderPrice)}</span>
                                            <span className="text-[10px] text-green-400 font-bold">Tiết kiệm khoảng {formatCurrency(savingPerUnit * orderQuantity)}</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleContactZalo}
                                    className="w-full mt-10 bg-white text-gray-900 py-4 rounded-2xl font-bold text-base hover:bg-primary hover:text-white transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-3"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.8.48 3.5 1.32 5L2.04 22l5.18-1.26C8.42 21.56 10.17 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
                                    Nhận báo giá chính thức
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- CHARM PREVIEW MODAL --- */}
            {showCharmModal && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowCharmModal(false)}
                >
                    <div 
                        className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden transform animate-bounce-small"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-2xl font-heading font-bold text-gray-900">Thư viện Charm & Phụ kiện</h3>
                                <p className="text-xs text-gray-500 mt-1">Dữ liệu thực tế từ kho linh kiện The Luvin</p>
                            </div>
                            <button onClick={() => setShowCharmModal(false)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md text-2xl hover:text-red-500 transition-colors">×</button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6">
                                {dbCharms.map(charm => (
                                    <div key={charm.id} className="group flex flex-col items-center gap-2">
                                        <div className="aspect-square w-full bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center p-3 group-hover:border-primary group-hover:bg-pink-50 transition-all">
                                            <img src={charm.imageUrl} className="max-w-full max-h-full object-contain" alt={charm.name} />
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-600 text-center line-clamp-1">{charm.name}</span>
                                    </div>
                                ))}
                            </div>
                            {dbCharms.length === 0 && (
                                <div className="text-center py-20 text-gray-400 italic">Đang cập nhật danh sách từ database...</div>
                            )}
                        </div>
                        <div className="p-6 border-t text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50">
                            The Luvin • Quà tặng doanh nghiệp độc bản
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
