
import React, { useState, useRef, useMemo } from 'react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CollectionTemplate, LegoPart, FrameOption } from '../../types';
import { slugify } from '../../utils/helpers';
import { StoryEditor } from './story-editor/StoryEditor';
import { StoryRenderer } from './story-editor/StoryRenderer';
import { StoryStyle, INITIAL_ADJUSTMENTS } from '../../src/types/story';

import { StoreConfig } from '../../services/configService';

interface AdminStoryGeneratorProps {
    templates: CollectionTemplate[];
    parts: LegoPart[];
    frames: FrameOption[];
    storeConfig?: StoreConfig;
}

interface StyleOption {
    id: StoryStyle;
    name: string;
    description: string;
    icon: string;
}

const STYLE_OPTIONS: StyleOption[] = [
    { 
        id: 'classic', 
        name: 'Classic Luvin', 
        description: 'Bố cục truyền thống, tập trung vào sản phẩm và giá', 
        icon: '🏠' 
    },
    { 
        id: 'magazine', 
        name: 'Magazine Cover', 
        description: 'Phong cách bìa tạp chí cao cấp, Typography nghệ thuật', 
        icon: '📖' 
    },
    { 
        id: 'minimal', 
        name: 'Modern Minimal', 
        description: 'Tối giản, tinh tế, nhiều khoảng trắng sang trọng', 
        icon: '✨' 
    },
    {
        id: 'addons',
        name: 'Service Addons',
        description: 'Làm nổi bật các dịch vụ cộng thêm (Đèn, Ảnh, Hộp...)',
        icon: '📸'
    }
];

export const AdminStoryGenerator: React.FC<AdminStoryGeneratorProps> = ({ templates, parts, frames, storeConfig }) => {
    const selectedIdsRef = useRef<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedStyle, setSelectedStyle] = useState<StoryStyle>('classic');
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const templateRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const logoUrl = storeConfig?.logoUrl;

    const categories = useMemo(() => {
        const cats = new Set<string>();
        templates.forEach(t => {
            if (t.category) cats.add(t.category);
            else if (t.productLine) cats.add(t.productLine);
        });
        return Array.from(cats);
    }, [templates]);

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            if (!t.imageUrl) return false;
            
            const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 t.id.toLowerCase().includes(searchTerm.toLowerCase());
            
            const cat = t.category || t.productLine || '';
            const matchesCategory = categoryFilter === 'all' || cat === categoryFilter;
            
            return matchesSearch && matchesCategory;
        });
    }, [templates, searchTerm, categoryFilter]);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredTemplates.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTemplates.map(t => t.id)));
        }
    };

    const [dailyTarget, setDailyTarget] = useState<number>(() => {
        const saved = localStorage.getItem('story_daily_target');
        return saved ? parseInt(saved, 10) : 5;
    });

    const handleTargetChange = (val: number) => {
        const cleanVal = Math.max(1, isNaN(val) ? 1 : val);
        setDailyTarget(cleanVal);
        localStorage.setItem('story_daily_target', String(cleanVal));
    };

    const selectRandomStories = () => {
        const source = filteredTemplates.length > 0 ? filteredTemplates : templates;
        if (source.length === 0) return;
        
        const shuffled = [...source].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, dailyTarget);
        
        const newSet = new Set(selected.map(t => t.id));
        setSelectedIds(newSet);
    };

    const generateStories = async () => {
        if (selectedIds.size === 0) return;
        setIsGenerating(true);
        setProgress(0);

        const zip = new JSZip();
        const selectedTemplates = templates.filter(t => selectedIds.has(t.id));

        try {
            for (let i = 0; i < selectedTemplates.length; i++) {
                const t = selectedTemplates[i];
                setGeneratingId(t.id);
                
                // Wait for state update and potential render
                await new Promise(resolve => setTimeout(resolve, 100));

                const node = templateRefs.current[t.id];
                if (node) {
                    const dataUrl = await toPng(node, {
                        width: 1080,
                        height: 1920,
                        pixelRatio: 1,
                        cacheBust: true,
                        skipFonts: false,
                        includeQueryParams: true,
                        fontEmbedCSS: '',
                    });
                    
                    const base64Data = dataUrl.split(',')[1];
                    zip.file(`${slugify(t.name || 'story')}-${t.id}.png`, base64Data, { base64: true });
                }
                setProgress(Math.round(((i + 1) / selectedTemplates.length) * 100));
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `the-luvin-stories-${new Date().getTime()}.zip`);
        } catch (error) {
            console.error("Story generation failed:", error);
            alert("Lỗi khi tạo Story. Vui lòng thử lại.");
        } finally {
            setIsGenerating(false);
            setProgress(0);
            setGeneratingId(null);
        }
    };

    const generateSingle = async (template: CollectionTemplate) => {
        setGeneratingId(template.id);
        // Small delay to ensure React renders the hidden node
        await new Promise(resolve => setTimeout(resolve, 150));

        const node = templateRefs.current[template.id];
        if (!node) {
            console.error("Template node not found for ID:", template.id);
            setGeneratingId(null);
            return;
        }

        try {
            const dataUrl = await toPng(node, {
                width: 1080,
                height: 1920,
                pixelRatio: 2,
                cacheBust: true,
                skipFonts: false,
                includeQueryParams: true,
                fontEmbedCSS: '',
            });
            saveAs(dataUrl, `${slugify(template.name || 'story')}-${template.id}.png`);
        } catch (error) {
            console.error("Single story generation failed:", error);
            alert("Lỗi khi tải Story.");
        } finally {
            setGeneratingId(null);
        }
    };

    if (editingId) {
        const activeTemplate = templates.find(t => t.id === editingId);
        if (activeTemplate) {
            return (
                <StoryEditor 
                    template={activeTemplate}
                    parts={parts}
                    frames={frames}
                    storeConfig={storeConfig}
                    logoUrl={logoUrl}
                    onBack={() => setEditingId(null)}
                    currentStyle={selectedStyle}
                />
            );
        }
    }

    return (
        <div className="animate-fade-in space-y-6 pb-20">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Story Generator</h2>
                        <p className="text-sm text-gray-500 mt-1">Tạo ảnh Instagram Story (1080x1920) tự động từ mẫu</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={toggleAll}
                            className="flex-1 md:flex-none px-4 py-2 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50 whitespace-nowrap"
                        >
                            {selectedIds.size === filteredTemplates.length && filteredTemplates.length > 0 ? 'Bỏ chọn hết' : `Chọn tất cả (${filteredTemplates.length})`}
                        </button>
                        <button 
                            onClick={generateStories}
                            disabled={selectedIds.size === 0 || isGenerating}
                            className="flex-1 md:flex-none px-6 py-2 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-luvin-pink transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>{progress}%</span>
                                </>
                            ) : (
                                <>
                                    <span>Tải ZIP</span>
                                    {selectedIds.size > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{selectedIds.size}</span>}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="border-t pt-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Chỉ tiêu & Chọn Ngẫu Nhiên hàng ngày</p>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-gradient-to-br from-pink-50/20 to-violet-50/20 p-5 rounded-2xl border border-pink-100/60 shadow-sm">
                        <div className="md:col-span-4 space-y-2">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Chỉ tiêu đăng story hàng ngày</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number" 
                                    min="1"
                                    max="50"
                                    value={dailyTarget}
                                    onChange={(e) => handleTargetChange(parseInt(e.target.value, 10))}
                                    className="w-20 px-3 py-2 text-center text-sm font-bold bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-luvin-pink/20 transition-all"
                                />
                                <span className="text-xs text-gray-500 font-semibold">story / ngày</span>
                            </div>
                            <p className="text-[10px] text-gray-400">Thiết lập mục tiêu số lượng story cần đăng tải mỗi ngày.</p>
                        </div>
                        <div className="md:col-span-5 space-y-2">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Tiến độ hôm nay</label>
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                                <span>Đã chọn: {selectedIds.size} / {dailyTarget} story</span>
                                <span className="text-luvin-pink">{Math.round((selectedIds.size / dailyTarget) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200/60 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-pink-500 to-violet-500 h-full transition-all duration-500" 
                                    style={{ width: `${Math.min(100, (selectedIds.size / dailyTarget) * 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium">
                                {selectedIds.size >= dailyTarget 
                                    ? '🎉 Tuyệt vời! Bạn đã chọn đủ hoặc vượt chỉ tiêu đăng story hôm nay!' 
                                    : `Cần chọn thêm ${Math.max(1, dailyTarget - selectedIds.size)} story nữa để đạt mục tiêu.`}
                            </p>
                        </div>
                        <div className="md:col-span-3 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={selectRandomStories}
                                className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <span>🎲 Chọn Ngẫu Nhiên {dailyTarget} Story</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="border-t pt-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Chọn phong cách thiết kế mặc định</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {STYLE_OPTIONS.map(style => (
                            <button
                                key={style.id}
                                onClick={() => setSelectedStyle(style.id)}
                                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left ${selectedStyle === style.id ? 'border-luvin-pink bg-pink-50/30 ring-1 ring-luvin-pink shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                            >
                                <div className="w-10 h-10 flex-shrink-0 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm border border-gray-50">
                                    {style.icon}
                                </div>
                                <div>
                                    <h3 className={`text-sm font-bold ${selectedStyle === style.id ? 'text-luvin-pink' : 'text-gray-900'}`}>{style.name}</h3>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed font-medium">{style.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 border-t pt-6">
                    <div className="relative flex-grow">
                        <input 
                            type="text"
                            placeholder="Tìm kiếm mẫu..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-luvin-pink/20 transition-all"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                        <button 
                            onClick={() => setCategoryFilter('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${categoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            Tất cả
                        </button>
                        {categories.map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">Không tìm thấy mẫu nào khớp với bộ lọc</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {filteredTemplates.map(t => (
                        <div 
                            key={t.id} 
                            className={`group relative bg-white border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${selectedIds.has(t.id) ? 'ring-2 ring-luvin-pink border-transparent shadow-lg shadow-pink-100' : 'hover:border-gray-300'}`}
                            onClick={() => toggleSelect(t.id)}
                        >
                            <div className="aspect-[3/4] bg-gray-50 relative">
                                <img src={t.imageUrl} className="w-full h-full object-cover" alt={t.name} />
                                <div className="absolute top-2 left-2">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.has(t.id) ? 'bg-luvin-pink border-luvin-pink' : 'bg-white/80 border-gray-300'}`}>
                                        {selectedIds.has(t.id) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingId(t.id); }}
                                    className="absolute bottom-2 left-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
                                    title="Chỉnh sửa & Xem trước"
                                >
                                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); generateSingle(t); }}
                                    className="absolute bottom-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
                                    title="Tải nhanh PNG"
                                >
                                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                </button>
                            </div>
                            <div className="p-3">
                                <h3 className="text-[11px] font-bold text-gray-900 truncate leading-tight">{t.name}</h3>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1 truncate">{t.category || t.productLine}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="fixed -left-[5000px] top-0 w-0 h-0 pointer-events-none overflow-hidden">
                {templates.filter(t => t.id === generatingId).map(t => (
                    <div 
                        key={`export-${t.id}`}
                        ref={el => templateRefs.current[t.id] = el}
                    >
                        <StoryRenderer 
                            template={t}
                            style={selectedStyle}
                            adjustments={INITIAL_ADJUSTMENTS}
                            parts={parts}
                            frames={frames}
                            logoUrl={logoUrl}
                            storeConfig={storeConfig}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
