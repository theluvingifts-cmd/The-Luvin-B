
import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import { CollectionTemplate, LegoPart, FrameOption } from '../../../types';
import { StoryStyle, StoryAdjustments, INITIAL_ADJUSTMENTS } from '../../../src/types/story';
import { slugify } from '../../../utils/helpers';
import { EditorPanel } from './EditorPanel';
import { StoryRenderer } from './StoryRenderer';

import { StoreConfig } from '../../../services/configService';

interface StoryEditorProps {
    template: CollectionTemplate;
    parts: LegoPart[];
    frames: FrameOption[];
    storeConfig?: StoreConfig;
    logoUrl?: string;
    onBack: () => void;
    currentStyle: StoryStyle;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({
    template,
    parts,
    frames,
    storeConfig,
    logoUrl,
    onBack,
    currentStyle
}) => {
    const [style, setStyle] = useState<StoryStyle>(currentStyle);
    const [adjustments, setAdjustments] = useState<StoryAdjustments>(INITIAL_ADJUSTMENTS);
    const [isGenerating, setIsGenerating] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!exportRef.current) return;
        setIsGenerating(true);
        
        try {
            // Small delay to ensure all styles are applied
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const dataUrl = await toPng(exportRef.current, {
                width: 1080,
                height: 1920,
                pixelRatio: 2,
                cacheBust: true,
                skipFonts: false,
                includeQueryParams: true,
                fontEmbedCSS: '',
            });
            
            saveAs(dataUrl, `the-luvin-story-${slugify(template.name || 'custom')}-${template.id}.png`);
        } catch (error) {
            console.error("Story export failed:", error);
            alert("Lỗi khi tạo ảnh. Vui lòng thử lại.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-gray-100 flex overflow-hidden animate-fade-in">
            {/* Header / Sidebar Control */}
            <div className="w-96 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen shadow-2xl relative z-20">
                <div className="p-4 border-b border-gray-100">
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-bold text-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        <span>Quay lại Danh sách</span>
                    </button>
                </div>
                
                <EditorPanel 
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                    style={style}
                    setStyle={setStyle}
                    onReset={() => setAdjustments(INITIAL_ADJUSTMENTS)}
                />
                
                <div className="p-6 border-t border-gray-100 bg-white">
                    <button 
                        onClick={handleDownload}
                        disabled={isGenerating}
                        className="w-full py-4 bg-gray-900 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-luvin-pink transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-6 h-6 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        )}
                        <span>Xuất Ảnh PNG</span>
                    </button>
                </div>
            </div>

            {/* Preview Stage */}
            <div className="flex-grow flex items-center justify-center relative p-8 md:p-12 overflow-hidden bg-gray-200/50">
                {/* Decorative background info */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300 font-black text-[20vw] opacity-[0.03] select-none pointer-events-none uppercase italic">
                    Preview
                </div>

                {/* The scaling logic for preview */}
                <div className="relative group perspective-1000">
                    <div className="relative shadow-[0_100px_200px_rgba(0,0,0,0.15)] rounded-[60px] overflow-hidden bg-white scale-[0.35] lg:scale-[0.4] xl:scale-[0.45] origin-center transition-all duration-700 ease-out hover:rotate-y-0 group-hover:scale-[0.4] xxl:scale-[0.5]">
                        <StoryRenderer 
                            template={template}
                            style={style}
                            adjustments={adjustments}
                            parts={parts}
                            frames={frames}
                            logoUrl={logoUrl}
                            storeConfig={storeConfig}
                        />
                    </div>
                    
                    {/* Size indicator */}
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-white shadow-sm flex items-center gap-4 animate-bounce-slow">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Export Resolution: 1080 x 1920 px</span>
                    </div>
                </div>
            </div>

            {/* Hidden Export Node */}
            <div className="fixed -left-[10000px] top-0 pointer-events-none">
                <div ref={exportRef}>
                    <StoryRenderer 
                        template={template}
                        style={style}
                        adjustments={adjustments}
                        parts={parts}
                        frames={frames}
                        logoUrl={logoUrl}
                        storeConfig={storeConfig}
                        isExporting={true}
                    />
                </div>
            </div>
        </div>
    );
};
