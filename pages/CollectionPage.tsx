
import React, { useState, useMemo, useEffect } from 'react';
import { CollectionTemplate, FrameConfig, FrameOption, LegoPart, Page } from '../types';
import { COLLECTION_TEMPLATES } from '../constants';
import { calculatePrice, formatCurrency } from '../utils/pricing';

interface CollectionPageProps {
    navigateTo: (page: Page) => void, 
    onCustomize: (template: CollectionTemplate) => void, 
    templates?: CollectionTemplate[],
    onZoomImage: (url: string) => void,
    allParts: Record<string, LegoPart>,
    frames: FrameOption[],
    storeConfig: any
}

export const CollectionPage: React.FC<CollectionPageProps> = ({ navigateTo, onCustomize, templates, onZoomImage, allParts, frames, storeConfig }) => {
    const displayTemplates: CollectionTemplate[] = (templates && templates.length > 0) ? templates : COLLECTION_TEMPLATES;
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Tất cả');

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

    return ( 
      <div className="min-h-screen bg-[#f1f3f5] pb-20 font-body text-site-text">
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

        {/* Product Grid - 2 columns on mobile, matching image style */}
        <div className="container mx-auto px-3 sm:px-6 py-8">
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {filteredTemplates.map((template, index) => {
                    const { totalPrice } = calculatePrice(template.config, allParts, frames, storeConfig.rewardTiers);
                    const purchaseCount = template.purchaseCount || 0;
                    
                    return ( 
                        <div key={template.id || index} className="group flex flex-col bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full">
                            {/* Image Container with Badges */}
                            <div className="relative aspect-[3/4] overflow-hidden bg-gray-50 cursor-pointer" onClick={() => onCustomize(template)}>
                                <img 
                                    src={template.imageUrl} 
                                    alt={template.name} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                />
                                
                                {/* Top Labels */}
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
                                
                                {/* Trusted/Purchase Count Badge - Matching Image */}
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
                                        onClick={() => onCustomize(template)} 
                                        className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-primary transition-all active:scale-95 group/btn"
                                    >
                                        Tùy chỉnh ngay
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
}
