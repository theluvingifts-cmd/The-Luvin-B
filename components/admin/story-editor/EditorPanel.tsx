
import React from 'react';
import { StoryAdjustments, StoryStyle } from '../../../src/types/story';

interface EditorPanelProps {
    adjustments: StoryAdjustments;
    setAdjustments: (adj: StoryAdjustments | ((prev: StoryAdjustments) => StoryAdjustments)) => void;
    style: StoryStyle;
    setStyle: (style: StoryStyle) => void;
    onReset: () => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
    adjustments: adj,
    setAdjustments,
    style,
    setStyle,
    onReset
}) => {
    const update = (key: keyof StoryAdjustments, value: any) => {
        setAdjustments(prev => ({ ...prev, [key]: value }));
    };

    const sectionTitle = (title: string) => (
        <div className="flex items-center gap-2 mb-4 pt-4 border-t border-gray-100 first:pt-0 first:border-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</span>
        </div>
    );

    const controlGroup = (label: string, value: number, key: keyof StoryAdjustments, min: number, max: number, step: number = 1) => (
        <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700">{label}</span>
                <span className="text-[10px] font-mono text-gray-400">{value}px</span>
            </div>
            <input 
                type="range" 
                min={min} 
                max={max} 
                step={step} 
                value={value} 
                onChange={(e) => update(key, parseFloat(e.target.value))} 
                className="w-full accent-luvin-pink h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
            />
        </div>
    );

    const toggle = (label: string, key: keyof StoryAdjustments) => (
        <label className="flex items-center justify-between cursor-pointer mb-2">
            <span className="text-xs font-bold text-gray-700">{label}</span>
            <div className="relative">
                <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={!!adj[key]} 
                    onChange={(e) => update(key, e.target.checked)} 
                />
                <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:bg-luvin-pink transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
            </div>
        </label>
    );

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Advanced Editor</h3>
                    <p className="text-xs text-luvin-pink font-black uppercase tracking-widest">Premium Customization</p>
                </div>
                <button 
                    onClick={onReset}
                    className="text-[10px] bg-gray-100 px-3 py-1.5 rounded-full font-black text-gray-500 hover:bg-gray-200 transition-colors uppercase tracking-widest"
                >
                    Reset
                </button>
            </div>

            <div className="flex-grow p-6 overflow-y-auto space-y-6 no-scrollbar">
                {/* 1. Global Style */}
                <div>
                    {sectionTitle("Layout Style")}
                    <div className="grid grid-cols-3 gap-2">
                        {(['classic', 'magazine', 'minimal'] as StoryStyle[]).map(s => (
                            <button
                                key={s}
                                onClick={() => setStyle(s)}
                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${style === s ? 'bg-gray-900 text-white border-gray-900 shadow-lg' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Content Overrides */}
                <div>
                    {sectionTitle("Content Settings")}
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Custom Name</label>
                            <input 
                                type="text"
                                value={adj.customName || ''}
                                onChange={(e) => update('customName', e.target.value)}
                                placeholder="Tên sản phẩm..."
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-luvin-pink/20 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Price Override</label>
                                <input 
                                    type="number"
                                    value={adj.customPrice || ''}
                                    onChange={(e) => update('customPrice', parseInt(e.target.value) || undefined)}
                                    placeholder="Giá tiền..."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-luvin-pink/20 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Font Scale</label>
                                <input 
                                    type="number"
                                    step="0.1"
                                    min="0.5"
                                    max="2"
                                    value={adj.fontSizeScale || 1}
                                    onChange={(e) => update('fontSizeScale', parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-luvin-pink/20 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Custom Note</label>
                            <textarea 
                                value={adj.customNote || ''}
                                onChange={(e) => update('customNote', e.target.value)}
                                placeholder="Ghi chú về background..."
                                rows={2}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-luvin-pink/20 outline-none resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Positioning */}
                <div>
                    {sectionTitle("Precise Positioning")}
                    {controlGroup("Branding Unit", adj.brandingY, "brandingY", -200, 300)}
                    {controlGroup("Product Frame", adj.imageY, "imageY", -300, 500)}
                    {controlGroup("Image Scale", adj.imageScale, "imageScale", 0.5, 2.5, 0.05)}
                    {controlGroup("Content Unit", adj.contentY, "contentY", -300, 300)}
                    {controlGroup("Price Badge", adj.priceY, "priceY", -200, 600)}
                    {controlGroup("Info Note", adj.noteY, "noteY", -200, 300)}
                </div>

                {/* 4. Colors */}
                <div>
                    {sectionTitle("Themes & Colors")}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Background</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={adj.backgroundColor || '#FFFFFF'} onChange={(e) => update('backgroundColor', e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
                                <span className="text-[8px] font-mono text-gray-400 uppercase">{adj.backgroundColor || 'Def'}</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Text Color</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={adj.textColor || '#111827'} onChange={(e) => update('textColor', e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
                                <span className="text-[8px] font-mono text-gray-400 uppercase">{adj.textColor || 'Def'}</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Accent Color</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={adj.accentColor || '#E91E63'} onChange={(e) => update('accentColor', e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
                                <span className="text-[8px] font-mono text-gray-400 uppercase">{adj.accentColor || 'Def'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Visibility */}
                <div>
                    {sectionTitle("Visibility Settings")}
                    <div className="space-y-1">
                        {toggle("Hide Branding", "hideBranding")}
                        {toggle("Hide Price", "hidePrice")}
                        {toggle("Hide Info Note", "hideNote")}
                        {toggle("Hide Technical Specs", "hideSpecs")}
                    </div>
                </div>
            </div>
        </div>
    );
};
