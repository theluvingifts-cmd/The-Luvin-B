
// ... (Previous imports)
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Page, FrameConfig, LegoPart, DraggableItem, TextConfig, LegoCharacterConfig, OutfitColor, PresetBackground, FrameOption } from '../types';
import { 
    FRAME_OPTIONS, 
    LEGO_PARTS, 
    defaultShirtColors,
    defaultPantsColors,
} from '../constants';
import FramePreview from '../components/FramePreview';
import { uploadToCloudinary } from '../services/uploadService';
import { calculatePrice, formatCurrency, CHARACTER_BASE_PRICE, FREE_SHIPPING_THRESHOLD, getEffectivePrice, PriceBreakdownItem } from '../utils/pricing';
import { ZoomIcon } from '../components/ZoomIcon';
import { getAllOrders } from '../services/orderService';

declare var html2canvas: any;

// ... (StepIndicator, Step1Frame components remain the same) ...
// (Retaining StepIndicator and Step1Frame fully as they are mostly unchanged)

const StepIndicator: React.FC<{ currentStep: number; setStep: (step: number) => void }> = ({ currentStep, setStep }) => {
  const steps = ['Thông tin SP', 'Nền & Chữ', 'Thiết kế', 'Mua hàng'];
  
  return (
    <div id="builder-step-indicator" className="w-full max-w-3xl mx-auto md:mx-0 my-6 px-2 scroll-mt-24">
      <div className="flex justify-between md:justify-start md:gap-4 items-center relative md:w-max">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10 transform -translate-y-1/2 hidden sm:block"></div>
        
        {steps.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isCompleted = currentStep > stepNumber;
            
            return (
                <button
                    key={index}
                    onClick={() => setStep(stepNumber)}
                    className={`
                        relative flex items-center justify-center
                        transition-all duration-300 ease-in-out
                        ${isActive ? 'flex-grow sm:flex-grow-0' : 'flex-shrink-0'}
                    `}
                    style={{ minWidth: isActive ? 'auto' : '32px' }}
                >
                    <div className={`
                        flex items-center rounded-full border-2 transition-all duration-300 overflow-hidden bg-white
                        ${isActive 
                            ? 'border-luvin-pink pl-1 pr-4 py-1 gap-2 shadow-sm w-full' 
                            : isCompleted 
                                ? 'border-luvin-pink p-1 w-8 h-8 justify-center' 
                                : 'border-gray-300 p-1 w-8 h-8 justify-center'
                        }
                        sm:w-auto sm:h-auto sm:px-4 sm:py-1.5 sm:gap-2
                    `}>
                        <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors
                            ${isActive 
                                ? 'bg-luvin-pink text-white' 
                                : isCompleted 
                                    ? 'bg-luvin-pink text-white' 
                                    : 'bg-gray-200 text-gray-500'
                            }
                        `}>
                            {isCompleted ? '✓' : stepNumber}
                        </div>
                        <span className={`
                            text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300
                            ${isActive 
                                ? 'text-luvin-pink opacity-100 max-w-[150px]' 
                                : 'text-gray-500 max-w-0 opacity-0 sm:max-w-[150px] sm:opacity-100 sm:block hidden'
                            }
                        `}>
                            {label}
                        </span>
                    </div>
                </button>
            );
        })}
      </div>
    </div>
  );
};

const Step1Frame: React.FC<{ config: FrameConfig; setConfig: (c: FrameConfig) => void; frames: FrameOption[] }> = ({ config, setConfig, frames }) => {
  const selectedFrame = frames.find(f => f.id === config.frameId) || frames[0];
  
  useEffect(() => {
      if (selectedFrame && selectedFrame.colors && selectedFrame.colors.length > 0) {
          if (!config.frameColor || !selectedFrame.colors.includes(config.frameColor)) {
              setConfig({ ...config, frameColor: selectedFrame.colors[0] });
          }
      }
  }, [selectedFrame, config.frameColor]);

  return (
    <div className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-gray-800 mb-3">CHỌN KÍCH THƯỚC</h4>
        <div className="grid grid-cols-3 gap-3">
          {frames.map(frame => {
            const effectivePrice = getEffectivePrice(frame);
            const isSale = effectivePrice < frame.price;

            return (
                <button
                key={frame.id}
                onClick={() => setConfig({ ...config, frameId: frame.id })}
                disabled={frame.stock === 0}
                className={`border rounded-lg py-2 px-1 text-xs sm:text-sm font-semibold transition-all duration-200 flex flex-col items-center justify-center h-20 relative hover:scale-105 active:scale-95 ${
                    config.frameId === frame.id ? 'bg-luvin-pink text-gray-800 border-luvin-pink shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-50'
                } ${frame.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                <span>{frame.name}</span>
                {isSale ? (
                    <div className="flex flex-col items-center leading-none mt-1">
                        <span className="font-normal opacity-60 line-through text-[10px]">{formatCurrency(frame.price)}</span>
                        <span className="font-bold text-red-600 text-xs">{formatCurrency(effectivePrice)}</span>
                    </div>
                ) : (
                    <span className="font-normal opacity-80 mt-1">{formatCurrency(frame.price)}</span>
                )}
                
                {isSale && (
                    <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm font-bold whitespace-nowrap z-10">SALE</span>
                )}
                {frame.id === 'lg' && !isSale && (
                    <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-[9px] px-1.5 py-0.5 rounded shadow-sm text-yellow-900 font-bold whitespace-nowrap z-10">Phổ biến nhất</span>
                )}
                {frame.stock === 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] px-1 rounded-bl">Hết hàng</span>}
                </button>
            );
          })}
        </div>

        {selectedFrame && selectedFrame.colors && selectedFrame.colors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="font-bold text-xs text-gray-500 uppercase mb-2">MÀU KHUNG</h4>
                <div className="flex gap-3 flex-wrap">
                    {selectedFrame.colors.map(color => {
                        const getColorStyle = (c: string) => {
                            if (c === 'white') return { bg: '#fff', border: '#ddd' };
                            if (c === 'black') return { bg: '#000', border: '#000' };
                            if (c === 'wood') return { bg: '#d2b48c', border: '#c1a075' };
                            if (c === 'gold') return { bg: '#ffd700', border: '#e6c200' };
                            return { bg: c, border: c };
                        };
                        const style = getColorStyle(color);
                        const isSelected = config.frameColor === color;

                        return (
                            <button 
                                key={color}
                                onClick={() => setConfig({ ...config, frameColor: color })}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all capitalize hover:shadow-sm ${isSelected ? 'border-luvin-pink ring-1 ring-luvin-pink bg-pink-50' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                                <div 
                                    className="w-4 h-4 rounded-full shadow-sm border" 
                                    style={{ backgroundColor: style.bg, borderColor: style.border }}
                                ></div>
                                <span className="text-sm font-medium text-gray-700">{color === 'white' ? 'Trắng' : color === 'black' ? 'Đen' : color}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        )}
      </div>
       {selectedFrame && (
        <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3">GIÁ CƠ BẢN BAO GỒM</h4>
            <ul className="text-sm list-disc list-inside text-gray-600 space-y-1">
                <li>1 Khung ảnh {selectedFrame.name} ({selectedFrame.description}).</li>
                <li>1 Nền tùy chọn (mẫu có sẵn hoặc ảnh của bạn).</li>
                <li>Miễn phí thêm chữ & ảnh nhỏ trang trí.</li>
                <li>Hộp quà & thiệp viết tay theo yêu cầu.</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2 italic">Lưu ý: Giá chưa bao gồm nhân vật LEGO và phụ kiện.</p>
        </div>
      )}
    </div>
  );
};

const PresetBackgroundButton: React.FC<{
    bg: PresetBackground;
    isSelected: boolean;
    onClick: () => void;
    onZoom: (url: string) => void;
}> = ({ bg, isSelected, onClick, onZoom }) => {
    const isColor = bg.url.startsWith('#');
    let line1 = bg.name;
    let line2 = '';

    const match = bg.name.match(/^(.*?)(\s+\d+)$/);
    
    if (match) {
        line1 = match[1]; 
        line2 = match[2].trim();
    } else {
        const parts = bg.name.split(' ');
        if (parts.length > 1) {
            line1 = parts[0];
            line2 = parts.slice(1).join(' ');
        }
    }

    return (
        <button
            onClick={onClick}
            className={`border-2 rounded-xl p-1.5 flex flex-col items-center justify-start gap-1.5 transition-all text-center w-full relative group hover:shadow-md ${
                isSelected
                    ? 'border-luvin-pink bg-pink-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
        >
            <div className="w-full aspect-[4/5] rounded-md bg-gray-100 overflow-hidden flex items-center justify-center relative border border-gray-100">
                {isColor ? (
                    <div className="w-full h-full" style={{ backgroundColor: bg.url }}></div>
                ) : (
                    <>
                        <img
                            src={bg.url}
                            alt={bg.name}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 right-1 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-auto">
                            <div 
                                className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-full cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); onZoom(bg.url); }}
                                title="Zoom"
                            >
                                <ZoomIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </>
                )}
                {/* Indicator for interactive template */}
                {bg.overlayConfig && (
                    <div className="absolute top-1 left-1 bg-yellow-400 text-[8px] font-bold px-1.5 py-0.5 rounded text-yellow-900 shadow-sm">
                        MẪU
                    </div>
                )}
            </div>
            <div className="flex flex-col justify-center items-center flex-shrink-0 h-9 leading-tight">
                <span className="text-[11px] font-semibold text-gray-700">{line1}</span>
                {line2 && <span className="text-[11px] font-semibold text-gray-700">{line2}</span>}
            </div>
        </button>
    );
};

const Step2BackgroundAndDecorations: React.FC<{
  config: FrameConfig;
  setConfig: (c: FrameConfig) => void;
  addText: () => void;
  addCharm: (dataUrl: string) => void;
  backgrounds: PresetBackground[];
  frames: FrameOption[];
  onZoomImage: (url: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  preferredSquareFrameId: string;
}> = ({ config, setConfig, addText, addCharm, backgrounds, frames, onZoomImage, showToast, preferredSquareFrameId }) => {
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const charmUploadRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  const availableBackgrounds = useMemo(() => {
    return backgrounds;
  }, [backgrounds]);

  const categories = useMemo(() => {
    return ['Tất cả', ...Array.from(new Set(availableBackgrounds.map(bg => bg.category)))];
  }, [availableBackgrounds]);

  const filteredBackgrounds = useMemo(() => {
    if (selectedCategory === 'Tất cả') {
      return availableBackgrounds;
    }
    return availableBackgrounds.filter(bg => bg.category === selectedCategory);
  }, [selectedCategory, availableBackgrounds]);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
        setSelectedCategory('Tất cả');
    }
  }, [categories, selectedCategory]);

  const handleBackgroundSelect = (bg: PresetBackground) => {
    const isColor = bg.url.startsWith('#');
    let newFrameId = config.frameId;
    let message = '';

    const currentFrameOption = frames.find(f => f.id === config.frameId);
    
    const isCurrentFrameSquare = currentFrameOption ? Math.abs(currentFrameOption.frameWidthCm - currentFrameOption.frameHeightCm) < 1 : true;

    if (bg.type === 'rectangle' && isCurrentFrameSquare) {
        const rectFrame = frames.find(f => Math.abs(f.frameWidthCm - f.frameHeightCm) > 1 && f.stock !== 0) || frames.find(f => f.id === 'md');
        if (rectFrame) {
            newFrameId = rectFrame.id;
            message = `Đã tự động chuyển sang khung ${rectFrame.name} để vừa với nền`;
        }
    } else if (bg.type === 'square' && !isCurrentFrameSquare) {
        let targetId = preferredSquareFrameId;
        const targetFrame = frames.find(f => f.id === targetId);
        if (!targetFrame || Math.abs(targetFrame.frameWidthCm - targetFrame.frameHeightCm) >= 1) {
             targetId = 'lg';
        }
        const squareFrame = frames.find(f => f.id === targetId) || frames.find(f => f.id === 'lg') || frames.find(f => Math.abs(f.frameWidthCm - f.frameHeightCm) < 1);

        if (squareFrame) {
            newFrameId = squareFrame.id;
            message = `Đã tự động chuyển sang khung ${squareFrame.name} để vừa với nền`;
        }
    }

    let shouldRotate = false;
    if (bg.type === 'rectangle') {
        shouldRotate = bg.orientation === 'landscape';
    }

    // Determine config to merge
    // If background has overlayConfig, we load those texts/items
    // Otherwise, we keep existing items or reset? Usually reset/merge logic is complex.
    // Here we will merge the template's overlays if they exist.
    
    const newBackground = { type: isColor ? 'color' : 'image', value: bg.url } as any;
    
    // Create new config object
    let newConfig = { 
        ...config, 
        frameId: newFrameId,
        background: newBackground,
        isRotated: shouldRotate
    };

    // If this background is a template with pre-defined layers, apply them
    if (bg.overlayConfig) {
        newConfig.texts = bg.overlayConfig.texts || [];
        newConfig.draggableItems = bg.overlayConfig.draggableItems || [];
        if (message) message += ". Đã tải mẫu chữ.";
        else message = "Đã tải mẫu nền & chữ.";
    }

    setConfig(newConfig);
    if (message) showToast(message, 'success');
  };

  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
            const imageUrl = event.target.result as string;
            const img = new Image();
            img.onload = () => {
                 const isLandscape = img.naturalWidth > img.naturalHeight;
                 const currentFrame = frames.find(f => f.id === config.frameId);
                 const isRect = currentFrame && Math.abs(currentFrame.frameWidthCm - currentFrame.frameHeightCm) > 1;
                 const shouldRotate = isRect && isLandscape;

                 setConfig({ 
                     ...config, 
                     background: { type: 'upload', value: imageUrl },
                     isRotated: shouldRotate
                 });
            };
            img.src = imageUrl;
        }
      };
      fileReader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCharmFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          addCharm(event.target.result as string);
        }
      };
      fileReader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-gray-800 mb-3">A. CHỌN MẪU NỀN CÓ SẴN</h4>
        
        <div className="mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {categories.map(category => (
                    <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                            selectedCategory === category
                                ? 'bg-luvin-pink text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        {category}
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2 min-h-[150px]">
          {filteredBackgrounds.length > 0 ? (
            filteredBackgrounds.map((bg) => {
              return (
                <PresetBackgroundButton
                  key={bg.id}
                  bg={bg}
                  isSelected={config.background.value === bg.url}
                  onClick={() => handleBackgroundSelect(bg)}
                  onZoom={onZoomImage}
                />
              );
            })
          ) : (
            <p className="col-span-3 text-center text-sm text-gray-500 py-10">
              {backgrounds.length === 0 ? "Đang tải dữ liệu..." : "Không có mẫu nào phù hợp."}
            </p>
          )}
        </div>
      </div>
      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-gray-800 mb-3">B. HOẶC TẢI ẢNH CỦA BẠN</h4>
        <button onClick={() => bgUploadRef.current?.click()} className="w-full font-semibold bg-gray-200 text-gray-800 py-2.5 px-3 rounded-lg hover:bg-gray-300 active:scale-95 transition-transform">
          Tải ảnh nền
        </button>
      </div>

      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-gray-800 mb-2">C. THÊM CHỮ & TRANG TRÍ</h4>
        <p className="text-sm text-gray-600 mb-3">Chỉnh sửa trực tiếp trên khung xem trước.</p>
        <div className="flex gap-2">
            <button onClick={addText} className="w-full font-semibold bg-gray-200 text-gray-800 py-2.5 px-3 rounded-lg hover:bg-gray-300 active:scale-95 transition-transform">
              + Thêm chữ mới
            </button>
            <button onClick={() => charmUploadRef.current?.click()} className="w-full font-semibold bg-gray-200 text-gray-800 py-2.5 px-3 rounded-lg hover:bg-gray-300 active:scale-95 transition-transform">
              Tải ảnh nhỏ
            </button>
        </div>
      </div>
      <input type="file" ref={bgUploadRef} accept="image/*" onChange={handleBgFileUpload} className="hidden" />
      <input type="file" ref={charmUploadRef} accept="image/*" onChange={handleCharmFileUpload} className="hidden" />
    </div>
  );
};

// ... (Rest of PartButton and other Step3/Step4 components remain unchanged)
const PartButton: React.FC<{
    part: LegoPart;
    isSelected: boolean;
    onClick: () => void;
    priceToDisplay: number; 
    originalPrice?: number;
    isHot?: boolean;
}> = ({ part, isSelected, onClick, priceToDisplay, originalPrice, isHot }) => {
    const [imgError, setImgError] = useState(false);
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = () => {
        setIsClicked(true);
        onClick();
        setTimeout(() => setIsClicked(false), 300);
    };
    
    const isSale = originalPrice !== undefined && priceToDisplay < originalPrice;

    return (
        <button
            onClick={handleClick}
            className={`border rounded-lg p-1.5 flex flex-col items-center justify-start gap-1.5 transition-all text-center w-full relative overflow-hidden ${
                isSelected
                    ? 'border-luvin-pink bg-pink-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
            } ${isClicked ? 'ring-2 ring-luvin-pink ring-opacity-50 scale-95' : 'hover:scale-[1.02]'}`}
        >
            {isClicked && (
                <div className="absolute inset-0 bg-luvin-pink opacity-20 z-10 animate-ping rounded-lg"></div>
            )}
            {isHot && (
                <div className="absolute top-0 right-0 z-20 bg-red-500 text-white text-[10px] px-1 rounded-bl shadow-sm flex items-center justify-center w-5 h-5" title="Hot Trend - Được chọn nhiều nhất tuần qua">
                    🔥
                </div>
            )}
            {isSale && (
                <div className="absolute top-0 left-0 z-20 bg-yellow-400 text-yellow-900 text-[9px] px-1 rounded-br shadow-sm font-bold">
                    SALE
                </div>
            )}
            <div className="w-full aspect-square rounded-md bg-gray-100 overflow-hidden flex items-center justify-center relative">
                {!imgError && part.imageUrl ? (
                    <img 
                        src={part.imageUrl} 
                        alt={part.name} 
                        className="w-full h-full object-contain" 
                        onError={() => setImgError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="text-[10px] text-gray-400 text-center p-1">No Image</div>
                )}
            </div>
            <div className="flex flex-col justify-center items-center flex-shrink-0 h-10 leading-tight">
                <span className="text-[11px] font-semibold text-gray-800 line-clamp-1">{part.name}</span>
                {isSale ? (
                    <div className="flex flex-col">
                        <span className="text-[9px] font-normal text-gray-400 line-through">
                            {formatCurrency(originalPrice!)}
                        </span>
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-red-600' : 'text-red-500'}`}>
                            {formatCurrency(priceToDisplay)}
                        </span>
                    </div>
                ) : (
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-red-600' : 'text-luvin-pink'}`}>
                        {formatCurrency(priceToDisplay)}
                    </span>
                )}
            </div>
        </button>
    );
};

const sortParts = (parts: LegoPart[], mode: 'default' | 'price_asc' | 'price_desc') => {
    if (mode === 'default') return parts;
    return [...parts].sort((a, b) => {
        const priceA = getEffectivePrice(a) || 0;
        const priceB = getEffectivePrice(b) || 0;
        return mode === 'price_asc' ? priceA - priceB : priceB - priceA;
    });
};

const Step3Characters: React.FC<{ 
    config: FrameConfig; 
    setConfig: (c: FrameConfig) => void;
    legoParts: typeof LEGO_PARTS;
    selectedItemId?: string | null;
    setSelectedItemId: (id: string | null) => void;
    activePartType: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set';
    setActivePartType: (type: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set') => void;
    hotPartIds: string[];
}> = ({ config, setConfig, legoParts, selectedItemId, setSelectedItemId, activePartType, setActivePartType, hotPartIds }) => {
    const [activeCharId, setActiveCharId] = useState<number | null>(config.characters[0]?.id || null);
    const activeCharacter = config.characters.find(c => c.id === activeCharId);
    const [printDialogCharId, setPrintDialogCharId] = useState<number | null>(null);
    
    const [sortMode, setSortMode] = useState<'default' | 'price_asc' | 'price_desc'>('default');
    const [accessorySortMode, setAccessorySortMode] = useState<'default' | 'price_asc' | 'price_desc' | 'hot_trend'>('hot_trend');
    const [accessoryCategory, setAccessoryCategory] = useState<string>('Tất cả');

    const getAvailableParts = (list: LegoPart[]) => {
        return list.filter(p => p.stock === undefined || p.stock > 0);
    };

     useEffect(() => {
        if (!config.characters.find(c => c.id === activeCharId)) {
            setActiveCharId(config.characters[config.characters.length - 1]?.id || null);
        }
     }, [config.characters, activeCharId]);

     useEffect(() => {
        if (selectedItemId && selectedItemId.startsWith('character-')) {
            const id = parseInt(selectedItemId.split('-')[1]);
            if (!isNaN(id)) {
                setActiveCharId(id);
            }
        }
     }, [selectedItemId]);

    const handleAddChar = () => {
        const newId = Date.now();
        const availableShirts = getAvailableParts(legoParts.shirt);
        const availablePants = getAvailableParts(legoParts.pants);
        const availableFaces = getAvailableParts(legoParts.face);
        const availableHairs = getAvailableParts(legoParts.hair);

        const newCharacter: LegoCharacterConfig = {
            id: newId, 
            shirt: availableShirts[0] || legoParts.shirt[0], 
            pants: availablePants[0] || legoParts.pants[0],
            face: availableFaces[0] || legoParts.face[0], 
            hair: availableHairs[0] || legoParts.hair[0],
            x: 30 + (config.characters.length % 3) * 20, 
            y: 75, 
            rotation: 0, 
            scale: 1,
            selectedShirtColor: availableShirts[0]?.colors?.[0],
            selectedPantsColor: availablePants[0]?.colors?.[0],
            selectedHairColor: availableHairs[0]?.colors?.[0],
        };
        setConfig({ ...config, characters: [...config.characters, newCharacter] });
        setActiveCharId(newId);
        
        setSelectedItemId(`character-${newId}`);
        setActivePartType('shirt');
    };
    
    const handleRemoveChar = (id: number) => {
        setConfig({...config, characters: config.characters.filter(c => c.id !== id)});
    };
    
    const addDraggableItem = (part: LegoPart) => {
        if (part.type !== 'accessory' && part.type !== 'pet' && part.type !== 'hat') return;
        
        let startX = 50;
        let startY = 50;
        
        if (part.type === 'hat' && activeCharacter) {
            startX = activeCharacter.x;
            startY = activeCharacter.y - 35; 
        } else {
            startX = 50 + (Math.random() - 0.5) * 20;
            startY = 50 + (Math.random() - 0.5) * 20;
        }

        const newItem: DraggableItem = {
            id: Date.now(), 
            partId: part.id, 
            type: part.type as 'accessory' | 'pet' | 'hat', 
            x: startX, 
            y: startY, 
            rotation: 0, 
            scale: 1, 
            isFlipped: false, 
            selectedColor: part.colors?.[0]
        };
        setConfig({...config, draggableItems: [...config.draggableItems, newItem]});
    }

    const handlePartSelect = (part: LegoPart | undefined) => {
        if (!activeCharId || !part) return;

        if (part.type === 'hat') {
            addDraggableItem(part);
            return;
        }

        setConfig({
            ...config,
            characters: config.characters.map(c => {
                if (c.id === activeCharId) {
                    const newChar = { ...c };
                    
                    if (part.type === 'set') {
                        newChar.shirt = part;
                        newChar.pants = undefined; 
                    } else {
                        (newChar as any)[part.type] = part;
                    }

                    let partColors = part.colors;
                    if (!partColors || partColors.length === 0) {
                        const nameLower = part.name.toLowerCase();
                        if (part.type === 'shirt' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'shirt1')) {
                            partColors = defaultShirtColors;
                        }
                        if (part.type === 'pants' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'pants1')) {
                            partColors = defaultPantsColors;
                        }
                    }

                    if (part.type === 'shirt' || part.type === 'set') newChar.selectedShirtColor = partColors?.[0];
                    if (part.type === 'pants') newChar.selectedPantsColor = partColors?.[0];
                    if (part.type === 'hair') newChar.selectedHairColor = partColors?.[0];
                    
                    return newChar;
                }
                return c;
            })
        });
    };

    const handlePartDeselect = (partType: 'hair' | 'hat') => {
      if (!activeCharId) return;
      if (partType === 'hat') return;

      setConfig({
        ...config,
        characters: config.characters.map(c => {
            if (c.id === activeCharId) {
                const updatedChar = { ...c, [partType]: undefined };
                return updatedChar;
            }
            return c;
        })
      });
    }
    
    const handleCustomPrintSelect = (price: number) => {
      if (!printDialogCharId) return;
      setConfig({
        ...config,
        characters: config.characters.map(c => 
          c.id === printDialogCharId ? { ...c, customPrintPrice: price } : c
        )
      });
      setPrintDialogCharId(null);
    };

    const handleRandomizeOutfit = () => {
        if (!activeCharId) return;
        
        const availableHair = getAvailableParts(legoParts.hair);
        const availableFace = getAvailableParts(legoParts.face);
        const availableShirt = getAvailableParts(legoParts.shirt);
        const availablePants = getAvailableParts(legoParts.pants);

        const getRandomItem = (list: LegoPart[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : undefined;
        
        const getRandomColor = (colors: OutfitColor[] | undefined) => {
            if (!colors) return undefined;
            const availableColors = colors.filter(c => c.stock === undefined || c.stock > 0);
            return availableColors.length > 0 ? availableColors[Math.floor(Math.random() * availableColors.length)] : undefined;
        };

        const randomHair = getRandomItem(availableHair);
        const randomFace = getRandomItem(availableFace);
        const randomShirt = getRandomItem(availableShirt);
        const randomPants = getRandomItem(availablePants);

        setConfig({
            ...config,
            characters: config.characters.map(c => {
                if (c.id === activeCharId) {
                    const newChar: LegoCharacterConfig = { ...c };
                    
                    newChar.face = randomFace || c.face;
                    newChar.shirt = randomShirt || c.shirt;
                    newChar.pants = randomPants || c.pants;
                    newChar.hair = randomHair || c.hair;

                    let shirtColors = newChar.shirt?.colors;
                    if (!shirtColors || shirtColors.length === 0) {
                         const nameLower = newChar.shirt?.name.toLowerCase() || '';
                         if (nameLower.includes('trơn') || nameLower.includes('basic')) shirtColors = defaultShirtColors;
                    }
                    
                    let pantsColors = newChar.pants?.colors;
                    if (!pantsColors || pantsColors.length === 0) {
                         const nameLower = newChar.pants?.name.toLowerCase() || '';
                         if (nameLower.includes('trơn') || nameLower.includes('basic')) pantsColors = defaultPantsColors;
                    }

                    newChar.selectedShirtColor = getRandomColor(shirtColors) || shirtColors?.[0];
                    newChar.selectedPantsColor = getRandomColor(pantsColors) || pantsColors?.[0];
                    newChar.selectedHairColor = getRandomColor(newChar.hair?.colors) || newChar.hair?.colors?.[0];

                    return newChar;
                }
                return c;
            })
        });
    };
    
    const partTypes: { key: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set', label: string }[] = [
        { key: 'shirt', label: 'Áo' },
        { key: 'pants', label: 'Quần' },
        { key: 'set', label: 'Theo bộ' },
        { key: 'face', label: 'Mặt' },
        { key: 'hair', label: 'Tóc' },
        { key: 'hat', label: 'Mũ' },
    ];

    const currentPartList = useMemo(() => {
        const list = getAvailableParts(legoParts[activePartType] || []);
        return sortParts(list, sortMode);
    }, [legoParts, activePartType, sortMode]);

    const uniqueAccessoryCategories = useMemo(() => {
        const cats = new Set<string>();
        legoParts.accessory.forEach(p => {
            if (p.category) cats.add(p.category);
        });
        return ['Tất cả', ...Array.from(cats)];
    }, [legoParts.accessory]);

    const filteredAccessories = useMemo(() => {
        let list = getAvailableParts(legoParts.accessory);
        if (accessoryCategory !== 'Tất cả') {
            list = list.filter(p => p.category === accessoryCategory);
        }

        if (accessorySortMode === 'hot_trend') {
             return list.sort((a, b) => {
                const indexA = hotPartIds.indexOf(a.id);
                const indexB = hotPartIds.indexOf(b.id);
                const aIsHot = indexA !== -1;
                const bIsHot = indexB !== -1;

                if (aIsHot && bIsHot) return indexA - indexB;
                if (aIsHot) return -1;
                if (bIsHot) return 1;
                
                return 0;
            });
        }

        return sortParts(list, accessorySortMode as any);
    }, [legoParts.accessory, accessorySortMode, accessoryCategory, hotPartIds]);

    return (
        <div className="space-y-4">
            {printDialogCharId && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center">
                  <h3 className="font-bold text-lg mb-2">Chọn chất lượng in</h3>
                  <p className="text-sm text-gray-600 mb-4">In theo yêu cầu sẽ có chi phí cao hơn. Vui lòng chọn chất lượng mong muốn cho nhân vật này.</p>
                  <div className="space-y-2">
                    <button onClick={() => handleCustomPrintSelect(150000)} className="w-full bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg hover:bg-gray-300">In thường - {formatCurrency(150000)}</button>
                    <button onClick={() => handleCustomPrintSelect(300000)} className="w-full bg-luvin-pink text-gray-800 font-semibold py-2 rounded-lg hover:opacity-90">In cao cấp - {formatCurrency(300000)}</button>
                    {config.characters.find(c => c.id === printDialogCharId)?.customPrintPrice && 
                      <button onClick={() => handleCustomPrintSelect(0)} className="w-full bg-red-100 text-red-700 font-semibold py-2 rounded-lg hover:bg-red-200">Bỏ in yêu cầu</button>
                    }
                  </div>
                  <button onClick={() => setPrintDialogCharId(null)} className="text-xs text-gray-500 mt-4 hover:underline">Hủy</button>
                </div>
              </div>
            )}
            <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-800">QUẢN LÝ NHÂN VẬT</h4>
                    {activeCharacter && (
                        <button 
                            onClick={handleRandomizeOutfit}
                            className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors active:scale-95"
                            title="Chọn ngẫu nhiên trang phục"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            Ngẫu nhiên
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {config.characters.map((char, index) => (
                        <div key={char.id} className="relative">
                            <button onClick={() => setActiveCharId(char.id)} className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeCharId === char.id ? 'bg-pink-100 text-luvin-pink border border-luvin-pink shadow-sm' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                                NV {index + 1}
                            </button>
                            <button onClick={() => handleRemoveChar(char.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs font-bold shadow-sm hover:scale-110 transition-transform">
                                &times;
                            </button>
                        </div>
                    ))}
                    <button onClick={handleAddChar} className="bg-green-500 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-green-600 transition-colors active:scale-95">+ Thêm ({formatCurrency(CHARACTER_BASE_PRICE)})</button>
                </div>
                {activeCharacter && 
                  <div className="mt-4 pt-4 border-t flex items-center justify-start">
                    <button onClick={() => setPrintDialogCharId(activeCharacter.id)} className="text-sm text-blue-600 hover:underline font-semibold">
                      {activeCharacter.customPrintPrice ? `In yêu cầu (${formatCurrency(activeCharacter.customPrintPrice)})` : 'Thêm in yêu cầu?'}
                    </button>
                  </div>
                }
                {config.characters.length > 0 && !activeCharacter && <p className="text-sm text-center text-gray-500 mt-2">Hãy chọn một nhân vật để bắt đầu thiết kế.</p>}
                {config.characters.length === 0 && <p className="text-sm text-center text-gray-500 mt-2">Chưa có nhân vật nào. Hãy thêm một nhân vật!</p>}
            </div>

            {activeCharacter && (
                <div className="p-4 border border-gray-200 rounded-lg relative">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-4">
                        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar items-center w-full px-1 py-1">
                            {partTypes.map(pt => (
                                <button key={pt.key} onClick={() => setActivePartType(pt.key)} className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors whitespace-nowrap ${activePartType === pt.key ? 'bg-luvin-pink text-white shadow-sm' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                                    {pt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                     <div className="grid grid-cols-4 gap-2">
                         {(activePartType === 'hair') && (
                             <button onClick={() => handlePartDeselect(activePartType)} className="border-2 border-dashed border-gray-300 rounded-lg p-1.5 flex flex-col items-center justify-center gap-1 transition-colors text-center w-full h-full min-h-[100px] text-gray-500 hover:bg-gray-100 hover:border-gray-400">
                               <span className="text-2xl font-bold">&times;</span>
                               <span className="text-[11px] font-semibold">Không chọn</span>
                             </button>
                         )}
                        {currentPartList.length > 0 ? currentPartList.map(part => {
                            const isSelected = activePartType === 'hat' ? false : activeCharacter[activePartType === 'set' ? 'shirt' : activePartType]?.id === part.id;
                            
                            // Base Effective Price for the part
                            let effectiveBasePrice = getEffectivePrice(part);
                            let originalBasePrice = part.price;

                            // Calculate final display price including color surcharge
                            let priceToDisplay = effectiveBasePrice;
                            let originalPriceToDisplay = originalBasePrice;

                            if (isSelected) {
                                let surcharge = 0;
                                if (activePartType === 'shirt' || activePartType === 'set') surcharge = (activeCharacter.selectedShirtColor?.price || 0);
                                else if (activePartType === 'pants') surcharge = (activeCharacter.selectedPantsColor?.price || 0);
                                else if (activePartType === 'hair') surcharge = (activeCharacter.selectedHairColor?.price || 0);
                                
                                priceToDisplay += surcharge;
                                originalPriceToDisplay += surcharge;
                            }

                            return (
                                <PartButton 
                                    key={part.id} 
                                    part={part}
                                    isSelected={isSelected}
                                    onClick={() => handlePartSelect(part)}
                                    priceToDisplay={priceToDisplay}
                                    originalPrice={originalPriceToDisplay}
                                />
                            );
                        }) : (
                            <div className="col-span-4 text-center text-sm text-gray-400 py-4">
                                {legoParts[activePartType].length > 0 ? "Các sản phẩm này đang hết hàng." : "Đang tải hoặc chưa có dữ liệu..."}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex flex-col gap-3 mb-4">
                    <h4 className="font-bold text-gray-800">THÊM PHỤ KIỆN</h4>
                    
                    {uniqueAccessoryCategories.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                            {uniqueAccessoryCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setAccessoryCategory(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                        accessoryCategory === cat 
                                            ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <div className="relative inline-block w-32">
                            <select 
                                value={accessorySortMode}
                                onChange={(e) => setAccessorySortMode(e.target.value as any)}
                                className="appearance-none w-full pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 cursor-pointer"
                            >
                                <option value="hot_trend">Hot Trend 🔥</option>
                                <option value="default">Mặc định</option>
                                <option value="price_asc">Giá tăng dần</option>
                                <option value="price_desc">Giá giảm dần</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {filteredAccessories.length > 0 ? filteredAccessories.map(part => {
                        const effectivePrice = getEffectivePrice(part);
                        // Add color surcharge if default color has price
                        const defaultColorPrice = part.colors?.[0]?.price || 0;
                        const finalPrice = effectivePrice + defaultColorPrice;
                        const originalPrice = part.price + defaultColorPrice;

                        return (
                            <PartButton 
                                key={part.id} 
                                part={part} 
                                isSelected={false} 
                                onClick={() => addDraggableItem(part)} 
                                priceToDisplay={finalPrice} 
                                originalPrice={originalPrice}
                                isHot={hotPartIds.includes(part.id)}
                            />
                        );
                    }) : (
                        <p className="col-span-4 text-center text-sm text-gray-400 py-4">Không tìm thấy phụ kiện nào.</p>
                    )}
                </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-3">THÊM THÚ CƯNG</h4>
                <div className="grid grid-cols-4 gap-2">
                    {getAvailableParts(legoParts.pet).map(part => {
                        const effectivePrice = getEffectivePrice(part);
                        // Add color surcharge if default color has price
                        const defaultColorPrice = part.colors?.[0]?.price || 0;
                        const finalPrice = effectivePrice + defaultColorPrice;
                        const originalPrice = part.price + defaultColorPrice;

                        return (
                            <PartButton 
                                key={part.id} 
                                part={part} 
                                isSelected={false} 
                                onClick={() => addDraggableItem(part)} 
                                priceToDisplay={finalPrice}
                                originalPrice={originalPrice}
                                isHot={hotPartIds.includes(part.id)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const Step4Summary: React.FC<{ totalPrice: number; priceBreakdown: PriceBreakdownItem[]; frameName: string; charCount: number; onAddToCart: () => void; onBuyNow: () => void; isSaving: boolean; isEditingOrder?: boolean }> = ({ totalPrice, priceBreakdown, frameName, charCount, onAddToCart, onBuyNow, isSaving, isEditingOrder }) => {
  const remainingForFreeShip = FREE_SHIPPING_THRESHOLD - totalPrice;

  return (
    <div>
        <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
                <span>CHI TIẾT HÓA ĐƠN</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{charCount} Nhân vật</span>
            </h4>
            
            <div className="space-y-2 text-sm text-gray-700 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {priceBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-1">
                        <div className="flex flex-col">
                            <span className={item.isBase ? 'font-semibold text-gray-800' : 'text-gray-600'}>
                                {item.label}
                            </span>
                            {item.details && <span className="text-[10px] text-gray-400 italic">{item.details}</span>}
                        </div>
                        <div className="text-right">
                            {item.originalValue !== undefined && item.originalValue > item.value && (
                                <span className="block text-[10px] text-gray-400 line-through">
                                    {formatCurrency(item.originalValue)}
                                </span>
                            )}
                            <span className={`font-medium ${item.value > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                {item.value > 0 ? formatCurrency(item.value) : 'Miễn phí'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="border-t border-gray-200 my-3 pt-2">
                <div className="flex justify-between text-base font-bold text-gray-800 items-center">
                    <span>Tạm tính</span>
                    <span className="text-xl text-luvin-pink">{formatCurrency(totalPrice)}</span>
                </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200 mt-2">
                {remainingForFreeShip > 0 ? (
                    <p className="text-xs text-gray-600 text-center">
                        Mua thêm <span className="font-bold text-luvin-pink">{formatCurrency(remainingForFreeShip)}</span> để được <span className="font-bold text-green-600 uppercase">Freeship</span>
                    </p>
                ) : (
                    <p className="text-xs text-green-600 font-bold text-center flex items-center justify-center gap-1">
                        <span>🎉</span> Đơn hàng đủ điều kiện Freeship!
                    </p>
                )}
            </div>
        </div>

        {/* EARLY BIRD PROMO NOTIFICATION */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mt-4 flex gap-3 items-start animate-fade-in">
            <span className="text-xl">📅</span>
            <div>
                <p className="font-bold text-indigo-900 text-sm mb-1">Mẹo: Đặt Lịch Sớm (Early Bird)</p>
                <p className="text-xs text-indigo-700 leading-relaxed">
                    Sản phẩm thủ công cần <strong>1-3 ngày hoàn thiện</strong> và 2-4 ngày vận chuyển.
                    <br/>
                    Nếu bạn có kế hoạch tặng quà xa, hãy chọn ngày nhận <strong>sau 20 ngày</strong> ở bước thanh toán để được <strong>Giảm ngay 5%</strong>!
                </p>
            </div>
        </div>

        <div className="mt-4 space-y-2">
            {!isEditingOrder && (
                <button onClick={onBuyNow} disabled={isSaving} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-base hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-wait shadow-md">
                    {isSaving ? 'Đang xử lý...' : 'Mua ngay & Thanh toán'}
                </button>
            )}
            <button onClick={onAddToCart} disabled={isSaving} className={`w-full font-bold py-3 rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-wait ${isEditingOrder ? 'bg-luvin-pink text-gray-800 hover:opacity-90' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                {isSaving ? '...' : (isEditingOrder ? 'Lưu mẫu thiết kế' : 'Thêm vào giỏ hàng')}
            </button>
        </div>
    </div>
  );
};

const TextEditor: React.FC<{
    activeText: TextConfig;
    setConfig: (c: FrameConfig) => void;
    config: FrameConfig;
    selectedTextId: number;
    deselect: () => void;
    onAddText: () => void;
}> = ({ activeText, setConfig, config, selectedTextId, deselect, onAddText }) => {
    
    const updateActiveText = (updates: Partial<TextConfig>) => {
        setConfig({
            ...config,
            texts: config.texts.map((t) => t.id === selectedTextId ? { ...t, ...updates } : t)
        });
    }

    const isLocked = activeText.lockedContent;
    
    return (
        <div className="p-4 border border-gray-200 rounded-lg relative">
            {isLocked && (
                <div 
                    className="absolute inset-0 z-20 bg-gray-50/50 backdrop-blur-[1px] flex items-center justify-center rounded-lg cursor-not-allowed"
                    onClick={(e) => e.stopPropagation()} // Stop click propagation to inputs behind
                >
                    <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 shadow-sm flex items-center gap-1 select-none">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zm2 5v3h-4V7c0-1.103.897-2 2-2s2 .897 2 2z"/></svg>
                        🔒 Nội dung đã bị khóa bởi Admin
                    </span>
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">CHỈNH SỬA CHỮ</h3>
                <div className="flex gap-2 relative z-30">
                    <button onClick={onAddText} className="text-xs sm:text-sm font-body border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                        + Thêm chữ
                    </button>
                    <button onClick={deselect} className="text-xs sm:text-sm font-body bg-luvin-pink text-gray-800 px-4 py-1.5 rounded-lg hover:opacity-90 font-bold transition-colors">
                        Xong
                    </button>
                </div>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-gray-600 block mb-1">Nội dung</label>
                    <textarea
                        value={activeText.content}
                        onChange={e => updateActiveText({ content: e.target.value })}
                        disabled={isLocked}
                        readOnly={isLocked}
                        rows={3}
                        className={`w-full p-2 border rounded-lg text-sm bg-white ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                        placeholder="Nhập nội dung văn bản..."
                    />
                </div>
                <div>
                    <label className="text-sm font-bold text-gray-600 block mb-1">Cỡ chữ</label>
                    <input 
                      type="number" 
                      min="8" 
                      max="100" 
                      value={activeText.size} 
                      onChange={e => updateActiveText({ size: parseInt(e.target.value)})} 
                      disabled={isLocked}
                      readOnly={isLocked}
                      className={`w-full p-2 border rounded-lg text-sm bg-white ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                    />
                </div>
                <div className="flex items-center justify-between gap-2">
                    <button 
                        onClick={() => updateActiveText({background: !activeText.background})} 
                        disabled={isLocked}
                        className={`text-sm px-3 py-2 rounded-lg flex-1 ${activeText.background ? 'bg-luvin-pink text-gray-800' : 'bg-gray-200 text-gray-800'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {activeText.background ? 'Bỏ nền mờ' : 'Thêm nền mờ'}
                    </button>
                    <div className={`flex rounded-lg border border-gray-300 overflow-hidden ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                        {(['left', 'center', 'right'] as const).map(align => (
                           <button key={align} onClick={() => updateActiveText({ textAlign: align })} className={`px-3 py-1 text-sm ${activeText.textAlign === align ? 'bg-luvin-pink text-gray-800' : 'bg-white text-gray-800'}`}>
                             {align.charAt(0).toUpperCase()}
                           </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

type Transform = { x: number; y: number; rotation: number; scale: number; width?: number };

interface BuilderPageProps { 
    config: FrameConfig; 
    setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>; 
    navigateTo: (p:Page) => void; 
    onAddToCart: (config: FrameConfig, openCartPanel?: boolean) => void; 
    onUpdateCart: (config: FrameConfig) => void; 
    showToast: (message: string, type: 'success' | 'error') => void;
    legoParts: typeof LEGO_PARTS; 
    backgrounds: PresetBackground[]; 
    frames: FrameOption[]; 
    editingCartIndex: number | null; 
    onCancelEdit: () => void; 
    onZoomImage: (url: string) => void; 
    logoUrl?: string; 
    initialStep?: number; 
    isEditingOrder?: boolean;
}

const base64ToBlob = (base64: string) => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

export const BuilderPage: React.FC<BuilderPageProps> = ({ config, setConfig, navigateTo, onAddToCart, onUpdateCart, showToast, legoParts, backgrounds, frames, editingCartIndex, onCancelEdit, onZoomImage, logoUrl, initialStep, isEditingOrder }) => {
  const [step, setStep] = useState(initialStep || 1); 
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const previewContainerParentRef = useRef<HTMLDivElement>(null);
  const frameCaptureRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(480);
  const [isSaving, setIsSaving] = useState(false);
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [isEditingText, setIsEditingText] = useState(false);
  const [activePartType, setActivePartType] = useState<'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set'>('shirt');
  const [hotPartIds, setHotPartIds] = useState<string[]>([]);
  const [lastSquareFrameId, setLastSquareFrameId] = useState<string>('lg'); 
  
  const [history, setHistory] = useState<FrameConfig[]>([config]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const allParts = useMemo(() => (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  const { totalPrice, priceBreakdown } = useMemo(() => calculatePrice(config, allParts, frames), [config, allParts, frames]);
  const remainingForFreeShip = FREE_SHIPPING_THRESHOLD - totalPrice;
  const freeShipPercent = Math.min(100, (totalPrice / FREE_SHIPPING_THRESHOLD) * 100);

  useEffect(() => {
      const currentFrame = frames.find(f => f.id === config.frameId);
      if (currentFrame && Math.abs(currentFrame.frameWidthCm - currentFrame.frameHeightCm) < 1) {
          setLastSquareFrameId(currentFrame.id);
      }
  }, [config.frameId, frames]);

  useEffect(() => {
    const fetchHotTrends = async () => {
        try {
            const orders = await getAllOrders();
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const recentOrders = orders.filter(o => (o.createdAt || 0) > sevenDaysAgo);
            
            const counts: Record<string, number> = {};
            recentOrders.forEach(o => {
                o.items.forEach(item => {
                    item.draggableItems.forEach(d => {
                        if (d.type !== 'charm') {
                            counts[d.partId] = (counts[d.partId] || 0) + 1;
                        }
                    });
                    item.characters.forEach(c => {
                        if (c.hat) counts[c.hat.id] = (counts[c.hat.id] || 0) + 1;
                    });
                });
            });

            let topIds = Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([id]) => id);
            
            if (topIds.length < 3) {
                const availableAccessories = [...LEGO_PARTS.accessory, ...LEGO_PARTS.pet];
                const staticHotItems = availableAccessories
                    .filter(p => p.isHot && !topIds.includes(p.id))
                    .map(p => p.id);
                
                topIds = [...topIds, ...staticHotItems];

                if (topIds.length < 3) {
                    const randomFillers = availableAccessories
                        .filter(p => !topIds.includes(p.id))
                        .map(p => p.id);
                    topIds = [...topIds, ...randomFillers];
                }
            }

            setHotPartIds(topIds.slice(0, 3));
        } catch (e) {
            console.error(e);
            const defaults = [...LEGO_PARTS.accessory, ...LEGO_PARTS.pet].slice(0, 3).map(p => p.id);
            setHotPartIds(defaults);
        }
    };
    fetchHotTrends();
  }, []);

  const setConfigWithHistory = useCallback((newConfigOrFn: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => {
      setConfig(prev => {
          const newConfig = typeof newConfigOrFn === 'function' ? newConfigOrFn(prev) : newConfigOrFn;
          
          if (JSON.stringify(newConfig) !== JSON.stringify(prev)) {
              const newHistory = history.slice(0, historyIndex + 1);
              newHistory.push(newConfig);
              if (newHistory.length > 20) newHistory.shift();
              setHistory(newHistory);
              setHistoryIndex(newHistory.length - 1);
          }
          return newConfig;
      });
  }, [history, historyIndex, setConfig]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setConfig(history[newIndex]);
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setConfig(history[newIndex]);
      }
  };

  const handleShare = async () => {
      setIsSaving(true);
      const image = await captureFrameAsImage();
      setIsSaving(false);
      
      if (!image) return;

      if (navigator.share) {
          try {
              const blob = await (await fetch(image)).blob();
              const file = new File([blob], "the-luvin-design.png", { type: blob.type });
              await navigator.share({
                  title: 'My LEGO Frame Design',
                  text: 'Check out my custom LEGO frame design from The Luvin!',
                  files: [file]
              });
          } catch (e) {
              const link = document.createElement('a');
              link.href = image;
              link.download = 'the-luvin-design.png';
              link.click();
          }
      } else {
          const link = document.createElement('a');
          link.href = image;
          link.download = 'the-luvin-design.png';
          link.click();
      }
  };

  useEffect(() => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
          const element = document.getElementById('builder-action-area');
          if (element) {
              const headerOffset = 100;
              const elementPosition = element.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.scrollY - headerOffset;

              window.scrollTo({
                  top: offsetPosition,
                  behavior: "smooth"
              });
          }
      } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [step]);

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsBottomBarVisible(false);
      } else {
        setIsBottomBarVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', controlNavbar);
    return () => {
      window.removeEventListener('scroll', controlNavbar);
    };
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width } = entries[0].contentRect;
        setPreviewWidth(width > 520 ? 520 : width);
      }
    });

    if (previewContainerParentRef.current) {
      observer.observe(previewContainerParentRef.current);
    }

    return () => {
      if (previewContainerParentRef.current) {
        observer.unobserve(previewContainerParentRef.current);
      }
    };
  }, []);
  
  const selectedText = useMemo(() => {
    if (selectedItemId?.startsWith('text-')) {
        const id = parseInt(selectedItemId.split('-')[1], 10);
        return config.texts.find(t => t.id === id) || null;
    }
    return null;
  }, [selectedItemId, config.texts]);

  const handleItemTransform = useCallback((id: string, newTransform: Transform) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      
      setConfigWithHistory((prev: FrameConfig) => {
          if (type === 'text') {
              const idToUpdate = parseInt(rawId);
              return { ...prev, texts: prev.texts.map(item => item.id === idToUpdate ? { ...item, ...newTransform } : item) };
          }
          const itemId = parseInt(rawId);
          if (type === 'character') return { ...prev, characters: prev.characters.map((item: LegoCharacterConfig) => item.id === itemId ? { ...item, ...newTransform } : item) };
          if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map((item: DraggableItem) => item.id === itemId ? { ...item, ...newTransform } : item) };
          return prev;
      });
  }, [setConfigWithHistory]);

  const handleItemFlip = useCallback((id: string) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      
      if (type === 'item') {
          const itemId = parseInt(rawId);
          setConfigWithHistory((prev: FrameConfig) => ({
              ...prev,
              draggableItems: prev.draggableItems.map((item: DraggableItem) => 
                  item.id === itemId ? { ...item, isFlipped: !item.isFlipped } : item
              )
          }));
      }
  }, [setConfigWithHistory]);

  const handleItemUpdate = useCallback((id: string, updates: Partial<DraggableItem>) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      
      if (type === 'item') {
          const itemId = parseInt(rawId);
          setConfigWithHistory((prev: FrameConfig) => ({
              ...prev,
              draggableItems: prev.draggableItems.map((item: DraggableItem) => 
                  item.id === itemId ? { ...item, ...updates } : item
              )
          }));
      }
  }, [setConfigWithHistory]);

  const handleCharacterUpdate = useCallback((id: number, updates: Partial<LegoCharacterConfig>) => {
      setConfigWithHistory((prev: FrameConfig) => ({
          ...prev,
          characters: prev.characters.map((c: LegoCharacterConfig) => c.id === id ? { ...c, ...updates } : c)
      }));
  }, [setConfigWithHistory]);

  const handleItemRemoveCompletely = useCallback((id: string) => {
    const [type, ...rest] = id.split('-');
    const rawId = rest.join('-');
    
    setSelectedItemId(null);

    setConfigWithHistory((prev: FrameConfig) => {
        if (type === 'text') {
            const idToDelete = parseInt(rawId, 10);
            return { ...prev, texts: prev.texts.filter(t => t.id !== idToDelete) };
        }
        const itemId = parseInt(rawId, 10);
        if (type === 'character') return { ...prev, characters: prev.characters.filter((item: LegoCharacterConfig) => item.id !== itemId) };
        if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter((item: DraggableItem) => item.id !== itemId) };
        return prev;
    });
  }, [setConfigWithHistory]);
  
  const handleItemDelete = useCallback((id: string) => {
    const [type, ...rest] = id.split('-');
    const rawId = rest.join('-');
    
    if (type === 'text') {
        const idToUpdate = parseInt(rawId, 10);
        const textItem = config.texts.find(t => t.id === idToUpdate);
        
        if (textItem && textItem.content && textItem.content.trim() !== '') {
             setConfigWithHistory((prev: FrameConfig) => ({
                ...prev,
                texts: prev.texts.map(t => t.id === idToUpdate ? { ...t, content: '' } : t)
            }));
        } else {
             handleItemRemoveCompletely(id);
        }
    } else {
        handleItemRemoveCompletely(id);
    }
  }, [setConfigWithHistory, handleItemRemoveCompletely, config.texts]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId && !isEditingText) {
            if (e.key === 'Backspace' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
            }
            handleItemDelete(selectedItemId);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) handleRedo();
            else handleUndo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, handleItemDelete, isEditingText, handleUndo, handleRedo]);

  const handleTextUpdate = useCallback((id: number, updates: Partial<TextConfig>) => {
    setConfigWithHistory((prev: FrameConfig) => ({
        ...prev,
        texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  }, [setConfigWithHistory]);
  
  const addText = () => {
      const newId = Date.now();
      const newText: TextConfig = { id: newId, content: 'Nhập chữ...', font: 'Montserrat', size: 12, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: true, textAlign: 'center', width: 30 };
      setConfigWithHistory((prev: FrameConfig) => ({...prev, texts: [...prev.texts, newText]}));
      setSelectedItemId(`text-${newId}`);
  };

  const addCharm = (dataUrl: string) => {
      const newCharm: DraggableItem = { id: Date.now(), partId: dataUrl, type: 'charm', x: 50, y: 50, rotation: 0, scale: 0.5 };
      setConfigWithHistory((prev: FrameConfig) => ({...prev, draggableItems: [...prev.draggableItems, newCharm]}));
  }
  
  const captureFrameAsImage = async (): Promise<string> => {
    const originalSelectedId = selectedItemId;
    setSelectedItemId(null); 

    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const container = frameCaptureRef.current;
          if (container && typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(container, {
              backgroundColor: null,
              useCORS: true, 
              allowTaint: true, 
              scale: 3,      
              logging: false,
              scrollX: 0,    
              scrollY: 0,
              ignoreElements: (element: Element) => false
            });
            resolve(canvas.toDataURL('image/png'));
          } else {
            console.error('html2canvas error');
            resolve('');
          }
        } catch (error) {
          console.error('Snapshot error:', error);
          resolve('');
        } finally {
          setSelectedItemId(originalSelectedId); 
        }
      }, 1000); 
    });
  };

  const animateAddToCart = (imageSrc: string) => {
      const desktopCart = document.getElementById('cart-icon-desktop');
      const mobileCart = document.getElementById('cart-icon-mobile');
      const targetIcon = window.innerWidth >= 768 ? desktopCart : mobileCart;
      const sourceContainer = frameCaptureRef.current;

      if (!targetIcon || !sourceContainer || !imageSrc) return;

      const startRect = sourceContainer.getBoundingClientRect();
      const endRect = targetIcon.getBoundingClientRect();

      const flyImg = document.createElement('img');
      flyImg.src = imageSrc;
      flyImg.classList.add('flying-product-item');
      
      flyImg.style.left = `${startRect.left}px`;
      flyImg.style.top = `${startRect.top}px`;
      flyImg.style.width = `${startRect.width}px`;
      flyImg.style.height = `${startRect.height}px`;

      document.body.appendChild(flyImg);
      flyImg.getBoundingClientRect();

      const endX = endRect.left + endRect.width / 2;
      const endY = endRect.top + endRect.height / 2;
      const targetSize = 20;

      flyImg.style.left = `${endX - targetSize/2}px`;
      flyImg.style.top = `${endY - targetSize/2}px`;
      flyImg.style.width = `${targetSize}px`;
      flyImg.style.height = `${targetSize}px`;
      flyImg.style.opacity = '0.5';

      flyImg.addEventListener('transitionend', () => {
          if (document.body.contains(flyImg)) {
              document.body.removeChild(flyImg);
          }
      });
  };

  const handleAddToCartWrapper = async (andCheckout: boolean) => {
    setIsSaving(true);
    try {
        const base64Image = await captureFrameAsImage();
        
        if (!base64Image) {
            showToast('Lỗi tạo ảnh. Vui lòng thử lại.', 'error');
            setIsSaving(false);
            return;
        }

        animateAddToCart(base64Image);

        const imageBlob = base64ToBlob(base64Image);
        const imageFile = new File([imageBlob], "design_preview.png", { type: "image/png" });

        const cloudUrl = await uploadToCloudinary(imageFile);
        
        if (!cloudUrl) {
             showToast('Lỗi lưu ảnh. Vui lòng kiểm tra kết nối mạng.', 'error');
             setIsSaving(false);
             return;
        }

        const finalConfig = { 
            ...config, 
            previewImageUrl: cloudUrl
        };

        if (editingCartIndex !== null && !andCheckout) {
            onUpdateCart(finalConfig);
        } else {
            onAddToCart({ ...finalConfig, quantity: 1 }, !andCheckout);
        }
        
        if (andCheckout) {
            navigateTo('checkout');
        }
    } catch (e) {
        console.error(e);
        showToast('Đã có lỗi xảy ra.', 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleCharacterDoubleClick = (charId: number) => {
      setStep(3); 
      setSelectedItemId(`character-${charId}`);
  };

  const handleAutoAdvance = () => {
      if (selectedItemId && (selectedItemId.startsWith('item-') || selectedItemId.startsWith('text-'))) {
          setSelectedItemId(null);
          return;
      }

      const order: ('shirt' | 'pants' | 'hair' | 'face' | 'hat')[] = ['shirt', 'pants', 'hair', 'face', 'hat'];
      let currentIndex = order.indexOf(activePartType as any);
      
      if (activePartType === 'set') {
          setActivePartType('hair');
          return;
      }

      if (currentIndex !== -1 && currentIndex < order.length - 1) {
          setActivePartType(order[currentIndex + 1]);
      } else {
          setActivePartType('shirt'); 
      }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1: return <Step1Frame config={config} setConfig={setConfigWithHistory} frames={frames} />;
      case 2: return <Step2BackgroundAndDecorations 
          config={config} 
          setConfig={setConfigWithHistory} 
          addText={addText} 
          addCharm={addCharm} 
          backgrounds={backgrounds} 
          frames={frames} 
          onZoomImage={onZoomImage} 
          showToast={showToast} 
          preferredSquareFrameId={lastSquareFrameId}
      />;
      case 3: return <Step3Characters config={config} setConfig={setConfigWithHistory} legoParts={legoParts} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} activePartType={activePartType} setActivePartType={setActivePartType} hotPartIds={hotPartIds} />;
      case 4: return <Step4Summary 
        totalPrice={totalPrice} 
        priceBreakdown={priceBreakdown} 
        frameName={frames.find(f => f.id === config.frameId)?.name || ''} 
        charCount={config.characters.length} 
        onAddToCart={() => handleAddToCartWrapper(false)} 
        onBuyNow={() => handleAddToCartWrapper(true)}
        isSaving={isSaving} 
        isEditingOrder={isEditingOrder}
      />;
      default: return null;
    }
  };

  return (
    <div className="bg-gray-50 py-4 sm:py-8 safe-bottom">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-500">
                <button onClick={() => navigateTo('home')} className="hover:underline">Home</button> / Thiết kế
            </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
            {isEditingOrder ? 'Chỉnh sửa đơn hàng' : 'Thiết kế & Mua hàng'}
        </h1>
        
        {/* Layout */}
        <StepIndicator currentStep={step} setStep={setStep} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 lg:items-start">
          <div className="lg:col-span-7" ref={previewContainerParentRef}>
            {/* Preview Section */}
            <div className="lg:sticky lg:top-24">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                        ẢNH XEM TRƯỚC
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleUndo} 
                            disabled={historyIndex <= 0}
                            className="w-8 h-8 rounded border bg-white flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-50 active:scale-95 transition-all"
                            title="Hoàn tác (Undo)"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                        <button 
                            onClick={handleRedo} 
                            disabled={historyIndex >= history.length - 1}
                            className="w-8 h-8 rounded border bg-white flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-50 active:scale-95 transition-all"
                            title="Làm lại (Redo)"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                        </button>
                        <button 
                            onClick={handleShare}
                            className="w-8 h-8 rounded border bg-white flex items-center justify-center text-blue-600 hover:bg-blue-50 active:scale-95 transition-all"
                            title="Chia sẻ thiết kế"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </button>
                    </div>
                </div>
                <div className="bg-gray-100 rounded-lg flex items-center justify-center aspect-square p-4 mb-32 lg:mb-0 shadow-inner">
                    <FramePreview 
                        ref={frameCaptureRef}
                        config={config} 
                        containerWidth={previewWidth - 32} 
                        onItemTransform={handleItemTransform} 
                        onItemRemove={handleItemRemoveCompletely}
                        onTextUpdate={handleTextUpdate}
                        onItemUpdate={handleItemUpdate}
                        onCharacterUpdate={handleCharacterUpdate} 
                        onItemFlip={handleItemFlip}
                        onCharacterDoubleClick={handleCharacterDoubleClick}
                        onAutoAdvance={handleAutoAdvance} 
                        className="w-full h-full"
                        selectedItemId={selectedItemId}
                        setSelectedItemId={setSelectedItemId}
                        setIsEditingText={setIsEditingText}
                        allParts={allParts}
                        activePartType={activePartType} 
                        logoUrl={logoUrl} 
                    />
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-start shadow-sm hidden lg:flex">
                    <span className="text-amber-500 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                        </svg>
                    </span>
                    <div className="text-xs text-amber-900 leading-relaxed">
                        <p className="font-bold mb-1">Lưu ý quan trọng:</p>
                        <p>Đây là bản xem trước mô phỏng. Sau khi đặt hàng, <strong>Designer sẽ thiết kế lại bố cục & màu sắc</strong> đẹp nhất và gửi bạn duyệt trước khi in ấn.</p>
                    </div>
                </div>
                <div className="h-10 mt-4 hidden lg:block"></div>
            </div>
          </div>

          <div className="lg:col-span-5 mt-4 lg:mt-0" id="builder-action-area"> 
              {(step === 2 || step === 3) && (
                  <div className="mb-3 px-1 animate-fade-in">
                      <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-gray-500 font-medium">
                              {remainingForFreeShip > 0 ? (
                                <>Thêm <b className="text-luvin-pink">{formatCurrency(remainingForFreeShip)}</b> để Freeship</>
                              ) : (
                                <b className="text-green-600 flex items-center gap-1">✨ Đã được Freeship</b>
                              )}
                          </span>
                          <span className="text-gray-400 font-bold">{Math.round(freeShipPercent)}%</span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                              className="h-full bg-gradient-to-r from-pink-300 to-luvin-pink transition-all duration-500 ease-out rounded-full shadow-[0_0_8px_rgba(239,163,181,0.6)]" 
                              style={{ width: `${freeShipPercent}%` }}
                          ></div>
                      </div>
                  </div>
              )}

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  {selectedText ? (
                      <TextEditor 
                          activeText={selectedText}
                          setConfig={setConfigWithHistory}
                          config={config}
                          selectedTextId={selectedText.id}
                          deselect={() => setSelectedItemId(null)}
                          onAddText={addText}
                      />
                  ) : (
                      <>
                          <div className="min-h-[400px]">
                              {renderStepContent()}
                          </div>
                      </>
                  )}
              </div>
              
              {!selectedText && (
                <>
                  <div className="mt-4 text-right font-bold text-lg text-gray-800 hidden lg:block">
                    Giá tạm tính: <span className="text-luvin-pink">{formatCurrency(totalPrice)}</span>
                  </div>
                  {editingCartIndex !== null && step === 4 && (
                        <div className="mt-4 mb-2">
                            <button 
                                onClick={onCancelEdit} 
                                className="w-full bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Hủy sửa
                            </button>
                        </div>
                  )}
                  {step === 4 && editingCartIndex !== null && (
                        <div className="mt-2 hidden lg:flex items-center gap-4">
                             <button onClick={() => handleAddToCartWrapper(false)} disabled={isSaving} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-base hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                {isSaving ? '...' : (isEditingOrder ? 'Lưu vào đơn hàng' : 'Cập nhật giỏ hàng')}
                            </button>
                        </div>
                  )}
                  
                  {!(editingCartIndex !== null && step === 4) && (
                      <div className="mt-2 hidden lg:flex items-center gap-4">
                          <button
                              onClick={() => setStep(s => Math.max(1, s - 1))}
                              disabled={step === 1}
                              className="w-full bg-white border border-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:bg-gray-100 transition-colors"
                          >
                              &larr; Quay lại
                          </button>
                          <button
                              onClick={() => setStep(s => Math.min(4, s + 1))}
                              disabled={step === 4}
                              className="w-full bg-luvin-pink text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:opacity-90 transition-colors shadow-md"
                          >
                              Tiếp theo
                          </button>
                      </div>
                  )}
                </>
              )}
               
               <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50 transition-transform duration-300 ease-in-out safe-bottom ${isBottomBarVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                     <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-medium text-gray-500">Tạm tính:</span>
                        <span className="font-bold text-lg text-luvin-pink">{formatCurrency(totalPrice)}</span>
                      </div>
                     
                     {editingCartIndex !== null && step === 4 ? (
                        <div className="flex gap-2">
                            <button onClick={onCancelEdit} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                                Hủy
                            </button>
                            <button onClick={() => handleAddToCartWrapper(false)} disabled={isSaving} className="flex-[2] bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-sm hover:opacity-90 transition-colors disabled:opacity-50">
                                {isSaving ? '...' : (isEditingOrder ? 'Lưu vào đơn' : 'Cập nhật')}
                            </button>
                        </div>
                     ) : (
                         <div className="flex gap-3">
                           <button
                              onClick={() => setStep(s => Math.max(1, s - 1))}
                              disabled={step === 1}
                              className="flex-1 bg-white border border-gray-300 text-gray-800 font-bold py-3 rounded-lg disabled:opacity-50 text-sm"
                          >
                              Quay lại
                          </button>
                          <button
                              onClick={() => setStep(s => Math.min(4, s + 1))}
                              disabled={step === 4}
                              className="flex-[2] bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg disabled:opacity-50 shadow-md text-sm"
                          >
                              Tiếp theo
                          </button>
                         </div>
                     )}
                </div>
               <div className="lg:hidden h-24"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
