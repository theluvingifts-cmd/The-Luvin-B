
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
    const [charmTier, setCharmTier] = useState<'none' | 'normal' | 'vip'>('none');
    const [quantity, setQuantity] = useState(10); // Mặc định sỉ từ 10

    // Cấu hình nội dung gói
    const charmPacks = {
        normal: {
            name: 'Gói Charm Thường',
            price: 10000,
            icon: '🎀',
            details: [
                'Lựa chọn các icon cơ bản: Trái tim, Ngôi sao, Hoa sen...',
                'Màu sắc tiêu chuẩn (Đỏ, Xanh, Vàng)',
                '1 Charm cho mỗi khung tranh',
                'Phù hợp phong cách tối giản, thanh lịch'
            ]
        },
        vip: {
            name: 'Gói Charm VIP',
            price: 20000,
            icon: '👑',
            details: [
                'Toàn quyền chọn các phụ kiện chi tiết: Máy ảnh, Thú cưng nhỏ, Vali, Đồ ăn...',
                'Màu sắc đặc biệt (Gold, Chrome, Pastel)',
                '1-2 chi tiết phối hợp cho mỗi khung',
                'Phù hợp phong cách sinh động, kể chuyện'
            ]
        }
    };

    const currentFrame = useMemo(() => frames.find(f => f.id === selFrameId) || frames[0], [selFrameId, frames]);

    const unitPrice = useMemo(() => {
        const base = currentFrame?.price || 210000;
        const charCost = selNVCount * 50000;
        const charmCost = charmTier === 'none' ? 0 : charmPacks[charmTier].price;
        return base + charCost + charmCost;
    }, [currentFrame, selNVCount, charmTier]);

    const totalPrice = unitPrice * quantity;

    const handleContactZalo = () => {
        const hotline = config.hotline?.replace(/\s/g, '') || '0964393115';
        const message = encodeURIComponent(
            `Chào The Luvin, mình cần báo giá sỉ cho cấu hình:\n` +
            `- Khung: ${currentFrame.name}\n` +
            `- Số nhân vật: ${selNVCount}\n` +
            `- Gói Charm: ${charmTier === 'none' ? 'Không lấy' : charmPacks[charmTier].name}\n` +
            `- Số lượng: ${quantity} khung\n` +
            `Dự kiến tổng: ${formatCurrency(totalPrice)}`
        );
        window.open(`https://zalo.me/${hotline}?text=${message}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 font-body text-gray-800 pb-20">
            {/* Header Area */}
            <div className="bg-white border-b border-gray-100 pt-16 pb-10 px-4 text-center">
                <div className="container mx-auto">
                    <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase mb-2 block">The Luvin B2B Solutions</span>
                    <h1 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-4">Dự Toán Báo Giá Sỉ</h1>
                    <p className="text-gray-500 max-w-xl mx-auto text-sm">
                        Công cụ giúp bạn tự cấu hình quà tặng doanh nghiệp và nhận báo giá dự kiến ngay lập tức.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT: Configurator */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Step 1: Frame */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs">1</span>
                                CHỌN DÒNG KHUNG
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {frames.map(f => (
                                    <button 
                                        key={f.id}
                                        onClick={() => setSelFrameId(f.id)}
                                        className={`p-4 border-2 rounded-xl text-left transition-all ${selFrameId === f.id ? 'border-primary bg-pink-50' : 'border-gray-100 hover:border-gray-200'}`}
                                    >
                                        <p className="font-bold text-sm text-gray-800">{f.name}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">{f.frameWidthCm}x{f.frameHeightCm}cm</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 2: Characters */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs">2</span>
                                SỐ LƯỢNG NHÂN VẬT
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

                        {/* Step 3: Charm Tier Details */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs">3</span>
                                GÓI PHỤ KIỆN (CHARM)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(['normal', 'vip'] as const).map(tier => {
                                    const pack = charmPacks[tier];
                                    const isActive = charmTier === tier;
                                    return (
                                        <div 
                                            key={tier}
                                            onClick={() => setCharmTier(tier)}
                                            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${isActive ? 'border-primary bg-pink-50/50 ring-1 ring-primary' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl">{pack.icon}</span>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900">{pack.name}</h4>
                                                        <p className="text-primary font-bold text-xs">+{formatCurrency(pack.price)} / khung</p>
                                                    </div>
                                                </div>
                                                {isActive && <div className="bg-primary text-white p-1 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                                            </div>
                                            <ul className="space-y-2">
                                                {pack.details.map((d, i) => (
                                                    <li key={i} className="flex gap-2 text-xs text-gray-600 leading-relaxed">
                                                        <span className="text-primary mt-0.5">•</span>
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                            <button 
                                onClick={() => setCharmTier('none')}
                                className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 underline"
                            >
                                Tôi không lấy Charm trang trí
                            </button>
                        </div>

                        {/* Step 4: Final Quantity */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-gray-900 uppercase text-sm tracking-wider">4. Số lượng đặt sỉ</h3>
                                <p className="text-xs text-gray-500">Áp dụng đơn hàng sản xuất đồng loạt</p>
                            </div>
                            <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-2xl">
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold text-xl">-</button>
                                <input 
                                    type="number" 
                                    className="w-20 bg-transparent text-center font-heading font-bold text-2xl outline-none"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                />
                                <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 bg-white rounded-xl shadow-sm font-bold text-xl">+</button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Live Summary Card */}
                    <div className="lg:col-span-5 sticky top-24">
                        <div className="bg-gray-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                            {/* Decorative element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            
                            <h2 className="text-xl font-heading font-bold mb-8 border-b border-white/10 pb-4">Tóm tắt báo giá</h2>
                            
                            <div className="space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">Sản phẩm</p>
                                        <p className="text-sm font-medium">Khung {currentFrame.name} + {selNVCount} NV</p>
                                    </div>
                                    <span className="font-mono text-sm">{formatCurrency(unitPrice - (charmTier !== 'none' ? charmPacks[charmTier].price : 0))}</span>
                                </div>

                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">Phụ kiện</p>
                                        <p className="text-sm font-medium">{charmTier === 'none' ? 'Không' : charmPacks[charmTier].name}</p>
                                    </div>
                                    <span className="font-mono text-sm">+{formatCurrency(charmTier === 'none' ? 0 : charmPacks[charmTier].price)}</span>
                                </div>

                                <div className="pt-6 border-t border-white/10">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-400">Đơn giá / khung:</span>
                                        <span className="text-lg font-bold">{formatCurrency(unitPrice)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Số lượng:</span>
                                        <span className="text-lg font-bold">x {quantity}</span>
                                    </div>
                                </div>

                                <div className="pt-8 border-t-2 border-white/10 flex justify-between items-center">
                                    <span className="text-lg font-bold uppercase tracking-tighter">Tổng dự kiến:</span>
                                    <span className="text-3xl font-heading font-bold text-primary">{formatCurrency(totalPrice)}</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleContactZalo}
                                className="w-full mt-10 bg-white text-gray-900 py-4 rounded-2xl font-bold text-base hover:bg-primary hover:text-white transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-3"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.8.48 3.5 1.32 5L2.04 22l5.18-1.26C8.42 21.56 10.17 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
                                Gửi yêu cầu cấu hình này
                            </button>
                            
                            <p className="text-[10px] text-gray-500 mt-6 text-center italic leading-relaxed">
                                * Lưu ý: Báo giá trên mang tính chất tham khảo. Chiết khấu thêm cho số lượng lớn {` (>50 khung) `} sẽ được Designer chốt trực tiếp sau khi nhận yêu cầu.
                            </p>
                        </div>
                        
                        {/* Trust Badges */}
                        <div className="mt-6 grid grid-cols-3 gap-2">
                            <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                                <span className="block text-lg">🚚</span>
                                <span className="text-[9px] font-bold text-gray-400">Giao toàn quốc</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                                <span className="block text-lg">🏷️</span>
                                <span className="text-[9px] font-bold text-gray-400">In Logo FREE</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                                <span className="block text-lg">🛡️</span>
                                <span className="text-[9px] font-bold text-gray-400">Hợp đồng VAT</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
