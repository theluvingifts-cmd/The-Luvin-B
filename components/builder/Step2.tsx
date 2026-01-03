
import React, { useRef, useState, useMemo, useEffect } from 'react';
import type { FrameConfig, PresetBackground, FrameOption, FormField } from '../../types';
import { ZoomIcon } from '../ZoomIcon';
import { getEffectivePrice, formatCurrency } from '../../utils/pricing';

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
                        {...(priority ? { fetchpriority: "high" } : {})}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error'; }}
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
  setConfig: (c: FrameConfig) => void;
  backgrounds: PresetBackground[];
  frames: FrameOption[];
  onZoomImage: (url: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  preferredSquareFrameId: string;
}> = ({ config, setConfig, backgrounds, frames, onZoomImage, showToast, preferredSquareFrameId }) => {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['Tất cả', ...Array.from(new Set(backgrounds.map(bg => bg.category)))], [backgrounds]);

  const filteredBackgrounds = useMemo(() => {
    return selectedCategory === 'Tất cả' ? backgrounds : backgrounds.filter(bg => bg.category === selectedCategory);
  }, [selectedCategory, backgrounds]);

  const currentBg = backgrounds.find(bg => bg.url === config.background.value);

  // Auto-generate fields if none defined on the background object
  const activeFields = useMemo((): FormField[] => {
    if (currentBg?.formFields && currentBg.formFields.length > 0) return currentBg.formFields;
    
    // Default generic fields for any template
    return [
        { id: 'names', label: 'Tên / Lời tựa ngắn', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
        { id: 'date', label: 'Ngày kỷ niệm (nếu có)', type: 'date', required: false },
        { id: 'message', label: 'Thông điệp của bạn', type: 'textarea', required: false, placeholder: 'Nhập lời nhắn gửi đến người nhận...' },
        { id: 'photo', label: 'Đính kèm ảnh in thêm', type: 'image', required: false },
    ];
  }, [currentBg]);

  const handleUpdateFormData = (fieldId: string, value: string) => {
    setConfig({
        ...config,
        customFormData: {
            ...(config.customFormData || {}),
            [fieldId]: value
        }
    });
  };

  const handleImageFieldUpload = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') handleUpdateFormData(fieldId, reader.result);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleBackgroundSelect = (bg: PresetBackground) => {
    const isColor = bg.url.startsWith('#');
    let newFrameId = config.frameId;

    const currentFrameOption = frames.find(f => f.id === config.frameId);
    const isCurrentFrameSquare = currentFrameOption ? Math.abs(currentFrameOption.frameWidthCm - currentFrameOption.frameHeightCm) < 1 : true;

    if (bg.type === 'rectangle' && isCurrentFrameSquare) {
        const rectFrame = frames.find(f => Math.abs(f.frameWidthCm - f.frameHeightCm) > 1 && f.stock !== 0) || frames.find(f => f.id === 'md');
        if (rectFrame) newFrameId = rectFrame.id;
    } else if (bg.type === 'square' && !isCurrentFrameSquare) {
        const squareFrame = frames.find(f => f.id === preferredSquareFrameId) || frames.find(f => f.id === 'lg');
        if (squareFrame) newFrameId = squareFrame.id;
    }

    setConfig({ 
        ...config, 
        frameId: newFrameId,
        background: { type: isColor ? 'color' : 'image', value: bg.url },
        isRotated: bg.orientation === 'landscape',
        // FIX: Giữ nguyên các mảng deco (charms, text, shapes) để khách hàng không bị mất tiến trình
        // Không gọi reset: texts: [], draggableItems: [], shapes: []
    });
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
              key={bg.id}
              bg={bg}
              isSelected={config.background.value === bg.url}
              onClick={() => handleBackgroundSelect(bg)}
              onZoom={onZoomImage}
              priority={idx < 10} // Ưu tiên load nhanh 10 ảnh nền đầu tiên
            />
          ))}
        </div>
      </div>

      <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm animate-fade-in">
        <h4 className="font-bold text-gray-800 mb-4 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-50"></span>
            2. Nhập thông tin in ấn
        </h4>
        
        <div className="space-y-4">
            {activeFields.map(field => (
                <div key={field.id} className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight ml-1 flex justify-between">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                    </label>
                    
                    {field.type === 'text' && (
                        <input 
                            type="text" 
                            placeholder={field.placeholder}
                            value={config.customFormData?.[field.id] || ''}
                            onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none transition-all font-medium"
                        />
                    )}

                    {field.type === 'date' && (
                        <input 
                            type="date" 
                            value={config.customFormData?.[field.id] || ''}
                            onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink outline-none transition-all font-medium"
                        />
                    )}

                    {field.type === 'textarea' && (
                        <textarea 
                            placeholder={field.placeholder}
                            rows={3}
                            value={config.customFormData?.[field.id] || ''}
                            onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink outline-none transition-all font-medium"
                        ></textarea>
                    )}

                    {field.type === 'image' && (
                        <div className="flex gap-3 items-center">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 p-2.5 bg-white border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {config.customFormData?.[field.id] ? 'Đã tải ảnh lên' : 'Tải ảnh đính kèm'}
                            </button>
                            {config.customFormData?.[field.id] && (
                                <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden shadow-sm relative group">
                                    <img src={config.customFormData[field.id]} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => handleUpdateFormData(field.id, '')}
                                        className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold"
                                    >
                                        Xóa
                                    </button>
                                </div>
                            )}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={(e) => handleImageFieldUpload(field.id, e)} 
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
        
        <p className="text-[10px] text-gray-400 mt-5 italic leading-tight bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
            * Các thông tin trên sẽ được <b>Designer chuyên nghiệp</b> tại The Luvin căn chỉnh font chữ & bố cục đẹp nhất cho bạn sau khi nhận đơn.
        </p>
      </div>
    </div>
  );
};
