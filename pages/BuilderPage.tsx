
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Page, FrameConfig, LegoPart, DraggableItem, TextConfig, LegoCharacterConfig, OutfitColor, PresetBackground, FrameOption, CollectionTemplate } from '../types';
import { 
    FRAME_OPTIONS, 
    LEGO_PARTS, 
} from '../constants';
import FramePreview from '../components/FramePreview';
import { uploadToCloudinary } from '../services/uploadService';
import { calculatePrice, formatCurrency } from '../utils/pricing';
import { StudioDesign } from '../components/StudioDesign'; 
import { getAllFonts } from '../services/fontService';
import { addTemplate } from '../services/templateService'; 
import { auth } from '../config/firebase'; 
import { onAuthStateChanged } from 'firebase/auth';

declare var html2canvas: any;

// ... (StepIndicator and Step1Frame components remain unchanged, omitted for brevity but assumed present)
const StepIndicator: React.FC<{ currentStep: number; setStep: (step: number) => void }> = ({ currentStep, setStep }) => {
  const steps = ['Kích thước', 'Thiết kế', 'Nhân vật', 'Thanh toán'];
  
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
          {frames.map(frame => (
            <button
              key={frame.id}
              onClick={() => setConfig({ ...config, frameId: frame.id })}
              disabled={frame.stock === 0}
              className={`border rounded-lg py-2 px-1 text-xs sm:text-sm font-semibold transition-all duration-200 flex flex-col items-center justify-center h-20 relative hover:scale-105 active:scale-95 ${
                config.frameId === frame.id ? 'bg-luvin-pink text-gray-800 border-luvin-pink shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-50'
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
}

export const BuilderPage: React.FC<BuilderPageProps> = ({ config, setConfig, navigateTo, onAddToCart, onUpdateCart, showToast, legoParts, backgrounds, frames, editingCartIndex, onCancelEdit, onZoomImage, logoUrl, initialStep }) => {
  const [step, setStep] = useState(initialStep || 1); 
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const previewContainerParentRef = useRef<HTMLDivElement>(null);
  const frameCaptureRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(480);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [activePartType, setActivePartType] = useState<'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set'>('shirt');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Custom Fonts State (Cloud)
  const [customFonts, setCustomFonts] = useState<{name: string, label: string}[]>([]);

  // Check Admin Role & Load Fonts
  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user && (user.email?.includes('admin') || user.email === 'jinbduong@gmail.com')) {
              setIsAdmin(true);
          } else {
              setIsAdmin(false);
          }
      });

      // Load fonts from Firestore
      const loadFonts = async () => {
          const fonts = await getAllFonts();
          setCustomFonts(fonts.map(f => ({ name: f.name, label: f.name })));
          
          // Load font faces into document
          fonts.forEach(font => {
              const fontFace = new FontFace(font.name, `url(${font.url})`);
              fontFace.load().then(loadedFace => {
                  document.fonts.add(loadedFace);
              }).catch(err => console.error("Error loading font:", font.name, err));
          });
      };
      loadFonts();

      return () => unsubscribe();
  }, []);

  // Undo/Redo State
  const [history, setHistory] = useState<FrameConfig[]>([config]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const { totalPrice, priceBreakdown } = useMemo(() => calculatePrice(config, Object.values(legoParts).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), frames), [config, legoParts, frames]);

  // Wrapper for setConfig to handle history
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

  const handleUndo = () => { if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setConfig(history[newIndex]); } };
  const handleRedo = () => { if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setConfig(history[newIndex]); } };

  const handleItemTransform = useCallback((id: string, newTransform: any) => {
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

  const handleItemRemoveCompletely = useCallback((id: string) => {
    const [type, ...rest] = id.split('-');
    const rawId = rest.join('-');
    setSelectedItemId(null);
    setConfigWithHistory((prev: FrameConfig) => {
        if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== parseInt(rawId)) };
        const itemId = parseInt(rawId);
        if (type === 'character') return { ...prev, characters: prev.characters.filter((item) => item.id !== itemId) };
        if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter((item) => item.id !== itemId) };
        return prev;
    });
  }, [setConfigWithHistory]);

  const handleTextUpdate = useCallback((id: number, updates: Partial<TextConfig>) => {
    setConfigWithHistory((prev: FrameConfig) => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) }));
  }, [setConfigWithHistory]);

  const handleItemUpdate = useCallback((id: string, updates: Partial<DraggableItem>) => {
      const [type, ...rest] = id.split('-');
      if (type === 'item') {
          const itemId = parseInt(rest.join('-'));
          setConfigWithHistory((prev) => ({
              ...prev,
              draggableItems: prev.draggableItems.map(item => item.id === itemId ? { ...item, ...updates } : item)
          }));
      }
  }, [setConfigWithHistory]);

  const handleCharacterUpdate = useCallback((id: number, updates: Partial<LegoCharacterConfig>) => {
      setConfigWithHistory((prev) => ({ ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c) }));
  }, [setConfigWithHistory]);

  const handleItemFlip = useCallback((id: string) => {
      const [type, ...rest] = id.split('-');
      if (type === 'item') {
          const itemId = parseInt(rest.join('-'));
          setConfigWithHistory((prev) => ({ ...prev, draggableItems: prev.draggableItems.map(item => item.id === itemId ? { ...item, isFlipped: !item.isFlipped } : item) }));
      }
  }, [setConfigWithHistory]);

  // Capture Image
  const captureFrameAsImage = async (): Promise<string> => {
    const originalSelectedId = selectedItemId;
    setSelectedItemId(null); 
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const container = frameCaptureRef.current;
          if (container && typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(container, { backgroundColor: null, useCORS: true, scale: 3, logging: false, scrollX: 0, scrollY: 0, ignoreElements: (element: Element) => false });
            resolve(canvas.toDataURL('image/png'));
          } else { resolve(''); }
        } catch (error) { resolve(''); } finally { setSelectedItemId(originalSelectedId); }
      }, 500); // Shorter delay
    });
  };

  const handleAddToCartWrapper = async (andCheckout: boolean) => {
    setIsSaving(true);
    try {
        const base64Image = await captureFrameAsImage();
        if (!base64Image) { showToast('Lỗi tạo ảnh. Vui lòng thử lại.', 'error'); setIsSaving(false); return; }
        const cloudUrl = await uploadToCloudinary(base64Image);
        if (!cloudUrl) { showToast('Lỗi lưu ảnh. Vui lòng kiểm tra kết nối mạng.', 'error'); setIsSaving(false); return; }
        const finalConfig = { ...config, previewImageUrl: cloudUrl };
        if (editingCartIndex !== null && !andCheckout) onUpdateCart(finalConfig);
        else onAddToCart({ ...finalConfig, quantity: 1 }, !andCheckout);
        if (andCheckout) navigateTo('checkout');
    } catch (e) { showToast('Đã có lỗi xảy ra.', 'error'); } finally { setIsSaving(false); }
  };

  // ADMIN FEATURE: Save as Template
  const handleSaveAsTemplate = async () => {
      const name = prompt("Nhập tên mẫu thiết kế:");
      if (!name) return;
      
      setIsSaving(true);
      showToast("Đang tạo mẫu...", "success");
      try {
          const base64Image = await captureFrameAsImage();
          if (!base64Image) throw new Error("Failed to capture");
          
          const imageUrl = await uploadToCloudinary(base64Image);
          if (!imageUrl) throw new Error("Failed to upload image");

          const newTemplate: CollectionTemplate = {
              id: `tpl_${Date.now()}`,
              name,
              imageUrl,
              config: config
          };

          const success = await addTemplate(newTemplate);
          if (success) showToast("Đã lưu mẫu thành công!", "success");
          else showToast("Lỗi khi lưu mẫu.", "error");

      } catch (error) {
          console.error(error);
          showToast("Có lỗi xảy ra.", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const handleCharacterDoubleClick = (charId: number) => { setStep(3); setSelectedItemId(`character-${charId}`); };
  const handleAutoAdvance = () => { /* ... existing logic ... */ };

  const allParts = useMemo(() => Object.values(legoParts).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>), [legoParts]);

  const renderStepContent = () => {
    switch (step) {
      case 1: return <Step1Frame config={config} setConfig={setConfigWithHistory} frames={frames} />;
      case 2: return (
        <StudioDesign 
            config={config} 
            setConfig={setConfigWithHistory}
            backgrounds={backgrounds}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            onZoomImage={onZoomImage}
            onStepChange={setStep}
            onUndo={handleUndo}
            onRedo={handleRedo}
            historyIndex={historyIndex}
            historyLength={history.length}
            logoUrl={logoUrl}
            allParts={allParts}
            onItemTransform={handleItemTransform}
            onItemRemove={handleItemRemoveCompletely}
            onTextUpdate={handleTextUpdate}
            onItemUpdate={handleItemUpdate}
            onCharacterUpdate={handleCharacterUpdate}
            onItemFlip={handleItemFlip}
            setIsEditingText={setIsEditingText}
            frameCaptureRef={frameCaptureRef}
            customFonts={customFonts}
            setCustomFonts={setCustomFonts}
            showToast={showToast}
            isAdmin={isAdmin}
            onSaveTemplate={handleSaveAsTemplate}
        />
      );
      case 3: 
        return <div>Character Selection Step (Placeholder)</div>; 
      case 4: 
        return <div>Summary Step (Placeholder)</div>;
      default: return null;
    }
  };

  if (step === 2) {
      return (
          <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col font-sans text-gray-900">
              {renderStepContent()}
          </div>
      );
  }

  return (
    <div className="bg-gray-50 py-4 sm:py-8 safe-bottom">
      <div className="container mx-auto px-4">
        {/* ... Header and Indicator code ... */}
        <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-500">
                <button onClick={() => navigateTo('home')} className="hover:underline">Home</button> / Thiết kế
            </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
            {editingCartIndex !== null ? 'Chỉnh sửa đơn hàng' : 'Thiết kế & Mua hàng'}
        </h1>
        <StepIndicator currentStep={step} setStep={setStep} />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 lg:items-start">
          {/* Left Preview Panel */}
          <div className="lg:col-span-7" ref={previewContainerParentRef}>
            <div className="lg:sticky lg:top-24">
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
            </div>
          </div>

          <div className="lg:col-span-5 mt-4 lg:mt-0" id="builder-action-area"> 
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="min-h-[400px]">
                      {renderStepContent()}
                  </div>
              </div>
              {!(editingCartIndex !== null && step === 4) && (
                  <div className="mt-2 hidden lg:flex items-center gap-4">
                      <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="w-full bg-white border border-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:bg-gray-100 transition-colors">
                          &larr; Quay lại
                      </button>
                      <button onClick={() => setStep(s => Math.min(4, s + 1))} disabled={step === 4} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 px-8 rounded-lg disabled:opacity-50 hover:opacity-90 transition-colors shadow-md">
                          Tiếp theo
                      </button>
                  </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};
