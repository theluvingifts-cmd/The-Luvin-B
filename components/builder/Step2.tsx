
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
            <div className="w-full aspect-[4/5] rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center relative border border-gray-100/50">
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
                    <div className="absolute top-1 right-1 bg-luvin-pink text-white rounded-full p-0.5 shadow-sm z-20">
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

  const categories = useMemo(() => ['Tất cả', ...Array.from(new Set(backgrounds.map(bg => bg.category)))], [backgrounds]);

  const filteredBackgrounds = useMemo(() => {
    return selectedCategory === 'Tất cả' ? backgrounds : backgrounds.filter(bg => bg.category === selectedCategory);
  }, [selectedCategory, backgrounds]);

  const currentBg = backgrounds.find(bg => bg.url === config.background.value);

  // Phân loại fields: Trường văn bản và Trường ảnh
  const activeFields = useMemo((): FormField[] => {
    if (currentBg?.formFields && currentBg.formFields.length > 0) {
        return currentBg.formFields;
    }
    return [
        { id: 'names', label: 'Tên / Lời tựa ngắn', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
        { id: 'date', label: 'Ngày kỷ niệm (nếu có)', type: 'date', required: false },
        { id: 'message', label: 'Lời chúc của bạn', type: 'textarea', required: false, placeholder: 'Nhập nội dung muốn in lên tranh...' },
        { id: 'photo', label: 'Thay/Thêm ảnh', type: 'image', required: false },
    ];
  }, [currentBg]);

  const textFields = useMemo(() => activeFields.filter(f => f.type !== 'image'), [activeFields]);
  const imageFields = useMemo(() => activeFields.filter(f => f.type === 'image'), [activeFields]);

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
        isRotated: bg.orientation === 'landscape'
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
              priority={idx < 10} 
            />
          ))}
        </div>
      </div>

      <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm">
        <h4 className="font-bold text-gray-800 mb-5 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            2. Thông tin in ấn
        </h4>
        
        <div className="space-y-6">
            {/* PHẦN NHẬP CHỮ */}
            {textFields.length > 0 && (
                <div className="space-y-4">
                    {textFields.map(field => (
                        <div key={field.id} className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight ml-1 flex justify-between">
                                {field.label}
                                {field.required && <span className="text-red-500">*</span>}
                            </label>
                            {field.type === 'textarea' ? (
                                <textarea 
                                    placeholder={field.placeholder}
                                    rows={3}
                                    value={config.customFormData?.[field.id] || ''}
                                    onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none transition-all font-medium"
                                />
                            ) : (
                                <input 
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    value={config.customFormData?.[field.id] || ''}
                                    onChange={(e) => handleUpdateFormData(field.id, e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none transition-all font-medium"
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* PHẦN THAY/THÊM ẢNH (DẠNG GRID Ô VUÔNG) */}
            {imageFields.length > 0 && (
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight ml-1">
                        Thay/Thêm ảnh ({imageFields.length} ảnh yêu cầu)
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                        {imageFields.map((field, idx) => {
                            const hasImage = !!config.customFormData?.[field.id];
                            return (
                                <div key={field.id} className="flex flex-col gap-1">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = (e) => handleImageFieldUpload(field.id, e as any);
                                            input.click();
                                        }}
                                        className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center relative overflow-hidden group ${
                                            hasImage ? 'border-luvin-pink' : 'border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
                                        }`}
                                        title={field.label}
                                    >
                                        {hasImage ? (
                                            <>
                                                <img src={config.customFormData![field.id]} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <span className="text-[8px] text-white font-bold uppercase">Sửa</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            </div>
                                        )}
                                    </button>
                                    <span className="text-[8px] text-center text-gray-400 font-bold uppercase truncate">{field.label.replace('Thay/Thêm ảnh', '').trim() || `Ảnh ${idx + 1}`}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
        
        <p className="text-[10px] text-gray-400 mt-6 italic leading-tight bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
            * Các thông tin trên sẽ được <b>Designer chuyên nghiệp</b> tại The Luvin căn chỉnh font chữ & bố cục đẹp nhất cho bạn sau khi nhận đơn.
        </p>
      </div>
    </div>
  );
};
