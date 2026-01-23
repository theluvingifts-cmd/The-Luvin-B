
import React, { useRef, useState, useMemo } from 'react';
import type { FrameConfig, PresetBackground, FrameOption, FormField } from '../../types';
import { ZoomIcon } from '../ZoomIcon';
import { resizeImage } from '../../utils/helpers';
import { SmartImage } from '../shared/SmartImage';

const PresetBackgroundButton: React.FC<{
    bg: PresetBackground;
    isSelected: boolean;
    onClick: () => void;
    onZoom: (url: string) => void;
    priority?: boolean;
}> = ({ bg, isSelected, onClick, onZoom, priority }) => {
    const imageSrc = bg.previewUrl || bg.url;
    return (
        <button onClick={onClick} className={`border-2 rounded-xl p-1 flex flex-col items-center transition-all w-full relative ${isSelected ? 'border-luvin-pink bg-pink-50 shadow-sm' : 'border-gray-200 bg-white'}`}>
            <div className="w-full aspect-[4/5] rounded-lg bg-gray-100 overflow-hidden relative">
                <SmartImage src={imageSrc} alt={bg.name} loading={priority ? "eager" : "lazy"} className="w-full h-full" />
                <div className="absolute bottom-1 right-1 z-10 bg-black/40 text-white p-1 rounded-full cursor-pointer" onClick={(e) => { e.stopPropagation(); onZoom(imageSrc); }}><ZoomIcon className="w-3 h-3" /></div>
            </div>
            <span className="text-[9px] font-bold text-gray-700 py-1 truncate w-full px-1 uppercase">{bg.name}</span>
        </button>
    );
};

export const Step2BackgroundAndDecorations: React.FC<{
  config: FrameConfig;
  setConfig: (c: FrameConfig) => void;
  backgrounds: PresetBackground[];
  frames: FrameOption[];
  onZoomImage: (url: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  preferredSquareFrameId: string;
}> = ({ config, setConfig, backgrounds, frames, onZoomImage, showToast, preferredSquareFrameId }) => {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const manualBgInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['Tất cả', ...Array.from(new Set(backgrounds.map(bg => bg.category)))], [backgrounds]);
  const filteredBackgrounds = useMemo(() => selectedCategory === 'Tất cả' ? backgrounds : backgrounds.filter(bg => bg.category === selectedCategory), [selectedCategory, backgrounds]);
  
  const currentBg = backgrounds.find(bg => bg.url === config.background.value);

  const activeFields = useMemo((): FormField[] => {
    if (config.formFields && config.formFields.length > 0) return config.formFields;
    if (currentBg?.formFields && currentBg.formFields.length > 0) return currentBg.formFields;
    return [];
  }, [currentBg, config.formFields]);

  const handleUpdateFormData = (fieldId: string, value: string) => {
    const newFormData = { ...(config.customFormData || {}), [fieldId]: value };
    
    let displayValue = value;
    if (value && value.includes('-') && value.length === 10) {
        const p = value.split('-');
        displayValue = `${p[2]}/${p[1]}/${p[0]}`;
    }

    const updatedTexts = config.texts.map(t => {
        if (t.linkedFieldId === fieldId) {
            return { ...t, content: displayValue || ' ' };
        }
        return t;
    });

    setConfig({ 
        ...config, 
        customFormData: newFormData,
        texts: updatedTexts
    });
  };

  const handleBackgroundSelect = (bg: PresetBackground) => {
    const isColor = bg.url.startsWith('#');
    let newFrameId = config.frameId;
    if (bg.type === 'rectangle' && (config.frameId === 'lg' || config.frameId === 'sm')) {
        newFrameId = 'md';
    }

    const overlayTexts = (bg.overlayConfig?.texts || []).map(t => {
        if (t.linkedFieldId && config.customFormData?.[t.linkedFieldId]) {
            let val = config.customFormData[t.linkedFieldId];
            if (val.includes('-')) {
                const p = val.split('-');
                val = `${p[2]}/${p[1]}/${p[0]}`;
            }
            return { ...t, content: val };
        }
        return t;
    });

    setConfig({ 
        ...config, 
        frameId: newFrameId,
        background: { type: isColor ? 'color' : 'image', value: bg.url },
        isRotated: bg.orientation === 'landscape',
        formFields: bg.formFields || [],
        texts: overlayTexts,
        draggableItems: bg.overlayConfig?.draggableItems || [],
        shapes: bg.overlayConfig?.shapes || []
    });
  };

  const handleManualBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsProcessingImage(true);
        try {
            const resized = await resizeImage(file, 1200, 1200);
            setConfig({
                ...config,
                background: { type: 'upload', value: resized },
                // Khi khách tự up ảnh, xóa các text overlay của mẫu cũ để tránh đè chữ lung tung
                texts: config.texts.filter(t => t.linkedFieldId), // Chỉ giữ lại các text liên kết với form
                draggableItems: [],
                shapes: []
            });
            showToast("Đã tải ảnh nền của bạn!", "success");
        } catch (error) {
            showToast("Lỗi xử lý ảnh", "error");
        } finally {
            setIsProcessingImage(false);
        }
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* SECTION 1: PRESET BACKGROUNDS */}
      <div className="bg-white p-4 border border-gray-100 rounded-2xl shadow-sm">
        <h4 className="font-bold text-gray-800 mb-4 uppercase tracking-wider text-[11px]">1. CHỌN MẪU NỀN</h4>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
            {categories.map(category => (
                <button key={category} onClick={() => setSelectedCategory(category)} className={`flex-shrink-0 px-3 py-1 text-[10px] rounded-full font-bold transition-all ${selectedCategory === category ? 'bg-luvin-pink text-white' : 'bg-gray-100 text-gray-500'}`}>{category}</button>
            ))}
        </div>
        <div className="grid grid-cols-4 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
          {filteredBackgrounds.map(bg => (
            <PresetBackgroundButton key={bg.id} bg={bg} isSelected={config.background.value === bg.url} onClick={() => handleBackgroundSelect(bg)} onZoom={onZoomImage} />
          ))}
        </div>
        
        {/* MANUAL UPLOAD AREA - KHÔI PHỤC THEO YÊU CẦU CỦA BỐ */}
        <div className="mt-4 pt-4 border-t border-dashed border-gray-100">
            <input type="file" ref={manualBgInputRef} className="hidden" accept="image/*" onChange={handleManualBgUpload} />
            <button 
                onClick={() => manualBgInputRef.current?.click()}
                disabled={isProcessingImage}
                className={`w-full py-3 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2 ${config.background.type === 'upload' ? 'border-luvin-pink bg-pink-50 text-luvin-pink' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
            >
                {isProcessingImage ? (
                    <span className="text-xs font-bold animate-pulse">Đang xử lý ảnh...</span>
                ) : (
                    <>
                        <span className="text-xl">☁️</span>
                        <span className="text-[11px] font-black uppercase tracking-tight">
                            {config.background.type === 'upload' ? 'Thay ảnh nền khác' : 'Tải ảnh nền của riêng bạn'}
                        </span>
                    </>
                )}
            </button>
            {config.background.type === 'upload' && (
                <p className="text-[9px] text-center text-gray-400 mt-2 italic">* Bạn đang sử dụng ảnh nền tự tải lên</p>
            )}
        </div>
      </div>

      {/* SECTION 2: PRINT INFO FORM */}
      <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm">
        <h4 className="font-bold text-gray-800 mb-4 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 2. NHẬP THÔNG TIN IN ẤN
        </h4>
        <div className="space-y-4">
            {activeFields.length > 0 ? activeFields.map(field => (
                <div key={field.id} className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === 'text' && (
                        <input type="text" placeholder={field.placeholder} value={config.customFormData?.[field.id] || ''} onChange={(e) => handleUpdateFormData(field.id, e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-luvin-pink" />
                    )}
                    {field.type === 'textarea' && (
                        <textarea placeholder={field.placeholder} rows={2} value={config.customFormData?.[field.id] || ''} onChange={(e) => handleUpdateFormData(field.id, e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-luvin-pink" />
                    )}
                    {field.type === 'date' && (
                        <input type="date" value={config.customFormData?.[field.id] || ''} onChange={(e) => handleUpdateFormData(field.id, e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-luvin-pink" />
                    )}
                    {field.type === 'image' && (
                        <input type="file" accept="image/*" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const resized = await resizeImage(file, 800, 800);
                                handleUpdateFormData(field.id, resized);
                            }
                        }} className="w-full text-xs" />
                    )}
                </div>
            )) : (
                <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                    <p className="text-xs text-gray-400 italic font-medium">Mẫu này không có ô nhập liệu.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
