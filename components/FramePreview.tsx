
import React, { useRef, useState, useEffect, useMemo, memo, useCallback } from 'react';
import type { FrameConfig, LegoCharacterConfig, LegoPart, TextConfig, DraggableItem, OutfitColor, ShapeConfig, FrameOption } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS, defaultShirtColors, defaultPantsColors } from '../constants';

type Transform = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  width?: number;
  height?: number;
}

interface FramePreviewProps {
  config: FrameConfig;
  frames?: FrameOption[];
  containerWidth?: number;
  onItemTransform: (id: string, newTransform: Transform) => void;
  onItemRemove: (id: string) => void;
  onTextUpdate: (id: number, updates: Partial<TextConfig>) => void;
  onItemUpdate?: (id: string, updates: Partial<DraggableItem>) => void;
  onCharacterUpdate?: (id: number, updates: Partial<LegoCharacterConfig>) => void;
  onItemFlip?: (id: string) => void;
  onCharacterDoubleClick?: (id: number) => void;
  onAutoAdvance?: () => void;
  className?: string;
  isInteractive?: boolean;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  setIsEditingText: (isEditing: boolean) => void;
  allParts?: Record<string, LegoPart>;
  activePartType?: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set';
  logoUrl?: string;
  previewFont?: string | null; 
  allowTextScaling?: boolean;
  onAlign?: (type: 'center' | 'horizontal' | 'vertical') => void;
}

const SafeImage = memo(({ src, style, className, alt, priority, disableTransition, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; disableTransition?: boolean }) => {
    const isBase64 = src?.startsWith('data:');
    const [isLoaded, setIsLoaded] = useState(isBase64);
    const [hasError, setHasError] = useState(false);
    
    useEffect(() => {
        setIsLoaded(isBase64);
        setHasError(false);
    }, [src, isBase64]);

    if (hasError || !src) return null;

    const imgProps: any = { ...props };
    // Removed crossOrigin="anonymous" to avoid CORS issues in the preview
    // if (!isBase64) {
    //     imgProps.crossOrigin = "anonymous";
    // }

    if (disableTransition) {
        return (
            <img 
                referrerPolicy="no-referrer"
                src={src}
                alt={alt}
                style={style}
                onError={() => setHasError(true)} 
                className={className}
                loading={priority ? "eager" : "lazy"}
                {...imgProps}
            />
        );
    }

    return (
        <img 
            referrerPolicy="no-referrer"
            src={src}
            alt={alt}
            style={style}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)} 
            className={`
                ${className} 
                transition-opacity duration-300 ease-out
                ${isLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            loading={priority ? "eager" : "lazy"}
            {...imgProps}
        />
    );
});

const LegoCharacter = memo(({ character, pxPerCm }: { character: LegoCharacterConfig; pxPerCm: number }) => {
  const { hair, face, shirt, pants, set, hat } = character;
  const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
  const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
  const setImageUrl = character.selectedSetColor?.imageUrl || set?.imageUrl;
  const hatImageUrl = character.selectedHatColor?.imageUrl || hat?.imageUrl;
  
  let hairImageUrl = hair?.imageUrl;
  if (character.selectedHairColor?.imageUrl) {
      hairImageUrl = character.selectedHairColor.imageUrl;
  }

  const CHARACTER_WIDTH_CM = 2.5;
  const CHARACTER_HEIGHT_CM = 4.0;

  const px = (cm: number) => Math.round(cm * pxPerCm);

  const containerStyle = useMemo(() => ({
    position: 'relative' as const,
    width: px(CHARACTER_WIDTH_CM),
    height: px(CHARACTER_HEIGHT_CM),
    transformOrigin: 'center',
    opacity: character.opacity ?? 1,
    display: character.isHidden ? 'none' : 'block'
  }), [pxPerCm, character.opacity, character.isHidden]);

  const partStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    pointerEvents: 'none' as const,
  }), []);

  return (
    <div style={containerStyle}>
      {!set && pants && pantsImageUrl && <SafeImage disableTransition priority src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} />}
      {!set && shirt && shirtImageUrl && <SafeImage disableTransition priority src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} />}
      {set && setImageUrl && <SafeImage disableTransition priority src={setImageUrl} alt="set" style={{ ...partStyle, zIndex: 2 }} />}
                    {face && face.imageUrl && <SafeImage disableTransition priority src={face.imageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} />}
                    {hair && hairImageUrl && <SafeImage disableTransition priority src={hairImageUrl} alt={hair.name} style={{ ...partStyle, zIndex: 4 }} />}
                </div>
  );
});

const getFontFamily = (fontName: string) => {
    if (!fontName) return 'sans-serif';
    const cleanName = fontName.replace(/[^a-zA-Z0-9\s-]/g, '');
    return `'${cleanName}', sans-serif`;
};

const EditableText = memo(({
    text,
    fontSize,
    onUpdate,
    onBeginEditing,
    onEndEditing,
    isContentLocked,
    previewFont
}: {
    text: TextConfig;
    fontSize: number;
    onUpdate: (updates: Partial<TextConfig>) => void;
    onBeginEditing: () => void;
    onEndEditing: () => void;
    isContentLocked?: boolean;
    previewFont?: string | null;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(text.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const activeFont = previewFont || text.font;

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    const handleBlur = () => {
        onUpdate({ content: editedContent });
        setIsEditing(false);
        onEndEditing();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleBlur();
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (isContentLocked) return;
        e.stopPropagation();
        setIsEditing(true);
        setEditedContent(text.content);
        onBeginEditing();
    }

    const textStyle = useMemo(() => ({
        fontFamily: getFontFamily(activeFont),
        fontSize: `${fontSize}px`,
        color: text.color,
        whiteSpace: 'pre-wrap' as const,
        textAlign: text.textAlign || 'center',
        padding: text.textAlign === 'left' ? '0.4em 0.8em' : '0.4em', 
        wordBreak: 'break-word' as const,
        lineHeight: 1.4,
        fontWeight: text.fontWeight || 'normal',
        userSelect: (isContentLocked || !isEditing) ? 'none' as const : 'auto' as const,
        border: text.border ? `${text.borderWidth || 2}px ${text.borderStyle || 'solid'} ${text.borderColor || text.color}` : 'none',
        opacity: text.opacity ?? 1,
        display: text.isHidden ? 'none' : 'block',
        ...(text.background && { backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)', borderRadius: '5px' })
    }), [activeFont, fontSize, text, isContentLocked, isEditing]);

    if (isEditing) {
        return (
            <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()} 
                style={{
                    ...textStyle,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    background: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 0 0 2px #efa3b5',
                    margin: 0,
                    cursor: 'text',
                    userSelect: 'auto'
                }}
            />
        );
    }

    return (
        <div style={{minWidth: '20px', width: '100%', height: '100%'}} onDoubleClick={handleDoubleClick}>
            <p style={textStyle}>{text.content || " "}</p>
        </div>
    );
});

const Transformable = memo(({
    children,
    id,
    initialTransform,
    onTransform,
    isFlipped,
    parentRef,
    isSelected,
    onSelect,
    isResizable = true,
    isRotatable = true,
    isDraggable = true,
    isPositionLocked = false,
    zIndex,
    style,
    resizeMode = 'scale',
    allowTextScaling = false,
    containerSize,
    onDoubleClick
}: {
    children: React.ReactNode;
    id: string;
    initialTransform: Transform;
    onTransform: (id: string, transform: Transform) => void;
    isFlipped?: boolean;
    parentRef: React.RefObject<HTMLDivElement>;
    isSelected: boolean;
    onSelect: (id: string) => void;
    isResizable?: boolean;
    isRotatable?: boolean;
    isDraggable?: boolean;
    isPositionLocked?: boolean;
    zIndex?: number;
    style?: React.CSSProperties;
    resizeMode?: 'scale' | 'dimensions';
    allowTextScaling?: boolean;
    containerSize?: { width: number; height: number; };
    onDoubleClick?: () => void;
}) => {
    const getClientCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ('clientX' in e) return { x: e.clientX, y: e.clientY };
      return null;
    };

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (isPositionLocked) return; 
        e.stopPropagation();
        onSelect(id);

        const parentRect = parentRef.current?.getBoundingClientRect();
        if (!parentRect) return;
        const startCoords = getClientCoords(e.nativeEvent);
        if (!startCoords) return;

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const moveCoords = getClientCoords(moveEvent);
            if (!moveCoords) return;
            const dx = moveCoords.x - startCoords.x;
            const dy = moveCoords.y - startCoords.y;
            const newX = ((initialTransform.x / 100) * parentRect.width + dx) / parentRect.width * 100;
            const newY = ((initialTransform.y / 100) * parentRect.height + dy) / parentRect.height * 100;
            onTransform(id, { ...initialTransform, x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) });
        };
        const handleEnd = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    };

    const handleRotateStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (isPositionLocked) return;
        e.preventDefault();
        e.stopPropagation();
        const parentRect = parentRef.current?.getBoundingClientRect();
        if (!parentRect) return;
        const startCoords = getClientCoords(e.nativeEvent);
        if(!startCoords) return;
        const centerX = parentRect.left + (initialTransform.x / 100) * parentRect.width;
        const centerY = parentRect.top + (initialTransform.y / 100) * parentRect.height;
        const startAngle = Math.atan2(startCoords.y - centerY, startCoords.x - centerX) * 180 / Math.PI;
        const startRotation = initialTransform.rotation;

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const moveCoords = getClientCoords(moveEvent);
            if (!moveCoords) return;
            const currentAngle = Math.atan2(moveCoords.y - centerY, moveCoords.x - centerX) * 180 / Math.PI;
            onTransform(id, { ...initialTransform, rotation: startRotation + (currentAngle - startAngle) });
        };
        const handleEnd = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    };

    const handleResizeStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (isPositionLocked) return;
        e.preventDefault();
        e.stopPropagation();
        if (!containerSize) return;

        const startCoords = getClientCoords(e.nativeEvent);
        if (!startCoords) return;
        
        const startScale = initialTransform.scale || 1;
        const startWidth = initialTransform.width || 20;
        const startHeight = initialTransform.height || 20;

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
             const moveCoords = getClientCoords(moveEvent);
             if (!moveCoords) return;
             const dx = moveCoords.x - startCoords.x;
             const dy = moveCoords.y - startCoords.y;

             if (resizeMode === 'dimensions') {
                 const dwPercent = (dx / containerSize.width) * 100;
                 const dhPercent = (dy / containerSize.height) * 100;
                 onTransform(id, { 
                     ...initialTransform, 
                     width: Math.max(1, startWidth + dwPercent),
                     height: Math.max(1, startHeight + dhPercent)
                 });
             } else {
                 onTransform(id, { ...initialTransform, scale: Math.max(0.2, startScale + dx / 100) });
             }
        };
        const handleEnd = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    };

    const handleResizeWidthStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (isPositionLocked) return;
        e.preventDefault();
        e.stopPropagation();
        if (!containerSize) return;
        const startCoords = getClientCoords(e.nativeEvent);
        if (!startCoords) return;
        const startWidth = initialTransform.width || 30;

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const moveCoords = getClientCoords(moveEvent);
            if (!moveCoords) return;
            const dx = moveCoords.x - startCoords.x;
            onTransform(id, { ...initialTransform, width: Math.max(10, startWidth + (dx / containerSize.width) * 100) });
        };
        const handleEnd = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    };

    const handleScale = resizeMode === 'dimensions' ? 1 : 1 / (initialTransform.scale || 1);
    const rotation = initialTransform.rotation || 0;
    
    return (
        <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={(e) => { e.stopPropagation(); onSelect(id); }} 
            onDoubleClick={(e) => { e.stopPropagation(); if(onDoubleClick) onDoubleClick(); }}
            className="absolute transform-gpu"
            style={{
                ...style,
                left: `${initialTransform.x}%`,
                top: `${initialTransform.y}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) ${(resizeMode === 'scale' || allowTextScaling) ? `scale(${initialTransform.scale})` : ''} scaleX(${isFlipped ? -1 : 1})`,
                touchAction: 'none',
                cursor: isPositionLocked ? 'default' : (isSelected ? 'move' : 'pointer'),
                outline: isSelected ? (isPositionLocked ? '2px solid #ef4444' : '2px dashed #efa3b5') : 'none',
                outlineOffset: '4px',
                zIndex: isSelected ? 100 : zIndex
            }}
        >
            {children}
            
            {isSelected && !isPositionLocked && (
                <>
                  {resizeMode === 'dimensions' && !(style as any)?.height && (
                      <div 
                        onMouseDown={handleResizeWidthStart} 
                        onTouchStart={handleResizeWidthStart} 
                        className="transform-handle absolute top-1/2 -right-3 -translate-y-1/2 cursor-ew-resize bg-luvin-pink w-3 h-6 rounded-md border-2 border-white shadow-sm z-[110]" 
                        style={{ transform: `translateY(-50%) scale(${handleScale})` }}
                      ></div>
                  )}

                  {isRotatable && (
                      <div 
                        onMouseDown={handleRotateStart} 
                        onTouchStart={handleRotateStart} 
                        className="transform-handle absolute -top-8 left-1/2 -translate-x-1/2 cursor-alias bg-luvin-pink text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm z-[110]" 
                        style={{ transform: `translateX(-50%) scale(${handleScale})` }}
                      >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </div>
                  )}

                  {isResizable && (
                      <div 
                        onMouseDown={handleResizeStart} 
                        onTouchStart={handleResizeStart} 
                        className="transform-handle absolute -bottom-2 -right-2 cursor-nwse-resize bg-luvin-pink w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center z-[110]" 
                        style={{ transform: `scale(${handleScale})` }}
                      >
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 20h16m0 0V4" /></svg>
                      </div>
                  )}
                </>
            )}
        </div>
    );
});

const FramePreview = React.forwardRef<HTMLDivElement, FramePreviewProps>(({ 
  config, 
  frames: propFrames,
  containerWidth = 400, 
  onItemTransform, 
  onItemRemove, 
  onTextUpdate, 
  onItemUpdate, 
  onCharacterUpdate, 
  onItemFlip, 
  onCharacterDoubleClick, 
  onAutoAdvance, 
  className, 
  isInteractive = true, 
  selectedItemId, 
  setSelectedItemId, 
  setIsEditingText, 
  allParts: propAllParts, 
  activePartType, 
  logoUrl, 
  previewFont, 
  allowTextScaling, 
  onAlign 
}, ref) => {
  const currentFrames = useMemo(() => propFrames || FRAME_OPTIONS, [propFrames]);
  const frameOption = useMemo(() => currentFrames.find(f => f.id === config.frameId) || currentFrames[0] || FRAME_OPTIONS[0], [currentFrames, config.frameId]);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const uniqueId = React.useId();
  const patternId = `watermark-pattern-${uniqueId.replace(/:/g, "")}`;

  const isRotated = config.isRotated || false;
  const frameW = isRotated ? frameOption.frameHeightCm : frameOption.frameWidthCm;
  const frameH = isRotated ? frameOption.frameWidthCm : frameOption.frameHeightCm;
  const bgW = isRotated ? frameOption.backgroundHeightCm : frameOption.backgroundWidthCm;
  const bgH = isRotated ? frameOption.backgroundWidthCm : frameOption.backgroundHeightCm;

  const maxDimensionCm = useMemo(() => Math.max(...currentFrames.map(f => Math.max(f.frameWidthCm, f.frameHeightCm))), [currentFrames]);
  const pxPerCm = containerWidth / maxDimensionCm;
  
  const frameWidth = frameW * pxPerCm;
  const frameHeight = frameH * pxPerCm;
  const backgroundWidth = bgW * pxPerCm;
  const backgroundHeight = bgH * pxPerCm;

  const responsiveScale = backgroundWidth / 500;

  const handleMouseMove = (e: React.MouseEvent) => {
    // Tilt effect removed for flat design
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const allParts: Record<string, LegoPart> = useMemo(() => {
      if (propAllParts) return propAllParts;
      return Object.values(LEGO_PARTS).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>);
  }, [propAllParts]);

  const selectedDraggableType = useMemo(() => {
    if (!selectedItemId || !selectedItemId.startsWith('item-')) return null;
    const id = parseInt(selectedItemId.split('-')[1]);
    const item = (config.draggableItems || []).find(i => i.id === id);
    return item?.type || null;
  }, [selectedItemId, config.draggableItems]);

  const activeColors = useMemo(() => {
      if (!selectedItemId) return null;
      const [type, idStr] = selectedItemId.split('-');
      const id = parseInt(idStr);
      if (type === 'item') {
          const item = (config.draggableItems || []).find(i => i.id === id);
          return item ? allParts[item.partId]?.colors : null;
      }
      if (type === 'character' && activePartType) {
          const char = (config.characters || []).find(c => c.id === id);
          if (!char) return null;
          if (activePartType === 'shirt' || activePartType === 'set') { 
              if (char.shirt?.colors && char.shirt.colors.length > 0) return char.shirt.colors;
              const name = char.shirt?.name.toLowerCase() || '';
              if (char.shirt && (char.shirt.id === 'shirt1' || name.includes('trơn') || name.includes('plain') || name.includes('basic'))) return defaultShirtColors;
          }
          if (activePartType === 'pants') {
              if (char.pants?.colors && char.pants.colors.length > 0) return char.pants.colors;
               const name = char.pants?.name.toLowerCase() || '';
              if (char.pants && (char.pants.id === 'pants1' || name.includes('trơn') || name.includes('plain') || name.includes('basic'))) return defaultPantsColors;
          }
          if (activePartType === 'hair') return char.hair?.colors;
      }
      return null;
  }, [selectedItemId, config, activePartType, allParts]);

  const handleColorSelect = useCallback((color: OutfitColor) => {
      if (!selectedItemId) return;
      const [type, idStr] = selectedItemId.split('-');
      const id = parseInt(idStr);
      if (type === 'item' && onItemUpdate) {
          onItemUpdate(selectedItemId, { selectedColor: color });
      } else if (type === 'character' && onCharacterUpdate) {
          if (activePartType === 'shirt' || activePartType === 'set') onCharacterUpdate(id, { selectedShirtColor: color });
          else if (activePartType === 'pants') onCharacterUpdate(id, { selectedPantsColor: color });
          else if (activePartType === 'hair') onCharacterUpdate(id, { selectedHairColor: color });
      }
  }, [selectedItemId, onItemUpdate, onCharacterUpdate, activePartType]);

  const getActiveColorHex = useMemo(() => {
      if (!selectedItemId) return null;
      const [type, idStr] = selectedItemId.split('-');
      const id = parseInt(idStr);
      if (type === 'item') {
          return config.draggableItems.find(i => i.id === id)?.selectedColor?.hex;
      }
      if (type === 'character' && activePartType) {
          const char = config.characters.find(c => c.id === id);
          if (!char) return null;
          if (activePartType === 'shirt' || activePartType === 'set') return char.selectedShirtColor?.hex;
          if (activePartType === 'pants') return char.selectedPantsColor?.hex;
          if (activePartType === 'hair') return char.selectedHairColor?.hex;
      }
      return null;
  }, [selectedItemId, config, activePartType]);

  const depth = pxPerCm * 3; // 3cm depth for the museum box
  const frameThickness = pxPerCm * 1.5; // 1.5cm thickness for the outer frame wood

  return (
    <div 
      ref={ref} 
      className={`flex items-center justify-center relative ${className}`} 
      style={{ 
        width: frameWidth + frameThickness * 2, 
        height: frameHeight + frameThickness * 2,
        perspective: 'none',
        padding: frameThickness
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
        <div 
          className="relative transition-all duration-500 ease-out flex items-center justify-center"
          style={{ 
              width: frameWidth, 
              height: frameHeight, 
              backgroundColor: config.frameColor === 'black' ? '#1a1a1a' : '#ffffff',
              boxShadow: config.isMuseumStyle 
                ? '0 10px 30px -10px rgba(0, 0, 0, 0.1)'
                : '0 10px 30px -10px rgba(0, 0, 0, 0.1)',
              transform: 'none',
              transformStyle: 'preserve-3d',
              border: '2px solid #f0f0f0'
          }}
          onMouseDown={(e) => {
              if (isInteractive) setSelectedItemId(null);
          }}
        >
            {/* Flat Frame Style */}
            <div
                ref={previewContainerRef}
                className="relative overflow-hidden"
                style={{
                    width: backgroundWidth,
                    height: backgroundHeight,
                    border: '1px solid #e5e7eb',
                    transform: 'none',
                    transformStyle: 'preserve-3d',
                    backgroundColor: '#ffffff'
                }}
                onMouseDown={(e) => {
                    if (isInteractive) {
                        e.stopPropagation();
                        setSelectedItemId(null);
                    }
                }}
            >
                {config.background.type === 'color' ? (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: config.background.value, zIndex: 0 }} />
                ) : (
                    <SafeImage 
                        priority
                        src={config.background.value} 
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} 
                        alt="background"
                    />
                )}

                {logoUrl && (
                    <div className="watermark-layer" style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
                        <svg width="100%" height="100%" style={{ opacity: 0.15 }} fill="transparent">
                            <defs>
                                <pattern id={patternId} x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                                    <image href={logoUrl} x="40" y="40" width="40" height="40" preserveAspectRatio="xMidYMid meet" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
                        </svg>
                    </div>
                )}

                {(Array.isArray(config.shapes) ? config.shapes : []).map(shape => {
                    // --- BỔ SUNG LOGIC ĐỔ ẢNH TỪ FORM CHO SHAPE ---
                    let shapeImageUrl = null;
                    if (shape.linkedFieldId && config.customFormData?.[shape.linkedFieldId]) {
                        const formFields = Array.isArray(config.formFields) ? config.formFields : [];
                        const field = formFields.find(f => f.id === shape.linkedFieldId);
                        if (field?.type === 'image') {
                            shapeImageUrl = config.customFormData[shape.linkedFieldId];
                        }
                    }

                    return (
                        <Transformable
                            key={`shape-${shape.id}`}
                            id={`shape-${shape.id}`}
                            initialTransform={{ x: shape.x, y: shape.y, rotation: shape.rotation, scale: 1, width: shape.width, height: shape.height }}
                            onTransform={onItemTransform}
                            parentRef={previewContainerRef}
                            isSelected={selectedItemId === `shape-${shape.id}`}
                            onSelect={setSelectedItemId}
                            isDraggable={isInteractive}
                            isResizable={isInteractive}
                            isRotatable={isInteractive}
                            isPositionLocked={shape.lockedPosition}
                            zIndex={4}
                            resizeMode="dimensions"
                            containerSize={{ width: backgroundWidth, height: backgroundHeight }}
                            style={{ 
                                width: `${(shape.width) * backgroundWidth / 100}px`,
                                height: `${(shape.height) * backgroundHeight / 100}px`,
                                opacity: shape.opacity ?? 1,
                                display: shape.isHidden ? 'none' : 'block'
                            }}
                        >
                            <div style={{
                                width: '100%',
                                height: '100%',
                                borderStyle: shape.strokeType || 'solid',
                                borderWidth: `${shape.strokeWidth}px`,
                                borderColor: shape.strokeColor,
                                backgroundColor: shape.fillColor || 'transparent',
                                borderRadius: `${shape.borderRadius}px`,
                                boxSizing: 'border-box',
                                overflow: 'hidden', // Quan trọng để ảnh không tràn ra ngoài bo góc
                                position: 'relative'
                            }}>
                                {shapeImageUrl && (
                                    <SafeImage 
                                        src={shapeImageUrl} 
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                                        alt="shape-image"
                                    />
                                )}
                            </div>
                        </Transformable>
                    );
                })}

                {(Array.isArray(config.characters) ? config.characters : []).map(char => (
                    <Transformable 
                        key={`character-${char.id}`} id={`character-${char.id}`} initialTransform={char} 
                        onTransform={onItemTransform} 
                        parentRef={previewContainerRef} isSelected={selectedItemId === `character-${char.id}`} onSelect={setSelectedItemId}
                        isResizable={false} isRotatable={false} isDraggable={isInteractive} zIndex={5}
                        isPositionLocked={char.lockedPosition}
                        onDoubleClick={() => onCharacterDoubleClick && onCharacterDoubleClick(char.id)}
                    >
                       <div style={{width: '100%', height: '100%'}}><LegoCharacter character={char} pxPerCm={pxPerCm} /></div>
                     </Transformable>
                ))}
                
                {(Array.isArray(config.draggableItems) ? config.draggableItems : []).map(item => {
                    const isCharm = item.type === 'charm';
                    const part = !isCharm ? allParts[item.partId] : null;
                    
                    // --- BỔ SUNG LOGIC ĐỔ ẢNH TỪ FORM ---
                    // Nếu sticker này được liên kết với một field Form (type Image) và field đó có dữ liệu
                    let imageUrl = isCharm ? item.partId : (item.selectedColor?.imageUrl || part?.imageUrl);
                    if (isCharm && item.linkedFieldId && config.customFormData?.[item.linkedFieldId]) {
                        imageUrl = config.customFormData[item.linkedFieldId];
                    }

                    const name = isCharm ? 'charm' : (item.selectedColor?.name ? `${part?.name} (${item.selectedColor.name})` : part?.name);
                    const widthCm = isCharm ? 2 : (part?.widthCm || 1);
                    const heightCm = isCharm ? 2 : (part?.heightCm || 1);
                    
                    if (!imageUrl) return null;

                    let maskStyle: React.CSSProperties = {};
                    if (item.maskShape === 'circle') maskStyle = { borderRadius: '50%' };
                    else if (item.maskShape === 'rounded') maskStyle = { borderRadius: '15%' };
                    else if (item.maskShape === 'heart') maskStyle = { clipPath: 'path("M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")' };
                    else if (item.maskShape === 'star') maskStyle = { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' };

                    return (
                        <Transformable 
                            key={`item-${item.id}`} id={`item-${item.id}`} initialTransform={item} 
                            onTransform={onItemTransform}
                            isFlipped={item.isFlipped} parentRef={previewContainerRef} isSelected={selectedItemId === `item-${item.id}`} onSelect={setSelectedItemId}
                            isResizable={isInteractive && (isCharm || !!item.frameUrl)} isRotatable={isInteractive} isDraggable={isInteractive}
                            isPositionLocked={item.lockedPosition}
                            zIndex={item.type === 'hat' ? 12 : 10}
                            containerSize={{ width: backgroundWidth, height: backgroundHeight }}
                        >
                            <div style={{ ...maskStyle, overflow: 'hidden', width: widthCm * pxPerCm, height: heightCm * pxPerCm, opacity: item.opacity ?? 1, display: item.isHidden ? 'none' : 'block', position: 'relative' }}>
                                {/* The content image (sticker or uploaded photo) */}
                                <SafeImage priority={!isCharm} src={imageUrl} alt={name} className="pointer-events-none" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                
                                {/* The Frame Overlay (Museum Frame) */}
                                {item.frameUrl && (
                                    <SafeImage 
                                        priority 
                                        src={item.frameUrl} 
                                        alt="frame overlay" 
                                        className="pointer-events-none absolute inset-0 w-full h-full object-contain" 
                                        style={{ zIndex: 1 }}
                                    />
                                )}
                            </div>
                        </Transformable>
                    );
                })}
                
                {(Array.isArray(config.texts) ? config.texts : []).map(text => {
                    const isSelected = selectedItemId === `text-${text.id}`;
                    return (
                        <Transformable 
                            key={`text-${text.id}`} id={`text-${text.id}`} 
                            initialTransform={{x: text.x, y: text.y, rotation: text.rotation, scale: text.scale, width: text.width}} 
                            onTransform={onItemTransform} parentRef={previewContainerRef} isSelected={isSelected} onSelect={setSelectedItemId}
                            isDraggable={isInteractive} zIndex={15} resizeMode="dimensions" containerSize={{ width: backgroundWidth, height: backgroundHeight }}
                            isPositionLocked={text.lockedPosition}
                            style={{ width: `${(text.width || 30) * backgroundWidth / 100}px` }}
                            allowTextScaling={allowTextScaling}
                        >
                        <EditableText 
                                text={text} 
                                fontSize={text.size * responsiveScale}
                                onUpdate={(updates) => onTextUpdate(text.id, updates)} 
                                onBeginEditing={() => setIsEditingText(true)} 
                                onEndEditing={() => setIsEditingText(false)} 
                                isContentLocked={text.lockedContent}
                                previewFont={isSelected ? previewFont : undefined}
                        />
                        </Transformable>
                    );
                })}
            </div>
        </div>

        {isInteractive && selectedItemId && (
            <div 
                className="absolute -bottom-24 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 w-max max-w-[90vw] pointer-events-none"
                onMouseDown={(e) => { e.stopPropagation(); }} 
            >
                {activeColors && activeColors.length > 0 && (
                    <div className="pointer-events-auto w-fit bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-full px-2 py-2 overflow-x-auto no-scrollbar mx-auto animate-subtle-pulse">
                        <div className="flex gap-2 w-max px-2">
                            {activeColors.map((color: OutfitColor, idx: number) => {
                                const isColorOOS = color.stock === 0;
                                return (
                                    <button
                                        key={idx}
                                        onMouseDown={(e) => { if (!isColorOOS) { e.stopPropagation(); handleColorSelect(color); } }}
                                        disabled={isColorOOS}
                                        className={`w-6 h-6 rounded-full border relative flex-shrink-0 transition-transform active:scale-95 ${getActiveColorHex === color.hex ? 'ring-2 ring-luvin-pink border-transparent' : 'border-gray-300'} ${isColorOOS ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                                        style={{ backgroundColor: color.hex }}
                                        title={isColorOOS ? `${color.name} (Hết hàng)` : color.name}
                                    >
                                        {color.imageUrl && <SafeImage src={color.imageUrl} className="w-full h-full object-contain rounded-full opacity-80" />}
                                        {isColorOOS && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-500 font-black">/</div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                <div className="pointer-events-auto flex items-center justify-center gap-2 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-full px-3 py-1.5 mx-auto">
                    {onAlign && (
                        <>
                            <button onMouseDown={(e) => { e.stopPropagation(); onAlign('center'); }} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Căn giữa">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><rect x="8" y="8" width="8" height="8"></rect></svg>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onAlign('horizontal'); }} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Căn giữa ngang">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="4" x2="12" y2="20"></line><rect x="6" y="8" width="12" height="8"></rect></svg>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onAlign('vertical'); }} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Căn giữa dọc">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"></line><rect x="8" y="6" width="8" height="12"></rect></svg>
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        </>
                    )}
                    {(selectedDraggableType === 'accessory' || selectedDraggableType === 'pet') && onItemFlip && (
                        <button onMouseDown={(e) => { e.stopPropagation(); onItemFlip(selectedItemId); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-all active:scale-90" title="Lật hình">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 9h10M14 6l3 3-3 3" />
                                <path d="M17 15H7M10 12l-3 3 3 3" />
                            </svg>
                        </button>
                    )}
                    <button onMouseDown={(e) => { e.stopPropagation(); onItemRemove(selectedItemId); }} className="p-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors active:scale-90" title="Xóa">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button onMouseDown={(e) => { e.stopPropagation(); setSelectedItemId(null); }} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Bỏ chọn">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        )}
    </div>
  );
});

export default FramePreview;
