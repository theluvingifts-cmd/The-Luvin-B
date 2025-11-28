
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
    
    // State for filtering
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Tất cả');

    // Define smart categories based on keywords
    const categories = ['Tất cả', 'Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh'];

    // Filter Logic
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
      <div className="min-h-screen bg-[#f9f4ef] pb-20 font-body">
        {/* Modern Header Section */}
        <div className="bg-white sticky top-0 z-30 shadow-sm transition-all">
            <div className="container mx-auto px-6 py-6 md:py-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="relative">
                        <h1 className="text-5xl md:text-7xl font-script text-luvin-pink transform -rotate-2 origin-left drop-shadow-sm mb-2">The Collection</h1>
                        <p className="text-xs text-gray-400 mt-2 font-medium tracking-widest uppercase ml-1">Những thiết kế được yêu thích nhất</p>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative w-full md:w-72 group">
                        <input 
                            type="text" 
                            placeholder="Tìm mẫu..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-luvin-pink rounded-full text-sm transition-all outline-none shadow-inner group-hover:shadow-md"
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-hover:text-luvin-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-3 mt-6 overflow-x-auto no-scrollbar pb-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all border shadow-sm ${
                                activeCategory === cat 
                                    ? 'bg-gray-900 text-white border-gray-900 scale-105' 
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
        <div className="container mx-auto px-6 py-8">
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                  {filteredTemplates.map((template, index) => {
                    const { totalPrice } = calculatePrice(template.config, allParts, frames);
                    
                    return ( 
                        <div key={template.id || index} className="group bg-white rounded-xl p-4 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 flex flex-col h-full">
                            {/* Image Area - Aspect Square & Padding to fix cropping */}
                            <div className="relative aspect-square bg-[#f4eee8] rounded-lg overflow-hidden mb-4 group-hover:bg-[#efe5dc] transition-colors">
                                <div className="absolute inset-0 p-6 flex items-center justify-center">
                                    <div className="relative w-full h-full shadow-lg"> {/* Added shadow container */}
                                        <img 
                                            src={template.imageUrl} 
                                            alt={template.name} 
                                            className="w-full h-full object-contain bg-white" 
                                        />
                                    </div>
                                </div>
                                
                                {/* Hover Overlay Actions */}
                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none group-hover:pointer-events-auto z-20">
                                    <div className="flex gap-2 justify-center">
                                        <button 
                                            onClick={() => onCustomize(template.config)} 
                                            className="bg-white text-gray-900 font-bold py-2 px-4 rounded-full text-xs shadow-lg hover:bg-luvin-pink hover:text-white transition-colors flex items-center gap-1.5 transform hover:scale-105"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            Tùy chỉnh
                                        </button>
                                        <button 
                                            onClick={() => onZoomImage(template.imageUrl)}
                                            className="w-8 h-8 bg-white text-gray-700 rounded-full flex items-center justify-center shadow-lg hover:bg-luvin-pink hover:text-white transition-colors transform hover:scale-105"
                                            title="Xem nhanh"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Info Area */}
                            <div className="text-center mt-auto">
                                <h3 className="text-base font-heading font-bold text-gray-800 line-clamp-1 mb-1 group-hover:text-luvin-pink transition-colors" title={template.name}>{template.name}</h3>
                                <div className="flex flex-col items-center">
                                    <span className="text-luvin-pink font-bold text-lg">{formatCurrency(totalPrice)}</span>
                                    <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                                        {template.config.characters.length} nhân vật • {frames.find(f => f.id === template.config.frameId)?.name}
                                    </span>
                                </div>
                            </div>
                        </div> 
                    );
                  })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-4xl animate-bounce">🙈</div>
                    <h3 className="text-xl font-bold text-gray-800 font-heading">Không tìm thấy mẫu nào</h3>
                    <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">Thử thay đổi từ khóa hoặc chọn danh mục khác xem sao nhé.</p>
                    <button onClick={() => {setSearchTerm(''); setActiveCategory('Tất cả')}} className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity">Xem tất cả</button>
                </div>
            )}
        </div>
      </div> 
    );
}
