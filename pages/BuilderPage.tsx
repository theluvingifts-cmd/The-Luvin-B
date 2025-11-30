
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
import { calculatePrice, formatCurrency, CHARACTER_BASE_PRICE, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { ZoomIcon } from '../components/ZoomIcon';

declare var html2canvas: any;

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

const Step1Frame: React.FC<{ config: FrameConfig; setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>; frames: FrameOption[] }> = ({ config, setConfig, frames }) => {
  const selectedFrame = frames.find(f => f.id === config.frameId) || frames[0];
  
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
                config.frameId === frame.id ? 'bg-luvin-pink text-gray-800 border-luvin-pink' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-50'
              } ${frame.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span>{frame.name}</span>
              <span className="font-normal opacity-80 mt-1">{formatCurrency(frame.price)}</span>
              {frame.stock === 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] px-1 rounded-bl">Hết hàng</span>}
            </button>
          ))}
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
                <div className="absolute bottom-1 right-1 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-auto">
                    <div 
                        className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-full cursor-pointer"
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
    priceToDisplay: number; 
}> = ({ part, isSelected, onClick, priceToDisplay }) => {
    const [imgError, setImgError] = useState(false);
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = () => {
        setIsClicked(true);
        onClick();
        setTimeout(() => setIsClicked(false), 300);
    };
    
    return (
        <button
            onClick={handleClick}
            className={`border rounded-lg p-1.5 flex flex-col items-center justify-start gap-1.5 transition-all text-center w-full relative overflow-hidden ${
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
                <span className={`text-[11px] font-bold ${isSelected && priceToDisplay > part.price ? 'text-red-600' : 'text-luvin-pink'}`}>
                    {formatCurrency(priceToDisplay)}
                </span>
            </div>
        </button>
    );
};

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
    
    const [sortMode, setSortMode] = useState<'default' | 'price_asc' | 'price_desc'>('default');
    const [accessorySortMode, setAccessorySortMode] = useState<'default' | 'price_asc' | 'price_desc'>('default');
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
        setConfig(prev => ({ ...prev, characters: [...prev.characters, newCharacter] }));
        setActiveCharId(newId);
        
        setSelectedItemId(`character-${newId}`);
        setActivePartType('shirt');
    };
    
    const handleRemoveChar = (id: number) => {
        setConfig(prev => ({...prev, characters: prev.characters.filter(c => c.id !== id)}));
    };

    const handleMoveChar = (index: number, direction: 'left' | 'right') => {
        const newIndex = direction === 'left' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= config.characters.length) return;

        const newChars = [...config.characters];
        const [movedChar] = newChars.splice(index, 1);
        newChars.splice(newIndex, 0, movedChar);
        
        const charA = config.characters[index];
        const charB = config.characters[newIndex];
        
        const tempX = charA.x;
        movedChar.x = charB.x;
        newChars[index] = { ...charB, x: tempX };

        setConfig(prev => ({ ...prev, characters: newChars }));
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
        setConfig(prev => ({...prev, draggableItems: [...prev.draggableItems, newItem]}));
    }

    const handlePartSelect = (part: LegoPart | undefined) => {
        if (!activeCharId || !part) return;

        if (part.type === 'hat') {
            addDraggableItem(part);
            return;
        }

        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
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
        }));
    };

    const handlePartDeselect = (partType: 'hair' | 'hat') => {
      if (!activeCharId) return;
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

        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
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
        return sortParts(list, accessorySortMode);
    }, [legoParts.accessory, accessorySortMode, accessoryCategory]);

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
                        <div key={char.id} className="relative flex items-center group">
                            {index > 0 && (
                                <button onClick={() => handleMoveChar(index, 'left')} className="absolute -left-2 z-10 bg-white border rounded-full w-4 h-4 flex items-center justify-center text-[8px] text-gray-500 hover:bg-gray-100 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                    &lt;
                                </button>
                            )}
                            <button onClick={() => setActiveCharId(char.id)} className={`px-4 py-2 text-sm rounded-lg font-medium relative ${activeCharId === char.id ? 'bg-pink-100 text-luvin-pink border border-luvin-pink' : 'bg-gray-200 text-gray-800'}`}>
                                NV {index + 1}
                            </button>
                            <button onClick={() => handleRemoveChar(char.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs font-bold z-10">
                                &times;
                            </button>
                            {index < config.characters.length - 1 && (
                                <button onClick={() => handleMoveChar(index, 'right')} className="absolute -right-2 z-10 bg-white border rounded-full w-4 h-4 flex items-center justify-center text-[8px] text-gray-500 hover:bg-gray-100 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                    &gt;
                                </button>
                            )}
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
                        {currentPartList.length > 0 ? currentPartList.map(part => {
                            const isSelected = activePartType === 'hat' ? false : activeCharacter[activePartType === 'set' ? 'shirt' : activePartType]?.id === part.id;
                            
                            let priceToDisplay = part.price;
                            if (isSelected) {
                                if (activePartType === 'shirt' || activePartType === 'set') priceToDisplay += (activeCharacter.selectedShirtColor?.price || 0);
                                else if (activePartType === 'pants') priceToDisplay += (activeCharacter.selectedPantsColor?.price || 0);
                                else if (activePartType === 'hair') priceToDisplay += (activeCharacter.selectedHairColor?.price || 0);
                            }

                            return (
                                <PartButton 
                                    key={part.id} 
                                    part={part}
                                    isSelected={isSelected}
                                    onClick={() => handlePartSelect(part)}
                                    priceToDisplay={priceToDisplay} 
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
                    
                    {/* Category Filter Pills */}
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

                    {/* Sorting Dropdown */}
                    <div className="flex justify-end">
                        <div className="relative inline-block w-32">
                            <select 
                                value={accessorySortMode}
                                onChange={(e) => setAccessorySortMode(e.target.value as any)}
                                className="appearance-none w-full pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 cursor-pointer"
                            >
                                <option value="default">Sắp xếp</option>
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
                    {filteredAccessories.length > 0 ? filteredAccessories.map(part => (
                        <PartButton key={part.id} part={part} isSelected={false} onClick={() => addDraggableItem(part)} priceToDisplay={part.price} />
                    )) : (
                        <p className="col-span-4 text-center text-sm text-gray-400 py-4">Không tìm thấy phụ kiện nào.</p>
                    )}
                </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-3">THÊM THÚ CƯNG</h4>
                <div className="grid grid-cols-4 gap-2">
                    {getAvailableParts(legoParts.pet).map(part => (
                        <PartButton key={part.id} part={part} isSelected={false} onClick={() => addDraggableItem(part)} priceToDisplay={part.price} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export const BuilderPage: React.FC<{
    config: FrameConfig;
    setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>;
    navigateTo: (page: Page) => void;
    onAddToCart: (config: FrameConfig, openCart?: boolean) => void;
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
}> = ({ config, setConfig, navigateTo, onAddToCart, onUpdateCart, showToast, legoParts, backgrounds, frames, editingCartIndex, onCancelEdit, onZoomImage, logoUrl, initialStep = 1 }) => {
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [isEditingText, setIsEditingText] = useState(false);
    const [activePartType, setActivePartType] = useState<'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set'>('shirt');
    const previewContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialStep) setCurrentStep(initialStep);
    }, [initialStep]);

    const handleItemTransform = useCallback((id: string, newTransform: any) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);

        setConfig(prev => {
            if (type === 'character') {
                return {
                    ...prev,
                    characters: prev.characters.map(c => c.id === numericId ? { ...c, ...newTransform } : c)
                };
            } else if (type === 'text') {
                return {
                    ...prev,
                    texts: prev.texts.map(t => t.id === numericId ? { ...t, ...newTransform } : t)
                };
            } else if (type === 'item') {
                return {
                    ...prev,
                    draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...newTransform } : i)
                };
            }
            return prev;
        });
    }, [setConfig]);

    const handleItemRemove = useCallback((id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);

        setConfig(prev => {
            if (type === 'character') {
                return { ...prev, characters: prev.characters.filter(c => c.id !== numericId) };
            } else if (type === 'text') {
                return { ...prev, texts: prev.texts.filter(t => t.id !== numericId) };
            } else if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numericId) };
            }
            return prev;
        });
        setSelectedItemId(null);
    }, [setConfig]);

    const handleTextUpdate = useCallback((id: number, updates: Partial<TextConfig>) => {
        setConfig(prev => ({
            ...prev,
            texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t)
        }));
    }, [setConfig]);

    const handleItemUpdate = useCallback((idStrFull: string, updates: Partial<DraggableItem>) => {
        const [type, idStr] = idStrFull.split('-');
        const numericId = parseInt(idStr);
        if (type === 'item') {
            setConfig(prev => ({
                ...prev,
                draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...updates } : i)
            }));
        }
    }, [setConfig]);

    const handleCharacterUpdate = useCallback((id: number, updates: Partial<LegoCharacterConfig>) => {
        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
    }, [setConfig]);

    const handleItemFlip = useCallback((id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        if (type === 'item') {
            setConfig(prev => ({
                ...prev,
                draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, isFlipped: !i.isFlipped } : i)
            }));
        }
    }, [setConfig]);

    const addText = () => {
        const newText: TextConfig = {
            id: Date.now(),
            content: "Nhập chữ...",
            font: "Montserrat",
            size: 24,
            color: "#000000",
            x: 50, y: 50, rotation: 0, scale: 1, background: false, textAlign: 'center', width: 30
        };
        setConfig(prev => ({ ...prev, texts: [...prev.texts, newText] }));
        setSelectedItemId(`text-${newText.id}`);
        setIsEditingText(true);
    };

    const addCharm = (dataUrl: string) => {
        const newItem: DraggableItem = {
            id: Date.now(),
            partId: dataUrl,
            type: 'charm',
            x: 50, y: 50, rotation: 0, scale: 1
        };
        setConfig(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
    };

    const capturePreview = async () => {
        if (previewContainerRef.current) {
             const target = previewContainerRef.current.querySelector('div > div') as HTMLElement;
             if (target && typeof html2canvas !== 'undefined') {
                 try {
                     const canvas = await html2canvas(target, { 
                         useCORS: true, 
                         scale: 2,
                         backgroundColor: null
                     });
                     return canvas.toDataURL('image/png');
                 } catch (e) {
                     console.error("Capture error", e);
                     return null;
                 }
             }
        }
        return null;
    };

    const handleNextStep = async () => {
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
            window.scrollTo(0, 0);
        } else {
            const previewUrl = await capturePreview();
            const configWithImage = { ...config, previewImageUrl: previewUrl || undefined };
            
            if (editingCartIndex !== null) {
                onUpdateCart(configWithImage);
                showToast("Đã cập nhật giỏ hàng!", 'success');
            } else {
                onAddToCart(configWithImage);
                showToast("Đã thêm vào giỏ hàng!", 'success');
            }
        }
    };

    const { totalPrice } = calculatePrice(config, 
        Object.values(legoParts).flat().reduce((acc, p) => ({...acc, [p.id]: p}), {} as Record<string, LegoPart>), 
        frames
    );

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-1/2 lg:sticky lg:top-24">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 preview-container-capture">
                        <FramePreview 
                            ref={previewContainerRef}
                            config={config} 
                            containerWidth={window.innerWidth < 768 ? window.innerWidth - 80 : 500}
                            onItemTransform={handleItemTransform}
                            onItemRemove={handleItemRemove}
                            onTextUpdate={handleTextUpdate}
                            onItemUpdate={handleItemUpdate}
                            onCharacterUpdate={handleCharacterUpdate}
                            onItemFlip={handleItemFlip}
                            isInteractive={true}
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            setIsEditingText={setIsEditingText}
                            allParts={Object.values(legoParts).flat().reduce((acc, p) => ({...acc, [p.id]: p}), {} as Record<string, LegoPart>)}
                            activePartType={activePartType}
                            logoUrl={logoUrl}
                        />
                        <div className="mt-6 flex items-center justify-between text-gray-700 bg-gray-50 p-4 rounded-lg">
                            <span className="font-bold text-lg">Tổng cộng:</span>
                            <span className="font-bold text-xl text-luvin-pink">{formatCurrency(totalPrice)}</span>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-1/2">
                    <StepIndicator currentStep={currentStep} setStep={setCurrentStep} />
                    
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 min-h-[500px]">
                        {currentStep === 1 && (
                            <Step1Frame config={config} setConfig={setConfig} frames={frames} />
                        )}
                        {currentStep === 2 && (
                            <Step2BackgroundAndDecorations 
                                config={config} 
                                setConfig={setConfig} 
                                addText={addText} 
                                addCharm={addCharm} 
                                backgrounds={backgrounds}
                                onZoomImage={onZoomImage}
                            />
                        )}
                        {currentStep === 3 && (
                            <Step3Characters 
                                config={config} 
                                setConfig={setConfig} 
                                legoParts={legoParts}
                                selectedItemId={selectedItemId}
                                setSelectedItemId={setSelectedItemId}
                                activePartType={activePartType}
                                setActivePartType={setActivePartType}
                            />
                        )}
                        {currentStep === 4 && (
                            <div className="p-6 text-center space-y-6">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-4xl">✨</div>
                                <h3 className="text-2xl font-bold text-gray-800">Hoàn tất thiết kế!</h3>
                                <p className="text-gray-600">
                                    Sản phẩm của bạn đã sẵn sàng. Hãy kiểm tra lại lần cuối trước khi thêm vào giỏ hàng nhé.
                                </p>
                                <div className="space-y-3 pt-4">
                                    <button 
                                        onClick={handleNextStep}
                                        className="w-full bg-luvin-pink text-gray-900 font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:bg-opacity-90 transition-all transform hover:-translate-y-1"
                                    >
                                        {editingCartIndex !== null ? 'Cập nhật giỏ hàng' : 'Thêm vào giỏ hàng'} - {formatCurrency(totalPrice)}
                                    </button>
                                    
                                    {editingCartIndex !== null && (
                                        <button 
                                            onClick={onCancelEdit}
                                            className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                                        >
                                            Hủy chỉnh sửa
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={() => setCurrentStep(3)}
                                        className="text-gray-500 hover:text-gray-800 text-sm font-medium underline"
                                    >
                                        Quay lại chỉnh sửa
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {currentStep < 4 && (
                        <div className="mt-6 flex justify-between">
                            {currentStep > 1 ? (
                                <button onClick={() => setCurrentStep(currentStep - 1)} className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors">Quay lại</button>
                            ) : <div></div>}
                            <button onClick={handleNextStep} className="px-8 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition-colors shadow-lg">Tiếp tục &rarr;</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
