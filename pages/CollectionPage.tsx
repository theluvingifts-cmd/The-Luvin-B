
import React, { useState, useMemo } from 'react';
import { CollectionTemplate, FrameConfig, FrameOption, LegoPart, Page } from '../types';
import { COLLECTION_TEMPLATES } from '../constants';
import { calculatePrice, formatCurrency } from '../utils/pricing';

interface CollectionPageProps {
    navigateTo: (page: Page) => void, 
    onCustomize: (config: FrameConfig) => void, 
    templates?: CollectionTemplate[],
    onZoomImage: (url: string) => void,
    allParts: Record<string, LegoPart>,
    frames: FrameOption[]
}

export const CollectionPage: React.FC<CollectionPageProps> = ({ navigateTo, onCustomize, templates, onZoomImage, allParts, frames }) => {
    const displayTemplates: CollectionTemplate[] = (templates && templates.length > 0) ? templates : COLLECTION_TEMPLATES;
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Tất cả');

    // Lấy danh mục động hoàn toàn từ dữ liệu thực tế của templates
    const categories = useMemo(() => {
        const dynamicCats = new Set<string>();
        displayTemplates.forEach(t => {
            if (t.category && t.category.trim() !== '') {
                dynamicCats.add(t.category.trim());
            }
        });
        // Sắp xếp danh mục theo bảng chữ cái và thêm "Tất cả" lên đầu
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
      <div className="min-h-screen bg-[#fdfcfb] pb-20 font-body text-site-text">
        {/* Header Section - Clean & Modern */}
        <div className="bg-white border-b border-gray-100 pt-20 pb-10 px-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="container mx-auto text-center relative z-10">
                <h1 className="text-3xl md:text-5xl font-heading font-bold mb-3 text-gray-900 leading-tight">
                    Khám phá <span className="text-luvin-pink">Thiết kế</span> độc bản
                </h1>
                <p className="text-gray-500 max-w-lg mx-auto text-xs md:text-sm leading-relaxed px-4">
                    Mỗi mẫu thiết kế là một câu chuyện. Hãy chọn một mẫu bạn thích nhất và bắt đầu tùy chỉnh cho riêng mình.
                </p>
                
                {/* Search Bar - Optimized for Mobile */}
                <div className="mt-8 max-w-md mx-auto relative px-2">
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm mẫu..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm transition-all outline-none focus:bg-white focus:ring-2 focus:ring-luvin-pink/20 focus:border-luvin-pink shadow-sm"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>
        </div>

        {/* Filter Section - Sticky & Horizontal Scroll */}
        <div className="sticky top-14 sm:top-16 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 shadow-sm transition-all">
            <div className="container mx-auto px-4 overflow-x-auto no-scrollbar flex items-center justify-start sm:justify-center gap-2">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all duration-300 border ${
                            activeCategory === cat 
                                ? 'bg-primary text-white border-primary shadow-md' 
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Content Grid - Better Mobile Spacing */}
        <div className="container mx-auto px-3 sm:px-6 py-8">
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {filteredTemplates.map((template, index) => {
                    const { totalPrice } = calculatePrice(template.config, allParts, frames);
                    
                    return ( 
                        <div key={template.id || index} className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100">
                            {/* Image Area - Always Interactive */}
                            <div className="relative aspect-square overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer" onClick={() => onCustomize(template.config)}>
                                <img 
                                    src={template.imageUrl} 
                                    alt={template.name} 
                                    className="w-full h-full object-contain p-2 sm:p-4 transition-transform duration-500 group-hover:scale-110" 
                                />
                                
                                {/* Quick View Button (Top Right) */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onZoomImage(template.imageUrl); }}
                                    className="absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 bg-white/80 backdrop-blur text-gray-600 rounded-full flex items-center justify-center hover:bg-white shadow-sm border border-gray-100"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </button>
                            </div>

                            {/* Info Area */}
                            <div className="p-3 sm:p-4 flex flex-col flex-grow">
                                <span className="text-[9px] text-luvin-pink font-bold uppercase tracking-wider mb-1">
                                    {template.category || 'Mẫu thiết kế'}
                                </span>
                                <h3 className="text-xs sm:text-sm font-bold text-gray-800 line-clamp-1 mb-2 leading-tight" title={template.name}>
                                    {template.name}
                                </h3>
                                
                                <div className="mt-auto">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm sm:text-base font-bold text-gray-900">{formatCurrency(totalPrice)}</span>
                                        <span className="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                            {template.config.characters.length} NV
                                        </span>
                                    </div>
                                    
                                    {/* Action Button - Always visible & prominent on mobile */}
                                    <button 
                                        onClick={() => onCustomize(template.config)} 
                                        className="w-full py-2 sm:py-2.5 bg-gray-900 text-white rounded-xl text-[10px] sm:text-xs font-bold shadow-sm hover:bg-luvin-pink transition-colors active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        Tùy chỉnh ngay
                                    </button>
                                </div>
                            </div>
                        </div> 
                    );
                  })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200 mx-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-3xl">🔍</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Không tìm thấy mẫu nào</h3>
                    <p className="text-gray-400 text-xs px-10">Thử thay đổi từ khóa hoặc chọn danh mục khác nhé.</p>
                    <button onClick={() => {setSearchTerm(''); setActiveCategory('Tất cả')}} className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-full text-xs font-bold">Xem tất cả</button>
                </div>
            )}
        </div>
      </div> 
    );
}
