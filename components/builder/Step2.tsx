
import React, { useRef, useState, useMemo } from 'react';
import type { FrameConfig, PresetBackground, FrameOption, FormField } from '../../types';
import { ZoomIcon } from '../ZoomIcon';
import { resizeImage } from '../../utils/helpers';
import { SmartImage } from '../shared/SmartImage';
import { useLanguage } from '../../src/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState(t('studio.all'));
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const manualBgInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => [t('studio.all'), ...Array.from(new Set(backgrounds.map(bg => bg.category)))], [backgrounds, t]);
  const filteredBackgrounds = useMemo(() => selectedCategory === t('studio.all') ? backgrounds : backgrounds.filter(bg => bg.category === selectedCategory), [selectedCategory, backgrounds, t]);
  
  const currentBg = backgrounds.find(bg => bg.url === config.background.value);

  const activeFields = useMemo((): FormField[] => {
    if (config.formFields && config.formFields.length > 0) return config.formFields;
    if (currentBg?.formFields && currentBg.formFields.length > 0) return currentBg.formFields;
    return [];
  }, [currentBg, config.formFields]);

  const handleUpdateFormData = (fieldId: string, value: string) => {
    const newFormData = { ...(config.customFormData || {}), [fieldId]: value };
    
    let displayValue = value;
    // Format date if it's a date string (YYYY-MM-DD)
    if (value && value.includes('-') && value.split('-').length === 3 && value.length === 10) {
        const p = value.split('-');
        displayValue = `${p[2]}/${p[1]}/${p[0]}`;
    }

    const updatedTexts = config.texts.map(t => {
        if (t.linkedFieldId === fieldId) {
            const field = activeFields.find(f => f.id === fieldId);
            if (field?.type === 'color') {
                return { ...t, color: value };
            }
            return { ...t, content: displayValue || ' ' };
        }
        return t;
    });

    const updatedDraggableItems = (config.draggableItems || []).map(item => {
        if (item.linkedFieldId === fieldId) {
            const field = activeFields.find(f => f.id === fieldId);
            if (field?.type === 'image') {
                return { ...item, partId: value };
            }
        }
        return item;
    });

    const updatedShapes = (config.shapes || []).map(s => {
        if (s.linkedFieldId === fieldId) {
            const field = activeFields.find(f => f.id === fieldId);
            if (field?.type === 'color') {
                return { ...s, fillColor: value };
            }
        }
        return s;
    });

    setConfig({ 
        ...config, 
        customFormData: newFormData,
        texts: updatedTexts,
        draggableItems: updatedDraggableItems,
        shapes: updatedShapes
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
            if (val.includes('-') && val.split('-').length === 3 && val.length === 10) {
                const p = val.split('-');
                val = `${p[2]}/${p[1]}/${p[0]}`;
            }
            return { ...t, content: val };
        }
        return t;
    });

    const overlayDraggableItems = (bg.overlayConfig?.draggableItems || []).map(item => {
        if (item.linkedFieldId && config.customFormData?.[item.linkedFieldId]) {
            return { ...item, partId: config.customFormData[item.linkedFieldId] };
        }
        return item;
    });

    const overlayShapes = (bg.overlayConfig?.shapes || []).map(s => {
        if (s.linkedFieldId && config.customFormData?.[s.linkedFieldId]) {
            return { ...s, fillColor: config.customFormData[s.linkedFieldId] };
        }
        return s;
    });

    setConfig({ 
        ...config, 
        frameId: newFrameId,
        background: { type: isColor ? 'color' : 'image', value: bg.url },
        isRotated: bg.orientation === 'landscape',
        formFields: bg.formFields || [],
        texts: overlayTexts,
        draggableItems: overlayDraggableItems,
        shapes: overlayShapes
    });
  };

  const handleManualBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        // Giới hạn kích thước ảnh 10MB cho ảnh nền
        if (file.size > 10 * 1024 * 1024) {
            showToast(t('studio.image_too_large') || 'Ảnh quá lớn (tối đa 10MB)', 'error');
            return;
        }
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
            showToast(t("studio.background_uploaded"), "success");
        } catch (error) {
            showToast(t("studio.image_processing_error"), "error");
        } finally {
            setIsProcessingImage(false);
        }
    }
  };

  const isFieldLinked = (fieldId: string) => {
      return config.texts.some(t => t.linkedFieldId === fieldId) || 
             config.draggableItems.some(i => i.linkedFieldId === fieldId) ||
             config.shapes.some(s => s.linkedFieldId === fieldId);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* SECTION 1: PRESET BACKGROUNDS */}
      <div className="bg-white p-4 border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">{t('studio.select_background')}</h4>
            <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                {t('studio.templates_count', { count: filteredBackgrounds.length })}
            </span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
            {categories.map(category => (
                <button 
                    key={category} 
                    onClick={() => setSelectedCategory(category)} 
                    className={`flex-shrink-0 px-4 py-1.5 text-[10px] rounded-full font-black transition-all uppercase tracking-tight ${selectedCategory === category ? 'bg-luvin-pink text-white shadow-md shadow-pink-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    {category}
                </button>
            ))}
        </div>
        <div className="grid grid-cols-4 gap-2.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
          {filteredBackgrounds.map(bg => (
            <PresetBackgroundButton key={bg.id} bg={bg} isSelected={config.background.value === bg.url} onClick={() => handleBackgroundSelect(bg)} onZoom={onZoomImage} />
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-dashed border-gray-100">
            <input type="file" ref={manualBgInputRef} className="hidden" accept="image/*" onChange={handleManualBgUpload} />
            <button 
                onClick={() => manualBgInputRef.current?.click()}
                disabled={isProcessingImage}
                className={`w-full py-3.5 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2.5 ${config.background.type === 'upload' ? 'border-luvin-pink bg-pink-50 text-luvin-pink' : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'}`}
            >
                {isProcessingImage ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-luvin-pink border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[11px] font-black uppercase">{t('studio.processing_image')}</span>
                    </div>
                ) : (
                    <>
                        <span className="text-xl">📸</span>
                        <span className="text-[11px] font-black uppercase tracking-tight">
                            {config.background.type === 'upload' ? t('studio.change_background') : t('studio.upload_own_background')}
                        </span>
                    </>
                )}
            </button>
            {config.background.type === 'upload' && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-[9px] text-gray-400 italic font-medium">{t('studio.using_uploaded_bg')}</p>
                </div>
            )}
        </div>
      </div>

      {/* SECTION 2: PRINT INFO FORM */}
      <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20"></div>
        <div className="flex justify-between items-center mb-5">
            <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span> 
                {t('studio.enter_print_info')}
            </h4>
            {activeFields.length > 0 && (
                <button 
                    onClick={() => setConfig({ ...config, customFormData: {} })}
                    className="text-[9px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-tighter transition-colors"
                >
                    {t('studio.clear_all')}
                </button>
            )}
        </div>

        <div className="space-y-5">
            {activeFields.length > 0 ? activeFields.map(field => {
                const isLinked = isFieldLinked(field.id);
                return (
                    <div key={field.id} className="space-y-1.5 group">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1 flex items-center gap-1.5">
                                {field.label} 
                                {field.required && <span className="text-red-500 text-xs">*</span>}
                                {isLinked && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[8px] font-bold border border-green-100 animate-pulse">
                                        <span className="w-1 h-1 rounded-full bg-green-500"></span>
                                        LIVE
                                    </span>
                                )}
                            </label>
                            {field.helpText && (
                                <span className="text-[9px] text-gray-400 italic font-medium">{field.helpText}</span>
                            )}
                        </div>

                        <div className="relative">
                            {field.type === 'text' && (
                                <input 
                                    type="text" 
                                    placeholder={field.placeholder || t('studio.enter_field', { field: field.label.toLowerCase() })} 
                                    value={config.customFormData?.[field.id] || ''} 
                                    onChange={(e) => handleUpdateFormData(field.id, e.target.value)} 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            )}
                            {field.type === 'textarea' && (
                                <textarea 
                                    placeholder={field.placeholder || t('studio.enter_field', { field: field.label.toLowerCase() })} 
                                    rows={2} 
                                    value={config.customFormData?.[field.id] || ''} 
                                    onChange={(e) => handleUpdateFormData(field.id, e.target.value)} 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none" 
                                />
                            )}
                            {field.type === 'date' && (
                                <input 
                                    type="date" 
                                    value={config.customFormData?.[field.id] || ''} 
                                    onChange={(e) => handleUpdateFormData(field.id, e.target.value)} 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            )}
                            {field.type === 'number' && (
                                <input 
                                    type="number" 
                                    min={field.min}
                                    max={field.max}
                                    step={field.step}
                                    placeholder={field.placeholder}
                                    value={config.customFormData?.[field.id] || ''} 
                                    onChange={(e) => handleUpdateFormData(field.id, e.target.value)} 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            )}
                            {field.type === 'select' && (
                                <select 
                                    value={config.customFormData?.[field.id] || ''} 
                                    onChange={(e) => handleUpdateFormData(field.id, e.target.value)} 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">{t('studio.select_field', { field: field.label.toLowerCase() })}</option>
                                    {field.options?.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            )}
                            {field.type === 'color' && (
                                <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                                    <input 
                                        type="color" 
                                        value={config.customFormData?.[field.id] || '#000000'} 
                                        onChange={(e) => handleUpdateFormData(field.id, e.target.value)} 
                                        className="w-10 h-10 rounded-lg border-none cursor-pointer bg-transparent" 
                                    />
                                    <span className="text-xs font-mono text-gray-500 uppercase">{config.customFormData?.[field.id] || '#000000'}</span>
                                </div>
                            )}
                            {field.type === 'image' && (
                                <div className="flex flex-col gap-2">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const resized = await resizeImage(file, 800, 800);
                                                handleUpdateFormData(field.id, resized);
                                            }
                                        }} 
                                        className="hidden" 
                                        id={`file-${field.id}`}
                                    />
                                    <label 
                                        htmlFor={`file-${field.id}`}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-100 transition-all border-dashed"
                                    >
                                        <span className="text-lg">🖼️</span>
                                        <span className="text-xs font-bold text-gray-600">
                                            {config.customFormData?.[field.id] ? t('studio.change_image') : t('studio.select_upload_image')}
                                        </span>
                                    </label>
                                    {config.customFormData?.[field.id] && (
                                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                                            <img src={config.customFormData[field.id]} alt="Preview" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleUpdateFormData(field.id, '')}
                                                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {field.type === 'select' && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }) : (
                <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <span className="text-xl">📝</span>
                    </div>
                    <p className="text-[11px] text-gray-400 italic font-bold uppercase tracking-tight">{t('studio.no_custom_fields')}</p>
                    <p className="text-[9px] text-gray-300 mt-1">{t('studio.add_text_directly')}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
