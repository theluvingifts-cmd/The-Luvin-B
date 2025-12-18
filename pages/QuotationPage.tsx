
import React, { useState, useMemo } from 'react';
import { FrameOption } from '../types';
import { formatCurrency } from '../utils/pricing';
import { StoreConfig } from '../services/configService';

interface QuotationPageProps {
    frames: FrameOption[];
    config: StoreConfig;
}

export const QuotationPage: React.FC<QuotationPageProps> = ({ frames, config }) => {
    const [selFrameId, setSelFrameId] = useState('sm');
    const [selNVCount, setSelNVCount] = useState(1);
    const [charmTier, setCharmTier] = useState<'none' | 'normal' | 'vip'>('normal');
    const [normalCharmQty, setNormalCharmQty] = useState(1); // Số lượng charm cho gói thường
    const [orderQuantity, setOrderQuantity] = useState(10); // Số lượng đơn hàng sỉ

    // Cấu hình nội dung chi tiết gói
    const charmPacks = {
        normal: {
            name: 'Gói Charm Tiêu Chuẩn',
            basePrice: 10000, // Giá 1 charm thường
            icon: '🎀',
            items: ['Trái tim', 'Ngôi sao', 'Hoa hướng dương', 'Cỏ 4 lá', 'Nốt nhạc', 'Kim cương'],
            description: 'Các icon trang trí cơ bản, tạo điểm nhấn nhẹ nhàng.'
        },
        vip: {
            name: 'Gói Charm Premium',
            fixedPrice: 25000, // Giá cố định cho combo VIP
            icon: '👑',
            items: ['Máy ảnh mini', 'Thú cưng (Corgi/Mèo)', 'Vali du lịch', 'Bình nước/Cà phê', 'Máy tính/Sách', 'Đồ ăn mini'],
            description: 'Combo 2-3 phụ kiện cao cấp theo chủ đề nghề nghiệp/sở thích.'
        }
    };

    const currentFrame = useMemo(() => frames.find(f => f.id === selFrameId) || frames[0], [selFrameId, frames]);

    // Giả định giá bán lẻ (Retail) để so sánh tiết kiệm
    const retailComparison = useMemo(() => {
        const frameRetail = (currentFrame?.price || 210000) + 40000; // Lẻ đắt hơn ~40k
        const nvRetail = selNVCount * 75000; // Lẻ ~75k/NV (đã bao gồm linh kiện lẻ)
        const charmRetail = charmTier === 'none' ? 0 : (charmTier === 'normal' ? normalCharmQty * 15000 : 35000);
        return frameRetail + nvRetail + charmRetail;
    }, [currentFrame, selNVCount, charmTier, normalCharmQty]);

    // Tính giá sỉ (Wholesale)
    const unitWholesalePrice = useMemo(() => {
        const baseFrame = currentFrame?.price || 210000;
        const charCost = selNVCount * 50000; // Sỉ tính 50k/NV
        let charmCost = 0;
        if (charmTier === 'normal') charmCost = normalCharmQty * charmPacks.normal.basePrice;
        if (charmTier === 'vip') charmCost = charmPacks.vip.fixedPrice;
        return baseFrame + charCost + charmCost;
    }, [currentFrame, selNVCount, charmTier, normalCharmQty]);

    const totalOrderPrice = unitWholesalePrice * orderQuantity;
    const savingPercent = Math.round((1 - unitWholesalePrice / retailComparison) * 100);

    const handleContactZalo = () => {
        const hotline = config.hotline?.replace(/\s/g, '') || '0964393115';
        const message = encodeURIComponent(
            `Chào The Luvin, mình cần báo giá sỉ cho doanh nghiệp:\n` +
            `- Cấu hình: Khung ${currentFrame.name} + ${selNVCount} NV\n` +
            `- Phụ kiện: ${charmTier === 'none' ? 'Không' : (charmTier === 'normal' ? `${normalCharmQty} Charm Thường` : 'Gói VIP')}\n` +
            `- Số lượng: ${orderQuantity} khung\n` +
            `- Đơn giá sỉ: ${formatCurrency(unitWholesalePrice)}\n` +
            `Dự kiến tổng: ${formatCurrency(totalOrderPrice)}`
        );
        window.open(`https://zalo.me/${hotline}?text=${message}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 font-body text-gray-800 pb-20">
            {/* Header Area */}
            <div className="bg-white border-b border-gray-100 pt-16 pb-12 px-4 text-center">
                <div className="container mx-auto">
                    <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase mb-2 block">The Luvin B2B Solutions</span>
                    <h1 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-4">Dự Toán Báo Giá Sỉ</h1>
                    <p className="text-gray-500 max-w-xl mx-auto text-sm">
                        Hệ thống tự động tính toán chi phí dựa trên cấu hình tùy chỉnh cho doanh nghiệp.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT: Configurator */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Step 1: Frame */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                                DÒNG KHUNG
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {frames.map(f => (
                                    <button 
                                        key={f.id}
                                        onClick={() => setSelFrameId(f.id)}
                                        className={`p-4 border-2 rounded-2xl text-left transition-all ${selFrameId === f.id ? 'border-primary bg-pink-50' : 'border-gray-100 hover:border-gray-200'}`}
                                    >
                                        <p className="font-bold text-sm text-gray-800">{f.name}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{f.frameWidthCm}x{f.frameHeightCm}cm</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 2: Characters */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                                NHÂN VẬT LEGO
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <button 
                                        key={n}
                                        onClick={() => setSelNVCount(n)}
                                        className={`px-6 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${selNVCount === n ? 'border-primary bg-primary text-white shadow-md' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                                    >
                                        {n} NV
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 3: Charm Tier Selection */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                                GÓI PHỤ KIỆN (CHARM)
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {/* Normal Pack */}
                                <div 
                                    onClick={() => setCharmTier('normal')}
                                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${charmTier === 'normal' ? 'border-primary bg-pink-50/30 ring-1 ring-primary' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{charmPacks.normal.icon}</span>
                                            <div>
                                                <h4 className="font-bold text-sm">{charmPacks.normal.name}</h4>
                                                <p className="text-primary font-bold text-[11px]">{formatCurrency(charmPacks.normal.basePrice)}/cái</p>
                                            </div>
                                        </div>
                                        {charmTier === 'normal' && <div className="bg-primary text-white p-1 rounded-full"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-4">
                                        {charmPacks.normal.items.map(item => (
                                            <span key={item} className="text-[9px] bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500">{item}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* VIP Pack */}
                                <div 
                                    onClick={() => setCharmTier('vip')}
                                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${charmTier === 'vip' ? 'border-primary bg-pink-50/30 ring-1 ring-primary' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{charmPacks.vip.icon}</span>
                                            <div>
                                                <h4 className="font-bold text-sm">{charmPacks.vip.name}</h4>
                                                <p className="text-primary font-bold text-[11px]">+{formatCurrency(charmPacks.vip.fixedPrice)}/khung</p>
                                            </div>
                                        </div>
                                        {charmTier === 'vip' && <div className="bg-primary text-white p-1 rounded-full"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-4">
                                        {charmPacks.vip.items.map(item => (
                                            <span key={item} className="text-[9px] bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500">{item}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Quantity Selector for Normal Charms */}
                            {charmTier === 'normal' && (
                                <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between animate-fade-in">
                                    <span className="text-xs font-bold text-gray-600">Số lượng charm mỗi khung:</span>
                                    <div className="flex items-center gap-3">
                                        {[1, 2, 3, 4, 5].map(q => (
                                            <button 
                                                key={q}
                                                onClick={() => setNormalCharmQty(q)}
                                                className={`w-8 h-8 rounded-full border-2 text-xs font-bold transition-all ${normalCharmQty === q ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-400'}`}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button onClick={() => setCharmTier('none')} className="mt-4 text-[10px] font-bold text-gray-400 hover:text-primary transition-colors underline">Không sử dụng phụ kiện trang trí</button>
                        </div>

                        {/* Step 4: Final Quantity */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">4. SỐ LƯỢNG ĐẶT HÀNG SỈ</h3>
                                <p className="text-[10px] text-gray-400 mt-1">Áp dụng đơn hàng sản xuất đồng loạt theo mẫu</p>
                            </div>
                            <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-2xl">
                                <button onClick={() => setOrderQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold text-xl">-</button>
                                <input 
                                    type="number" 
                                    className="w-20 bg-transparent text-center font-heading font-bold text-2xl outline-none"
                                    value={orderQuantity}
                                    onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                />
                                <button onClick={() => setOrderQuantity(q => q + 1)} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold text-xl">+</button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Live Summary Card */}
                    <div className="lg:col-span-5 sticky top-24">
                        <div className="bg-gray-900 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                            {/* Saving Badge */}
                            <div className="absolute top-6 right-[-35px] bg-red-500 text-white px-10 py-1 font-bold text-[10px] rotate-45 shadow-lg flex flex-col items-center">
                                <span>TIẾT KIỆM</span>
                                <span className="text-sm">-{savingPercent}%</span>
                            </div>

                            <h2 className="text-xl font-heading font-bold mb-8 border-b border-white/10 pb-4">Tóm tắt dự toán</h2>
                            
                            <div className="space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Cấu hình chính</p>
                                        <p className="text-sm font-medium">Khung {currentFrame.name} + {selNVCount} NV</p>
                                    </div>
                                    <span className="font-mono text-sm">{formatCurrency(unitWholesalePrice - (charmTier === 'normal' ? normalCharmQty * 10000 : (charmTier === 'vip' ? 25000 : 0)))}</span>
                                </div>

                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Phụ kiện kèm theo</p>
                                        <p className="text-sm font-medium">
                                            {charmTier === 'none' ? 'Không lấy charm' : (charmTier === 'normal' ? `Gói Standard (${normalCharmQty} cái)` : 'Gói Premium (VIP)')}
                                        </p>
                                    </div>
                                    <span className="font-mono text-sm">+{formatCurrency(charmTier === 'normal' ? normalCharmQty * 10000 : (charmTier === 'vip' ? 25000 : 0))}</span>
                                </div>

                                <div className="pt-6 border-t border-white/10 space-y-2">
                                    <div className="flex justify-between items-center text-gray-400 text-xs italic">
                                        <span>Giá mua lẻ tương đương:</span>
                                        <span className="line-through">{formatCurrency(retailComparison)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-300">Đơn giá sỉ / khung:</span>
                                        <span className="text-xl font-bold text-primary">{formatCurrency(unitWholesalePrice)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-300">Tổng số lượng sỉ:</span>
                                        <span className="text-lg font-bold">x {orderQuantity}</span>
                                    </div>
                                </div>

                                <div className="pt-8 border-t-2 border-white/10 flex justify-between items-center">
                                    <span className="text-lg font-bold uppercase tracking-tighter">Tổng chi phí:</span>
                                    <div className="text-right">
                                        <span className="block text-3xl font-heading font-bold text-white">{formatCurrency(totalOrderPrice)}</span>
                                        <span className="text-[10px] text-green-400 font-bold">Tiết kiệm được {formatCurrency((retailComparison - unitWholesalePrice) * orderQuantity)}</span>
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
                        
                        {/* Badges */}
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center">
                                <span className="block text-xl mb-1">🏷️</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">In Logo DN FREE</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center">
                                <span className="block text-xl mb-1">🛡️</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Hợp đồng & VAT</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
