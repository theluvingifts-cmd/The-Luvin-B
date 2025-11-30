
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
    const displayTemplates = (templates && templates.length > 0) ? templates : COLLECTION_TEMPLATES;
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Tất cả');

    const categories = ['Tất cả', 'Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh'];

    const filteredTemplates = useMemo(() => {
        return displayTemplates.filter(template => {
            const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesCategory = true;
            if (activeCategory !== 'Tất cả') {
                const keywords: Record<string, string[]> = {
                    'Tình yêu': ['yêu', 'love', 'couple', 'valentine'],
                    'Sinh nhật': ['sinh nhật', 'birthday', 'sn'],
                    'Kỷ niệm': ['kỷ niệm', 'anniversary', 'tháng'],
                    'Gia đình': ['gia đình', 'family', 'nhà'],
                    'Giáng sinh': ['noel', 'christmas', 'giáng sinh', 'xmas']
                };
                
                const currentKeywords = keywords[activeCategory] || [];
                const nameLower = template.name.toLowerCase();
                matchesCategory = currentKeywords.some(kw => nameLower.includes(kw));
            }

            return matchesSearch && matchesCategory;
        });
    }, [displayTemplates, searchTerm, activeCategory]);

    return ( 
      <div className="min-h-screen bg-[#fcf9f6] pb-20 font-body text-site-text">
        {/* Header Hero Section */}
        <div className="bg-white border-b border-gray-100 pt-24 pb-12 px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-50 rounded-full blur-3xl opacity-60 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none -translate-x-1/2 translate-y-1/2"></div>
            
            <div className="container mx-auto text-center relative z-10">
                <h1 className="text-4xl md:text-6xl font-heading font-bold mb-4 text-gray-900">
                    Bộ Sưu Tập <span className="text-primary italic font-light">Thiết Kế</span>
                </h1>
                <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                    Khám phá những mẫu khung tranh LEGO được yêu thích nhất. Bạn có thể chọn một mẫu và tùy chỉnh lại theo ý thích của mình.
                </p>
                
                {/* Search Bar */}
                <div className="mt-8 max-w-md mx-auto relative group">
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm mẫu (VD: Sinh nhật, Tình yêu...)" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-full text-sm transition-all outline-none shadow-sm focus:shadow-md focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>
        </div>

        {/* Filter Section */}
        <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 py-3 shadow-sm transition-all">
            <div className="container mx-auto px-6 overflow-x-auto no-scrollbar">
                <div className="flex items-center justify-center gap-2 min-w-max">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 border ${
                                activeCategory === cat 
                                    ? 'bg-primary text-white border-primary shadow-md transform scale-105' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Content Grid */}
        <div className="container mx-auto px-6 py-12">
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                  {filteredTemplates.map((template, index) => {
                    const { totalPrice } = calculatePrice(template.config, allParts, frames);
                    
                    return ( 
                        <div key={template.id || index} className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:-translate-y-1">
                            {/* Image Area */}
                            <div className="relative aspect-square overflow-hidden bg-gray-50 group">
                                <div className="absolute inset-0 flex items-center justify-center p-6">
                                    <img 
                                        src={template.imageUrl} 
                                        alt={template.name} 
                                        className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-md" 
                                    />
                                </div>
                                
                                {/* Quick Actions Overlay */}
                                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center">
                                    <div className="flex gap-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                                        <button 
                                            onClick={() => onZoomImage(template.imageUrl)}
                                            className="w-10 h-10 bg-white/90 backdrop-blur text-gray-800 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                                            title="Xem nhanh"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => onCustomize(template.config)} 
                                            className="h-10 px-5 bg-primary text-white rounded-full font-bold text-xs shadow-lg hover:bg-opacity-90 transition-colors flex items-center"
                                        >
                                            Tùy chỉnh ngay
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Info Area */}
                            <div className="p-5 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-base font-bold text-gray-800 line-clamp-2 leading-tight group-hover:text-primary transition-colors" title={template.name}>{template.name}</h3>
                                </div>
                                
                                <div className="mt-auto pt-4 flex items-end justify-between border-t border-gray-50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Giá tham khảo</span>
                                        <span className="text-lg font-bold text-gray-900">{formatCurrency(totalPrice)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
                                            {template.config.characters.length} Nhân vật
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div> 
                    );
                  })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-5xl animate-bounce">🔍</div>
                    <h3 className="text-2xl font-bold text-gray-800 font-heading mb-2">Không tìm thấy mẫu nào</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto">Thử thay đổi từ khóa hoặc chọn danh mục khác xem sao nhé.</p>
                    <button onClick={() => {setSearchTerm(''); setActiveCategory('Tất cả')}} className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-full font-bold text-sm hover:shadow-lg transition-all hover:-translate-y-1">Xem tất cả</button>
                </div>
            )}
        </div>
      </div> 
    );
}
