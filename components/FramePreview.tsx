
import React, { useRef, useState, useEffect, useMemo, forwardRef } from 'react';
import type { FrameConfig, LegoCharacterConfig, LegoPart, TextConfig, DraggableItem, OutfitColor, ShapeConfig } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS, defaultShirtColors, defaultPantsColors } from '../constants';

type Transform = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  width?: number;
  height?: number; // Added height for shapes
}

interface FramePreviewProps {
  config: FrameConfig;
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
  onAlign?: (type: 'center' | 'horizontal' | 'vertical') => void; // New prop for alignment
}

// 1. SafeImage Component with Skeleton Loading
const SafeImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    if (hasError) return null;

    return (
        <>
            {isLoading && (
                <div 
                    className="skeleton absolute inset-0 rounded-sm" 
                    style={{ zIndex: 0, ...props.style }} // Matches skeleton size to image
                ></div>
            )}
            <img 
                crossOrigin="anonymous" 
                referrerPolicy="no-referrer"
                {...props} 
                onLoad={() => setIsLoading(false)}
                onError={() => { setIsLoading(false); setHasError(true); }} 
                className={`${props.className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            />
        </>
    );
};

const LegoCharacter: React.FC<{ character: LegoCharacterConfig; pxPerCm: number }> = ({ character, pxPerCm }) => {
  const { hair, face, shirt, pants } = character;
  const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
  const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
  
  let hairImageUrl = hair?.imageUrl;
  if (character.selectedHairColor?.imageUrl) {
      hairImageUrl = character.selectedHairColor.imageUrl;
  }

  const CHARACTER_WIDTH_CM = 2.5;
  const CHARACTER_HEIGHT_CM = 4.0;

  const px = (cm: number) => Math.round(cm * pxPerCm);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: px(CHARACTER_WIDTH_CM),
    height: px(CHARACTER_HEIGHT_CM),
    transformOrigin: 'center',
  };

  const partStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    pointerEvents: 'none',
  };

  return (
    <div style={containerStyle}>
      {pants && pantsImageUrl && <SafeImage src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} />}
      {shirt && shirtImageUrl && <SafeImage src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} />}
      {face && face.imageUrl && <SafeImage src={face.imageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} />}
      {hair && hairImageUrl && <SafeImage src={hairImageUrl} alt={hair.name} style={{ ...partStyle, zIndex: 4 }} />}
    </div>
  );
};

// Updated Font Family Helper to support custom fonts
const getFontFamily = (fontName: string) => {
    // If it's a known Google font, return specific stack
    switch (fontName) {
        case 'Anniversary': return '"Dancing Script", cursive';
        case 'Serif': return '"Noto Serif", serif';
        case 'Playfair Display': return '"Playfair Display", serif';
        case 'Montserrat': return '"Montserrat", sans-serif';
        case 'Roboto': return '"Roboto", sans-serif';
        case 'Open Sans': return '"Open Sans", sans-serif';
        case 'Merriweather': return '"Merriweather", serif';
        case 'Dancing Script': return '"Dancing Script", cursive';
        case 'Lora': return '"Lora", serif';
        case 'Nunito': return '"Nunito", sans-serif';
        case 'Pacifico': return '"Pacifico", cursive';
        default: 
            // For uploaded custom fonts, use the name directly
            return `'${fontName}', sans-serif`;
    }
};

const EditableText: React.FC<{
    text: TextConfig;
    fontSize: number; // Calculated font size
    onUpdate: (updates: Partial<TextConfig>) => void;
    onBeginEditing: () => void;
    onEndEditing: () => void;
    isContentLocked?: boolean;
    previewFont?: string | null;
}> = ({ text, fontSize, onUpdate, onBeginEditing, onEndEditing, isContentLocked, previewFont }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(text.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Use preview font if available, otherwise use text.font
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

    const handleDoubleClick = () => {
        if (isContentLocked) return; // Prevent editing if content is locked
        setIsEditing(true);
        setEditedContent(text.content);
        onBeginEditing();
    }

    const textStyle: React.CSSProperties = {
        fontFamily: getFontFamily(activeFont),
        fontSize: `${fontSize}px`,
        color: text.color,
        whiteSpace: 'pre-wrap',
        textAlign: text.textAlign || 'center',
        padding: '0.2em', // Changed from 10px to relative unit to scale with font size
        wordBreak: 'break-word',
        textShadow: '0 0 5px white, 0 0 5px white',
        lineHeight: 1.4,
        fontWeight: text.fontWeight || 'normal', // Apply bold
        userSelect: isContentLocked ? 'none' : 'auto', // Prevent selection if locked (mobile fix)
        border: text.border ? `${text.borderWidth || 2}px ${text.borderStyle || 'solid'} ${text.borderColor || text.color}` : 'none', // Apply border
        ...(text.background && { backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)', borderRadius: '5px' })
    };

    if (isEditing) {
        return (
            <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
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
};

const Transformable: React.FC<{
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
    isPositionLocked?: boolean; // New Prop
    zIndex?: number;
    style?: React.CSSProperties;
    resizeMode?: 'scale' | 'dimensions'; // New: Choose how to resize
    allowTextScaling?: boolean; // New Prop: Allow scaling text via corner (deprecated by resizeMode but kept for compat)
    containerSize?: { width: number; height: number; };
    onDoubleClick?: () => void;
}> = ({ children, id, initialTransform, onTransform, isFlipped, parentRef, isSelected, onSelect, isResizable = true, isRotatable = true, isDraggable = true, isPositionLocked = false, zIndex, style, resizeMode = 'scale', allowTextScaling = false, containerSize, onDoubleClick }) => {
    
    const getClientCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ('clientX' in e) return { x: e.clientX, y: e.clientY };
      return null;
    };

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!isDraggable || isPositionLocked) { // Prevent drag if position locked
            if (isPositionLocked) {
                // Still allow selection if locked, but no drag
                e.stopPropagation();
                onSelect(id);
            }
            return;
        }
        e.preventDefault();
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
        e.preventDefault();
        e.stopPropagation();
        if (!containerSize) return; // Should have container size for accurate dimension resizing

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
                 // Resizing width and height (Shapes)
                 const dwPercent = (dx / containerSize.width) * 100;
                 const dhPercent = (dy / containerSize.height) * 100;
                 
                 onTransform(id, { 
                     ...initialTransform, 
                     width: Math.max(1, startWidth + dwPercent),
                     height: Math.max(1, startHeight + dhPercent)
                 });
             } else {
                 if (allowTextScaling && !style?.height) { // Text scaling (corner drag -> scale)
                     // If allowTextScaling is true and it's text (no height in style), treat corner as scale
                     onTransform(id, { ...initialTransform, scale: Math.max(0.2, startScale + dx / 100) });
                 } else {
                     // Standard scaling
                     onTransform(id, { ...initialTransform, scale: Math.max(0.2, startScale + dx / 100) });
                 }
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
            onDoubleClick={(e) => { if(onDoubleClick) { e.stopPropagation(); onDoubleClick(); } }}
            className="absolute transform-gpu"
            style={{
                ...style,
                left: `${initialTransform.x}%`,
                top: `${initialTransform.y}%`,
                // If resizeMode is dimensions, we don't scale the container itself, we expect width/height to be set via props/style
                // EXCEPT if allowTextScaling is true (for Text), then we DO apply scale
                transform: `translate(-50%, -50%) rotate(${rotation}deg) ${(resizeMode === 'scale' || allowTextScaling) ? `scale(${initialTransform.scale})` : ''} scaleX(${isFlipped ? -1 : 1})`,
                touchAction: 'none',
                cursor: isDraggable && !isPositionLocked ? (isSelected ? 'move' : 'pointer') : (isPositionLocked ? 'not-allowed' : 'default'),
                outline: isSelected ? (isPositionLocked ? '2px solid #ef4444' : '2px dashed #efa3b5') : 'none',
                outlineOffset: '5px',
                zIndex: zIndex
            }}
        >
            {children}
            
            {/* Position Lock Indicator */}
            {isSelected && isPositionLocked && (
                <div 
                    className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-sm pointer-events-none"
                    style={{ transform: `scale(${handleScale})` }}
                >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zm2 5v3h-4V7c0-1.103.897-2 2-2s2 .897 2 2z"/></svg>
                </div>
            )}

            {isSelected && !isPositionLocked && (
                <>
                  {/* Text Specific Width Handle */}
                  {resizeMode === 'dimensions' && !style?.height && ( // Hacky check if it's text (only width resizing)
                      <div 
                        onMouseDown={handleResizeWidthStart} 
                        onTouchStart={handleResizeWidthStart} 
                        className="transform-handle absolute top-1/2 -right-3 -translate-y-1/2 cursor-ew-resize bg-luvin-pink w-4 h-8 rounded-md border-2 border-white shadow-sm" 
                        style={{ transform: `translateY(-50%) scale(${handleScale})` }}
                      ></div>
                  )}

                  {/* Standard Rotation Handle (Top) */}
                  {isRotatable && (
                      <div 
                        onMouseDown={handleRotateStart} 
                        onTouchStart={handleRotateStart} 
                        className="transform-handle absolute -top-8 left-1/2 -translate-x-1/2 cursor-alias bg-luvin-pink text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-sm" 
                        style={{ transform: `translateX(-50%) scale(${handleScale})` }}
                      >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </div>
                  )}

                  {/* Corner Scale/Resize Handle */}
                  {isResizable && (
                      <div 
                        onMouseDown={handleResizeStart} 
                        onTouchStart={handleResizeStart} 
                        className="transform-handle absolute -bottom-3 -right-3 cursor-nwse-resize bg-luvin-pink w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center" 
                        style={{ transform: `scale(${handleScale})` }}
                      >
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 20h16m0 0V4" /></svg>
                      </div>
                  )}
                </>
            )}
        </div>
    );
};

const FramePreview = React.forwardRef<HTMLDivElement, FramePreviewProps>(({ config, containerWidth = 400, onItemTransform, onItemRemove, onTextUpdate, onItemUpdate, onCharacterUpdate, onItemFlip, onCharacterDoubleClick, onAutoAdvance, className, isInteractive = true, selectedItemId, setSelectedItemId, setIsEditingText, allParts: propAllParts, activePartType, logoUrl, previewFont, allowTextScaling, onAlign }, ref) => {
  const frameOption = FRAME_OPTIONS.find(f => f.id === config.frameId) || FRAME_OPTIONS[0];
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  const uniqueId = React.useId();
  const patternId = `watermark-pattern-${uniqueId.replace(/:/g, "")}`;

  const isRotated = config.isRotated || false;
  const frameW = isRotated ? frameOption.frameHeightCm : frameOption.frameWidthCm;
  const frameH = isRotated ? frameOption.frameWidthCm : frameOption.frameHeightCm;
  const bgW = isRotated ? frameOption.backgroundHeightCm : frameOption.backgroundWidthCm;
  const bgH = isRotated ? frameOption.backgroundWidthCm : frameOption.backgroundHeightCm;

  const maxDimensionCm = useMemo(() => Math.max(...FRAME_OPTIONS.map(f => Math.max(f.frameWidthCm, f.frameHeightCm))), []);
  const pxPerCm = containerWidth / maxDimensionCm;
  
  const frameWidth = frameW * pxPerCm;
  const frameHeight = frameH * pxPerCm;
  const backgroundWidth = bgW * pxPerCm;
  const backgroundHeight = bgH * pxPerCm;

  // Calculate Responsive Scale for Fonts based on Background Width
  // Admin Base Width is 500px. We scale based on actual background width.
  const responsiveScale = backgroundWidth / 500;

  const allParts: Record<string, LegoPart> = useMemo(() => {
      if (propAllParts) return propAllParts;
      return Object.values(LEGO_PARTS).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>);
  }, [propAllParts]);

  const getCharacterColors = (char: LegoCharacterConfig | undefined, type: string) => {
      if (!char) return [];
      if (type === 'shirt' || type === 'set') { 
          if (char.shirt?.colors && char.shirt.colors.length > 0) return char.shirt.colors;
          const name = char.shirt?.name.toLowerCase() || '';
          if (char.shirt && (char.shirt.id === 'shirt1' || name.includes('trơn') || name.includes('plain') || name.includes('basic'))) return defaultShirtColors;
      }
      if (type === 'pants') {
          if (char.pants?.colors && char.pants.colors.length > 0) return char.pants.colors;
           const name = char.pants?.name.toLowerCase() || '';
          if (char.pants && (char.pants.id === 'pants1' || name.includes('trơn') || name.includes('plain') || name.includes('basic'))) return defaultPantsColors;
      }
      if (type === 'hair') return char.hair?.colors;
      return null;
  }

  const selectedItemDetails = useMemo(() => {
      if (!selectedItemId) return null;
      const [type, idStr] = selectedItemId.split('-');
      const id = parseInt(idStr);
      if (type === 'item') {
          const item = config.draggableItems.find(i => i.id === id);
          return { type: 'item', data: item, part: item ? allParts[item.partId] : null, canFlip: item && ['accessory', 'pet', 'hat'].includes(item.type) };
      } else if (type === 'text') {
          return { type: 'text', data: config.texts.find(t => t.id === id), canFlip: false };
      } else if (type === 'character') {
          return { type: 'character', data: config.characters.find(c => c.id === id), canFlip: false };
      } else if (type === 'shape') {
          return { type: 'shape', data: config.shapes?.find(s => s.id === id), canFlip: false };
      }
      return null;
  }, [selectedItemId, config, allParts]);

  const activeColors = useMemo(() => {
      if (selectedItemDetails?.type === 'item') return selectedItemDetails.part?.colors;
      if (selectedItemDetails?.type === 'character' && activePartType && selectedItemDetails.data) return getCharacterColors(selectedItemDetails.data as LegoCharacterConfig, activePartType);
      return null;
  }, [selectedItemDetails, activePartType]);

  const handleColorSelect = (color: any) => {
      if (selectedItemDetails?.type === 'item' && onItemUpdate && selectedItemId) onItemUpdate(selectedItemId, { selectedColor: color });
      if (selectedItemDetails?.type === 'character' && onCharacterUpdate && selectedItemDetails.data) {
          if (activePartType === 'shirt' || activePartType === 'set') onCharacterUpdate(selectedItemDetails.data.id, { selectedShirtColor: color });
          else if (activePartType === 'pants') onCharacterUpdate(selectedItemDetails.data.id, { selectedPantsColor: color });
          else if (activePartType === 'hair') onCharacterUpdate(selectedItemDetails.data.id, { selectedHairColor: color });
      }
  };

  const getActiveColorHex = (color: any) => {
      if (selectedItemDetails?.type === 'item') return (selectedItemDetails.data as DraggableItem)?.selectedColor?.hex;
      if (selectedItemDetails?.type === 'character' && activePartType) {
          const char = selectedItemDetails.data as LegoCharacterConfig;
          if (activePartType === 'shirt' || activePartType === 'set') return char.selectedShirtColor?.hex;
          if (activePartType === 'pants') return char.selectedPantsColor?.hex;
          if (activePartType === 'hair') return char.selectedHairColor?.hex;
      }
      return null;
  };

  useEffect(() => {
    if (!isInteractive || !selectedItemId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        let currentItem: any = null;
        if (type === 'item') currentItem = config.draggableItems.find(i => i.id === id);
        else if (type === 'character') currentItem = config.characters.find(c => c.id === id);
        else if (type === 'text') currentItem = config.texts.find(t => t.id === id);
        else if (type === 'shape') currentItem = config.shapes?.find(s => s.id === id);

        if (!currentItem || currentItem.lockedPosition) return; // Disable keyboard move if position locked
        
        let dx = 0; let dy = 0;
        const step = e.shiftKey ? 5 : 0.5;
        switch(e.key) {
            case 'ArrowUp': dy = -step; break;
            case 'ArrowDown': dy = step; break;
            case 'ArrowLeft': dx = -step; break;
            case 'ArrowRight': dx = step; break;
            default: return;
        }
        e.preventDefault();
        onItemTransform(selectedItemId, {
            x: Math.max(0, Math.min(100, currentItem.x + dx)),
            y: Math.max(0, Math.min(100, currentItem.y + dy)),
            rotation: currentItem.rotation,
            scale: currentItem.scale,
            width: (currentItem as TextConfig).width
        });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInteractive, selectedItemId, config, onItemTransform]);

  return (
    <div ref={ref} className={`flex items-center justify-center relative ${className}`} style={{ width: frameWidth, height: frameHeight }}>
        <div 
          className="relative transition-colors duration-300 flex items-center justify-center"
          style={{ 
              width: '100%', 
              height: '100%', 
              backgroundColor: config.frameColor === 'black' ? '#1a1a1a' : '#ffffff',
              boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`
          }}
        >
            <div
                ref={previewContainerRef}
                className="relative overflow-hidden"
                style={{
                    width: backgroundWidth,
                    height: backgroundHeight,
                    border: '1px solid #c0c0c0', // 2. Darker border explicitly set
                }}
                onClick={(e) => {
                    if (isInteractive && e.target === previewContainerRef.current) setSelectedItemId(null);
                }}
            >
                {/* 3. Background Layer using Img for CORS safety */}
                {config.background.type === 'color' ? (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: config.background.value, zIndex: 0 }} />
                ) : (
                    <SafeImage 
                        src={config.background.value} 
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} 
                        alt="background"
                    />
                )}

                {/* 4. Watermark Layer - Removed mix-blend-mode for better html2canvas capture */}
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

                {/* NEW: Shapes Layer (Layer 4) */}
                {config.shapes && config.shapes.map(shape => (
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
                            height: `${(shape.height) * backgroundHeight / 100}px`
                        }}
                    >
                        <div style={{
                            width: '100%',
                            height: '100%',
                            borderStyle: shape.strokeType,
                            borderWidth: `${shape.strokeWidth}px`,
                            borderColor: shape.strokeColor,
                            backgroundColor: shape.fillColor || 'transparent',
                            borderRadius: `${shape.borderRadius}px`,
                            boxSizing: 'border-box'
                        }} />
                    </Transformable>
                ))}

                {/* 5. Content Layers (Layer 10+) */}
                {config.characters.map(char => (
                    <Transformable 
                        key={`character-${char.id}`} id={`character-${char.id}`} initialTransform={char} onTransform={onItemTransform} 
                        parentRef={previewContainerRef} isSelected={selectedItemId === `character-${char.id}`} onSelect={setSelectedItemId}
                        isResizable={false} isRotatable={false} isDraggable={isInteractive} zIndex={5}
                        onDoubleClick={() => onCharacterDoubleClick && onCharacterDoubleClick(char.id)}
                    >
                       <div style={{width: '100%', height: '100%'}}><LegoCharacter character={char} pxPerCm={pxPerCm} /></div>
                    </Transformable>
                ))}
                
                {config.draggableItems.map(item => {
                    const isCharm = item.type === 'charm';
                    const part = !isCharm ? allParts[item.partId] : null;
                    const imageUrl = isCharm ? item.partId : (item.selectedColor?.imageUrl || part?.imageUrl);
                    const name = isCharm ? 'charm' : (item.selectedColor?.name ? `${part?.name} (${item.selectedColor.name})` : part?.name);
                    const widthCm = isCharm ? 2 : (part?.widthCm || 1);
                    const heightCm = isCharm ? 2 : (part?.heightCm || 1);
                    if (!imageUrl) return null;

                    return (
                        <Transformable 
                            key={`item-${item.id}`} id={`item-${item.id}`} initialTransform={item} onTransform={onItemTransform}
                            isFlipped={item.isFlipped} parentRef={previewContainerRef} isSelected={selectedItemId === `item-${item.id}`} onSelect={setSelectedItemId}
                            isResizable={isInteractive && isCharm} isRotatable={isInteractive} isDraggable={isInteractive}
                            isPositionLocked={item.lockedPosition} // Pass lockedPosition
                            zIndex={item.type === 'hat' ? 12 : 10}
                        >
                            <SafeImage src={imageUrl} alt={name} className="pointer-events-none" style={{ width: widthCm * pxPerCm, height: heightCm * pxPerCm, objectFit: 'contain', maxWidth: 'none', maxHeight: 'none' }} />
                        </Transformable>
                    );
                })}
                
                {config.texts.map(text => {
                    const isSelected = selectedItemId === `text-${text.id}`;
                    // Only apply previewFont if this specific item is selected and previewFont is provided
                    const effectiveFont = (isSelected && previewFont) ? previewFont : text.font;

                    return (
                        <Transformable 
                            key={`text-${text.id}`} id={`text-${text.id}`} 
                            initialTransform={{x: text.x, y: text.y, rotation: text.rotation, scale: text.scale, width: text.width}} 
                            onTransform={onItemTransform} parentRef={previewContainerRef} isSelected={isSelected} onSelect={setSelectedItemId}
                            isDraggable={isInteractive} zIndex={15} resizeMode="dimensions" containerSize={{ width: backgroundWidth, height: backgroundHeight }}
                            isPositionLocked={text.lockedPosition} // Pass lockedPosition
                            style={{ width: `${(text.width || 30) * backgroundWidth / 100}px` }}
                            allowTextScaling={allowTextScaling} // Pass allowTextScaling
                        >
                        <EditableText 
                                text={text} 
                                fontSize={text.size * responsiveScale} // Pass calculated responsive font size
                                onUpdate={(updates) => onTextUpdate(text.id, updates)} 
                                onBeginEditing={() => setIsEditingText(true)} 
                                onEndEditing={() => setIsEditingText(false)} 
                                isContentLocked={text.lockedContent} // Pass lockedContent
                                previewFont={isSelected ? previewFont : undefined} // Pass previewFont
                        />
                        </Transformable>
                    );
                })}
            </div>
        </div>

        {/* Toolbar - FIXED MOBILE ALIGNMENT & REMOVED NUDGE CONTROLS */}
        {isInteractive && selectedItemId && (
            <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 w-max max-w-[90vw] pointer-events-none">
                {activeColors && activeColors.length > 0 && (
                    <div className="pointer-events-auto w-fit bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full px-2 py-2 overflow-x-auto no-scrollbar mx-auto">
                        <div className="flex gap-2 w-max px-2">
                            {activeColors.map((color: OutfitColor, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => handleColorSelect(color)}
                                    className={`w-6 h-6 rounded-full border relative flex-shrink-0 transition-transform active:scale-95 ${getActiveColorHex(color) === color.hex ? 'ring-2 ring-luvin-pink border-transparent' : 'border-gray-300'}`}
                                    style={{ backgroundColor: color.hex }}
                                    title={`${color.name}`}
                                >
                                    {color.imageUrl && <SafeImage src={color.imageUrl} className="w-full h-full object-contain rounded-full opacity-80" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="pointer-events-auto flex items-center justify-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full px-3 py-1.5 mx-auto">
                    {onAlign && (
                        <>
                            <button onClick={() => onAlign('center')} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Căn giữa">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><rect x="8" y="8" width="8" height="8"></rect></svg>
                            </button>
                            <button onClick={() => onAlign('horizontal')} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Căn giữa ngang">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="4" x2="12" y2="20"></line><rect x="6" y="8" width="12" height="8"></rect></svg>
                            </button>
                            <button onClick={() => onAlign('vertical')} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Căn giữa dọc">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"></line><rect x="8" y="6" width="8" height="12"></rect></svg>
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        </>
                    )}
                    {selectedItemDetails?.canFlip && (
                        <button onClick={() => onItemFlip && onItemFlip(selectedItemId)} className="p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors active:scale-90" title="Lật">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                    )}
                    <button onClick={() => onItemRemove(selectedItemId)} className="p-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors active:scale-90" title="Xóa">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    {onAutoAdvance && (
                        <>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            <button onClick={onAutoAdvance} className="p-1.5 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors active:scale-90" title="Xong (Tiếp)">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            </button>
                        </>
                    )}
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button onClick={() => setSelectedItemId(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors active:scale-90" title="Bỏ chọn">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        )}
    </div>
  );
});

export default FramePreview;
