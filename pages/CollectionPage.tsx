
import React, { useState, useMemo } from 'react';
import { CollectionTemplate, FrameConfig, FrameOption, LegoPart, Page } from '../types';
import { COLLECTION_TEMPLATES } from '../constants';
import { calculatePrice, formatCurrency } from '../utils/pricing';
import { SmartImage } from '../components/shared/SmartImage';

interface CollectionPageProps {
    navigateTo: (page: Page) => void, 
    onCustomize: (template: CollectionTemplate) => void, 
    onAddToCart: (config: FrameConfig, openCartPanel?: boolean) => void,
    templates?: CollectionTemplate[],
    onZoomImage: (url: string) => void,
    allParts: Record<string, LegoPart>,
    frames: FrameOption[]
}

export const CollectionPage: React.FC<CollectionPageProps> = ({ navigateTo, onCustomize, onAddToCart, templates, onZoomImage, allParts, frames }) => {
    const displayTemplates: CollectionTemplate[] = (templates && templates.length > 0) ? templates : COLLECTION_TEMPLATES;
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Tất cả');
    const [selectedTemplate, setSelectedTemplate] = useState<CollectionTemplate | null>(null);
    const [customConfig, setCustomConfig] = useState<FrameConfig | null>(null);
    const [orderNote, setOrderNote] = useState('');

    const categories = useMemo(() => {
        const dynamicCats = new Set<string>();
        displayTemplates.forEach(t => {
            if (t.category && t.category.trim() !== '') {
                dynamicCats.add(t.category.trim());
            }
        });
        return ['Tất cả', ...Array.from(dynamicCats).sort()];
    }, [displayTemplates]);

    const filteredTemplates = useMemo(() => {
        return displayTemplates.filter(template => {
            const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'Tất cả' || template.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [displayTemplates, searchTerm, activeCategory]);

    const handleSelectTemplate = (template: CollectionTemplate) => {
        setSelectedTemplate(template);
        setCustomConfig({ ...template.config, templateId: template.id });
        setOrderNote('');
    };

    const toggleCharm = (charmId: number) => {
        if (!customConfig) return;
        const items = customConfig.draggableItems || [];
        const exists = items.some(i => i.id === charmId);
        
        if (exists) {
            setCustomConfig({
                ...customConfig,
                draggableItems: items.filter(i => i.id !== charmId)
            });
        } else {
            const originalCharm = selectedTemplate?.config.draggableItems.find(i => i.id === charmId);
            if (originalCharm) {
                setCustomConfig({
                    ...customConfig,
                    draggableItems: [...items, originalCharm]
                });
            }
        }
    };

    const handleQuickAddToCart = () => {
        if (!customConfig) return;
        const finalConfig = {
            ...customConfig,
            customFormData: {
                ...(customConfig.customFormData || {}),
                order_note: orderNote
            }
        };
        onAddToCart(finalConfig, true);
        setSelectedTemplate(null);
    };

    const currentPrice = useMemo(() => {
        if (!customConfig) return 0;
        const { totalPrice } = calculatePrice(customConfig, allParts, frames);
        return totalPrice;
    }, [customConfig, allParts, frames]);

    const availableCharms = useMemo(() => {
        if (!selectedTemplate) return [];
        return selectedTemplate.config.draggableItems.filter(i => i.type === 'charm');
    }, [selectedTemplate]);

    return ( 
      <div className="min-h-screen bg-[#f1f3f5] pb-20 font-body text-site-text relative">
        {/* Quick Customize Drawer */}
        {selectedTemplate && customConfig && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={() => setSelectedTemplate(null)}>
                <div 
                    className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-slide-up flex flex-col max-h-[90vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">{selectedTemplate.name}</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tùy chỉnh nhanh mẫu thiết kế</p>
                        </div>
                        <button onClick={() => setSelectedTemplate(null)} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        {/* Preview Image */}
                        <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gray-100 shadow-inner relative group">
                            <img 
                                src={selectedTemplate.imageUrl} 
                                alt={selectedTemplate.name} 
                                className="w-full h-full object-cover" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                        </div>

                        {/* Charms List */}
                        {availableCharms.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Chọn Charm Trang Trí
                                    </h3>
                                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        {customConfig.draggableItems.filter(i => i.type === 'charm').length} / {availableCharms.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {availableCharms.map((charm) => {
                                        const part = allParts[charm.partId];
                                        const isSelected = customConfig.draggableItems.some(i => i.id === charm.id);
                                        return (
                                            <button 
                                                key={charm.id}
                                                onClick={() => toggleCharm(charm.id)}
                                                className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center p-1 border border-gray-100">
                                                    <img src={part?.imageUrl || charm.partId} alt="Charm" className="w-full h-full object-contain" />
                                                </div>
                                                <div className="flex-grow text-left">
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{part?.name || 'Charm trang trí'}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold">{formatCurrency(part?.price || 0)}</p>
                                                </div>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-gray-200'}`}>
                                                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Order Notes */}
                        <div className="space-y-3">
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                Ghi chú đơn hàng
                            </h3>
                            <textarea 
                                value={orderNote}
                                onChange={e => setOrderNote(e.target.value)}
                                placeholder="Ví dụ: Thay đổi tên thành 'Luvin', đổi màu tóc nhân vật nữ sang nâu..."
                                rows={3}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-100 bg-white space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest block mb-1">Tổng cộng</span>
                                <span className="text-2xl font-black text-gray-900">{formatCurrency(currentPrice)}</span>
                            </div>
                            <button 
                                onClick={() => onCustomize(selectedTemplate)}
                                className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                                Tùy chỉnh chi tiết 
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                        <button 
                            onClick={handleQuickAddToCart}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-gray-200 hover:bg-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            🛒 Thêm vào giỏ hàng
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Simple Clean Header */}
        <div className="bg-white border-b border-gray-100 pt-16 pb-8 px-4">
            <div className="container mx-auto text-center">
                <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4 text-gray-900 leading-tight">
                    Bộ sưu tập <span className="text-primary italic">Luvin</span>
                </h1>
                
                {/* Search Bar */}
                <div className="max-w-md mx-auto relative px-2 mt-6">
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm mẫu thiết kế..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-6 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm transition-all outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>
        </div>

        {/* Filter Section */}
        <div className="sticky top-16 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 shadow-sm">
            <div className="container mx-auto px-4 overflow-x-auto no-scrollbar flex items-center gap-2">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            activeCategory === cat 
                                ? 'bg-primary text-white shadow-md' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Product Grid */}
        <div className="container mx-auto px-3 sm:px-6 py-8">
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {filteredTemplates.map((template, index) => {
                    const { totalPrice } = calculatePrice(template.config, allParts, frames);
                    const purchaseCount = template.purchaseCount || 0;
                    
                    return ( 
                        <div key={template.id || index} className="group flex flex-col bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full">
                            {/* Image Container */}
                            <div className="relative aspect-[3/4] overflow-hidden bg-gray-50 cursor-pointer" onClick={() => handleSelectTemplate(template)}>
                                <SmartImage 
                                    src={template.imageUrl} 
                                    alt={template.name} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                />
                                
                                <div className="absolute top-2 left-2 right-2 flex flex-col gap-1.5 pointer-events-none">
                                    <div className="bg-white/95 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-black text-primary uppercase tracking-tight shadow-sm border border-primary/10 w-fit">
                                        ✨ 100% Tùy chỉnh
                                    </div>
                                    {template.category && (
                                        <div className="bg-gray-900/80 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-bold text-white uppercase tracking-tight shadow-sm w-fit">
                                            {template.category}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="p-3 sm:p-5 flex flex-col flex-grow">
                                <h3 className="text-xs sm:text-base font-bold text-gray-900 mb-2 line-clamp-1">
                                    {template.name}
                                </h3>
                                
                                <div className="flex items-center gap-1.5 mb-4">
                                    <div className="flex items-center gap-1 bg-blue-50/80 px-1.5 py-1 rounded-lg">
                                        <span className="text-[10px]">⭐</span>
                                        <span className="text-[8px] sm:text-[9px] text-blue-700 font-black uppercase">Tin dùng</span>
                                    </div>
                                    <div className="text-[8px] sm:text-[9px] text-gray-400 font-bold leading-tight">
                                        {purchaseCount > 0 ? `${purchaseCount} lượt đặt hàng` : 'Đang hot'}
                                    </div>
                                </div>

                                <div className="mt-auto space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="text-[8px] text-gray-400 font-black block uppercase mb-0.5 tracking-tighter">Giá cơ bản từ</span>
                                            <span className="text-sm sm:text-lg font-black text-gray-900 leading-none">{formatCurrency(totalPrice)}</span>
                                        </div>
                                        <div className="bg-gray-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-gray-500 mb-0.5">
                                            {template.config.characters.length} NV Lego
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleSelectTemplate(template)} 
                                        className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-primary transition-all active:scale-95 group/btn"
                                    >
                                        Chọn mẫu này
                                        <svg className="w-3.5 h-3.5 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div> 
                    );
                  })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="text-5xl mb-4 opacity-50">🔍</div>
                    <h3 className="text-lg font-bold text-gray-800">Không tìm thấy mẫu nào</h3>
                    <button onClick={() => {setSearchTerm(''); setActiveCategory('Tất cả')}} className="mt-4 text-primary font-bold hover:underline">Xem tất cả</button>
                </div>
            )}
        </div>
      </div> 
    );
};
