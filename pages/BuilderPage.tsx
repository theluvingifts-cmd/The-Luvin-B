
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Page, FrameConfig, LegoPart, TextConfig, FrameOption, CustomFont } from '../types';
import { 
    LEGO_PARTS, 
    INITIAL_FRAME_CONFIG,
} from '../constants';
import FramePreview from '../components/FramePreview';
import { uploadToCloudinary } from '../services/uploadService';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { ZoomIcon } from '../components/ZoomIcon';
import { getAllOrders } from '../services/orderService';
import { trackAddToCart } from '../services/analyticsService'; 
import { dataURLToBlob, preloadImage } from '../utils/helpers';

// Sub-components
import { Step1Frame } from '../components/builder/Step1';
import { Step2BackgroundAndDecorations } from '../components/builder/Step2';
import { Step3Characters } from '../components/builder/Step3';
import { Step4Summary } from '../components/builder/Step4';

declare var html2canvas: any;

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];

const StepIndicator: React.FC<{ currentStep: number; setStep: (step: number) => void }> = ({ currentStep, setStep }) => {
  const steps = ['Chọn khung', 'Trang trí', 'Nhân vật', 'Hoàn tất'];

  return (
    <div id="builder-step-indicator" className="w-full max-w-3xl mx-auto md:mx-0 my-4 px-2 scroll-mt-24">
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

const FontSelector: React.FC<{ 
    value: string; 
    onChange: (font: string) => void; 
    onPreview: (font: string | null) => void;
    uploadedFonts: CustomFont[];
}> = ({ value, onChange, onPreview, uploadedFonts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const groups = [
        { label: 'Phông chữ cơ bản', fonts: DEFAULT_FONTS },
        { label: 'Phông chữ tải lên', fonts: uploadedFonts.map(f => f.name) }
    ];

    return (
        <div className="relative text-left" ref={dropdownRef} onMouseLeave={() => onPreview(null)}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-left flex justify-between items-center"
            >
                <span className="truncate">{value}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {groups.map((group) => (
                        group.fonts.length > 0 && (
                            <div key={group.label}>
                                <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{group.label}</div>
                                {group.fonts.map(font => (
                                    <div 
                                        key={font}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-pink-50 transition-colors ${value === font ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'}`}
                                        onMouseEnter={() => onPreview(font)}
                                        onClick={() => { onChange(font); setIsOpen(false); }}
                                    >
                                        <span style={{ fontFamily: font }}>{font}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    ))}
                </div>
            )}
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
    uploadedFonts: CustomFont[];
    setPreviewFont: (font: string | null) => void; 
}> = ({ activeText, setConfig, config, selectedTextId, deselect, onAddText, uploadedFonts, setPreviewFont }) => {
    
    const updateActiveText = (updates: Partial<TextConfig>) => {
        setConfig({
            ...config,
            texts: config.texts.map((t) => t.id === selectedTextId ? { ...t, ...updates } : t)
        });
    }

    const isLocked = activeText.lockedContent;
    
    return (
        <div className="p-4 border border-gray-200 rounded-lg relative text-left">
            {isLocked && (
                <div 
                    className="absolute inset-0 z-20 bg-gray-50/50 backdrop-blur-[1px] flex items-center justify-center rounded-lg cursor-not-allowed"
                    onClick={(e) => e.stopPropagation()} 
                >
                    <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 shadow-sm flex items-center gap-1 select-none">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zm2 5v3h-4V7c0-1.103.897-2 2-2s2 .897 2 2z"/></svg>
                        🔒 Nội dung đã bị khóa bởi Admin
                    </span>
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight text-sm">CHỈNH SỬA CHỮ</h3>
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
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nội dung</label>
                    <textarea
                        value={activeText.content}
                        onChange={e => updateActiveText({ content: e.target.value })}
                        disabled={isLocked}
                        readOnly={isLocked}
                        rows={3}
                        className={`w-full p-3 border rounded-lg text-sm bg-white ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300'} focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none`}
                        placeholder="Nhập nội dung văn bản..."
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Font Chữ</label>
                    <FontSelector 
                        value={activeText.font} 
                        onChange={(font) => updateActiveText({ font })}
                        onPreview={setPreviewFont}
                        uploadedFonts={uploadedFonts}
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cỡ chữ</label>
                    <input 
                      type="number" 
                      min="8" 
                      max="100" 
                      value={activeText.size} 
                      onChange={e => updateActiveText({ size: parseInt(e.target.value)})} 
                      disabled={isLocked}
                      readOnly={isLocked}
                      className={`w-full p-2.5 border rounded-lg text-sm bg-white ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300'} focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none`}
                    />
                </div>
                <div className="flex items-center justify-between gap-2">
                    <button 
                        onClick={() => updateActiveText({background: !activeText.background})} 
                        disabled={isLocked}
                        className={`text-sm px-3 py-2 rounded-lg flex-1 font-bold ${activeText.background ? 'bg-luvin-pink text-gray-800' : 'bg-gray-200 text-gray-800'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''} transition-all`}
                    >
                      {activeText.background ? 'Bỏ nền mờ' : 'Thêm nền mờ'}
                    </button>
                    <div className={`flex rounded-lg border border-gray-300 overflow-hidden ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                        {(['left', 'center', 'right'] as const).map(align => (
                           <button key={align} onClick={() => updateActiveText({ textAlign: align })} className={`px-4 py-2 text-sm font-bold ${(activeText.textAlign || 'center') === align ? 'bg-luvin-pink text-gray-800' : 'bg-white text-gray-800'} transition-all`}>
                             {align.charAt(0).toUpperCase()}
                           </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

type Transform = { x: number; y: number; rotation: number; scale: number; width?: number; height?: number };

interface BuilderPageProps { 
    config: FrameConfig; 
    setConfig: React.Dispatch<React.SetStateAction<FrameConfig>>; 
    navigateTo: (p:Page) => void; 
    onAddToCart: (config: FrameConfig, openCartPanel?: boolean) => void; 
    onUpdateCart: (config: FrameConfig) => void; 
    showToast: (message: string, type: 'success' | 'error') => void;
    legoParts: typeof LEGO_PARTS; 
    backgrounds: any[]; 
    frames: FrameOption[]; 
    editingCartIndex: number | null; 
    onCancelEdit: () => void; 
    onZoomImage: (url: string) => void; 
    logoUrl?: string; 
    initialStep?: number; 
    isEditingOrder?: boolean;
    uploadedFonts: CustomFont[];
}

export const BuilderPage: React.FC<BuilderPageProps> = ({ config, setConfig, navigateTo, onAddToCart, onUpdateCart, showToast, legoParts, backgrounds, frames, editingCartIndex, onCancelEdit, onZoomImage, logoUrl, initialStep, isEditingOrder, uploadedFonts }) => {
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
  const [previewFont, setPreviewFont] = useState<string | null>(null); 
  
  const [urgencyTimeLeft, setUrgencyTimeLeft] = useState(900);
  const urgencyTimerRef = useRef<any>(null);

  const [history, setHistory] = useState<FrameConfig[]>([config]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const topCharmUploadRef = useRef<HTMLInputElement>(null);

  const allParts = useMemo(() => (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  useEffect(() => {
    backgrounds.slice(0, 5).forEach(bg => preloadImage(bg.previewUrl || bg.url));
    if (hotPartIds.length > 0) {
        hotPartIds.forEach(id => {
            const part = allParts[id];
            if (part) preloadImage(part.imageUrl);
        });
    }
    (Object.values(legoParts) as LegoPart[][]).forEach(partsList => {
        partsList.slice(0, 3).forEach(p => preloadImage(p.imageUrl));
    });
  }, [backgrounds, hotPartIds, allParts, legoParts]);

  const { totalPrice, priceBreakdown } = useMemo(() => calculatePrice(config, allParts, frames), [config, allParts, frames]);
  const remainingForFreeShip = FREE_SHIPPING_THRESHOLD - totalPrice;
  const freeShipPercent = Math.min(100, (totalPrice / FREE_SHIPPING_THRESHOLD) * 100);

  useEffect(() => {
    if (step === 4 && !isEditingOrder && !urgencyTimerRef.current) {
        urgencyTimerRef.current = setInterval(() => {
            setUrgencyTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(urgencyTimerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
  }, [step, isEditingOrder]);

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
                    const randomFillers = availableAccessories.filter(p => !topIds.includes(p.id)).map(p => p.id);
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

  const handleReset = () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ thiết kế hiện tại và bắt đầu lại từ đầu?")) {
        setConfig(INITIAL_FRAME_CONFIG);
        setHistory([INITIAL_FRAME_CONFIG]);
        setHistoryIndex(0);
        localStorage.removeItem('active_design_draft');
        showToast("Đã làm mới thiết kế!", 'success');
    }
  };

  const handleShare = async () => {
      setIsSaving(true);
      const image = await captureFrameAsImage();
      setIsSaving(false);
      
      if (!image) return;

      if (navigator.share) {
          try {
              const blob = dataURLToBlob(image);
              if (!blob) throw new Error("Conversion failed");
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

  const handleItemTransform = useCallback((id: string, nTransform: Transform) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      
      setConfigWithHistory((prev: FrameConfig) => {
          if (type === 'text') {
              const idToUpdate = parseInt(rawId);
              return { ...prev, texts: prev.texts.map(item => item.id === idToUpdate ? { ...item, ...nTransform } : item) };
          }
          const itemId = parseInt(rawId);
          if (type === 'character') return { ...prev, characters: prev.characters.map((item: any) => item.id === itemId ? { ...item, ...nTransform } : item) };
          if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map((item: any) => item.id === itemId ? { ...item, ...nTransform } : item) };
          if (type === 'shape') {
              return { ...prev, shapes: (prev.shapes || []).map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
          }
          return prev;
      });
  }, [setConfigWithHistory]);

  const handleAlignItem = (direction: 'center' | 'center-x' | 'center-y' | 'horizontal' | 'vertical') => {
      if (!selectedItemId) return;
      if (direction === 'horizontal') direction = 'center-x';
      if (direction === 'vertical') direction = 'center-y';

      const [type, ...rest] = selectedItemId.split('-');
      const rawId = rest.join('-');
      const idToUpdate = parseInt(rawId);

      setConfigWithHistory((prev: FrameConfig) => {
          let updates: Partial<Transform> = {};
          if (direction === 'center') updates = { x: 50, y: 50 };
          else if (direction === 'center-x') updates = { x: 50 };
          else if (direction === 'center-y') updates = { y: 50 };

          if (type === 'text') {
              return { ...prev, texts: prev.texts.map(item => item.id === idToUpdate ? { ...item, ...updates } : item) };
          } else if (type === 'character') {
              return { ...prev, characters: prev.characters.map(item => item.id === idToUpdate ? { ...item, ...updates } : item) };
          } else if (type === 'item') {
              return { ...prev, draggableItems: prev.draggableItems.map(item => item.id === idToUpdate ? { ...item, ...updates } : item) };
          } else if (type === 'shape') {
              return { ...prev, shapes: (prev.shapes || []).map(item => item.id === idToUpdate ? { ...item, ...updates } : item) };
          }
          return prev;
      });
  };

  const handleItemFlip = useCallback((id: string) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      if (type === 'item') {
          const itemId = parseInt(rawId);
          setConfigWithHistory((prev: FrameConfig) => ({
              ...prev,
              draggableItems: prev.draggableItems.map((item: any) => 
                  item.id === itemId ? { ...item, isFlipped: !item.isFlipped } : item
              )
          }));
      }
  }, [setConfigWithHistory]);

  const handleItemUpdate = useCallback((id: string, updates: any) => {
      const [type, ...rest] = id.split('-');
      const rawId = rest.join('-');
      if (type === 'item') {
          const itemId = parseInt(rawId);
          setConfigWithHistory((prev: FrameConfig) => ({
              ...prev,
              draggableItems: prev.draggableItems.map((item: any) => 
                  item.id === itemId ? { ...item, ...updates } : item
              )
          }));
      }
  }, [setConfigWithHistory]);

  const handleCharacterUpdate = useCallback((id: number, updates: any) => {
      setConfigWithHistory((prev: FrameConfig) => ({
          ...prev,
          characters: prev.characters.map((c: any) => c.id === id ? { ...c, ...updates } : c)
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
        if (type === 'character') return { ...prev, characters: prev.characters.filter((item: any) => item.id !== itemId) };
        if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter((item: any) => item.id !== itemId) };
        if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(item => item.id !== itemId) };
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
      const newCharm: any = { id: Date.now(), partId: dataUrl, type: 'charm', x: 50, y: 50, rotation: 0, scale: 0.5 };
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
            resolve('');
          }
        } catch (error: any) {
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
          if (document.body.contains(flyImg)) document.body.removeChild(flyImg);
      });
  };

  const handleAddToCartWrapper = async (andCheckout: boolean) => {
    trackAddToCart(); 
    setIsSaving(true);
    try {
        const base64Image = await captureFrameAsImage();
        if (!base64Image) {
            showToast('Lỗi tạo ảnh. Có thể do lỗi CORS.', 'error');
            setIsSaving(false);
            return;
        }
        animateAddToCart(base64Image);
        const imageBlob = dataURLToBlob(base64Image);
        if (!imageBlob) {
            showToast('Lỗi xử lý ảnh.', 'error');
            setIsSaving(false);
            return;
        }
        const imageFile = new File([imageBlob], "design_preview.png", { type: "image/png" });
        const cloudUrl = await uploadToCloudinary(imageFile);
        if (!cloudUrl) {
             showToast('Lỗi lưu ảnh. Vui lòng kiểm tra kết nối mạng.', 'error');
             setIsSaving(false);
             return;
        }
        const finalConfig = { ...config, previewImageUrl: cloudUrl };
        if (editingCartIndex !== null && !andCheckout) {
            onUpdateCart(finalConfig);
        } else {
            onAddToCart({ ...finalConfig, quantity: 1 }, !andCheckout);
        }
        if (andCheckout) navigateTo('checkout');
    } catch (e) {
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
      if (selectedItemId && (selectedItemId.startsWith('item-') || selectedItemId.startsWith('text-') || selectedItemId.startsWith('shape-'))) {
          setSelectedItemId(null);
          return;
      }
      const order: ('shirt' | 'pants' | 'hair' | 'face' | 'hat')[] = ['shirt', 'pants', 'hair', 'face', 'hat'];
      let currentIndex = order.indexOf(activePartType as any);
      if (activePartType === 'set') { setActivePartType('hair'); return; }
      if (currentIndex !== -1 && currentIndex < order.length - 1) {
          setActivePartType(order[currentIndex + 1]);
      } else {
          setActivePartType('shirt'); 
      }
  };

  const handleTopCharmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const result = fileReader.result;
        if (typeof result === 'string') {
          addCharm(result);
          if (step !== 2) setStep(2);
        }
      };
      fileReader.readAsDataURL(file);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1: return <Step1Frame config={config} setConfig={setConfigWithHistory} frames={frames} />;
      case 2: return <Step2BackgroundAndDecorations config={config} setConfig={setConfigWithHistory} backgrounds={backgrounds} frames={frames} onZoomImage={onZoomImage} showToast={showToast} preferredSquareFrameId={lastSquareFrameId} />;
      case 3: return <Step3Characters config={config} setConfig={setConfigWithHistory} legoParts={legoParts} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} activePartType={activePartType} setActivePartType={setActivePartType} hotPartIds={hotPartIds} showToast={showToast} allParts={allParts} />;
      case 4: return <Step4Summary totalPrice={totalPrice} priceBreakdown={priceBreakdown} frameName={frames.find(f => f.id === config.frameId)?.name || ''} charCount={config.characters.length} onAddToCart={() => handleAddToCartWrapper(false)} onBuyNow={() => handleAddToCartWrapper(true)} isSaving={isSaving} isEditingOrder={isEditingOrder} urgencyTimeLeft={urgencyTimeLeft} />;
      default: return null;
    }
  };

  return (
    <div className="bg-gray-50 py-2 sm:py-6 safe-bottom">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-gray-400">
                <button onClick={() => navigateTo('home')} className="hover:underline">Home</button> / Thiết kế
            </div>
        </div>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-800 mb-2">
            {isEditingOrder ? 'Chỉnh sửa đơn hàng' : 'Thiết kế & Mua hàng'}
        </h1>
        
        <StepIndicator currentStep={step} setStep={setStep} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 lg:items-start">
          <div className="lg:col-span-7" ref={previewContainerParentRef}>
            <div className="lg:sticky lg:top-24">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-800 text-xs sm:text-base uppercase tracking-tight text-left">ẢNH XEM TRƯỚC</h3>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="flex gap-1 pr-2 mr-2 border-r border-gray-200">
                            <button onClick={addText} className="h-8 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 flex items-center gap-1 hover:bg-gray-50 active:scale-95 transition-all shadow-sm" title="Thêm chữ nhanh">
                                <span className="text-sm font-black">T+</span><span className="text-[10px] font-bold hidden sm:inline">Chữ</span>
                            </button>
                            <button onClick={() => topCharmUploadRef.current?.click()} className="h-8 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 flex items-center gap-1 hover:bg-gray-50 active:scale-95 transition-all shadow-sm" title="Tải ảnh nhỏ nhanh">
                                <span className="text-sm">🖼️</span><span className="text-[10px] font-bold hidden sm:inline">Ảnh</span>
                            </button>
                            <input type="file" ref={topCharmUploadRef} accept="image/*" onChange={handleTopCharmUpload} className="hidden" />
                        </div>
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
                        <button onClick={handleReset} className="w-8 h-8 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-red-500 hover:bg-red-50 active:scale-95 transition-all shadow-sm" title="Làm mới thiết kế">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <button onClick={handleShare} className="w-8 h-8 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-blue-600 hover:bg-blue-50 active:scale-95 transition-all shadow-sm" title="Chia sẻ thiết kế">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </button>
                    </div>
                </div>
                <div className="bg-gray-100 rounded-lg flex items-center justify-center aspect-square p-2 mb-2 lg:mb-0 shadow-inner">
                    <FramePreview 
                        ref={frameCaptureRef} config={config} containerWidth={previewWidth - 32} onItemTransform={handleItemTransform} onItemRemove={handleItemRemoveCompletely} onTextUpdate={handleTextUpdate} onItemUpdate={handleItemUpdate} onCharacterUpdate={handleCharacterUpdate} onItemFlip={handleItemFlip} onCharacterDoubleClick={handleCharacterDoubleClick} onAutoAdvance={handleAutoAdvance} className="w-full h-full" selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} setIsEditingText={setIsEditingText} allParts={allParts} activePartType={activePartType} logoUrl={logoUrl} previewFont={previewFont} onAlign={(type) => handleAlignItem(type === 'horizontal' ? 'center-x' : type === 'vertical' ? 'center-y' : 'center')} 
                    />
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-start shadow-sm hidden lg:flex text-left">
                    <span className="text-amber-500 mt-0.5"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg></span>
                    <div className="text-xs text-amber-900 leading-relaxed"><p className="font-bold mb-1">Lưu ý quan trọng:</p><p>Đây là bản xem trước mô phỏng. Sau khi đặt hàng, <b>Designer sẽ thiết kế lại bố cục & màu sắc</b> đẹp nhất và gửi bạn duyệt trước khi in ấn.</p></div>
                </div>
            </div>
          </div>

          <div className="lg:col-span-5 mt-2 lg:mt-0" id="builder-action-area"> 
              {(step === 2 || step === 3) && (
                  <div className="mb-3 px-1 animate-fade-in text-left">
                      <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-gray-500 font-medium">{remainingForFreeShip > 0 ? (<>Thêm <b className="text-luvin-pink">{formatCurrency(remainingForFreeShip)}</b> để Freeship</>) : (<b className="text-green-600 flex items-center gap-1">✨ Đã được Freeship</b>)}</span>
                          <span className="text-gray-400 font-bold">{Math.round(freeShipPercent)}%</span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-pink-300 to-luvin-pink transition-all duration-500 ease-out rounded-full shadow-[0_0_8px_rgba(239,163,181,0.6)]" style={{ width: `${freeShipPercent}%` }}></div></div>
                  </div>
              )}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  {selectedText ? (<TextEditor activeText={selectedText} setConfig={setConfigWithHistory} config={config} selectedTextId={selectedText.id} deselect={() => setSelectedItemId(null)} onAddText={addText} uploadedFonts={uploadedFonts} setPreviewFont={setPreviewFont} />) : (<div className="min-h-[350px]">{renderStepContent()}</div>)}
              </div>
              {!selectedText && (
                <>
                  <div className="mt-4 text-right font-bold text-lg text-gray-800 hidden lg:block">Giá tạm tính: <span className="text-luvin-pink">{formatCurrency(totalPrice)}</span></div>
                  <div className="mt-2 hidden lg:flex items-center gap-4">
                      {editingCartIndex !== null && step === 4 ? (
                        <div className="w-full flex flex-col gap-2">
                           <button onClick={onCancelEdit} className="w-full bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors">Hủy sửa</button>
                           <button onClick={() => handleAddToCartWrapper(false)} disabled={isSaving} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-base hover:opacity-90 transition-colors disabled:opacity-50">
                              {isSaving ? '...' : (isEditingOrder ? 'Lưu vào đơn hàng' : 'Cập nhật giỏ hàng')}
                           </button>
                        </div>
                      ) : (
                        <div className="w-full flex items-center gap-4">
                           <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="w-full bg-white border border-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:bg-gray-100 transition-colors">&larr; Quay lại</button>
                           <button onClick={() => setStep(s => Math.min(4, s + 1))} disabled={step === 4} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:opacity-90 transition-colors shadow-md">Tiếp theo</button>
                        </div>
                      )}
                  </div>
                </>
              )}
               <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50 transition-transform duration-300 ease-in-out safe-bottom ${isBottomBarVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                     <div className="flex justify-between items-center mb-3"><span className="text-xs font-medium text-gray-500">Tạm tính:</span><span className="font-bold text-lg text-luvin-pink">{formatCurrency(totalPrice)}</span></div>
                     {editingCartIndex !== null && step === 4 ? (
                        <div className="flex gap-2">
                            <button onClick={onCancelEdit} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors text-sm">Hủy</button>
                            <button onClick={() => handleAddToCartWrapper(false)} disabled={isSaving} className="flex-[2] bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-sm hover:opacity-90 transition-colors disabled:opacity-50">{isSaving ? '...' : (isEditingOrder ? 'Lưu vào đơn' : 'Cập nhật')}</button>
                        </div>
                     ) : (
                         <div className="flex gap-3">
                           <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="flex-1 bg-white border border-gray-300 text-gray-800 font-bold py-3 rounded-lg disabled:opacity-50 text-sm">Quay lại</button>
                           <button onClick={() => setStep(s => Math.min(4, s + 1))} disabled={step === 4} className="flex-[2] bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg disabled:opacity-50 shadow-md text-sm">Tiếp theo</button>
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
