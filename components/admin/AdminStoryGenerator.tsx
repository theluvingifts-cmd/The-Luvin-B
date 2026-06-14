
import React, { useState, useRef, useMemo } from 'react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CollectionTemplate, LegoPart, FrameOption } from '../../types';
import { calculatePrice, formatCurrency } from '../../utils/pricing';
import { slugify } from '../../utils/helpers';
import { Logo } from '../shared/Logo';

interface AdminStoryGeneratorProps {
    templates: CollectionTemplate[];
    parts: LegoPart[];
    frames: FrameOption[];
    logoUrl?: string;
}

export const AdminStoryGenerator: React.FC<AdminStoryGeneratorProps> = ({ templates, parts, frames, logoUrl }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const templateRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [generatingId, setGeneratingId] = useState<string | null>(null);

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
        await new Promise(resolve => setTimeout(resolve, 100));

        const node = templateRefs.current[template.id];
        if (!node) {
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
                                    onClick={(e) => { e.stopPropagation(); generateSingle(t); }}
                                    className="absolute bottom-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
                                    title="Tải story mẫu này"
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

            {/* Hidden export containers - Render ONLY the template being generated to save DOM memory */}
            <div className="fixed -left-[5000px] top-0 w-0 h-0 pointer-events-none overflow-hidden">
                {templates.filter(t => t.id === generatingId).map(t => (
                    <div 
                        key={`export-${t.id}`}
                        ref={el => templateRefs.current[t.id] = el}
                        className="w-[1080px] h-[1920px] bg-[#FFFBF0] flex flex-col items-center justify-between py-24 px-16 relative"
                    >
                        {/* Background Decor - Minimalist circles or shapes */}
                        <div className="absolute top-[10%] -left-[10%] w-[500px] h-[500px] bg-white opacity-40 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[5%] -right-[5%] w-[400px] h-[400px] bg-luvin-pink/5 rounded-full blur-3xl"></div>

                        {/* Top Branding */}
                        <div className="z-10 flex flex-col items-center gap-6">
                            <Logo url={logoUrl} className="h-32" textClassName="text-6xl" />
                            <div className="h-2 w-48 bg-gray-900/10 rounded-full"></div>
                        </div>

                        {/* Main Product Frame */}
                        <div className="w-full flex-grow flex flex-col justify-center items-center z-10 pt-12">
                            {/* Polaroid-style or floating look */}
                            <div className="w-full bg-white shadow-2xl rounded-[40px] p-6 flex flex-col">
                                <div className="aspect-square rounded-[24px] overflow-hidden bg-gray-50 border border-gray-100">
                                    <img src={t.imageUrl} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
                                </div>
                                <div className="pt-10 pb-6 px-4 flex flex-col items-center text-center">
                                    <p className="text-sm text-luvin-pink font-extrabold uppercase tracking-[0.4em] mb-3">{t.category || (t.productLine === 'gallery' ? 'MINIMALIST ART' : 'LEGO COLLECTION')}</p>
                                    <h3 className="text-5xl font-bold text-gray-900 tracking-tight leading-tight px-4">{t.name}</h3>
                                    
                                    <div className="flex items-center gap-6 mt-8">
                                        {t.config?.characters?.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">👤</div>
                                                <span className="text-xl font-bold text-gray-600">{t.config.characters.length} nhân vật</span>
                                            </div>
                                        )}
                                        {(() => {
                                            const isGallery = (t.productLine || t.config?.productLine) === 'gallery';
                                            const items = t.config?.draggableItems || [];
                                            
                                            if (isGallery) {
                                                const photosCount = items.filter(i => i.frameUrl).length || t.galleryOptions?.photoFrameCount || 0;
                                                if (photosCount > 0) {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">🖼️</div>
                                                            <span className="text-xl font-bold text-gray-600">{photosCount} khung ảnh</span>
                                                        </div>
                                                    );
                                                }
                                            } else {
                                                // LEGO line: count Draggable items + Character's special parts (hat, set)
                                                // We use a broader count to ensure all added elements are represented
                                                const draggableCharms = items.length;
                                                const characterExtras = t.config?.characters?.reduce((acc, char) => {
                                                    // Count hat and set as charms
                                                    return acc + (char.hat ? 1 : 0) + (char.set ? 1 : 0);
                                                }, 0) || 0;
                                                const charmCount = draggableCharms + characterExtras;

                                                if (charmCount > 0) {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">✨</div>
                                                            <span className="text-xl font-bold text-gray-600">{charmCount} charm</span>
                                                        </div>
                                                    );
                                                }
                                            }
                                            return null;
                                        })()}
                                    </div>

                                    {(() => {
                                        // Match CollectionPage logic for price calculation
                                        let basePrice = t.price || t.salePrice;
                                        
                                        // If no explicit price, calculate it accurately
                                        if (!basePrice && parts.length > 0) {
                                            const partsMap = parts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
                                            const { totalPrice } = calculatePrice(t.config, partsMap, frames);
                                            basePrice = totalPrice;
                                        }

                                        // Fallback default
                                        if (!basePrice) basePrice = 290000;
                                        
                                        // Hardcode fix for museum frame if name matches
                                        if (t.name?.toLowerCase().trim().includes('bảo tàng') || t.id?.toLowerCase().includes('bao-tang')) {
                                            basePrice = 310000;
                                        }

                                        return (
                                            <div className="mt-10 flex flex-col items-center gap-2">
                                                <p className="text-6xl font-black text-luvin-pink tracking-tighter">
                                                    {formatCurrency(Number(basePrice))}
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                                                    Tặng kèm Hộp, Túi và Thiệp
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Space for Instagram Stickers */}
                        <div className="w-full h-64 z-10 flex flex-col items-center justify-end pb-12">
                            <div className="flex flex-col items-center gap-2 opacity-30">
                                <p className="text-lg text-gray-400 font-bold uppercase tracking-[0.6em]">THELUVIN.VN</p>
                            </div>
                        </div>

                        {/* Decoration items */}
                        <div className="absolute top-1/2 left-0 w-full flex justify-between px-10 opacity-10 pointer-events-none">
                            <div className="text-9xl font-black text-gray-900/5 rotate-90 select-none">THELUVIN</div>
                            <div className="text-9xl font-black text-gray-900/5 -rotate-90 select-none">GIFTS</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
