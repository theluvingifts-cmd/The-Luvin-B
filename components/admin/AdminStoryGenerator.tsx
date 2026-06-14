
import React, { useState, useRef, useMemo } from 'react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CollectionTemplate } from '../../types';
import { formatCurrency } from '../../utils/pricing';
import { slugify } from '../../utils/helpers';
import { Logo } from '../shared/Logo';

interface AdminStoryGeneratorProps {
    templates: CollectionTemplate[];
    logoUrl?: string;
}

export const AdminStoryGenerator: React.FC<AdminStoryGeneratorProps> = ({ templates, logoUrl }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const templateRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const filteredTemplates = templates.filter(t => t.imageUrl);

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
        const selectedTemplates = filteredTemplates.filter(t => selectedIds.has(t.id));

        try {
            for (let i = 0; i < selectedTemplates.length; i++) {
                const t = selectedTemplates[i];
                const node = templateRefs.current[t.id];
                if (node) {
                    // Wait a bit for images to be fully ready if needed, 
                    // though html-to-image usually handles this.
                    const dataUrl = await toPng(node, {
                        width: 1080,
                        height: 1920,
                        pixelRatio: 1, // Standard resolution is enough for IG story
                        cacheBust: true,
                        skipFonts: false,
                        includeQueryParams: true,
                        fontEmbedCSS: '', // Skip manual font inlining to avoid CORS issues with cssRules access
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
        }
    };

    const generateSingle = async (template: CollectionTemplate) => {
        const node = templateRefs.current[template.id];
        if (!node) return;

        try {
            const dataUrl = await toPng(node, {
                width: 1080,
                height: 1920,
                pixelRatio: 2, // Higher quality for single export
                cacheBust: true,
                skipFonts: false,
                includeQueryParams: true,
                fontEmbedCSS: '', // Skip manual font inlining to avoid CORS issues
            });
            saveAs(dataUrl, `${slugify(template.name || 'story')}-${template.id}.png`);
        } catch (error) {
            console.error("Single story generation failed:", error);
            alert("Lỗi khi tải Story.");
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Story Generator</h2>
                    <p className="text-sm text-gray-500 mt-1">Tạo ảnh Instagram Story (1080x1920) tự động từ Collection</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={toggleAll}
                        className="px-4 py-2 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50"
                    >
                        {selectedIds.size === filteredTemplates.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                    </button>
                    <button 
                        onClick={generateStories}
                        disabled={selectedIds.size === 0 || isGenerating}
                        className="px-6 py-2 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-luvin-pink transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Đang tạo ({progress}%)</span>
                            </>
                        ) : (
                            <>
                                <span>Tạo & Tải ZIP</span>
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{selectedIds.size}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredTemplates.map(t => (
                    <div 
                        key={t.id} 
                        className={`group relative bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${selectedIds.has(t.id) ? 'ring-2 ring-luvin-pink border-transparent shadow-lg shadow-pink-100' : 'hover:border-gray-300'}`}
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
                            <h3 className="text-xs font-bold text-gray-900 truncate leading-tight">{t.name}</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{t.category || t.productLine}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Hidden export containers - Render all selected templates for capture */}
            <div className="fixed -left-[2000px] top-0 pointer-events-none overflow-hidden">
                {filteredTemplates.map(t => (
                    <div 
                        key={`export-${t.id}`}
                        ref={el => templateRefs.current[t.id] = el}
                        className="w-[1080px] h-[1920px] bg-[#FFFBF0] flex flex-col items-center justify-between py-24 px-16 relative"
                    >
                        {/* Background Decor - Minimalist circles or shapes */}
                        <div className="absolute top-[10%] -left-[10%] w-[500px] h-[500px] bg-white opacity-40 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[5%] -right-[5%] w-[400px] h-[400px] bg-luvin-pink/5 rounded-full blur-3xl"></div>

                        {/* Top Branding */}
                        <div className="z-10 flex flex-col items-center gap-4">
                            <Logo url={logoUrl} className="h-16" textClassName="text-3xl" />
                            <div className="h-1 w-24 bg-gray-900/10 rounded-full"></div>
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
                                        {t.config?.draggableItems?.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">✨</div>
                                                <span className="text-xl font-bold text-gray-600">{t.config.draggableItems.length} charm</span>
                                            </div>
                                        )}
                                    </div>

                                    {(() => {
                                        // Match CollectionPage logic for price calculation
                                        let basePrice = (t.salePrice && t.salePrice < (t.price || 0) ? t.salePrice : (t.price || t.config?.price || 290000));
                                        
                                        // Hardcode fix for museum frame if name matches
                                        if (t.name?.toLowerCase().trim().includes('bảo tàng') || t.id?.toLowerCase().includes('bao-tang')) {
                                            basePrice = 310000;
                                        }

                                        if (basePrice !== undefined && basePrice !== null && !isNaN(Number(basePrice))) {
                                            return (
                                                <div className="mt-10 flex flex-col items-center gap-2">
                                                    <p className="text-5xl font-black text-luvin-pink tracking-tighter">
                                                        {formatCurrency(Number(basePrice))}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                                                        Giá trọn gói (Khung + In ảnh + LEGO)
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
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
