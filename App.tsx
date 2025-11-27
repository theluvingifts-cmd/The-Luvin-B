
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Page, FrameConfig, LegoPart, DraggableItem, TextConfig, LegoCharacterConfig, OutfitColor, Order, PresetBackground, CollectionTemplate, FeedbackItem, FrameOption } from './types';
import { 
    FRAME_OPTIONS, 
    LEGO_PARTS, 
    INITIAL_FRAME_CONFIG, 
    COLLECTION_TEMPLATES, 
    FEEDBACK_ITEMS, 
    MOCK_ORDERS, 
    PRESET_BACKGROUNDS_SQUARE, 
    PRESET_BACKGROUNDS_RECTANGLE, 
    GENERAL_ASSETS,
    defaultShirtColors,
    defaultPantsColors,
} from './constants';
import FramePreview from './components/FramePreview';
import { createOrder, getOrderById, getOrdersByPhone } from './services/orderService'; // Kết nối Firebase
import { getAllParts } from './services/productService'; // Lấy sản phẩm từ DB
import { getAllBackgrounds } from './services/backgroundService'; // Lấy background từ DB
import { getStoreConfig } from './services/configService'; // Lấy cấu hình (logo)
import { getAllTemplates } from './services/templateService'; // Lấy mẫu
import { getAllFeedbacks } from './services/feedbackService'; // Lấy feedback
import { getAllFrames } from './services/frameService'; // Lấy khung
import AdminPage from './components/AdminPage'; // Trang Admin
import { sendOrderEmail } from './services/emailService'; // Hàm gửi mail

declare var html2canvas: any;
declare var confetti: any;

const formatCurrency = (amount: number, context: 'price' | 'payment' = 'price') => {
  if (amount === 0 && context === 'price') return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};


const CHARACTER_BASE_PRICE = 10000;
const FREE_SHIPPING_THRESHOLD = 349000;

// Updated to accept dynamic frames
const calculatePrice = (config: FrameConfig, allParts: Record<string, LegoPart>, frames: FrameOption[]) => {
    const breakdown: {label: string, value: number}[] = [];
    const frame = frames.find(f => f.id === config.frameId) || frames[0] || FRAME_OPTIONS[0];
    let total = frame.price;
    breakdown.push({ label: `Khung ${frame.name}`, value: frame.price });

    if(config.characters.length > 0) { const val = config.characters.length * CHARACTER_BASE_PRICE; total += val; breakdown.push({ label: `${config.characters.length} nhân vật`, value: val}); }
    
    config.characters.forEach((char, index) => {
        const customPrint = char.customPrintPrice || 0;
        if(customPrint > 0) {
            total += customPrint;
            breakdown.push({ label: `NV ${index + 1} - In yêu cầu`, value: customPrint });
        }
    });

    // Updated hair price calculation to include selected hair color price
    const hairPrice = config.characters.reduce((acc, char) => acc + (char.hair?.price || 0) + (char.selectedHairColor?.price || 0), 0);
    if(hairPrice > 0) { breakdown.push({ label: 'Tóc & Màu', value: hairPrice }); total += hairPrice; }

    // Hat price is now calculated from draggable items
    const hatPrice = config.draggableItems.filter(i => i.type === 'hat').reduce((acc, item) => acc + (allParts[item.partId]?.price || 0), 0);
    if(hatPrice > 0) { breakdown.push({ label: 'Mũ', value: hatPrice }); total += hatPrice; }

    const shirtPrice = config.characters.reduce((acc, char) => acc + (char.shirt?.price || 0) + (char.selectedShirtColor?.price || 0), 0);
    if(shirtPrice > 0) { total += shirtPrice; breakdown.push({ label: 'Áo & Màu', value: shirtPrice }); }

    const pantsPrice = config.characters.reduce((acc, char) => acc + (char.pants?.price || 0) + (char.selectedPantsColor?.price || 0), 0);
    if(pantsPrice > 0) { total += pantsPrice; breakdown.push({ label: 'Quần & Màu', value: pantsPrice }); }

    const accessoryPrice = config.draggableItems.filter(i => i.type === 'accessory').reduce((acc, item) => acc + (allParts[item.partId]?.price || 0) + (item.selectedColor?.price || 0), 0);
    if(accessoryPrice > 0) { total += accessoryPrice; breakdown.push({ label: 'Phụ kiện', value: accessoryPrice }); }
    
    const petPrice = config.draggableItems.filter(i => i.type === 'pet').reduce((acc, item) => acc + (allParts[item.partId]?.price || 0) + (item.selectedColor?.price || 0), 0);
    if(petPrice > 0) { total += petPrice; breakdown.push({ label: 'Thú cưng', value: petPrice }); }

    return { totalPrice: total, priceBreakdown: breakdown };
};


type Transform = { x: number; y: number; rotation: number; scale: number; width?: number };

// ... (Keep StepIndicator component as is) ...
const StepIndicator: React.FC<{ currentStep: number; setStep: (step: number) => void }> = ({ currentStep, setStep }) => {
  const steps = ['Thông tin SP', 'Nền & Chữ', 'Thiết kế', 'Mua hàng'];
  
  return (
    <div className="w-full max-w-3xl mx-auto md:mx-0 my-6 px-2">
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

// Updated Step1Frame to use dynamic frames and colors
const Step1Frame: React.FC<{ config: FrameConfig; setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>; frames: FrameOption[] }> = ({ config, setConfig, frames }) => {
  const selectedFrame = frames.find(f => f.id === config.frameId) || frames[0];
  
  // Effect to ensure frame color is valid for selected frame
  useEffect(() => {
      if (selectedFrame && selectedFrame.colors && selectedFrame.colors.length > 0) {
          if (!config.frameColor || !selectedFrame.colors.includes(config.frameColor)) {
              setConfig(prev => ({ ...prev, frameColor: selectedFrame.colors[0] }));
          }
      }
  }, [selectedFrame, config.frameColor, setConfig]);

  return (
    <div className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-gray-800 mb-3">CHỌN KÍCH THƯỚC</h4>
        <div className="grid grid-cols-3 gap-3">
          {frames.map(frame => (
            <button
              key={frame.id}
              onClick={() => setConfig(prev => ({ ...prev, frameId: frame.id }))}
              disabled={frame.stock === 0}
              className={`border rounded-lg py-2 px-1 text-xs sm:text-sm font-semibold transition-all duration-200 flex flex-col items-center justify-center h-20 relative ${
                config.frameId === frame.id ? 'bg-luvin-pink text-gray-800 border-luvin-pink' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              } ${frame.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span>{frame.name}</span>
              <span className="font-normal opacity-80 mt-1">{formatCurrency(frame.price)}</span>
              {frame.stock === 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] px-1 rounded-bl">Hết hàng</span>}
            </button>
          ))}
        </div>
        {/* Frame Color Selection */}
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
                            return { bg: c, border: c }; // Fallback
                        };
                        const style = getColorStyle(color);
                        const isSelected = config.frameColor === color;

                        return (
                            <button 
                                key={color}
                                onClick={() => setConfig(prev => ({ ...prev, frameColor: color }))}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all capitalize ${isSelected ? 'border-luvin-pink ring-1 ring-luvin-pink bg-pink-50' : 'border-gray-200 hover:bg-gray-50'}`}
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
            className={`border-2 rounded-xl p-1.5 flex flex-col items-center justify-start gap-1.5 transition-all text-center w-full relative group ${
                isSelected
                    ? 'border-luvin-pink bg-pink-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
        >
            <div className="w-full aspect-[4/5] rounded-md bg-gray-100 overflow-hidden flex items-center justify-center relative">
                <img
                    src={bg.url}
                    alt={bg.name}
                    className="w-full h-full object-cover"
                />
                {/* Corner Zoom Button (Bottom Right Only) */}
                <div className="absolute bottom-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div 
                        className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-full cursor-pointer pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); onZoom(bg.url); }}
                        title="Zoom"
                    >
                        <ZoomIcon className="w-4 h-4" />
                    </div>
                </div>
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
  setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>;
  addText: () => void;
  addCharm: (dataUrl: string) => void;
  backgrounds: PresetBackground[];
  onZoomImage: (url: string) => void;
}> = ({ config, setConfig, addText, addCharm, backgrounds, onZoomImage }) => {
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const charmUploadRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  const availableBackgrounds = useMemo(() => {
    const isSquare = config.frameId === 'sm' || config.frameId === 'lg';
    const typeNeeded = isSquare ? 'square' : 'rectangle';
    return backgrounds.filter(bg => bg.type === typeNeeded);
  }, [config.frameId, backgrounds]);

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

  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          setConfig((prev) => ({ ...prev, background: { type: 'upload', value: event.target.result as string } }));
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
            filteredBackgrounds.map((bg) => (
              <PresetBackgroundButton
                key={bg.id}
                bg={bg}
                isSelected={config.background.value === bg.url}
                onClick={() => setConfig((prev) => ({ ...prev, background: { type: 'image', value: bg.url } }))}
                onZoom={onZoomImage}
              />
            ))
          ) : (
            <p className="col-span-3 text-center text-sm text-gray-500 py-10">
              {backgrounds.length === 0 ? "Đang tải dữ liệu..." : "Không có mẫu nào phù hợp."}
            </p>
          )}
        </div>
      </div>
      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-gray-800 mb-3">B. HOẶC TẢI ẢNH CỦA BẠN</h4>
        <button onClick={() => bgUploadRef.current?.click()} className="w-full font-semibold bg-gray-200 text-gray-800 py-2.5 px-3 rounded-lg hover:bg-gray-300">
          Tải ảnh nền
        </button>
      </div>

      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-bold text-gray-800 mb-2">C. THÊM CHỮ & TRANG TRÍ</h4>
        <p className="text-sm text-gray-600 mb-3">Chỉnh sửa trực tiếp trên khung xem trước.</p>
        <div className="flex gap-2">
            <button onClick={addText} className="w-full font-semibold bg-gray-200 text-gray-800 py-2.5 px-3 rounded-lg hover:bg-gray-300">
              + Thêm chữ mới
            </button>
            <button onClick={() => charmUploadRef.current?.click()} className="w-full font-semibold bg-gray-200 text-gray-800 py-2.5 px-3 rounded-lg hover:bg-gray-300">
              Tải ảnh nhỏ
            </button>
        </div>
      </div>
      <input type="file" ref={bgUploadRef} accept="image/*" onChange={handleBgFileUpload} className="hidden" />
      <input type="file" ref={charmUploadRef} accept="image/*" onChange={handleCharmFileUpload} className="hidden" />
    </div>
  );
};

const PartButton: React.FC<{
    part: LegoPart;
    isSelected: boolean;
    onClick: () => void;
}> = ({ part, isSelected, onClick }) => {
    const [imgError, setImgError] = useState(false);
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = () => {
        setIsClicked(true);
        onClick();
        setTimeout(() => setIsClicked(false), 300); // Reset click effect after 300ms
    };
    
    return (
        <button
            onClick={handleClick}
            className={`border rounded-lg p-1.5 flex flex-col items-center justify-start gap-1 transition-all text-center w-full relative overflow-hidden ${
                isSelected
                    ? 'border-luvin-pink bg-pink-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
            } ${isClicked ? 'ring-2 ring-luvin-pink ring-opacity-50 scale-95' : ''}`}
        >
            {isClicked && (
                <div className="absolute inset-0 bg-luvin-pink opacity-20 z-10 animate-ping rounded-lg"></div>
            )}
            <div className="w-full aspect-square rounded-md bg-gray-100 overflow-hidden flex items-center justify-center">
                {!imgError && part.imageUrl ? (
                    <img 
                        src={part.imageUrl} 
                        alt={part.name} 
                        className="w-full h-full object-contain" 
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="text-[10px] text-gray-400 text-center p-1">No Image</div>
                )}
            </div>
            <div className="flex flex-col justify-center items-center flex-shrink-0 h-10 leading-tight">
                <span className="text-[11px] font-semibold text-gray-800">{part.name}</span>
                <span className="text-[11px] font-bold text-luvin-pink">{formatCurrency(part.price)}</span>
            </div>
        </button>
    );
};

// Helper for sorting parts
const sortParts = (parts: LegoPart[], mode: 'default' | 'price_asc' | 'price_desc') => {
    if (mode === 'default') return parts;
    return [...parts].sort((a, b) => {
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        return mode === 'price_asc' ? priceA - priceB : priceB - priceA;
    });
};

const Step3Characters: React.FC<{ 
    config: FrameConfig; 
    setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>;
    legoParts: typeof LEGO_PARTS;
    selectedItemId?: string | null;
    setSelectedItemId: (id: string | null) => void;
    activePartType: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set';
    setActivePartType: (type: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set') => void;
}> = ({ config, setConfig, legoParts, selectedItemId, setSelectedItemId, activePartType, setActivePartType }) => {
    const [activeCharId, setActiveCharId] = useState<number | null>(config.characters[0]?.id || null);
    const activeCharacter = config.characters.find(c => c.id === activeCharId);
    const [printDialogCharId, setPrintDialogCharId] = useState<number | null>(null);
    
    // Sorting States
    const [sortMode, setSortMode] = useState<'default' | 'price_asc' | 'price_desc'>('default');
    const [accessorySortMode, setAccessorySortMode] = useState<'default' | 'price_asc' | 'price_desc'>('default');

    // Helper to filter out items with 0 stock
    const getAvailableParts = (list: LegoPart[]) => {
        return list.filter(p => p.stock === undefined || p.stock > 0);
    };

     useEffect(() => {
        if (!config.characters.find(c => c.id === activeCharId)) {
            setActiveCharId(config.characters[config.characters.length - 1]?.id || null);
        }
     }, [config.characters, activeCharId]);

     // Effect to sync active character with selectedItemId from preview
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
        // Should pick default available parts if first ones are out of stock
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
        setConfig(prev => ({ ...prev, characters: [...prev.characters, newCharacter] }));
        setActiveCharId(newId);
        
        // Auto-select new character and default to shirt to show colors
        setSelectedItemId(`character-${newId}`);
        setActivePartType('shirt');
    };
    
    const handleRemoveChar = (id: number) => {
        setConfig(prev => ({...prev, characters: prev.characters.filter(c => c.id !== id)}));
    };
    
    const addDraggableItem = (part: LegoPart) => {
        // Modified to also accept 'hat'
        if (part.type !== 'accessory' && part.type !== 'pet' && part.type !== 'hat') return;
        
        // Logic position for hat: Above current character head
        let startX = 50;
        let startY = 50;
        
        if (part.type === 'hat' && activeCharacter) {
            startX = activeCharacter.x;
            startY = activeCharacter.y - 35; // Approximate head position offset
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
        setConfig(prev => ({...prev, draggableItems: [...prev.draggableItems, newItem]}));
    }

    const handlePartSelect = (part: LegoPart | undefined) => {
        if (!activeCharId || !part) return;

        // Special handling for Hat: Add as independent draggable item
        if (part.type === 'hat') {
            addDraggableItem(part);
            return;
        }

        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
                if (c.id === activeCharId) {
                    const newChar = { ...c };
                    
                    // Handle Sets (Vests/Combos)
                    if (part.type === 'set') {
                        newChar.shirt = part;
                        newChar.pants = undefined; // Clear pants so they don't conflict visually
                    } else {
                        // Standard assignment
                        (newChar as any)[part.type] = part;
                        // If selecting standard pants/shirt while a set was active, ensure logic holds
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
        }));
    };

    const handlePartDeselect = (partType: 'hair' | 'hat') => {
      if (!activeCharId) return;
      
      // For Hat: Since hats are now draggable items, "deselecting" here isn't really applicable 
      // unless we want to clear all hats. But typically user will delete specific hat.
      // We will keep it for 'hair' to allow bald characters.
      if (partType === 'hat') return;

      setConfig(prev => ({
        ...prev,
        characters: prev.characters.map(c => {
            if (c.id === activeCharId) {
                const updatedChar = { ...c, [partType]: undefined };
                return updatedChar;
            }
            return c;
        })
      }));
    }
    
    const handleCustomPrintSelect = (price: number) => {
      if (!printDialogCharId) return;
      setConfig(prev => ({
        ...prev,
        characters: prev.characters.map(c => 
          c.id === printDialogCharId ? { ...c, customPrintPrice: price } : c
        )
      }));
      setPrintDialogCharId(null);
    };

    const handleRandomizeOutfit = () => {
        if (!activeCharId) return;
        
        // 1. Filter available parts first to ensure we don't pick out-of-stock items
        const availableHair = getAvailableParts(legoParts.hair);
        const availableFace = getAvailableParts(legoParts.face);
        const availableShirt = getAvailableParts(legoParts.shirt);
        const availablePants = getAvailableParts(legoParts.pants);

        const getRandomItem = (list: LegoPart[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : undefined;
        
        const getRandomColor = (colors: OutfitColor[] | undefined) => {
            if (!colors) return undefined;
            // Filter available colors
            const availableColors = colors.filter(c => c.stock === undefined || c.stock > 0);
            return availableColors.length > 0 ? availableColors[Math.floor(Math.random() * availableColors.length)] : undefined;
        };

        const randomHair = getRandomItem(availableHair);
        const randomFace = getRandomItem(availableFace);
        const randomShirt = getRandomItem(availableShirt);
        const randomPants = getRandomItem(availablePants);
        // Note: We don't randomize Hat here anymore as it's a separate object.

        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
                if (c.id === activeCharId) {
                    const newChar: LegoCharacterConfig = { ...c };
                    
                    // Only replace if a random available item was found, otherwise keep current
                    newChar.face = randomFace || c.face;
                    newChar.shirt = randomShirt || c.shirt;
                    newChar.pants = randomPants || c.pants;
                    newChar.hair = randomHair || c.hair;

                    // Default colors logic with stock check
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
        }));
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
                            className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors"
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
                            <button onClick={() => setActiveCharId(char.id)} className={`px-4 py-2 text-sm rounded-lg font-medium ${activeCharId === char.id ? 'bg-pink-100 text-luvin-pink border border-luvin-pink' : 'bg-gray-200 text-gray-800'}`}>
                                NV {index + 1}
                            </button>
                            <button onClick={() => handleRemoveChar(char.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs font-bold">
                                &times;
                            </button>
                        </div>
                    ))}
                    <button onClick={handleAddChar} className="bg-green-500 text-white text-sm px-4 py-2 rounded-lg font-medium">+ Thêm ({formatCurrency(CHARACTER_BASE_PRICE)})</button>
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
                        <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar items-center">
                            {partTypes.map(pt => (
                                <button key={pt.key} onClick={() => setActivePartType(pt.key)} className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${activePartType === pt.key ? 'bg-luvin-pink text-white' : 'bg-gray-200 text-gray-800'}`}>
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
                        {currentPartList.length > 0 ? currentPartList.map(part => (
                            <PartButton 
                                key={part.id} 
                                part={part}
                                isSelected={activePartType === 'hat' ? false : activeCharacter[activePartType === 'set' ? 'shirt' : activePartType]?.id === part.id}
                                onClick={() => handlePartSelect(part)} 
                            />
                        )) : (
                            <div className="col-span-4 text-center text-sm text-gray-400 py-4">
                                {legoParts[activePartType].length > 0 ? "Các sản phẩm này đang hết hàng." : "Đang tải hoặc chưa có dữ liệu..."}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-800">THÊM PHỤ KIỆN</h4>
                    {/* KEEPING SORT DROPDOWN ONLY HERE */}
                    <select 
                        value={accessorySortMode}
                        onChange={(e) => setAccessorySortMode(e.target.value as any)}
                        className="text-xs border border-gray-300 rounded p-1 bg-white outline-none"
                    >
                        <option value="default">Sắp xếp</option>
                        <option value="price_asc">Giá tăng</option>
                        <option value="price_desc">Giá giảm</option>
                    </select>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {sortParts(getAvailableParts(legoParts.accessory), accessorySortMode).map(part => (
                        <PartButton key={part.id} part={part} isSelected={false} onClick={() => addDraggableItem(part)} />
                    ))}
                </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-3">THÊM THÚ CƯNG</h4>
                <div className="grid grid-cols-4 gap-2">
                    {getAvailableParts(legoParts.pet).map(part => (
                        <PartButton key={part.id} part={part} isSelected={false} onClick={() => addDraggableItem(part)} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const Step4Summary: React.FC<{ totalPrice: number; priceBreakdown: {label: string, value: number}[]; frameName: string; charCount: number; onAddToCart: () => void; onBuyNow: () => void; isSaving: boolean; }> = ({ totalPrice, priceBreakdown, frameName, charCount, onAddToCart, onBuyNow, isSaving }) => {
  const remainingForFreeShip = FREE_SHIPPING_THRESHOLD - totalPrice;

  return (
    <div>
        <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">THÔNG TIN KHUNG</h4>
            <div className="space-y-1 text-sm text-gray-700 mb-4">
                <p><strong>Kích thước:</strong> {frameName}</p>
                <p><strong>Số nhân vật:</strong> {charCount}</p>
            </div>
            
            <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">GIÁ DỰ KIẾN</h4>
            <div className="space-y-1 text-sm text-gray-700">
                {priceBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between">
                        <span>{item.label}</span>
                        <span className="font-medium">{item.value > 0 ? formatCurrency(item.value) : formatCurrency(0, 'price')}</span>
                    </div>
                ))}
                <div className="border-t border-gray-200 my-2"></div>
                <div className="flex justify-between text-base font-bold text-gray-800">
                    <span>Tổng cộng</span>
                    <span>{formatCurrency(totalPrice)}</span>
                </div>
                
                {/* Free Shipping Notification */}
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
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
        </div>
        <div className="mt-4 space-y-2">
            <button onClick={onBuyNow} disabled={isSaving} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-base hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-wait">
                {isSaving ? 'Đang xử lý...' : 'Mua ngay & Thanh toán'}
            </button>
            <button onClick={onAddToCart} disabled={isSaving} className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-lg text-base hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-wait">
                {isSaving ? '...' : 'Thêm vào giỏ hàng'}
            </button>
        </div>
    </div>
  );
};

const Header: React.FC<{ navigateTo: (page: Page) => void; cartCount: number; onCartClick: () => void; logoUrl: string; }> = ({ navigateTo, cartCount, onCartClick, logoUrl }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isMenuOpen]);
  
  const navItems: { label: string; page: Page }[] = [
    { label: 'Trang chủ', page: 'home' }, 
    { label: 'Thiết kế', page: 'builder' }, 
    { label: 'Bộ sưu tập', page: 'collection' }, 
    { label: 'Tra cứu', page: 'order-lookup' },
    { label: 'Về chúng tôi', page: 'about' }, // Added About Us
  ];
  
  const handleNav = (page: Page) => { navigateTo(page); setIsMenuOpen(false); }

  return (
    <>
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-40 shadow-sm border-b border-gray-200">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="cursor-pointer" onClick={() => handleNav('home')}>
              {logoUrl ? <img src={logoUrl} alt="The Luvin" className="h-12 object-contain" /> : <span className="font-heading text-2xl text-luvin-pink">The Luvin</span>}
          </div>
          <div className="hidden md:flex items-center space-x-6 font-body">
            {navItems.map(item => (
              <button key={item.page} onClick={() => handleNav(item.page)} className="text-gray-800 hover:text-luvin-pink transition-colors font-semibold text-sm">
                {item.label}
              </button>
            ))}
            <button onClick={onCartClick} className="relative text-gray-800 hover:text-luvin-pink transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path></svg>
              {cartCount > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
          <div className="md:hidden flex items-center gap-4">
            <button onClick={onCartClick} className="relative text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 0 0 0 2-1.61L23 6H6"></path></svg>
                {cartCount > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{cartCount}</span>}
            </button>
            <button onClick={() => setIsMenuOpen(true)} className="text-gray-800 focus:outline-none">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
            </button>
          </div>
        </nav>
      </header>

      <div 
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isMenuOpen}
      >
        <div 
          className="absolute inset-0 bg-black/40"
          onClick={() => setIsMenuOpen(false)}
        ></div>
        <div className={`absolute top-0 right-0 h-full w-4/5 max-w-xs bg-white transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
              <div className="p-5 flex justify-end">
                <button onClick={() => setIsMenuOpen(false)} className="text-gray-800">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <div className="flex flex-col items-start space-y-6 p-8 font-body">
                  {navItems.map(item => ( 
                    <button 
                      key={item.page} 
                      onClick={() => handleNav(item.page)} 
                      className="text-gray-800 hover:text-luvin-pink text-xl font-semibold"
                    >
                      {item.label}
                    </button> 
                  ))}
              </div>
            </div>
        </div>
      </div>
    </>
  );
};

// ... (Keep InstagramIcon, FacebookIcon, Footer, HomePage, TextEditor, BuilderPage, CollectionPage, CartPage components as is) ...
// ... skipping redundant parts for brevity ...
const InstagramIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-instagram"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
)

const FacebookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-facebook"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
)

const Footer: React.FC<{ navigateTo: (page: Page) => void }> = ({ navigateTo }) => {
  return (
    <footer className="bg-white text-gray-800 mt-auto font-body text-sm">
        <div className="bg-gray-100 py-2">
            <div className="container mx-auto px-6 text-center text-gray-500 text-xs tracking-widest">
                <span>LEGO</span>
                <span className="mx-2">|</span>
                <span>QUÀ TẶNG</span>
                <span className="mx-2">|</span>
                <span>KỶ NIỆM</span>
                <span className="mx-2">|</span>
                <span>TÌNH YÊU</span>
            </div>
        </div>
        <div className="container mx-auto px-6 py-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <h3 className="font-bold text-base mb-3 text-luvin-pink font-heading text-xl">The Luvin</h3>
                    <p className="text-gray-600 text-xs leading-relaxed">Nơi những mảnh ghép LEGO kể câu chuyện tình yêu của riêng bạn. Quà tặng độc đáo, tinh tế và đầy ý nghĩa.</p>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3">LIÊN HỆ</h3>
                    <p className="text-gray-600 mb-1">Địa chỉ: Khu 6, Thư Lâm, Hà Nội</p>
                    <p className="text-gray-600 mb-1">Hotline: 0964 393 115</p>
                    <p className="text-gray-600">Email: theluvin.gifts@gmail.com</p>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3">CHÍNH SÁCH & HỖ TRỢ</h3>
                    <ul className="space-y-2">
                        <li><button onClick={() => navigateTo('order-lookup')} className="text-gray-600 hover:text-luvin-pink transition-colors">Tra cứu đơn hàng</button></li>
                        <li><button onClick={() => navigateTo('warranty')} className="text-gray-600 hover:text-luvin-pink transition-colors">Chính sách bảo hành</button></li>
                        <li><button onClick={() => navigateTo('about')} className="text-gray-600 hover:text-luvin-pink transition-colors">Về chúng tôi</button></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3">KẾT NỐI VỚI CHÚNG TÔI</h3>
                    <div className="flex space-x-4">
                        <a href="https://www.instagram.com/the_luvin/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-luvin-pink hover:text-white transition-all"><InstagramIcon /></a>
                        <a href="https://www.facebook.com/theluvingifts" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-blue-600 hover:text-white transition-all"><FacebookIcon /></a>
                    </div>
                </div>
            </div>
        </div>
        <div className="border-t border-gray-200">
            <div className="container mx-auto px-6 py-4 flex flex-col items-center justify-center text-xs text-gray-500 relative">
                <p className="mb-2">Copyright © {new Date().getFullYear()} The Luvin. All Rights Reserved.</p>
                <a href="https://www.facebook.com/ngojinbtrongduong/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors font-medium">
                   Designed & Developed by <strong>Trong Duong</strong>
                </a>
            </div>
        </div>
    </footer>
  );
};

// ... (Keep AboutPage, WarrantyPage, HomePage, TextEditor, BuilderPage, CollectionPage, CartPage as is) ...
const AboutPage: React.FC = () => {
    return (
        <div className="bg-white font-body text-gray-800">
            <div className="relative py-20 bg-luvin-cream">
                <div className="container mx-auto px-6 text-center">
                    <h1 className="text-4xl md:text-5xl font-heading text-luvin-pink mb-4">Câu chuyện của The Luvin</h1>
                    <p className="text-lg max-w-2xl mx-auto text-gray-600 italic">"Không chỉ là quà tặng, đó là những kỷ niệm được đóng khung."</p>
                </div>
            </div>
            
            <div className="container mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16">
                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-gray-900">Khởi nguồn</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            The Luvin ra đời từ tình yêu với những mảnh ghép LEGO và mong muốn tạo ra những món quà cá nhân hóa thực sự ý nghĩa. Chúng tôi tin rằng mỗi mối quan hệ, mỗi kỷ niệm đều xứng đáng được lưu giữ một cách đặc biệt nhất.
                        </p>
                        <p className="text-gray-600 leading-relaxed">
                            Thay vì những món quà công nghiệp hàng loạt, The Luvin cho phép bạn tự tay thiết kế từng chi tiết nhỏ: từ màu tóc, trang phục cho đến những phụ kiện nhỏ xinh đại diện cho sở thích của người thương.
                        </p>
                    </div>
                    <div className="rounded-lg overflow-hidden shadow-lg bg-gray-100 aspect-video flex items-center justify-center">
                        <span className="text-gray-400 font-script text-2xl">Hình ảnh workshop / team</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="p-6 border border-gray-100 rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-luvin-pink text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl">✨</div>
                        <h3 className="font-bold text-lg mb-2">Cá nhân hóa 100%</h3>
                        <p className="text-sm text-gray-600">Bạn là người thiết kế chính. Từng nhân vật, từng dòng chữ đều mang dấu ấn riêng của bạn.</p>
                    </div>
                    <div className="p-6 border border-gray-100 rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-luvin-pink text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl">💎</div>
                        <h3 className="font-bold text-lg mb-2">Chất lượng cao cấp</h3>
                        <p className="text-sm text-gray-600">Sử dụng mảnh ghép LEGO chính hãng/cao cấp và khung ảnh composite bền đẹp theo thời gian.</p>
                    </div>
                    <div className="p-6 border border-gray-100 rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-luvin-pink text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl">💌</div>
                        <h3 className="font-bold text-lg mb-2">Gói ghém tận tâm</h3>
                        <p className="text-sm text-gray-600">Mỗi đơn hàng đều được đóng gói cẩn thận như một món quà gửi đến chính người thân của chúng tôi.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

const WarrantyPage: React.FC = () => {
    return (
        <div className="bg-gray-50 font-body text-gray-800 py-12 min-h-screen">
            <div className="container mx-auto px-6 max-w-3xl">
                <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">Chính sách Bảo hành & Đổi trả</h1>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold text-luvin-pink mb-4 flex items-center gap-2">
                            <span>🛡️</span> Chính sách đổi trả
                        </h2>
                        <div className="space-y-3 text-sm text-gray-700">
                            <p>The Luvin hỗ trợ đổi trả/hoàn tiền trong vòng <strong>03 ngày</strong> kể từ khi nhận hàng đối với các trường hợp sau:</p>
                            <ul className="list-disc list-inside pl-2 space-y-1">
                                <li>Sản phẩm bị vỡ, hỏng hóc nghiêm trọng do vận chuyển.</li>
                                <li>Sản phẩm sai mẫu mã, sai thiết kế so với đơn đặt hàng đã chốt (sai tóc, sai áo, sai chữ...).</li>
                                <li>Thiếu các bộ phận/chi tiết quan trọng.</li>
                            </ul>
                            <p className="italic mt-2 text-gray-500 bg-gray-50 p-2 rounded">Lưu ý: Vui lòng quay video mở hộp (unbox) để làm bằng chứng đối chiếu khi khiếu nại.</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold text-luvin-pink mb-4 flex items-center gap-2">
                            <span>🔧</span> Chính sách bảo hành
                        </h2>
                        <div className="space-y-3 text-sm text-gray-700">
                            <p>Chúng tôi bảo hành sản phẩm trong vòng <strong>30 ngày</strong> với các lỗi:</p>
                            <ul className="list-disc list-inside pl-2 space-y-1">
                                <li>Keo dán bị bong tróc tự nhiên.</li>
                                <li>Khung ảnh bị nứt/cong vênh do lỗi nhà sản xuất.</li>
                            </ul>
                            <p>Không bảo hành với các lỗi do người sử dụng gây ra như: làm rơi vỡ, để sản phẩm ở nơi ẩm ướt/nhiệt độ cao, tự ý tháo lắp làm hỏng chi tiết.</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold text-luvin-pink mb-4 flex items-center gap-2">
                            <span>🚚</span> Quy trình xử lý
                        </h2>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                            <li>Liên hệ ngay với The Luvin qua Fanpage hoặc Hotline <strong>0964 393 115</strong> khi gặp sự cố.</li>
                            <li>Gửi hình ảnh/video tình trạng sản phẩm.</li>
                            <li>Chúng tôi sẽ xác nhận và gửi phương án xử lý (Gửi bù linh kiện / Đổi mới / Hoàn tiền) trong vòng 24h.</li>
                            <li>Chi phí vận chuyển đổi trả (nếu do lỗi của The Luvin) sẽ được chúng tôi chi trả 100%.</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
}

const HomePage: React.FC<{ 
    navigateTo: (page: Page) => void;
    heroImage?: string;
    inspireImage?: string;
    feedbacks?: FeedbackItem[]; // Changed to prop
    templates?: CollectionTemplate[]; // Added to display collections from DB
}> = ({ navigateTo, heroImage, inspireImage, feedbacks, templates }) => {
  const BowIcon = () => (
    <svg className="w-6 h-6 text-luvin-pink opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 1.5C12 1.5 12 5.5 15 8.5C18 11.5 22.5 12 22.5 12C22.5 12 18 12.5 15 15.5C12 18.5 12 22.5 12 22.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 22.5C12 22.5 12 18.5 9 15.5C6 12.5 1.5 12 1.5 12C1.5 12 6 11.5 9 8.5C12 5.5 12 1.5 12 1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Use templates from DB if available for the carousel, fallback to constant
  const sliderProducts = useMemo(() => {
      if (templates && templates.length > 0) return templates.slice(0, 4);
      return COLLECTION_TEMPLATES.slice(0, 4);
  }, [templates]);

  useEffect(() => {
    const interval = setInterval(() => {
      handleNext();
    }, 4000);
    return () => clearInterval(interval);
  }, [sliderProducts]);

  const handlePrev = () => {
    setActiveSlide(prev => (prev - 1 + sliderProducts.length) % sliderProducts.length);
  };
  const handleNext = () => {
    setActiveSlide(prev => (prev + 1) % sliderProducts.length);
  };

  // If no images are set, don't render the background image style or use a placeholder class
  const heroStyle = heroImage ? {backgroundImage: `url(${heroImage})`} : { backgroundColor: '#fce7f3' }; 
  const inspireStyle = inspireImage ? {backgroundImage: `url(${inspireImage})`} : { backgroundColor: '#fce7f3' };

  const displayFeedbacks = (feedbacks && feedbacks.length > 0) ? feedbacks : [];

  return (
    <div>
      <div className="flex flex-col min-h-[calc(100vh-80px)]">
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2">
          <div className="hidden md:block bg-cover bg-center" style={heroStyle}></div>
          <div className="flex flex-col justify-center items-center p-8 text-center bg-white">
             <h1 className="text-5xl font-heading text-luvin-pink">The Luvin</h1>
             <p className="font-script text-3xl my-4 text-gray-600">Unique for every momment</p>
             <button 
               onClick={() => navigateTo('builder')}
               className="mt-4 border-2 border-luvin-pink text-luvin-pink font-bold py-2 px-8 rounded-full hover:bg-luvin-pink hover:text-gray-800 transition-colors duration-300 font-body tracking-wider"
             >
               BẮT ĐẦU THIẾT KẾ
             </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto my-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 items-center">
          <div className="h-[500px] md:h-[600px] bg-cover bg-center" style={inspireStyle}></div>
          <div className="bg-gray-100 flex flex-col justify-center items-center p-8 md:p-16 h-[500px] md:h-[600px] relative">
              {sliderProducts.length > 0 ? (
                  <>
                    <div className="relative w-full max-w-xs aspect-square">
                        {sliderProducts.map((product, index) => (
                            <img 
                                key={product.id} 
                                src={product.imageUrl} 
                                alt={product.name}
                                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ease-in-out ${activeSlide === index ? 'opacity-100' : 'opacity-0'}`}
                            />
                        ))}
                    </div>
                    <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/50 p-2 rounded-full hover:bg-white transition-colors z-10">&larr;</button>
                    <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/50 p-2 rounded-full hover:bg-white transition-colors z-10">&rarr;</button>
                    <div className="flex gap-3 my-6">
                        {sliderProducts.map((_, index) => (
                            <button 
                                key={index}
                                onClick={() => setActiveSlide(index)}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${activeSlide === index ? 'bg-gray-800 scale-125' : 'bg-gray-400 hover:bg-gray-400'}`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                    <div className="text-center h-20">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Featured</p>
                        <h3 className="font-semibold text-lg mt-1">{sliderProducts[activeSlide].name}</h3>
                    </div>
                  </>
              ) : (
                  <p className="text-gray-500">Chưa có sản phẩm nổi bật.</p>
              )}
          </div>
        </div>
      </div>

      <div className="py-12 bg-white group">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-bold font-body text-center mb-8">Our feedbacks</h2>
          <div className="w-full overflow-hidden relative">
            {displayFeedbacks.length > 0 ? (
                <div className="flex animate-marquee whitespace-nowrap">
                    {[...displayFeedbacks, ...displayFeedbacks].map((feedback, index) => (
                    <div key={index} className="flex-shrink-0 w-60 sm:w-72 bg-luvin-cream p-4 rounded-xl flex flex-col items-center mx-4">
                        <h3 className="font-script text-3xl text-luvin-pink mb-3">Feedback</h3>
                        <div className="w-full aspect-square rounded-lg overflow-hidden">
                        <img src={feedback.imageUrl} alt={feedback.name} className="w-full h-full object-cover"/>
                        </div>
                        <div className="mt-4 text-center whitespace-normal">
                            <p className="text-sm font-semibold text-gray-800">{feedback.name}</p>
                            <p className="text-xs text-gray-600 italic mt-1">"{feedback.text}"</p>
                        </div>
                        <div className="mt-4">
                        <BowIcon />
                        </div>
                    </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-gray-500">Chưa có feedback nào.</p>
            )}
            <div className="absolute top-0 left-0 w-16 h-full bg-gradient-to-r from-white to-transparent"></div>
            <div className="absolute top-0 right-0 w-16 h-full bg-gradient-to-l from-white to-transparent"></div>
          </div>
        </div>
      </div>

    </div>
  );
};


const TextEditor: React.FC<{
    activeText: TextConfig;
    setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>;
    selectedTextId: number;
    deselect: () => void;
    onAddText: () => void;
}> = ({ activeText, setConfig, selectedTextId, deselect, onAddText }) => {
    
    const updateActiveText = (updates: Partial<TextConfig>) => {
        setConfig(prev => ({
            ...prev,
            texts: prev.texts.map((t) => t.id === selectedTextId ? { ...t, ...updates } : t)
        }));
    }
    
    return (
        <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">CHỈNH SỬA CHỮ</h3>
                <div className="flex gap-2">
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
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
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
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                </div>
                <div className="flex items-center justify-between gap-2">
                    <button onClick={() => updateActiveText({background: !activeText.background})} className={`text-sm px-3 py-2 rounded-lg ${activeText.background ? 'bg-luvin-pink text-gray-800' : 'bg-gray-200 text-gray-800'}`}>
                      {activeText.background ? 'Bỏ nền mờ' : 'Thêm nền mờ'}
                    </button>
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
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

const BuilderPage: React.FC<{ 
    config: FrameConfig; 
    setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>; 
    navigateTo: (p:Page) => void; 
    onAddToCart: (config: FrameConfig, openCartPanel?: boolean) => void; 
    onUpdateCart: (config: FrameConfig) => void; // ADDED
    showToast: (message: string, type: 'success' | 'error') => void;
    legoParts: typeof LEGO_PARTS; 
    backgrounds: PresetBackground[]; 
    frames: FrameOption[]; 
    editingCartIndex: number | null; // ADDED
    onCancelEdit: () => void; // ADDED
    onZoomImage: (url: string) => void; // ADDED
}> = ({ config, setConfig, navigateTo, onAddToCart, onUpdateCart, showToast, legoParts, backgrounds, frames, editingCartIndex, onCancelEdit, onZoomImage }) => {
  const [step, setStep] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const previewContainerParentRef = useRef<HTMLDivElement>(null);
  const frameCaptureRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(480);
  const [isSaving, setIsSaving] = useState(false);
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [isEditingText, setIsEditingText] = useState(false);
  const [activePartType, setActivePartType] = useState<'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set'>('shirt'); 

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
  
  const allParts = useMemo(() => Object.values(legoParts).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  // Pass frames to calculatePrice
  const { totalPrice, priceBreakdown } = useMemo(() => calculatePrice(config, allParts, frames), [config, allParts, frames]);
  
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
      
      setConfig(prev => {
          if (type === 'text') {
              const idToUpdate = parseInt(rawId);
              return { ...prev, texts: prev.texts.map(item => item.id === idToUpdate ? { ...item, ...newTransform } : item) };
          }
          const itemId = parseInt(rawId);
          if (type === 'character') return { ...prev, characters: prev.characters.map(item => item.id === itemId ? { ...item, ...newTransform } : item) };
          if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(item => item.id === itemId ? { ...item, ...newTransform } : item) };
          return prev;
      });
  }, [setConfig]);

  const handleItemFlip = useCallback((id: string) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      
      if (type === 'item') {
          const itemId = parseInt(rawId);
          setConfig(prev => ({
              ...prev,
              draggableItems: prev.draggableItems.map(item => 
                  item.id === itemId ? { ...item, isFlipped: !item.isFlipped } : item
              )
          }));
      }
  }, [setConfig]);

  const handleItemUpdate = useCallback((id: string, updates: Partial<DraggableItem>) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      
      if (type === 'item') {
          const itemId = parseInt(rawId);
          setConfig(prev => ({
              ...prev,
              draggableItems: prev.draggableItems.map(item => 
                  item.id === itemId ? { ...item, ...updates } : item
              )
          }));
      }
  }, [setConfig]);

  const handleCharacterUpdate = useCallback((id: number, updates: Partial<LegoCharacterConfig>) => {
      setConfig(prev => ({
          ...prev,
          characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c)
      }));
  }, [setConfig]);

  const handleItemRemoveCompletely = useCallback((id: string) => {
    const [type, ...rest] = id.split('-');
    const rawId = rest.join('-');
    
    setSelectedItemId(null);

    setConfig(prev => {
        if (type === 'text') {
            const idToDelete = parseInt(rawId, 10);
            return { ...prev, texts: prev.texts.filter(t => t.id !== idToDelete) };
        }
        const itemId = parseInt(rawId, 10);
        if (type === 'character') return { ...prev, characters: prev.characters.filter(item => item.id !== itemId) };
        if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(item => item.id !== itemId) };
        return prev;
    });
  }, [setConfig]);
  
  const handleItemDelete = useCallback((id: string) => {
    const [type, ...rest] = id.split('-');
    const rawId = rest.join('-');
    
    if (type === 'text') {
        const idToUpdate = parseInt(rawId, 10);
        // Check if text content is already empty
        const textItem = config.texts.find(t => t.id === idToUpdate);
        
        if (textItem && textItem.content && textItem.content.trim() !== '') {
             // Step 1: Clear content
             setConfig(prev => ({
                ...prev,
                texts: prev.texts.map(t => t.id === idToUpdate ? { ...t, content: '' } : t)
            }));
        } else {
             // Step 2: Remove completely
             handleItemRemoveCompletely(id);
        }
    } else {
        handleItemRemoveCompletely(id);
    }
  }, [setConfig, handleItemRemoveCompletely, config.texts]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId && !isEditingText) {
            if (e.key === 'Backspace' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
            }
            handleItemDelete(selectedItemId);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, handleItemDelete, isEditingText]);

  const handleTextUpdate = useCallback((id: number, updates: Partial<TextConfig>) => {
    setConfig(prev => ({
        ...prev,
        texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  }, [setConfig]);
  
  const addText = () => {
      const newId = Date.now();
      const newText: TextConfig = { id: newId, content: 'Nhập chữ...', font: 'Montserrat', size: 12, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: true, textAlign: 'center', width: 30 };
      setConfig(prev => ({...prev, texts: [...prev.texts, newText]}));
      setSelectedItemId(`text-${newId}`);
  };

  const addCharm = (dataUrl: string) => {
      const newCharm: DraggableItem = { id: Date.now(), partId: dataUrl, type: 'charm', x: 50, y: 50, rotation: 0, scale: 0.5 };
      setConfig(prev => ({...prev, draggableItems: [...prev.draggableItems, newCharm]}));
  }
  
  const captureFrameAsImage = async (): Promise<string> => {
    return new Promise((resolve) => {
      const originalSelectedId = selectedItemId;
      setSelectedItemId(null);

      // Increased delay to 200ms to ensure clean state
      setTimeout(async () => {
        const element = frameCaptureRef.current;
        if (element && typeof html2canvas !== 'undefined') {
          try {
            const canvas = await html2canvas(element, {
              backgroundColor: null,
              logging: false,
              useCORS: true,
              ignoreElements: (el) => el.classList.contains('transform-handle'),
            });
            resolve(canvas.toDataURL('image/png'));
          } catch (error) {
            console.error('Error capturing frame:', error);
            resolve('');
          } finally {
            setSelectedItemId(originalSelectedId);
          }
        } else {
          resolve('');
          setSelectedItemId(originalSelectedId);
        }
      }, 200);
    });
  };

  const handleAddToCartWrapper = async (andCheckout: boolean) => {
    setIsSaving(true);
    const imageUrl = await captureFrameAsImage();
    setIsSaving(false);
    if (imageUrl) {
      if (editingCartIndex !== null && !andCheckout) {
          // Updating existing item
          onUpdateCart({ ...config, previewImageUrl: imageUrl });
      } else {
          // Adding new item
          // Default quantity is 1
          onAddToCart({ ...config, previewImageUrl: imageUrl, quantity: 1 }, !andCheckout);
      }
      
      if (andCheckout) {
        navigateTo('checkout');
      }
    } else {
      showToast('Đã có lỗi xảy ra khi thêm vào giỏ hàng. Vui lòng thử lại.', 'error');
    }
  };

  const handleSaveDraft = () => {
      localStorage.setItem('design_draft', JSON.stringify(config));
      showToast('Đã lưu bản nháp thành công!', 'success');
  };

  const handleResetDesign = () => {
      if (confirm("Bạn có chắc muốn làm mới thiết kế? Mọi thay đổi sẽ bị xóa.")) {
          setConfig(prev => ({
              ...INITIAL_FRAME_CONFIG,
              frameId: prev.frameId, // Keep size
          }));
          setStep(1);
          setSelectedItemId(null);
      }
  };

  const handleShare = async () => {
      const imageUrl = await captureFrameAsImage();
      if (!imageUrl) return;

      // If Web Share API supported
      if (navigator.share) {
          try {
              const blob = await (await fetch(imageUrl)).blob();
              const file = new File([blob], "design.png", { type: "image/png" });
              await navigator.share({
                  title: 'My LEGO Frame Design',
                  text: 'Check out my design at The Luvin!',
                  files: [file],
              });
          } catch (error) {
              console.log('Error sharing', error);
          }
      } else {
          // Fallback: Copy to clipboard or download
          try {
              const blob = await (await fetch(imageUrl)).blob();
              const item = new ClipboardItem({ "image/png": blob });
              await navigator.clipboard.write([item]);
              showToast('Đã sao chép ảnh vào bộ nhớ tạm!', 'success');
          } catch (err) {
              // Final fallback: Open in new tab
              const link = document.createElement('a');
              link.href = imageUrl;
              link.download = 'my-design.png';
              link.click();
              showToast('Đã tải ảnh về máy!', 'success');
          }
      }
  };

  const handleCharacterDoubleClick = (charId: number) => {
      setStep(3); // Move to design step
      setSelectedItemId(`character-${charId}`);
  };

  const handleAutoAdvance = () => {
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
      // Pass frames prop to Step1Frame
      case 1: return <Step1Frame config={config} setConfig={setConfig} frames={frames} />;
      case 2: return <Step2BackgroundAndDecorations config={config} setConfig={setConfig} addText={addText} addCharm={addCharm} backgrounds={backgrounds} onZoomImage={onZoomImage} />;
      case 3: return <Step3Characters config={config} setConfig={setConfig} legoParts={legoParts} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} activePartType={activePartType} setActivePartType={setActivePartType} />;
      case 4: return <Step4Summary 
        totalPrice={totalPrice} 
        priceBreakdown={priceBreakdown} 
        frameName={frames.find(f => f.id === config.frameId)?.name || ''} 
        charCount={config.characters.length} 
        onAddToCart={() => handleAddToCartWrapper(false)} 
        onBuyNow={() => handleAddToCartWrapper(true)}
        isSaving={isSaving} />;
      default: return null;
    }
  };

  return (
    <div className="bg-gray-50 py-4 sm:py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-500">
                <button onClick={() => navigateTo('home')} className="hover:underline">Home</button> / Thiết kế & Mua hàng
            </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
            {editingCartIndex !== null ? 'Chỉnh sửa đơn hàng' : 'Thiết kế & Mua hàng Khung LEGO'}
        </h1>
        <StepIndicator currentStep={step} setStep={setStep} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 lg:items-start">
          <div className="lg:col-span-7" ref={previewContainerParentRef}>
            <div className="lg:sticky lg:top-24">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">ẢNH XEM TRƯỚC</h3>
                    <div className="flex gap-2">
                        <button onClick={handleSaveDraft} className="bg-white border border-gray-300 p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-xs font-bold flex items-center gap-1" title="Lưu bản nháp">
                            💾
                        </button>
                        <button onClick={handleShare} className="bg-white border border-gray-300 p-1.5 rounded-lg hover:bg-gray-100 text-blue-600 text-xs font-bold flex items-center gap-1" title="Chia sẻ/Lưu ảnh">
                            📤
                        </button>
                        <button onClick={handleResetDesign} className="bg-white border border-red-200 p-1.5 rounded-lg hover:bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1" title="Làm mới">
                            🗑️
                        </button>
                    </div>
                </div>
                {/* Removed overflow-hidden here to allow toolbar to overflow */}
                <div className="bg-gray-100 rounded-lg flex items-center justify-center aspect-square p-4 mb-12 lg:mb-0">
                    <FramePreview 
                        ref={frameCaptureRef}
                        config={config} 
                        containerWidth={previewWidth - 32} 
                        onItemTransform={handleItemTransform} 
                        onItemRemove={handleItemRemoveCompletely}
                        onTextUpdate={handleTextUpdate}
                        onItemUpdate={handleItemUpdate}
                        onCharacterUpdate={handleCharacterUpdate} // ADDED
                        onItemFlip={handleItemFlip}
                        onCharacterDoubleClick={handleCharacterDoubleClick}
                        onAutoAdvance={handleAutoAdvance} // PASS AUTO ADVANCE
                        className="w-full h-full"
                        selectedItemId={selectedItemId}
                        setSelectedItemId={setSelectedItemId}
                        setIsEditingText={setIsEditingText}
                        allParts={allParts}
                        activePartType={activePartType} // ADDED
                    />
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-start shadow-sm">
                    <span className="text-amber-500 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
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

          <div className="lg:col-span-5 mt-4 lg:mt-0">
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                  {selectedText ? (
                      <TextEditor 
                          activeText={selectedText}
                          setConfig={setConfig}
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
                  <div className="mt-4 text-right font-bold text-lg text-gray-800">
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
                                {isSaving ? '...' : 'Cập nhật giỏ hàng'}
                            </button>
                        </div>
                  )}
                  
                  {/* Only show standard navigation if not in the special update mode for step 4, OR if we are in update mode but not step 4 */}
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
                              className="w-full bg-luvin-pink text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:opacity-90 transition-colors"
                          >
                              Tiếp theo
                          </button>
                      </div>
                  )}
                </>
              )}
               <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-top p-4 z-30 transition-transform duration-300 ease-in-out ${isBottomBarVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                     <div className="text-right font-bold text-base text-gray-800 mb-2">
                        Giá tạm tính: <span className="text-luvin-pink">{formatCurrency(totalPrice)}</span>
                      </div>
                     
                     {editingCartIndex !== null && step === 4 ? (
                        <div className="flex flex-col gap-2">
                            <button onClick={() => handleAddToCartWrapper(false)} disabled={isSaving} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-base hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                {isSaving ? '...' : 'Cập nhật giỏ hàng'}
                            </button>
                            <button onClick={onCancelEdit} className="w-full bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors">
                                Hủy sửa
                            </button>
                        </div>
                     ) : (
                         <div className="flex items-center gap-4">
                           <button
                              onClick={() => setStep(s => Math.max(1, s - 1))}
                              disabled={step === 1}
                              className="w-full bg-white border border-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:bg-gray-100 transition-colors"
                          >
                              Quay lại
                          </button>
                          <button
                              onClick={() => setStep(s => Math.min(4, s + 1))}
                              disabled={step === 4}
                              className="w-full bg-luvin-pink text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:opacity-90 transition-colors"
                          >
                              Tiếp theo
                          </button>
                         </div>
                     )}
                </div>
               <div className="lg:hidden h-32"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ... (Keep CollectionPage, CartPage, CartPanel, CheckoutPage, OrderConfirmationPage, OrderLookupPage, categorizeParts as is) ...
// ... skipping redundant parts for brevity ...
const CollectionPage: React.FC<{ navigateTo: (page: Page) => void, setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>, templates?: CollectionTemplate[] }> = ({ navigateTo, setConfig, templates }) => {
    const displayTemplates = (templates && templates.length > 0) ? templates : COLLECTION_TEMPLATES;
    
    const handleCustomize = (config: FrameConfig) => { setConfig(config); navigateTo('builder'); };
    
    return ( 
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-5xl font-heading text-center text-luvin-pink mb-8">Bộ sưu tập The Luvin</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayTemplates.length > 0 ? displayTemplates.map((template, index) => ( 
            <div key={template.id || index} className="bg-white rounded-lg shadow-lg overflow-hidden group">
              <div className="relative">
                <img src={template.imageUrl} alt={template.name} className="w-full h-72 object-cover" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                  <button onClick={() => handleCustomize(template.config)} className="bg-white/80 text-luvin-pink font-bold py-2 px-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-body">
                    Tùy chỉnh mẫu này
                  </button>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold font-body text-luvin-pink">{template.name}</h3>
              </div>
            </div> 
          )) : (
              <p className="col-span-3 text-center text-gray-500">Đang cập nhật bộ sưu tập...</p>
          )}
        </div>
      </div> 
    );
}

const CartPage: React.FC<{ 
    cartItems: FrameConfig[]; 
    onRemoveItem: (index: number) => void; 
    onEditItem: (index: number) => void; // ADDED
    allParts: Record<string, LegoPart>; 
    navigateTo: (page: Page) => void;
    onUpdateQuantity: (index: number, newQuantity: number) => void;
    onZoomImage: (url: string) => void;
}> = ({ cartItems, onRemoveItem, onEditItem, allParts, navigateTo, onUpdateQuantity, onZoomImage }) => {
    const totalCartPrice = cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1), 0);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <h1 className="text-5xl font-heading text-center text-luvin-pink mb-8">Giỏ hàng của bạn</h1>
            {cartItems.length === 0 ? (
                <p className="text-center text-gray-600 font-body text-lg">Giỏ hàng của bạn đang trống.</p>
            ) : (
                <div className="max-w-4xl mx-auto">
                    <div className="space-y-6">
                        {cartItems.map((item, index) => {
                            const { totalPrice } = calculatePrice(item, allParts, FRAME_OPTIONS);
                            const frame = FRAME_OPTIONS.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
                            const quantity = item.quantity || 1;
                            
                            return (
                                <div key={index} className="bg-white rounded-lg shadow-md p-4 flex flex-col sm:flex-row items-center gap-4">
                                    <div 
                                        className="w-40 h-40 flex-shrink-0 bg-gray-100 rounded-md p-2 relative group"
                                    >
                                      {item.previewImageUrl ? (
                                        <>
                                            <img src={item.previewImageUrl} alt="Design Preview" className="w-full h-full object-contain" />
                                            
                                            {/* Bottom Right Zoom Button Only */}
                                            <div className="absolute bottom-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <div 
                                                    className="bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full cursor-pointer pointer-events-auto"
                                                    onClick={(e) => { e.stopPropagation(); onZoomImage(item.previewImageUrl!); }}
                                                    title="Zoom"
                                                >
                                                    <ZoomIcon className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </>
                                      ) : (
                                        <FramePreview config={item} containerWidth={144} onItemTransform={() => {}} onTextUpdate={() => {}} onItemFlip={() => {}} selectedItemId={null} setSelectedItemId={() => {}} isInteractive={false} onItemRemove={() => {}} setIsEditingText={() => {}} allParts={allParts} />
                                      )}
                                    </div>
                                    <div className="flex-grow text-center sm:text-left">
                                        <h3 className="font-bold text-lg font-body text-luvin-pink">Khung tùy chỉnh</h3>
                                        <p className="text-sm text-gray-600">Kích thước: {frame.name}</p>
                                        <p className="text-sm text-gray-600">Số nhân vật: {item.characters.length}</p>
                                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                                            <span className="text-sm font-medium">Số lượng:</span>
                                            <div className="flex items-center border border-gray-300 rounded">
                                                <button 
                                                    onClick={() => onUpdateQuantity(index, quantity - 1)}
                                                    className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                                                    disabled={quantity <= 1}
                                                >-</button>
                                                <span className="px-2 py-1 text-sm font-bold min-w-[20px] text-center">{quantity}</span>
                                                <button 
                                                    onClick={() => onUpdateQuantity(index, quantity + 1)}
                                                    className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-center sm:text-right">
                                        <p className="font-bold text-lg text-luvin-pink">{formatCurrency(totalPrice * quantity)}</p>
                                        <p className="text-xs text-gray-500">({formatCurrency(totalPrice)} / cái)</p>
                                        <div className="flex justify-center sm:justify-end gap-3 mt-2">
                                            <button onClick={() => onEditItem(index)} className="text-sm text-blue-600 hover:underline font-semibold">Sửa</button>
                                            <button onClick={() => onRemoveItem(index)} className="text-sm text-red-500 hover:underline">Xóa</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center text-2xl font-bold font-body text-luvin-pink">
                            <span>Tổng cộng:</span>
                            <span>{formatCurrency(totalCartPrice)}</span>
                        </div>
                        <button onClick={() => navigateTo('checkout')} className="mt-4 w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-lg hover:opacity-90 transition-colors">
                            Tiến hành thanh toán
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CartPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  cartItems: FrameConfig[];
  onRemoveItem: (index: number) => void;
  onEditItem: (index: number) => void; // ADDED
  allParts: Record<string, LegoPart>;
  navigateTo: (page: Page) => void;
  onUpdateQuantity: (index: number, newQuantity: number) => void;
  onZoomImage: (url: string) => void;
}> = ({ isOpen, onClose, cartItems, onRemoveItem, onEditItem, allParts, navigateTo, onUpdateQuantity, onZoomImage }) => {
  const subtotal = cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1), 0);
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  const percentage = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const handleCheckout = () => {
    onClose();
    navigateTo('checkout');
  };

  const handleViewCart = () => {
    onClose();
    navigateTo('cart');
  }

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isOpen ? 'bg-black/40' : 'bg-transparent pointer-events-none'}`}>
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">Giỏ hàng</h2>
          <button onClick={onClose} className="p-1">&times;</button>
        </div>

        {/* Free Shipping Progress in Cart Panel */}
        {cartItems.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                 {remaining > 0 ? (
                    <div className="space-y-1">
                        <p className="text-xs text-gray-600">
                            Thêm <span className="font-bold text-gray-900">{formatCurrency(remaining)}</span> để được <span className="font-bold text-green-600">Free Ship</span>
                        </p>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all duration-500" style={{width: `${percentage}%`}}></div>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                        <span>✨</span> Bạn đã được Miễn phí vận chuyển!
                    </p>
                )}
            </div>
        )}

        {cartItems.length === 0 ? (
          <p className="flex-grow flex items-center justify-center text-gray-500">Giỏ hàng trống.</p>
        ) : (
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {cartItems.map((item, index) => {
              const { totalPrice } = calculatePrice(item, allParts, FRAME_OPTIONS);
              const frame = FRAME_OPTIONS.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
              const quantity = item.quantity || 1;

              return (
                <div key={index} className="flex gap-4">
                  <div 
                    className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded p-1 relative group"
                  >
                     {item.previewImageUrl ? (
                        <>
                            <img src={item.previewImageUrl} alt="Design Preview" className="w-full h-full object-contain" />
                            {/* Bottom Right Zoom Button Only */}
                            <div className="absolute bottom-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div 
                                    className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-full cursor-pointer pointer-events-auto scale-75"
                                    onClick={(e) => { e.stopPropagation(); onZoomImage(item.previewImageUrl!); }}
                                    title="Zoom"
                                >
                                    <ZoomIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </>
                      ) : (
                        <FramePreview config={item} containerWidth={72} isInteractive={false} onItemTransform={()=>{}} onTextUpdate={()=>{}} onItemFlip={()=>{}} selectedItemId={null} setSelectedItemId={()=>{}} onItemRemove={() => {}} setIsEditingText={() => {}} allParts={allParts} />
                      )}
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-sm font-semibold">Khung LEGO tùy chỉnh</h3>
                    <p className="text-xs text-gray-500">{frame.name}</p>
                    <div className="flex justify-between items-end mt-1">
                        <p className="text-sm font-bold">{formatCurrency(totalPrice * quantity)}</p>
                        <div className="flex items-center border border-gray-300 rounded bg-white">
                            <button 
                                onClick={() => onUpdateQuantity(index, quantity - 1)}
                                className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                                disabled={quantity <= 1}
                            >-</button>
                            <span className="px-1.5 text-xs font-bold min-w-[16px] text-center">{quantity}</span>
                            <button 
                                onClick={() => onUpdateQuantity(index, quantity + 1)}
                                className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                            >+</button>
                        </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                      <button onClick={() => onRemoveItem(index)} className="text-red-500 self-start p-1 text-lg leading-none">&times;</button>
                      <button onClick={() => onEditItem(index)} className="text-blue-600 text-xs font-bold hover:underline">Sửa</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="p-4 border-t space-y-4">
          <div className="flex justify-between font-bold text-lg">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleViewCart} className="w-full bg-gray-200 text-gray-800 font-bold py-3 rounded hover:bg-gray-300">View cart</button>
            <button onClick={handleCheckout} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded hover:opacity-90">Checkout</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ZoomIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
)

const CheckoutPage: React.FC<{
  cartItems: FrameConfig[];
  allParts: Record<string, LegoPart>;
  onPlaceOrder: (order: Omit<Order, 'status' | 'createdAt'>) => Promise<void>;
  onZoomImage: (url: string) => void;
}> = ({ cartItems, allParts, onPlaceOrder, onZoomImage }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  
  const [provinces, setProvinces] = useState<{ name: string; code: number }[]>([]);
  const [districts, setDistricts] = useState<{ name: string; code: number }[]>([]);
  const [wards, setWards] = useState<{ name: string; code: number }[]>([]);
  
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedWard, setSelectedWard] = useState('');

  const [shippingOption, setShippingOption] = useState<'standard' | 'express' | 'bookship'>('standard');
  const [addGiftBox, setAddGiftBox] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'full'>('deposit');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const GIFT_BOX_PRICE = 30000;
  const SHIPPING_FEES = { standard: 25000, express: 45000, bookship: 0 };

  useEffect(() => {
    fetch('https://provinces.open-api.vn/api/p/')
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      fetch(`https://provinces.open-api.vn/api/p/${selectedProvince}?depth=2`)
        .then(res => res.json())
        .then(data => setDistricts(data.districts));
      setSelectedDistrict('');
      setWards([]);
      setSelectedWard('');
    } else {
      setDistricts([]);
      setWards([]);
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict) {
      fetch(`https://provinces.open-api.vn/api/d/${selectedDistrict}?depth=2`)
        .then(res => res.json())
        .then(data => setWards(data.wards));
      setSelectedWard('');
    } else {
      setWards([]);
    }
  }, [selectedDistrict]);


  const subtotal = useMemo(() => cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1), 0), [cartItems, allParts]);
  
  // Logic miễn phí vận chuyển
  let calculatedShippingFee = SHIPPING_FEES[shippingOption];
  const isFreeShippingEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
  
  if (shippingOption === 'standard' && isFreeShippingEligible) {
      calculatedShippingFee = 0;
  }
  
  const shippingFee = calculatedShippingFee;
  const giftBoxFee = addGiftBox ? GIFT_BOX_PRICE : 0;
  const totalPrice = subtotal + shippingFee + giftBoxFee;
  const amountToPay = paymentMethod === 'deposit' ? totalPrice * 0.7 : totalPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; 

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
        setPhoneError("Số điện thoại phải có đúng 10 số và bắt đầu bằng số 0");
        return;
    }

    setIsSubmitting(true);

    const provinceName = provinces.find(p => p.code === parseInt(selectedProvince))?.name || '';
    const districtName = districts.find(d => d.code === parseInt(selectedDistrict))?.name || '';
    const wardName = wards.find(w => w.code === parseInt(selectedWard))?.name || '';
    const fullAddress = [street, wardName, districtName, provinceName].filter(Boolean).join(', ');
    const orderId = `#TL${Date.now().toString().slice(-6)}`;
    
    try {
        await onPlaceOrder({
          id: orderId,
          customer: { name, phone, email, address: fullAddress },
          delivery: { date: deliveryDate, notes },
          items: cartItems,
          addGiftBox,
          shipping: { method: shippingOption, fee: shippingFee },
          payment: { method: paymentMethod },
          totalPrice,
          amountToPay,
        });
    } catch (error) {
        console.error("Order submission error:", error);
        setIsSubmitting(false);
        alert("Đã có lỗi xảy ra khi đặt hàng. Vui lòng thử lại.");
    }
  };

  if (cartItems.length === 0) {
      return <div className="text-center py-20">Giỏ hàng của bạn đang trống.</div>
  }

  return (
    <div className="bg-white">
      <form onSubmit={handleSubmit} className="container mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Thông tin thanh toán</h1>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 space-y-6">
            
            <div className="bg-gray-50 p-6 rounded-lg border shadow-sm">
              <h2 className="font-bold text-xl text-gray-800 mb-6 pb-2 border-b border-gray-200">Thông tin giao hàng</h2>
              
              <div className="mb-6 border-b border-gray-200 pb-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">1. Người nhận</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Họ và tên" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" required />
                    <div>
                      <input 
                        type="tel" 
                        placeholder="Số điện thoại" 
                        value={phone} 
                        onChange={e => { setPhone(e.target.value); setPhoneError(''); }} 
                        className={`w-full p-3 border ${phoneError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none`} 
                        required 
                      />
                      {phoneError && <p className="text-red-500 text-xs mt-1 ml-1">{phoneError}</p>}
                    </div>
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" required />
                  </div>
              </div>

              <div className="mb-6 border-b border-gray-200 pb-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">2. Địa chỉ & Vận chuyển</h3>
                  <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" required>
                            <option value="">Tỉnh/Thành phố</option>
                            {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                        </select>
                        <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" required disabled={!selectedProvince}>
                            <option value="">Quận/Huyện</option>
                            {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                        </select>
                         <select value={selectedWard} onChange={e => setSelectedWard(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink outline-none" required disabled={!selectedDistrict}>
                            <option value="">Phường/Xã</option>
                            {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                        </select>
                    </div>
                     <input type="text" placeholder="Số nhà, tên đường" value={street} onChange={e => setStreet(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" required />
                    
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-semibold text-gray-700 block mb-1">Ngày nhận hàng mong muốn</label>
                          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" required min={new Date().toISOString().split("T")[0]} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm mb-2 text-gray-700">Phương thức vận chuyển</h3>
                            <div className="space-y-2">
                                <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="standard" checked={shippingOption === 'standard'} onChange={() => setShippingOption('standard')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <span className="ml-2 text-sm flex-grow text-gray-700">Giao hàng thường</span>
                                    {isFreeShippingEligible ? (
                                        <div className="text-right">
                                            <span className="text-xs text-gray-400 line-through mr-1">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                            <span className="text-sm font-bold text-green-600">Miễn phí</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                    )}
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="express" checked={shippingOption === 'express'} onChange={() => setShippingOption('express')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <span className="ml-2 text-sm flex-grow text-gray-700">Giao hàng nhanh</span>
                                     <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.express)}</span>
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="bookship" checked={shippingOption === 'bookship'} onChange={() => setShippingOption('bookship')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <span className="ml-2 text-sm flex-grow text-gray-700">Tự book ship / Qua lấy</span>
                                     <span className="text-sm font-bold text-gray-800">Thỏa thuận</span>
                                </label>
                            </div>
                        </div>
                     </div>
                  </div>
              </div>

              <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">3. Ghi chú đơn hàng</h3>
                  <textarea placeholder="Ví dụ: Giao hàng trong giờ hành chính,..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none"></textarea>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border">
                 <label className="flex items-center p-3 rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 border">
                    <img src={GENERAL_ASSETS.giftbox} alt="Gift Box" className="w-12 h-12 object-contain mr-4"/>
                    <div className="flex-grow">
                        <span className="font-semibold text-gray-800">Thêm hộp quà</span>
                        <p className="text-xs text-gray-500">Hộp quà cao cấp & thiệp viết tay.</p>
                    </div>
                    <span className="font-bold text-luvin-pink mr-4">+{formatCurrency(GIFT_BOX_PRICE)}</span>
                    <input type="checkbox" checked={addGiftBox} onChange={e => setAddGiftBox(e.target.checked)} className="h-5 w-5 rounded text-luvin-pink focus:ring-luvin-pink"/>
                </label>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-gray-50 p-4 rounded-lg border sticky top-24">
                
              {/* Free Shipping Progress Bar in Checkout */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                 {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                    <div className="bg-green-100 text-green-800 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
                        <span>🎉</span>
                        <span>Chúc mừng! Bạn được Miễn phí giao hàng thường.</span>
                    </div>
                ) : (
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">Tiến độ Freeship</span>
                            <span className="font-bold text-gray-900">{Math.round((subtotal/FREE_SHIPPING_THRESHOLD)*100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-luvin-pink transition-all duration-500" style={{width: `${(subtotal/FREE_SHIPPING_THRESHOLD)*100}%`}}></div>
                        </div>
                        <p className="text-xs text-gray-500 text-right">Mua thêm <span className="font-bold text-gray-900">{formatCurrency(FREE_SHIPPING_THRESHOLD - subtotal)}</span> để được Freeship</p>
                    </div>
                )}
              </div>

              <h2 className="font-bold text-lg mb-4 border-b pb-2">Đơn hàng của bạn</h2>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {cartItems.map((item, index) => {
                  const { totalPrice } = calculatePrice(item, allParts, FRAME_OPTIONS);
                  const quantity = item.quantity || 1;
                  
                  return (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 object-contain bg-white border rounded cursor-pointer group relative" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)}>
                            {item.previewImageUrl ? (
                                <>
                                    <img src={item.previewImageUrl} className="w-full h-full object-contain" alt="preview" />
                                    {/* Bottom Right Zoom Button Only */}
                                    <div className="absolute bottom-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        <div 
                                            className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-full cursor-pointer pointer-events-auto scale-50"
                                            onClick={(e) => { e.stopPropagation(); onZoomImage(item.previewImageUrl!); }}
                                            title="Zoom"
                                        >
                                            <ZoomIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[8px]">No Img</div>
                            )}
                        </div>
                        <div>
                            <span>Khung tùy chỉnh</span>
                            {quantity > 1 && <span className="ml-1 text-xs font-bold text-gray-500">x{quantity}</span>}
                        </div>
                      </div>
                      <span>{formatCurrency(totalPrice * quantity)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(subtotal)}</span></div>
                {addGiftBox && <div className="flex justify-between"><span>Hộp quà</span><span>{formatCurrency(giftBoxFee)}</span></div>}
                <div className="flex justify-between">
                    <span>Phí vận chuyển</span>
                    {isFreeShippingEligible && shippingOption === 'standard' ? (
                        <span className="text-green-600 font-bold">Miễn phí</span>
                    ) : (
                        <span>{shippingOption === 'bookship' ? 'Tự thỏa thuận' : formatCurrency(shippingFee)}</span>
                    )}
                </div>
              </div>
              <div className="border-t mt-4 pt-4 flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="border-t mt-2 pt-2 flex justify-between font-bold text-lg text-luvin-pink">
                  <span>Cần thanh toán</span>
                  <span>{formatCurrency(amountToPay)}</span>
              </div>
              <div className="border-t mt-4 pt-4">
                <h3 className="font-semibold mb-2">Phương thức thanh toán</h3>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                    <input type="radio" name="payment" value="deposit" checked={paymentMethod === 'deposit'} onChange={() => setPaymentMethod('deposit')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink" />
                    <label htmlFor="deposit" className="ml-2 text-sm">Chuyển khoản cọc 70%</label>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                    <input type="radio" name="payment" value="full" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink" />
                    <label htmlFor="full" className="ml-2 text-sm">Chuyển khoản toàn bộ</label>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-wait">
                {isSubmitting ? 'Đang xử lý...' : 'ĐẶT HÀNG'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

const OrderConfirmationPage: React.FC<{ order: Order | null, navigateTo: (page: Page) => void, onZoomImage: (url: string) => void }> = ({ order, navigateTo, onZoomImage }) => {
    useEffect(() => {
        if (!order) {
            navigateTo('home');
        } else {
            // Confetti effect on mount
            if (typeof confetti === 'function') {
                const duration = 3 * 1000;
                const animationEnd = Date.now() + duration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

                const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

                const interval: any = setInterval(function() {
                    const timeLeft = animationEnd - Date.now();

                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    const particleCount = 50 * (timeLeft / duration);
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
                }, 250);
            }
        }
    }, [order, navigateTo]);
    
    if (!order) return null;

    const amountRemaining = order.totalPrice - order.amountToPay;
    
    const getVietQR = (order: Order) => {
        const BANK_ID = '970407'; // Techcombank
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2';
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        const amount = order.amountToPay;
        
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };

    return (
        <div className="bg-gray-50 py-12">
            <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
                <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
                    <div className="text-center">
                        <div className="mb-4 text-5xl">🎉</div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Đơn hàng của bạn đã được ghi nhận!</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Cảm ơn bạn đã đặt hàng. Vui lòng hoàn tất thanh toán để chúng tôi xử lý đơn hàng của bạn.
                        </p>
                        <p className="mt-4 text-base text-gray-700">Mã đơn hàng của bạn là: <span className="font-bold text-lg text-luvin-pink">{order.id}</span></p>
                    </div>
                    
                    <div className="mt-8 bg-gray-50 rounded-lg border p-6 text-center">
                        <h2 className="font-semibold text-gray-700">Quét mã QR để thanh toán</h2>
                        <img src={getVietQR(order)} alt="VietQR" className="mt-4 w-48 mx-auto border rounded-lg" />
                        <div className="mt-4 bg-white p-3 rounded-lg border">
                           <p className="text-xs text-gray-500">Nội dung chuyển khoản:</p>
                           <p className="font-bold text-gray-800 tracking-wider">{order.id}</p>
                        </div>
                    </div>

                    <div className="mt-8 border-t pt-6">
                         <h2 className="font-bold text-lg mb-4">Tóm tắt đơn hàng</h2>
                         <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg border p-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-16 object-contain bg-white border rounded cursor-pointer group relative" onClick={() => order.items[0].previewImageUrl && onZoomImage(order.items[0].previewImageUrl)}>
                                    <img src={order.items[0].previewImageUrl} className="w-full h-full object-contain" alt="preview" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIcon className="w-8 h-8 text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Khung tùy chỉnh x {order.items.length}</p>
                                  </div>
                                </div>
                                <p className="font-semibold">{formatCurrency(order.totalPrice - order.shipping.fee - (order.addGiftBox ? 30000 : 0))}</p>
                            </div>

                            <div className="text-sm space-y-2">
                                <div className="flex justify-between"><span>Tạm tính:</span><span className="font-medium">{formatCurrency(order.totalPrice - order.shipping.fee - (order.addGiftBox ? 30000 : 0))}</span></div>
                                <div className="flex justify-between">
                                    <span>Phí vận chuyển:</span>
                                    {order.shipping.fee === 0 && order.shipping.method === 'standard' ? (
                                        <span className="font-bold text-green-600">Miễn phí</span>
                                    ) : (
                                        <span className="font-medium">{formatCurrency(order.shipping.fee)}</span>
                                    )}
                                </div>
                                {order.addGiftBox && <div className="flex justify-between"><span>Hộp quà:</span><span className="font-medium">{formatCurrency(30000)}</span></div>}
                                <div className="border-t my-2"></div>
                                <div className="flex justify-between font-bold text-base"><span>Tổng cộng:</span><span>{formatCurrency(order.totalPrice)}</span></div>
                                <div className="flex justify-between font-bold text-base text-red-600"><span>Cần thanh toán:</span><span>{formatCurrency(order.amountToPay)}</span></div>
                                <div className="flex justify-between text-xs text-gray-500"><span>Còn lại (thanh toán khi nhận hàng):</span><span>{formatCurrency(amountRemaining)}</span></div>
                            </div>
                            
                            <div className="border-t pt-4 text-sm space-y-1">
                                <p><span className="font-semibold">Giao đến:</span> {order.customer.name}</p>
                                <p><span className="font-semibold">Địa chỉ:</span> {order.customer.address}</p>
                                <p><span className="font-semibold">SĐT:</span> {order.customer.phone}</p>
                                <p><span className="font-semibold">Ngày nhận mong muốn:</span> {new Date(order.delivery.date).toLocaleDateString('vi-VN')}</p>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    )
};

const OrderLookupPage: React.FC<{onZoomImage: (url: string) => void}> = ({onZoomImage}) => {
    const [orderCode, setOrderCode] = useState('');
    const [foundOrder, setFoundOrder] = useState<Order | null | 'not_found' | 'permission_error'>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [savedOrders, setSavedOrders] = useState<{id: string, date: number}[]>([]);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('my_orders') || '[]');
            if (Array.isArray(saved)) {
                setSavedOrders(saved);
            }
        } catch(e) {
            // Ignore error
        }
    }, []);

    const handleSearch = async (e?: React.FormEvent, codeOverride?: string) => {
        if (e) e.preventDefault();
        let codeToSearch = (codeOverride || orderCode).trim().toUpperCase();
        if (!codeToSearch) return;

        // Check if it's a phone number (all digits, 10 digits, starts with 0)
        const isPhone = /^0\d{9}$/.test(codeToSearch);

        if (!isPhone && !codeToSearch.startsWith('#')) {
            codeToSearch = '#' + codeToSearch;
        }
        
        // Update input if searched via click
        if (codeOverride) setOrderCode(codeToSearch);

        setIsLoading(true);
        setFoundOrder(null);
        
        try {
            let order: Order | null = null;

            if (isPhone) {
                const orders = await getOrdersByPhone(codeToSearch);
                // If multiple orders found, just take the most recent one for simple lookup
                if (orders.length > 0) {
                    order = orders[0];
                }
            } else {
                order = await getOrderById(codeToSearch);
                if (!order) {
                    order = MOCK_ORDERS[codeToSearch] || null;
                }
            }

            setFoundOrder(order || 'not_found');
        } catch (error: any) {
            console.error("Lỗi tra cứu đơn hàng:", error);
            if (error.code === 'permission-denied') {
                setFoundOrder('permission_error');
            } else {
                setFoundOrder('not_found');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const StatusTracker: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
        const getStepIndex = (status: string) => {
            switch(status) {
                case 'Chờ thanh toán': return 0;
                case 'Đã xác nhận': return 1;
                case 'Ưu tiên xuất đơn':
                case 'Đang đóng hàng':
                case 'Chờ chuyển hàng':
                case 'Đang xử lý': 
                    return 2;
                case 'Gửi hàng đi':
                case 'Đang giao hàng': 
                    return 3;
                case 'Đã giao hàng': return 4;
                default: return -1; 
            }
        };

        const steps = ['Chờ thanh toán', 'Đã xác nhận', 'Đang xử lý', 'Đang giao hàng', 'Đã giao hàng'];
        const currentStepIndex = getStepIndex(currentStatus);

        return (
            <div className="relative my-8">
                <div className="flex justify-between items-start">
                    {steps.map((step, index) => (
                        <div key={step} className="z-10 text-center" style={ { width: `${100 / steps.length}%` }}>
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-colors duration-500 relative ${index <= currentStepIndex ? 'bg-luvin-pink' : 'bg-gray-300'}`}>
                                {index <= currentStepIndex && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <p className={`mt-2 text-[10px] sm:text-xs font-semibold ${index <= currentStepIndex ? 'text-luvin-pink' : 'text-gray-500'}`}>{step}</p>
                        </div>
                    ))}
                </div>
                <div className="absolute top-3 left-0 right-0 h-0.5 -z-0" style={{ padding: '0 10%' }}>
                    <div className="w-full h-full bg-gray-200"></div>
                     <div 
                        className="absolute left-0 top-0 h-full bg-luvin-pink transition-all duration-500"
                        style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8 min-h-[60vh]">
            <div className="max-w-3xl mx-auto">
                <div className="text-center">
                    <h1 className="text-4xl sm:text-5xl font-heading text-luvin-pink mb-4">Tra cứu đơn hàng</h1>
                    <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto mt-6">
                        <input
                            type="text"
                            value={orderCode}
                            onChange={(e) => setOrderCode(e.target.value)}
                            placeholder="#TLxxxxxx hoặc SĐT"
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-luvin-pink focus:border-luvin-pink text-center uppercase"
                        />
                        <button type="submit" disabled={isLoading} className="bg-luvin-pink text-gray-800 font-bold px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50">
                            {isLoading ? '...' : 'Tra cứu'}
                        </button>
                    </form>
                    <p className="text-xs text-gray-500 mt-2">Nhập mã đơn hàng (có dấu #) hoặc số điện thoại đặt hàng</p>
                    
                    {/* Display saved orders */}
                    {savedOrders.length > 0 && !foundOrder && (
                        <div className="mt-8 max-w-md mx-auto">
                            <p className="text-sm text-gray-500 mb-3 font-medium">Đơn hàng của bạn (trên thiết bị này):</p>
                            <div className="space-y-2">
                                {savedOrders.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => handleSearch(undefined, item.id)}
                                        className="bg-white border border-gray-200 p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="text-left">
                                            <p className="font-bold text-gray-800">{item.id}</p>
                                            <p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                        <span className="text-xs font-bold text-luvin-pink group-hover:underline">Xem ngay &rarr;</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-10 min-h-[300px]">
                    {isLoading && <p className="text-center">Đang tìm kiếm...</p>}
                    {foundOrder === 'not_found' && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
                            Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn hàng hoặc số điện thoại.
                        </div>
                    )}
                    {foundOrder === 'permission_error' && (
                        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded-lg text-center">
                            <p className="font-bold">Hệ thống đang bảo trì</p>
                            <p className="text-sm mt-1">
                                Tính năng tra cứu đang được nâng cấp. Vui lòng inbox Fanpage hoặc gọi Hotline <strong className="whitespace-nowrap">0964 393 115</strong> để được hỗ trợ kiểm tra đơn hàng nhanh nhất.
                            </p>
                        </div>
                    )}
                    {foundOrder && typeof foundOrder === 'object' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-md">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="font-bold text-lg">Chi tiết đơn hàng <span className="text-luvin-pink">{foundOrder.id}</span></h2>
                                    <p className="text-sm text-gray-500">
                                        Ngày đặt: {foundOrder.id.startsWith('#TL') && !isNaN(Number(foundOrder.id.slice(3, -4))) ? new Date(Number(foundOrder.id.slice(3, -4))).toLocaleDateString('vi-VN') : '---'}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${foundOrder.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {foundOrder.status}
                                </span>
                            </div>

                            <StatusTracker currentStatus={foundOrder.status} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Thông tin nhận hàng</h3>
                                    <p><span className="font-semibold">Người nhận:</span> {foundOrder.customer.name}</p>
                                    <p><span className="font-semibold">SĐT:</span> {foundOrder.customer.phone}</p>
                                    <p><span className="font-semibold">Địa chỉ:</span> {foundOrder.customer.address}</p>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Đơn hàng</h3>
                                    <div className="space-y-2">
                                        {foundOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-100 rounded border overflow-hidden cursor-pointer" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)}>
                                                    {item.previewImageUrl && <img src={item.previewImageUrl} className="w-full h-full object-contain" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">Khung thiết kế</p>
                                                    <p className="text-xs text-gray-500">{item.characters.length} nhân vật</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                             <div className="mt-6 pt-4 border-t text-right">
                                <p className="text-lg">Tổng tiền: <span className="font-bold text-luvin-pink">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(foundOrder.totalPrice)}</span></p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper to categorize parts
const categorizeParts = (parts: LegoPart[]) => {
    const categories: typeof LEGO_PARTS = {
        hair: [], face: [], shirt: [], pants: [], hat: [], accessory: [], pet: [], set: []
    };
    parts.forEach(p => {
        if (p.type in categories) {
            categories[p.type as keyof typeof LEGO_PARTS].push(p);
        }
    });
    return categories;
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
  
  // CART PERSISTENCE: Initialize state from LocalStorage
  const [cartItems, setCartItems] = useState<FrameConfig[]>(() => {
      try {
          const savedCart = localStorage.getItem('shopping_cart');
          return savedCart ? JSON.parse(savedCart) : [];
      } catch (error) {
          console.error("Failed to load cart from storage", error);
          return [];
      }
  });

  // CART PERSISTENCE: Update LocalStorage whenever cartItems changes
  useEffect(() => {
      try {
          localStorage.setItem('shopping_cart', JSON.stringify(cartItems));
      } catch (error) {
          console.error("Failed to save cart to storage", error);
      }
  }, [cartItems]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true); 
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null); // NEW STATE: Track item being edited
  
  const [legoParts, setLegoParts] = useState(LEGO_PARTS);
  const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]); 
  const [templates, setTemplates] = useState<CollectionTemplate[]>(COLLECTION_TEMPLATES);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(FEEDBACK_ITEMS);
  const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS); // Initialize with constant fallback

  // Lazy initialization for logoUrl to prevent FOUC and sync issues
  const [logoUrl, setLogoUrl] = useState<string>(() => {
      try {
          const cached = localStorage.getItem('app_config');
          return cached ? JSON.parse(cached).logoUrl || "" : "";
      } catch (e) { return ""; }
  });
  
  const [heroImageUrl, setHeroImageUrl] = useState<string | undefined>(() => {
      try {
          const cached = localStorage.getItem('app_config');
          return cached ? JSON.parse(cached).heroImageUrl : undefined;
      } catch (e) { return undefined; }
  });

  const [inspireImageUrl, setInspireImageUrl] = useState<string | undefined>(() => {
      try {
          const cached = localStorage.getItem('app_config');
          return cached ? JSON.parse(cached).inspireImageUrl : undefined;
      } catch (e) { return undefined; }
  });

  // Use effect to apply favicon if cached
  useEffect(() => {
      try {
          const cached = localStorage.getItem('app_config');
          if (cached) {
              const config = JSON.parse(cached);
              if (config.faviconUrl) {
                  const link = document.querySelector("link[rel~='icon']");
                  if (link instanceof HTMLLinkElement) {
                      link.href = config.faviconUrl;
                  } else {
                      const newLink = document.createElement('link');
                      newLink.rel = 'icon';
                      newLink.href = config.faviconUrl;
                      document.head.appendChild(newLink);
                  }
              }
          }
      } catch(e) {}
  }, []);

  useEffect(() => {
      const fetchData = async () => {
          try {
            const [parts, bgs, storeConfig, tpls, fbs, fetchedFrames] = await Promise.all([
                getAllParts(), 
                getAllBackgrounds(), 
                getStoreConfig(),
                getAllTemplates(),
                getAllFeedbacks(),
                getAllFrames()
            ]);
            
            if (parts && parts.length > 0) {
                setLegoParts(categorizeParts(parts));
            }
            if (bgs && bgs.length > 0) {
                setBackgrounds(bgs);
            }
            if (tpls && tpls.length > 0) {
                setTemplates(tpls);
            }
            if (fbs && fbs.length > 0) {
                setFeedbacks(fbs);
            }
            if (fetchedFrames && fetchedFrames.length > 0) {
                setFrames(fetchedFrames);
            }

            if (storeConfig) {
                // Save to cache
                localStorage.setItem('app_config', JSON.stringify(storeConfig));

                if (storeConfig.logoUrl) setLogoUrl(storeConfig.logoUrl);
                if (storeConfig.heroImageUrl) setHeroImageUrl(storeConfig.heroImageUrl);
                if (storeConfig.inspireImageUrl) setInspireImageUrl(storeConfig.inspireImageUrl);
                
                if (storeConfig.faviconUrl) {
                    const link = document.querySelector("link[rel~='icon']");
                    if (link instanceof HTMLLinkElement) {
                        link.href = storeConfig.faviconUrl;
                    } else {
                        const newLink = document.createElement('link');
                        newLink.rel = 'icon';
                        newLink.href = storeConfig.faviconUrl;
                        document.head.appendChild(newLink);
                    }
                }
            }
          } catch (error) {
              console.error("Initial fetch error:", error);
          } finally {
              setIsAppLoading(false);
          }
      };
      fetchData();
  }, []);

  const allParts = useMemo(() => (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
      const checkHash = () => {
          if (window.location.hash === '#/admin') {
              setCurrentPage('admin');
          }
      };
      checkHash();
      window.addEventListener('hashchange', checkHash);
      return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleAddToCart = (newConfig: FrameConfig, openCart = true) => {
    // Ensure quantity is 1 when adding new item
    setCartItems(prev => [...prev, { ...newConfig, quantity: 1 }]);
    if (openCart) setIsCartOpen(true);
  };

  const handleUpdateCartItem = (updatedConfig: FrameConfig) => {
      if (editingCartIndex !== null) {
          setCartItems(prev => prev.map((item, i) => i === editingCartIndex ? { ...updatedConfig, quantity: item.quantity } : item)); // Preserve quantity
          setEditingCartIndex(null);
          setConfig(INITIAL_FRAME_CONFIG); // Reset config
          setIsCartOpen(true); // Open cart to show changes
      }
  };

  const handleEditCartItem = (index: number) => {
      setConfig(cartItems[index]);
      setEditingCartIndex(index);
      setIsCartOpen(false);
      navigateTo('builder');
  };

  const handleCancelEdit = () => {
      setEditingCartIndex(null);
      setConfig(INITIAL_FRAME_CONFIG);
      setIsCartOpen(true); // Go back to cart
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCartQuantity = (index: number, newQuantity: number) => {
      if (newQuantity < 1) return;
      setCartItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item));
  };

  const handlePlaceOrder = async (orderData: Omit<Order, 'status' | 'createdAt'>) => {
    const res = await createOrder(orderData);
    if (res.success && res.data) {
        setCurrentOrder(res.data);
        
        // Save to local history for Order Lookup
        try {
            // FIX: Explicitly type saved to avoid "unknown" type errors and spread errors
            const saved: any[] = JSON.parse(localStorage.getItem('my_orders') || '[]');
            const newEntry = { id: res.data.id, date: Date.now() };
            // Add new entry to start, remove duplicates if any, keep max 5
            const updated = [newEntry, ...saved.filter((o: any) => o.id !== res.data.id)].slice(0, 5);
            localStorage.setItem('my_orders', JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save local order history", e);
        }

        setCartItems([]); 
        navigateTo('order-confirmation');
        sendOrderEmail(res.data);
    } else {
        alert("Lỗi đặt hàng. Vui lòng thử lại.");
    }
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Even if fetching, show what we have from cache if possible
  // Only show loading screen if we truly have nothing to show
  if (isAppLoading && !logoUrl) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-pink-50 text-luvin-pink">
              <div className="animate-pulse flex flex-col items-center">
                  <svg className="w-16 h-16 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 1.5C12 1.5 12 5.5 15 8.5C18 11.5 22.5 12 22.5 12C22.5 12 18 12.5 15 15.5C12 18.5 12 22.5 12 22.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 22.5C12 22.5 12 18.5 9 15.5C6 12.5 1.5 12 1.5 12C1.5 12 6 11.5 9 8.5C12 5.5 12 1.5 12 1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="font-heading text-2xl tracking-wider">The Luvin</span>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
         {currentPage !== 'admin' && (
             <Header navigateTo={navigateTo} cartCount={cartItems.length} onCartClick={() => setIsCartOpen(true)} logoUrl={logoUrl} />
        )}
        
        <main className="flex-grow">
            {currentPage === 'home' && <HomePage navigateTo={navigateTo} heroImage={heroImageUrl} inspireImage={inspireImageUrl} feedbacks={feedbacks} templates={templates} />}
            {currentPage === 'builder' && (
                <BuilderPage 
                    config={config} 
                    setConfig={setConfig} 
                    navigateTo={navigateTo} 
                    onAddToCart={handleAddToCart} 
                    onUpdateCart={handleUpdateCartItem} // Pass update handler
                    showToast={showToast}
                    legoParts={legoParts}
                    backgrounds={backgrounds}
                    frames={frames}
                    editingCartIndex={editingCartIndex} // Pass editing index
                    onCancelEdit={handleCancelEdit} // Pass cancel handler
                    onZoomImage={setZoomedImageUrl} // Pass zoom handler
                />
            )}
            {currentPage === 'collection' && <CollectionPage navigateTo={navigateTo} setConfig={setConfig} templates={templates} />}
            {currentPage === 'cart' && <CartPage 
                cartItems={cartItems} 
                onRemoveItem={handleRemoveCartItem} 
                onEditItem={handleEditCartItem} // Pass edit handler
                allParts={allParts} 
                navigateTo={navigateTo}
                onUpdateQuantity={handleUpdateCartQuantity}
                onZoomImage={setZoomedImageUrl} 
            />}
            {currentPage === 'checkout' && <CheckoutPage cartItems={cartItems} allParts={allParts} onPlaceOrder={handlePlaceOrder} onZoomImage={(url) => setZoomedImageUrl(url)} />}
            {currentPage === 'order-confirmation' && <OrderConfirmationPage order={currentOrder} navigateTo={navigateTo} onZoomImage={(url) => setZoomedImageUrl(url)} />}
            {currentPage === 'order-lookup' && <OrderLookupPage onZoomImage={(url) => setZoomedImageUrl(url)} />}
            {currentPage === 'about' && <AboutPage />}
            {currentPage === 'warranty' && <WarrantyPage />}
            {currentPage === 'admin' && <AdminPage />}
        </main>

        {currentPage !== 'admin' && <Footer navigateTo={navigateTo} />}

        <CartPanel 
            isOpen={isCartOpen} 
            onClose={() => setIsCartOpen(false)} 
            cartItems={cartItems} 
            onRemoveItem={handleRemoveCartItem}
            onEditItem={handleEditCartItem} // Pass edit handler
            allParts={allParts}
            navigateTo={navigateTo}
            onUpdateQuantity={handleUpdateCartQuantity}
            onZoomImage={setZoomedImageUrl}
        />
        
         {zoomedImageUrl && (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setZoomedImageUrl(null)}>
                <div className="relative max-w-4xl max-h-full w-full flex justify-center">
                    <img src={zoomedImageUrl} alt="Zoomed" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    <button className="absolute -top-12 right-0 sm:-right-12 text-white hover:text-gray-300 transition-colors" onClick={() => setZoomedImageUrl(null)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        )}

        {toast && (
            <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-bold z-50 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                {toast.message}
            </div>
        )}
    </div>
  );
};

export default App;
