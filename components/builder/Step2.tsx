import React, { useRef, useState, useMemo } from 'react';
import type { FrameConfig, PresetBackground, FrameOption, FormField } from '../../types';
import { ZoomIcon } from '../ZoomIcon';

const PresetBackgroundButton: React.FC<{
    bg: PresetBackground;
    isSelected: boolean;
    onClick: () => void;
    onZoom: (url: string) => void;
    priority?: boolean;
}> = ({ bg, isSelected, onClick, onZoom, priority }) => {
    const imageSrc = bg.previewUrl || bg.url;
    const isColor = imageSrc.startsWith('#');
    
    return (
        <button
            onClick={onClick}
            className={`border-2 rounded-xl p-1 flex flex-col items-center justify-start transition-all text-center w-full relative group ${
                isSelected
                    ? 'border-luvin-pink bg-pink-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
        >
            <div className="w-full aspect-[4/5] rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center relative border border-gray-100">
                {isColor ? (
                    <div className="w-full h-full" style={{ backgroundColor: imageSrc }}></div>
                ) : (
                    <img
                        src={imageSrc}
                        alt={bg.name}
                        className="w-full h-full object-cover"
                        loading={priority ? "eager" : "lazy"}
                    />
                )}
                {isSelected && (
                    <div className="absolute top-1 right-1 bg-luvin-pink text-white rounded-full p-0.5 shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                )}
                <div 
                    className="absolute bottom-1 right-1 z-10 bg-black/40 text-white p-1 rounded-full cursor-pointer hover:bg-black/60 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onZoom(imageSrc); }}
                >
                    <ZoomIcon className="w-3 h-3" />
                </div>
            </div>
            <span className="text-[10px] font-bold text-gray-700 py-1.5 truncate w-full px-1">{bg.name}</span>
        </button>
    );
};

export const Step2BackgroundAndDecorations: React.FC<{
  config: FrameConfig;
  // Fix: Changed setConfig type to support functional updates (prev => ...)
  setConfig: (fn: (prev: FrameConfig) => FrameConfig) => void;
  backgrounds: PresetBackground[];
  frames: FrameOption[];
  onZoomImage: (url: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  preferredSquareFrameId: string;
}> = ({ config, setConfig, backgrounds, frames, onZoomImage, showToast, preferredSquareFrameId }) => {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const categories = useMemo(() => ['Tất cả', ...Array.from(new Set(backgrounds.map(bg => bg.category)))], [backgrounds]);

  const filteredBackgrounds = useMemo(() => {
    return selectedCategory === 'Tất cả' ? backgrounds : backgrounds.filter(bg => bg.category === selectedCategory);
  }, [selectedCategory, backgrounds]);

  const currentBg = backgrounds.find(bg => bg.url === config.background.value);

  const activeFields = useMemo((): FormField[] => {
    if (currentBg?.formFields && currentBg.formFields.length > 0) return currentBg.formFields;
    return [
        { id: 'names', label: 'Tên / Lời tựa', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
        { id: 'message', label: 'Thông điệp của bạn', type: 'textarea', required: false, placeholder: 'Nhập lời nhắn gửi đến người nhận...' },
        { id: 'photo', label: 'Tải ảnh cá nhân (nếu có)', type: 'image', required: false, placeholder: 'Tải ảnh của bạn để shop in Polaroid', limit: 1 },
    ];
  }, [currentBg]);

  const handleUpdateFormData = (fieldId: string, value: string | string[]) => {
    // Fix: Use functional update to ensure data consistency
    setConfig(prev => ({
        ...prev,
        customFormData: { ...(prev.customFormData || {}), [fieldId]: value }
    }));
  };

  const handleImageUpload = (fieldId: string, limit: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Get current images for this field
    const currentValues = (config.customFormData?.[fieldId] as string[]) || [];
    
    if (currentValues.length + files.length > limit) {
        showToast(`Trường này chỉ cho phép tối đa ${limit} ảnh`, 'error');
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                // Fix: Functional update for setConfig to avoid stale closure issues
                setConfig(prev => {
                    const existingImages = (prev.customFormData?.[fieldId] as string[]) || [];
                    return {
                        ...prev,
                        customFormData: {
                            ...(prev.customFormData || {}),
                            [fieldId]: [...existingImages, reader.result as string]
                        }
                    };
                });
            }
        };
        reader.readAsDataURL(file);
    });
  };

  const removeImage = (fieldId: string, index: number) => {
    const currentImages = (config.customFormData?.[fieldId] as string[]) || [];
    const updatedImages = currentImages.filter((_, i) => i !== index);
    handleUpdateFormData(fieldId, updatedImages);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      <div className="bg-white p-4 border border-gray-100 rounded-2xl shadow-sm">
        <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-luvin-pink"></span>
            1. Chọn mẫu nền
        </h4>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
            {categories.map(category => (
                <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex-shrink-0 px-4 py-1.5 text-[10px] rounded-full font-bold transition-all ${
                        selectedCategory === category ? 'bg-luvin-pink text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                >
                    {category}
                </button>
            ))}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
          {filteredBackgrounds.map((bg, idx) => (
            <PresetBackgroundButton
              key={bg.id} bg={bg}
              isSelected={config.background.value === bg.url}
              onClick={() => setConfig(prev => ({...prev, background: { type: bg.url.startsWith('#') ? 'color' : 'image', value: bg.url }}))}
              onZoom={onZoomImage} priority={idx < 10}
            />
          ))}
        </div>
      </div>

      <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm">
        <h4 className="font-bold text-gray-800 mb-4 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            2. Nhập thông tin in ấn
        </h4>
        
        <div className="space-y-4">
            {activeFields.map(field => (
                <div key={field.id} className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight ml-1 flex justify-between">
                        <span>{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                        {field.type === 'image' && <span className="text-blue-500 lowercase">(Tối đa {field.limit || 1} ảnh)</span>}
                    </label>
                    
                    {field.type === 'text' && (
                        <input 
                            type="text" placeholder={field.placeholder}
                            value={config.customFormData?.[field.id] as string || ''}
                            onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink outline-none transition-all font-medium"
                        />
                    )}

                    {field.type === 'textarea' && (
                        <textarea 
                            placeholder={field.placeholder} rows={3}
                            value={config.customFormData?.[field.id] as string || ''}
                            onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink outline-none transition-all font-medium"
                        ></textarea>
                    )}

                    {field.type === 'date' && (
                        <input 
                            type="date" 
                            value={config.customFormData?.[field.id] as string || ''}
                            onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink outline-none font-medium"
                        />
                    )}

                    {field.type === 'image' && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {((config.customFormData?.[field.id] as string[]) || []).map((img, idx) => (
                                    <div key={idx} className="relative w-16 h-16 rounded-lg border overflow-hidden group">
                                        <img src={img} className="w-full h-full object-cover" />
                                        <button 
                                            type="button"
                                            onClick={() => removeImage(field.id, idx)}
                                            className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold"
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                ))}
                                
                                {((config.customFormData?.[field.id] as string[]) || []).length < (field.limit || 1) && (
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRefs.current[field.id]?.click()}
                                        className="w-16 h-16 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 transition-colors"
                                    >
                                        <span className="text-xl text-gray-400">+</span>
                                        <span className="text-[8px] text-gray-400 font-bold uppercase">Tải ảnh</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-blue-500 font-medium italic opacity-80">{field.placeholder}</p>
                            {/* Fix: Wrap ref assignment in braces to avoid returning HTMLInputElement */}
                            <input 
                                type="file" ref={el => { fileInputRefs.current[field.id] = el; }}
                                className="hidden" accept="image/*" multiple
                                onChange={(e) => handleImageUpload(field.id, field.limit || 1, e)} 
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
        
        <div className="mt-5 p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl">
             <p className="text-[10px] text-blue-900 leading-relaxed font-medium">
                * Sau khi nhận đơn, <b>Designer chuyên nghiệp</b> sẽ trực tiếp căn chỉnh lại bố cục, phông chữ đẹp nhất và gửi ảnh mẫu cho bạn duyệt trước khi in.
             </p>
        </div>
      </div>
    </div>
  );
};