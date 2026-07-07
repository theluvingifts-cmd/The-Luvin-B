import React, { useState, useMemo } from 'react';
import { LegoPart, FrameConfig, Page } from '../types';
import { formatCurrency, isPartOutOfStock, getPartImageUrl } from '../utils/pricing';
import { useLanguage } from '../src/contexts/LanguageContext';
import { Search, Filter, ShoppingBag, ArrowRight, Check, Plus, Minus, Sparkles, Gift, Image, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LinhKienPageProps {
    legoParts: Record<string, LegoPart[]>;
    allParts: Record<string, LegoPart>;
    onAddToCart: (newConfig: FrameConfig, openCart?: boolean) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    isLoadingParts: boolean;
    navigateTo: (page: Page) => void;
}

export const LinhKienPage: React.FC<LinhKienPageProps> = ({
    legoParts,
    allParts,
    onAddToCart,
    showToast,
    isLoadingParts,
    navigateTo
}) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<string>('all');
    
    // Lưu trữ số lượng được chọn của từng item (mặc định là 1)
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    // Danh sách dịch vụ thêm (Virtual Services)
    const virtualServices: LegoPart[] = [
        { id: 'srv-giftbox', name: 'Hộp quà cao cấp The Luvin', price: 30000, type: 'accessory', imageUrl: '/src/assets/images/srv_giftbox_1782720591249.jpg', widthCm: 10, heightCm: 10, category: 'service' },
        { id: 'srv-light', name: 'Đèn LED đom đóm lung linh', price: 20000, type: 'accessory', imageUrl: '/src/assets/images/srv_light_1782720604384.jpg', widthCm: 10, heightCm: 10, category: 'service' },
        { id: 'srv-flower', name: 'Hoa mini trang trí kèm', price: 15000, type: 'accessory', imageUrl: '/src/assets/images/srv_flower_1782720618289.jpg', widthCm: 10, heightCm: 10, category: 'service' },
        { id: 'srv-card', name: 'Thiệp viết tay theo yêu cầu', price: 10000, type: 'accessory', imageUrl: '/src/assets/images/srv_card_1782720631994.jpg', widthCm: 10, heightCm: 10, category: 'service' },
        { id: 'srv-polaroid', name: 'In thêm 1 ảnh Polaroid lẻ', price: 10000, type: 'accessory', imageUrl: '/src/assets/images/srv_polaroid_1782720644820.jpg', widthCm: 10, heightCm: 10, category: 'service' }
    ];

    // Gộp tất cả parts từ database và các dịch vụ ảo
    const combinedParts = useMemo(() => {
        const partsFromDb = Object.values(legoParts).flat();
        return [...virtualServices, ...partsFromDb];
    }, [legoParts]);

    const tabs = [
        { id: 'all', label: 'Tất cả' },
        { id: 'service', label: 'Dịch vụ thêm ✨' },
        { id: 'accessory', label: 'Charm / Phụ kiện' },
        { id: 'pet', label: 'Thú cưng' },
        { id: 'hair', label: 'Tóc giả' },
        { id: 'hat', label: 'Mũ / Nón' },
        { id: 'set', label: 'Bộ đồ' },
        { id: 'face', label: 'Khuôn mặt' },
        { id: 'shirt', label: 'Áo lẻ' },
        { id: 'pants', label: 'Quần lẻ' }
    ];

    const filteredParts = useMemo(() => {
        return combinedParts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesTab = false;
            if (activeTab === 'all') {
                matchesTab = true;
            } else if (activeTab === 'service') {
                matchesTab = (p as any).category === 'service';
            } else {
                matchesTab = p.type === activeTab && (p as any).category !== 'service';
            }

            return matchesSearch && matchesTab;
        });
    }, [combinedParts, searchTerm, activeTab]);

    const handleQuantityChange = (id: string, delta: number) => {
        setQuantities(prev => {
            const current = prev[id] || 1;
            const next = current + delta;
            if (next < 1) return prev;
            return { ...prev, [id]: next };
        });
    };

    const getQty = (id: string) => quantities[id] || 1;

    // Thêm linh kiện/dịch vụ lẻ vào giỏ hàng dưới dạng một FrameConfig ảo
    const handleAdd = (part: LegoPart, autoCheckout = false) => {
        const qty = getQty(part.id);
        
        const addonConfig: FrameConfig = {
            frameId: 'accessory-only',
            background: { type: 'color', value: '#ffffff' },
            characters: [],
            texts: [],
            shapes: [],
            draggableItems: [
                {
                    id: Date.now(),
                    partId: part.id,
                    type: part.type === 'pet' ? 'pet' : (part.type === 'hat' ? 'hat' : 'charm'),
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scale: 1
                }
            ],
            previewImageUrl: part.imageUrl,
            quantity: qty,
            price: part.price,
            isSimpleMode: true
        };

        onAddToCart(addonConfig, !autoCheckout);
        showToast(`Đã thêm ${qty} x ${part.name} vào giỏ hàng!`, 'success');

        if (autoCheckout) {
            setTimeout(() => {
                navigateTo('cart');
            }, 300);
        }
    };

    return (
        <div className="min-h-screen bg-[#fbfbfe] font-body text-gray-800 pb-24">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-pink-50 via-white to-blue-50/40 border-b border-pink-100/50 pt-16 pb-12">
                <div className="container mx-auto px-4 sm:px-6 text-center max-w-4xl">
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex justify-center items-center gap-2 mb-3"
                    >
                        <span className="bg-pink-100 text-pink-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                            <Sparkles className="w-3 h-3 text-pink-500 fill-pink-500" />
                            Phụ kiện độc bản
                        </span>
                    </motion.div>
                    
                    <motion.h1 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-4xl sm:text-5xl font-heading font-black text-gray-900 mb-4 tracking-tight"
                    >
                        LINH KIỆN & <span className="text-pink-500 italic">DỊCH VỤ THÊM</span>
                    </motion.h1>

                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-sm sm:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed font-medium"
                    >
                        Nơi bạn chọn thêm những phụ kiện charm xinh xắn, hoa mini hoặc dịch vụ hộp quà cao cấp, viết thiệp hộ để món quà trao đi thêm trọn vẹn cảm xúc.
                    </motion.p>

                    {/* Search & Filter Controls */}
                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl mx-auto"
                    >
                        <div className="relative flex-grow">
                            <input 
                                type="text" 
                                placeholder="Tìm kiếm linh kiện hoặc dịch vụ..." 
                                className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-pink-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-pink-400 transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                        <button 
                            onClick={() => navigateTo('cart')}
                            className="bg-white border-2 border-pink-200 text-pink-600 font-bold px-6 py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-pink-50 active:scale-[0.98] transition-all shadow-sm"
                        >
                            <ShoppingBag className="w-4 h-4" />
                            Xem giỏ hàng
                        </button>
                    </motion.div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="sticky top-[64px] z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 overflow-x-auto no-scrollbar shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-300 shrink-0 mr-1" />
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                                    activeTab === tab.id 
                                        ? 'bg-pink-500 text-white shadow-md shadow-pink-200' 
                                        : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="container mx-auto px-4 sm:px-6 py-10">
                {isLoadingParts ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="aspect-[4/5] bg-gray-100 rounded-3xl animate-pulse"></div>
                        ))}
                    </div>
                ) : filteredParts.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-pink-200 max-w-lg mx-auto p-8 shadow-sm">
                        <div className="text-5xl mb-4">🔍</div>
                        <h3 className="font-bold text-gray-800 text-lg uppercase tracking-tight">Không tìm thấy linh kiện phù hợp</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Vui lòng kiểm tra lại từ khóa hoặc danh mục khác</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredParts.map(part => {
                                const isOOS = isPartOutOfStock(part);
                                const isService = (part as any).category === 'service';
                                const itemQty = getQty(part.id);

                                return (
                                    <motion.div 
                                        layout
                                        key={part.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.3 }}
                                        className={`group relative bg-white p-3 sm:p-4 rounded-3xl border-2 transition-all flex flex-col justify-between hover:shadow-xl hover:shadow-pink-50/50 ${
                                            isOOS ? 'opacity-65 grayscale border-gray-100' : 'border-gray-50/70 shadow-sm hover:border-pink-100'
                                        }`}
                                    >
                                        <div>
                                            {/* Badge */}
                                            <div className="absolute top-2.5 left-2.5 z-10 flex gap-1">
                                                {isService ? (
                                                    <span className="bg-pink-100 text-pink-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm flex items-center gap-0.5">
                                                        <Gift className="w-2 h-2" /> Dịch vụ
                                                    </span>
                                                ) : (
                                                    <span className="bg-blue-50 text-blue-500 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm">
                                                        {part.type}
                                                    </span>
                                                )}
                                                {isOOS && (
                                                    <span className="bg-red-50 text-red-500 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm">
                                                        Hết hàng
                                                    </span>
                                                )}
                                            </div>

                                            {/* Image container */}
                                            <div className="aspect-square rounded-2xl bg-gray-50/60 p-2 sm:p-4 mb-3 sm:mb-4 flex items-center justify-center relative overflow-hidden group-hover:scale-102 transition-transform">
                                                <img 
                                                    src={getPartImageUrl(part)} 
                                                    alt={part.name} 
                                                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                                                    referrerPolicy="no-referrer"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=The+Luvin';
                                                    }}
                                                />
                                            </div>

                                            {/* Info */}
                                            <div className="space-y-1 px-1">
                                                <h4 className="text-xs sm:text-sm font-black text-gray-900 uppercase truncate leading-tight group-hover:text-pink-500 transition-colors">
                                                    {part.name}
                                                </h4>
                                                <p className="text-xs font-mono font-bold text-gray-400">
                                                    #{part.id}
                                                </p>
                                                <p className="text-sm font-black text-pink-500 pt-1">
                                                    {formatCurrency(part.price)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action Area */}
                                        <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col gap-2">
                                            {/* Quantity Picker */}
                                            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-1">
                                                <button 
                                                    onClick={() => handleQuantityChange(part.id, -1)}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-white rounded-lg transition-all"
                                                    disabled={isOOS || itemQty <= 1}
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="text-xs font-black text-gray-700 min-w-[1.5rem] text-center">
                                                    {itemQty}
                                                </span>
                                                <button 
                                                    onClick={() => handleQuantityChange(part.id, 1)}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-white rounded-lg transition-all"
                                                    disabled={isOOS}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Buttons */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button 
                                                    onClick={() => handleAdd(part, false)}
                                                    className="bg-white border border-pink-200 text-pink-500 font-bold py-2 rounded-xl text-[10px] uppercase tracking-wide flex items-center justify-center gap-1 hover:bg-pink-50 active:scale-[0.98] transition-all"
                                                    disabled={isOOS}
                                                >
                                                    Thêm giỏ
                                                </button>
                                                <button 
                                                    onClick={() => handleAdd(part, true)}
                                                    className="bg-pink-500 text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wide flex items-center justify-center gap-1 hover:opacity-90 active:scale-[0.98] transition-all"
                                                    disabled={isOOS}
                                                >
                                                    Mua ngay
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
            
            {/* Float Cart indicator */}
            <div className="fixed bottom-6 right-6 z-40">
                <button 
                    onClick={() => navigateTo('cart')}
                    className="bg-pink-500 text-white px-6 py-4 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 font-bold uppercase tracking-wider text-xs"
                >
                    <ShoppingBag className="w-4 h-4" />
                    Xem Giỏ Hàng
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
