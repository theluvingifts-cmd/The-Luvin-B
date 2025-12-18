
import React, { useState, useMemo, useEffect } from 'react';
import { StoreConfig, getStoreConfig } from '../services/configService';
import { getAllFrames } from '../services/frameService';
import { FrameOption, LegoPart } from '../types';
import { formatCurrency, CHARACTER_BASE_PRICE } from '../utils/pricing';

interface BusinessPageProps {
    config?: StoreConfig;
    legoParts: {
        accessory: LegoPart[];
        pet: LegoPart[];
    };
}

const B2B_HERO_IMG = "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=1974&auto=format&fit=crop";

export const BusinessPage: React.FC<BusinessPageProps> = ({ config: propConfig, legoParts }) => {
    const [frames, setFrames] = useState<FrameOption[]>([]);
    const [selectedFrameId, setSelectedFrameId] = useState<string>('');
    const [charCount, setCharCount] = useState<number>(1);
    const [orderQty, setOrderQty] = useState<number>(10);
    const [charmPackage, setCharmPackage] = useState<'standard' | 'vip'>('standard');
    const [charmsPerFrame, setCharmsPerFrame] = useState<number>(0); 
    const [showCharmModal, setShowCharmModal] = useState<'standard' | 'vip' | null>(null);
    const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(propConfig || null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [frameData, configData] = await Promise.all([
                    getAllFrames(),
                    propConfig ? Promise.resolve(propConfig) : getStoreConfig()
                ]);
                
                if (frameData.length > 0) {
                    setFrames(frameData);
                    setSelectedFrameId(frameData[0].id);
                }
                setStoreConfig(configData);
            } catch (e) {
                console.error("B2B Load Error", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [propConfig]);

    const categorizedCharms = useMemo(() => {
        const allAccessories = [...(legoParts.accessory || []), ...(legoParts.pet || [])];
        return {
            standard: allAccessories.filter(p => p.price <= 15000),
            vip: allAccessories
        };
    }, [legoParts]);

    const selectedFrame = useMemo(() => frames.find(f => f.id === selectedFrameId), [frames, selectedFrameId]);

    const quote = useMemo(() => {
        if (!selectedFrame) return null;

        const estimatedPartsPrice = 25000; 
        const unitBaseRetail = selectedFrame.price + (charCount * (CHARACTER_BASE_PRICE + estimatedPartsPrice));
        
        let totalCharmRetail = 0;
        if (charmsPerFrame > 0) {
            const charmUnitPrice = charmPackage === 'vip' ? 20000 : 10000;
            totalCharmRetail = charmsPerFrame * charmUnitPrice;
        }

        const totalRetailPerUnit = unitBaseRetail + totalCharmRetail;
        
        // Lấy chiết khấu từ Admin Config
        const discountPercent = storeConfig?.b2bDiscountPercent ?? 5;
        const discountRate = (100 - discountPercent) / 100; 
        const b2bPricePerUnit = Math.round(totalRetailPerUnit * discountRate);
        const totalOrderAmount = b2bPricePerUnit * orderQty;
        
        const totalSavings = (totalRetailPerUnit - b2bPricePerUnit) * orderQty;

        return {
            retailBase: totalRetailPerUnit,
            b2bUnit: b2bPricePerUnit,
            total: totalOrderAmount,
            totalSavings: totalSavings,
            discountPercent: discountPercent
        };
    }, [selectedFrame, charCount, orderQty, charmPackage, charmsPerFrame, storeConfig]);

    const handleContact = () => {
        const hotline = storeConfig?.hotline?.replace(/\s/g, '') || '0964393115';
        const charmInfo = charmsPerFrame === 0 ? "Basic (không charm)" : `${charmsPerFrame} món (${charmPackage.toUpperCase()})`;
        const message = `Chào The Luvin, tôi cần báo giá B2B: ${charCount}NV/bộ, Khung ${selectedFrame?.name}, ${charmInfo}, SL ${orderQty} bộ.`;
        window.open(`https://zalo.me/${hotline}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const occasions = [
        { title: 'Nhân viên Xuất sắc', desc: 'Vinh danh những cá nhân có thành tích vượt trội hàng tháng/quý.', icon: '🏆' },
        { title: 'Tiệc Tất Niên (YEP)', desc: 'Món quà tri ân nhân viên ý nghĩa sau một năm nỗ lực.', icon: '🎆' },
        { title: 'Kỷ Niệm Thành Lập', desc: 'Quà tặng lưu niệm cho CBNV và khách mời sự kiện.', icon: '🏢' },
        { title: 'Onboarding nhân sự', desc: 'Chào mừng thành viên mới bằng bộ quà Welcome Kit độc đáo.', icon: '👋' },
        { title: 'Tri Ân Đối Tác VIP', desc: 'Món quà ngoại giao tinh tế, khẳng định đẳng cấp thương hiệu.', icon: '🤝' }
    ];

    return (
        <div className="min-h-screen bg-[#fdfcfb] font-body text-site-text transition-colors duration-300">
            {/* 1. Hero - Fixed height to prevent jump */}
            <div className="relative h-[35vh] min-h-[300px] flex items-center overflow-hidden bg-gray-100">
                <div className="absolute inset-0">
                    <img src={B2B_HERO_IMG} className="w-full h-full object-cover" alt="B2B Hero" />
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent"></div>
                </div>
                <div className="relative z-10 container mx-auto px-6">
                    <div className="max-w-2xl animate-fade-in">
                        <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 inline-block shadow-sm">
                            Corporate Gift Solutions
                        </span>
                        <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2 leading-tight">
                            Quà tặng Doanh nghiệp <br/>
                            <span className="text-primary italic font-light">Tinh tế & Độc bản</span>
                        </h1>
                        <p className="text-sm text-gray-500 max-w-md font-medium leading-relaxed">
                            Xây dựng văn hóa gắn kết qua những mảnh ghép LEGO thủ công. Giải pháp quà tặng tối ưu cho doanh nghiệp hiện đại.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Professional Workspace */}
            <section className="container mx-auto px-4 sm:px-6 py-12 -mt-12 relative z-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT: CONFIGURATION */}
                    <div className="lg:col-span-7 space-y-8">
                        <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl shadow-pink-100/50 border border-pink-50 min-h-[600px]">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-primary/20">1</div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Cấu hình quà tặng</h2>
                                    <p className="text-xs text-gray-400 font-bold">Lựa chọn các thông số cơ bản để nhận báo giá</p>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="space-y-12 animate-pulse">
                                    <div className="h-24 bg-gray-100 rounded-2xl"></div>
                                    <div className="h-24 bg-gray-100 rounded-2xl"></div>
                                    <div className="h-32 bg-gray-100 rounded-2xl"></div>
                                </div>
                            ) : (
                                <div className="space-y-12 animate-fade-in">
                                    {/* Frame Choice */}
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">1. Kích thước khung tranh</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {frames.map(f => (
                                                <button 
                                                    key={f.id}
                                                    onClick={() => setSelectedFrameId(f.id)}
                                                    className={`py-4 rounded-2xl border-2 transition-all duration-300 ${selectedFrameId === f.id ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 text-gray-400 hover:border-gray-200'}`}
                                                >
                                                    <span className="block text-sm font-black uppercase">{f.name}</span>
                                                    <span className="text-[9px] opacity-60 font-bold">{f.frameWidthCm}cm</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Characters per Frame */}
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">2. Số nhân vật LEGO mỗi bộ</label>
                                        <div className="flex gap-3">
                                            {[1, 2, 3, 4].map(num => (
                                                <button 
                                                    key={num}
                                                    onClick={() => setCharCount(num)}
                                                    className={`flex-1 py-4 rounded-2xl border-2 transition-all ${charCount === num ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-50 text-gray-400'}`}
                                                >
                                                    <span className="text-sm font-black">{num} Nhân vật</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Charm Config */}
                                    <div className="p-8 bg-secondary/30 rounded-[2rem] border border-pink-100 relative overflow-hidden">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                            <div>
                                                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] block mb-1">3. Trang trí linh kiện (Charm)</label>
                                                <p className="text-[11px] text-gray-400 font-bold">Thêm các chi tiết nhỏ giúp tranh sinh động hơn</p>
                                            </div>
                                            {charmsPerFrame > 0 && (
                                                <div className="flex bg-white p-1 rounded-xl border border-pink-100 shadow-sm">
                                                    <button onClick={() => setCharmPackage('standard')} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${charmPackage === 'standard' ? 'bg-gray-800 text-white' : 'text-gray-400'}`}>PHỔ THÔNG</button>
                                                    <button onClick={() => setCharmPackage('vip')} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${charmPackage === 'vip' ? 'bg-accent text-white' : 'text-gray-400'}`}>CAO CẤP</button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-6">
                                            <div className="grid grid-cols-6 gap-2">
                                                {[0, 1, 2, 3, 4, 5].map(num => (
                                                    <button 
                                                        key={num}
                                                        onClick={() => setCharmsPerFrame(num)}
                                                        className={`py-4 rounded-xl border-2 font-black text-sm transition-all ${charmsPerFrame === num ? 'bg-white border-primary text-primary shadow-md scale-105' : 'bg-white/50 border-transparent text-gray-300'}`}
                                                    >
                                                        {num === 0 ? 'Basic' : num}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Qty */}
                                    <div className="pt-10 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-6">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">4. Tổng số lượng đặt hàng</label>
                                            <span className="bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">TỐI THIỂU 10 BỘ</span>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-center gap-8">
                                            <div className="relative">
                                                <input 
                                                    type="number" min="10" 
                                                    value={orderQty} 
                                                    onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                                                    className={`w-40 p-5 border-2 rounded-3xl font-black text-4xl text-center outline-none transition-all ${orderQty < 10 ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-100 focus:border-primary bg-secondary/50'}`}
                                                />
                                            </div>
                                            <div className="flex-grow p-6 bg-primary/5 rounded-3xl border border-primary/10">
                                                <p className="text-[13px] font-bold text-gray-700 leading-tight">
                                                    ✨ ƯU ĐÃI DOANH NGHIỆP: <br/>
                                                    Tự động áp dụng <span className="text-primary font-black text-xl">giảm {quote?.discountPercent}%</span> so với giá bán lẻ vào bảng dự toán bên cạnh.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* OCCASIONS SECTION */}
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                            <h3 className="text-xl font-bold text-gray-900 mb-8 uppercase tracking-tight flex items-center gap-3">
                                <span className="text-2xl">📅</span> Các dịp quà tặng tiêu biểu
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {occasions.map((occ, i) => (
                                    <div key={i} className="p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-primary transition-all group cursor-default">
                                        <div className="text-3xl mb-3 group-hover:scale-110 transition-transform origin-left">{occ.icon}</div>
                                        <h4 className="font-bold text-gray-800 text-sm mb-1">{occ.title}</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed">{occ.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: PREMIUM QUOTE */}
                    <div className="lg:col-span-5 lg:sticky lg:top-24">
                        <div className="bg-white rounded-[3rem] shadow-2xl shadow-pink-200/40 border border-white p-8 sm:p-10 flex flex-col relative overflow-hidden min-h-[500px]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4">
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-sm font-bold text-gray-400">Đang tính toán dự toán...</p>
                                </div>
                            ) : (
                                <div className="relative z-10 space-y-10 animate-fade-in">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-2xl font-heading font-bold text-gray-900 italic">Dự toán ngân sách</h3>
                                        <span className="text-[10px] font-mono text-gray-300 uppercase">Ver. {new Date().toLocaleDateString()}</span>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400 font-bold uppercase tracking-widest">Đơn giá bán lẻ gốc</span>
                                            <span className="font-bold text-gray-300 line-through">{formatCurrency(quote?.retailBase || 0)} / bộ</span>
                                        </div>
                                        <div className="flex justify-between items-center py-8 border-y border-dashed border-gray-100">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Đơn giá sỉ ước tính</p>
                                                <p className="text-5xl font-heading font-bold text-primary leading-none tracking-tighter">{formatCurrency(quote?.b2bUnit || 0)}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-primary/20">
                                                    -{quote?.discountPercent}% ƯU ĐÃI
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-3">TỔNG DỰ TOÁN ({orderQty} BỘ)</p>
                                        <p className="text-5xl font-heading font-bold text-white mb-8 tracking-tighter">{formatCurrency(quote?.total || 0)}</p>
                                        
                                        <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center shadow-inner">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Doanh nghiệp tiết kiệm được:</p>
                                            <p className="text-3xl font-black text-primary">{formatCurrency(quote?.totalSavings || 0)}</p>
                                        </div>

                                        <div className="flex flex-col gap-2 mt-8 border-t border-white/10 pt-6">
                                            <p className="text-[10px] text-gray-400 flex items-center gap-2 font-bold uppercase">
                                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span> Bao gồm thiết kế Background riêng miễn phí
                                            </p>
                                            <p className="text-[10px] text-gray-400 flex items-center gap-2 font-bold uppercase">
                                                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> Cung cấp bộ chứng từ & Hợp đồng
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <button 
                                            onClick={handleContact}
                                            className="w-full bg-primary text-white font-bold py-6 rounded-2xl hover:brightness-105 transition-all shadow-xl shadow-primary/30 active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
                                        >
                                            NHẬN TƯ VẤN & BÁO GIÁ
                                        </button>
                                        <p className="text-center text-[10px] text-gray-400 font-bold px-6 leading-relaxed uppercase tracking-wide">
                                            Mẫu thiết kế và báo giá chính thức sẽ được gửi tới bạn qua Zalo trong vòng 30 - 60 phút.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. Features Section */}
            <section className="py-24 border-t border-gray-100 bg-white">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                        {[
                            { title: 'Thiết kế Background', desc: 'Thiết kế phông nền riêng biệt theo nhận diện thương hiệu hoặc chủ đề sự kiện của công ty.', icon: '📐' },
                            { title: 'In Ấn Logo', desc: 'In Logo doanh nghiệp lên bao bì, thiệp chúc mừng và hộp quà cao cấp đồng bộ.', icon: '🏷️' },
                            { title: 'Chứng từ & Hợp đồng', desc: 'Hỗ trợ hợp đồng kinh tế và các chứng từ giao nhận cần thiết cho kế toán doanh nghiệp.', icon: '📜' }
                        ].map((item, i) => (
                            <div key={i} className="group">
                                <div className="w-16 h-16 bg-[#f9f4ef] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                                    {item.icon}
                                </div>
                                <h4 className="font-bold text-gray-900 uppercase text-sm mb-3 tracking-tighter">{item.title}</h4>
                                <p className="text-xs text-gray-500 leading-relaxed max-w-[280px] mx-auto font-medium">{item.desc}</p>
                                {item.title === 'Chứng từ & Hợp đồng' && (
                                    <p className="text-[9px] text-gray-400 mt-2 italic">* Hiện chưa hỗ trợ xuất hóa đơn VAT trực tiếp, liên hệ hotline để được hỗ trợ giải pháp khác.</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Modal Library */}
            {showCharmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-fade-in" onClick={() => setShowCharmModal(null)}>
                    <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-secondary/30">
                            <div>
                                <h3 className="text-2xl font-heading font-bold text-gray-900">
                                    Thư viện linh kiện {showCharmModal === 'standard' ? 'Phổ thông' : 'VIP Premium'}
                                </h3>
                                <p className="text-[10px] text-primary font-black uppercase mt-2 tracking-widest">
                                    DANH SÁCH MẪU ĐỀ XUẤT CHO DOANH NGHIỆP
                                </p>
                            </div>
                            <button onClick={() => setShowCharmModal(null)} className="w-12 h-12 bg-white shadow-xl flex items-center justify-center rounded-2xl hover:text-primary transition-all border border-gray-100 font-bold">✕</button>
                        </div>
                        
                        <div className="p-10 overflow-y-auto custom-scrollbar flex-grow bg-white">
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                                {categorizedCharms[showCharmModal].map(charm => (
                                    <div key={charm.id} className="bg-secondary/10 p-4 rounded-3xl border border-transparent hover:border-primary hover:bg-white transition-all group">
                                        <div className="aspect-square rounded-2xl bg-white p-4 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                                            <img src={charm.imageUrl} alt={charm.name} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-600 text-center uppercase truncate px-2">{charm.name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-8 bg-white text-center border-t border-gray-100">
                            <button onClick={() => setShowCharmModal(null)} className="bg-gray-900 text-white px-16 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                                Quay lại báo giá
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
