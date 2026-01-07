
import React, { useRef, useState, useEffect, useMemo, memo, useCallback } from 'react';
import type { FrameConfig, LegoCharacterConfig, LegoPart, TextConfig, DraggableItem, OutfitColor, ShapeConfig } from '../types';
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

// Optimized SafeImage Component for Parts (Keep old logic for parts)
const SafeImage = memo(({ src, style, className, alt, priority, disableTransition, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; disableTransition?: boolean }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    
    useEffect(() => {
        setIsLoaded(false);
        setHasError(false);
    }, [src]);

    if (hasError || !src) return null;

    if (disableTransition) {
        return (
            <img 
                crossOrigin="anonymous" 
                referrerPolicy="no-referrer"
                src={src}
                alt={alt}
                style={style}
                onError={() => setHasError(true)} 
                className={className}
                loading={priority ? "eager" : "lazy"}
                {...props}
            />
        );
    }

    return (
        <img 
            crossOrigin="anonymous" 
            referrerPolicy="no-referrer"
            src={src}
            alt={alt}
            style={style}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)} 
            className={`${className} transition-all duration-500 ease-out ${isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px]'}`}
            loading={priority ? "eager" : "lazy"}
            {...props}
        />
    );
});

const LegoCharacter = memo(({ character, pxPerCm }: { character: LegoCharacterConfig; pxPerCm: number }) => {
  const { hair, face, shirt, pants } = character;
  const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
  const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
  let hairImageUrl = hair?.imageUrl;
  if (character.selectedHairColor?.imageUrl) hairImageUrl = character.selectedHairColor.imageUrl;

  const px = (cm: number) => Math.round(cm * pxPerCm);
  const partStyle = { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' as const, pointerEvents: 'none' as const };

  return (
    <div style={{ position: 'relative', width: px(2.5), height: px(4.0), transformOrigin: 'center' }}>
      {pants && pantsImageUrl && <SafeImage disableTransition priority src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} />}
      {shirt && shirtImageUrl && <SafeImage disableTransition priority src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} />}
      {face && face.imageUrl && <SafeImage disableTransition priority src={face.imageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} />}
      {hair && hairImageUrl && <SafeImage disableTransition priority src={hairImageUrl} alt={hair.name} style={{ ...partStyle, zIndex: 4 }} />}
    </div>
  );
});

const getFontFamily = (fontName: string) => {
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
        default: return `'${fontName}', sans-serif`;
    }
};

const EditableText = memo(({ text, fontSize, onUpdate, onBeginEditing, onEndEditing, isContentLocked, previewFont }: { text: TextConfig; fontSize: number; onUpdate: (updates: Partial<TextConfig>) => void; onBeginEditing: () => void; onEndEditing: () => void; isContentLocked?: boolean; previewFont?: string | null; }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(text.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const activeFont = previewFont || text.font;

    useEffect(() => { if (isEditing && textareaRef.current) { textareaRef.current.focus(); textareaRef.current.select(); } }, [isEditing]);
    const handleBlur = () => { onUpdate({ content: editedContent }); setIsEditing(false); onEndEditing(); };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBlur(); } };
    const handleDoubleClick = (e: React.MouseEvent) => { if (isContentLocked) return; e.stopPropagation(); setIsEditing(true); setEditedContent(text.content); onBeginEditing(); };

    const textStyle = {
        fontFamily: getFontFamily(activeFont),
        fontSize: `${fontSize}px`,
        color: text.color,
        whiteSpace: 'pre-wrap' as const,
        textAlign: text.textAlign || 'center',
        padding: '0.2em',
        wordBreak: 'break-word' as const,
        textShadow: '0 0 5px white, 0 0 5px white',
        lineHeight: 1.4,
        fontWeight: text.fontWeight || 'normal',
        userSelect: isContentLocked ? 'none' as const : 'auto' as const,
        border: text.border ? `${text.borderWidth || 2}px ${text.borderStyle || 'solid'} ${text.borderColor || text.color}` : 'none',
        ...(text.background && { backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)', borderRadius: '5px' })
    };

    if (isEditing) {
        return (
            <textarea
                ref={textareaRef} value={editedContent} onChange={(e) => setEditedContent(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
                style={{ ...textStyle, width: '100%', height: '100%', border: 'none', outline: 'none', resize: 'none', background: 'rgba(255, 255, 255, 0.95)', boxShadow: '0 0 0 2px #efa3b5', margin: 0, cursor: 'text', userSelect: 'auto' }}
            />
        );
    }
    return <div style={{minWidth: '20px', width: '100%', height: '100%'}} onDoubleClick={handleDoubleClick}><p style={textStyle}>{text.content || " "}</p></div>;
});

const Transformable = memo(({ children, id, initialTransform, onTransform, isFlipped, parentRef, isSelected, onSelect, isResizable = true, isRotatable = true, isDraggable = true, isPositionLocked = false, zIndex, style, resizeMode = 'scale', allowTextScaling = false, containerSize, onDoubleClick }: any) => {
    const handleDragStart = (e: any) => {
        if (!isDraggable || isPositionLocked) { if (isPositionLocked) { e.stopPropagation(); onSelect(id); } return; }
        e.preventDefault(); e.stopPropagation(); onSelect(id);
        const parentRect = parentRef.current?.getBoundingClientRect();
        if (!parentRect) return;
        const startC = e.touches ? e.touches[0] : e;
        const handleMove = (me: any) => {
            const curC = me.touches ? me.touches[0] : me;
            const dx = curC.clientX - startC.clientX;
            const dy = curC.clientY - startC.clientY;
            onTransform(id, { ...initialTransform, x: Math.max(0, Math.min(100, ((initialTransform.x / 100) * parentRect.width + dx) / parentRect.width * 100)), y: Math.max(0, Math.min(100, ((initialTransform.y / 100) * parentRect.height + dy) / parentRect.height * 100)) });
        };
        const handleEnd = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleEnd); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleEnd); };
        window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleEnd); window.addEventListener('touchmove', handleMove); window.addEventListener('touchend', handleEnd);
    };

    const rotation = initialTransform.rotation || 0;
    const transformStyle = {
        ...style,
        left: `${initialTransform.x}%`, top: `${initialTransform.y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) ${(resizeMode === 'scale' || allowTextScaling) ? `scale(${initialTransform.scale})` : ''} scaleX(${isFlipped ? -1 : 1})`,
        touchAction: 'none', cursor: isDraggable && !isPositionLocked ? (isSelected ? 'move' : 'pointer') : (isPositionLocked ? 'not-allowed' : 'default'),
        outline: isSelected ? (isPositionLocked ? '2px solid #ef4444' : '2px dashed #efa3b5') : 'none', outlineOffset: '5px', zIndex: zIndex
    };

    return <div onMouseDown={handleDragStart} onTouchStart={handleDragStart} onDoubleClick={onDoubleClick} className="absolute transform-gpu" style={transformStyle}>{children}</div>;
});

const FramePreview = React.forwardRef<HTMLDivElement, FramePreviewProps>(({ config, containerWidth = 400, onItemTransform, onItemRemove, onTextUpdate, onItemUpdate, onCharacterUpdate, onItemFlip, onCharacterDoubleClick, onAutoAdvance, className, isInteractive = true, selectedItemId, setSelectedItemId, setIsEditingText, allParts: propAllParts, activePartType, logoUrl, previewFont, allowTextScaling, onAlign }, ref) => {
  const frameOption = useMemo(() => FRAME_OPTIONS.find(f => f.id === config.frameId) || FRAME_OPTIONS[0], [config.frameId]);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const patternId = `watermark-pattern-${React.useId().replace(/:/g, "")}`;

  const frameWidth = (config.isRotated ? frameOption.frameHeightCm : frameOption.frameWidthCm) * (containerWidth / Math.max(...FRAME_OPTIONS.map(f => Math.max(f.frameWidthCm, f.frameHeightCm))));
  const frameHeight = (config.isRotated ? frameOption.frameWidthCm : frameOption.frameHeightCm) * (containerWidth / Math.max(...FRAME_OPTIONS.map(f => Math.max(f.frameWidthCm, f.frameHeightCm))));
  const backgroundWidth = (config.isRotated ? frameOption.backgroundHeightCm : frameOption.backgroundWidthCm) * (containerWidth / Math.max(...FRAME_OPTIONS.map(f => Math.max(f.frameWidthCm, f.frameHeightCm))));
  const backgroundHeight = (config.isRotated ? frameOption.backgroundWidthCm : frameOption.backgroundHeightCm) * (containerWidth / Math.max(...FRAME_OPTIONS.map(f => Math.max(f.frameWidthCm, f.frameHeightCm))));
  const pxPerCm = backgroundWidth / (config.isRotated ? frameOption.backgroundHeightCm : frameOption.backgroundWidthCm);

  // LOGIC BUFFERED BACKGROUND (TRÁNH NHÁY TRẮNG)
  const [displayBgUrl, setDisplayBgUrl] = useState(config.background.value);
  useEffect(() => {
    if (config.background.type === 'color') {
        setDisplayBgUrl(config.background.value);
        return;
    }
    const img = new Image();
    img.src = config.background.value;
    img.onload = () => setDisplayBgUrl(config.background.value);
    // Nếu lỗi giữ ảnh cũ
  }, [config.background.value, config.background.type]);

  const allPartsMap = useMemo(() => propAllParts || Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>), [propAllParts]);

  return (
    <div ref={ref} className={`flex items-center justify-center relative ${className}`} style={{ width: frameWidth, height: frameHeight }}>
        <div className="relative transition-colors duration-300 flex items-center justify-center" style={{ width: '100%', height: '100%', backgroundColor: config.frameColor === 'black' ? '#1a1a1a' : '#ffffff', boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.1)` }}>
            <div ref={previewContainerRef} className="relative overflow-hidden" style={{ width: backgroundWidth, height: backgroundHeight, border: '1px solid #c0c0c0' }} onClick={(e) => isInteractive && e.target === previewContainerRef.current && setSelectedItemId(null)}>
                {config.background.type === 'color' ? (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: displayBgUrl, zIndex: 0 }} />
                ) : (
                    <img crossOrigin="anonymous" referrerPolicy="no-referrer" src={displayBgUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="bg" />
                )}

                {logoUrl && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
                        <svg width="100%" height="100%" style={{ opacity: 0.15 }} fill="transparent"><defs><pattern id={patternId} x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><image href={logoUrl} x="40" y="40" width="40" height="40" preserveAspectRatio="xMidYMid meet" /></pattern></defs><rect width="100%" height="100%" fill={`url(#${patternId})`} /></svg>
                    </div>
                )}

                {config.shapes?.map(shape => (
                    <Transformable key={`shape-${shape.id}`} id={`shape-${shape.id}`} initialTransform={{ ...shape, scale: 1 }} onTransform={onItemTransform} parentRef={previewContainerRef} isSelected={selectedItemId === `shape-${shape.id}`} onSelect={setSelectedItemId} isResizable={isInteractive} isRotatable={isInteractive} isDraggable={isInteractive} isPositionLocked={shape.lockedPosition} zIndex={4} resizeMode="dimensions" containerSize={{ width: backgroundWidth, height: backgroundHeight }} style={{ width: `${shape.width * backgroundWidth / 100}px`, height: `${shape.height * backgroundHeight / 100}px` }}>
                        <div style={{ width: '100%', height: '100%', borderStyle: shape.strokeType, borderWidth: `${shape.strokeWidth}px`, borderColor: shape.strokeColor, backgroundColor: shape.fillColor || 'transparent', borderRadius: `${shape.borderRadius}px`, boxSizing: 'border-box' }} />
                    </Transformable>
                ))}

                {config.characters.map(char => (
                    <Transformable key={`character-${char.id}`} id={`character-${char.id}`} initialTransform={char} onTransform={onItemTransform} parentRef={previewContainerRef} isSelected={selectedItemId === `character-${char.id}`} onSelect={setSelectedItemId} isResizable={false} isRotatable={false} isDraggable={isInteractive} zIndex={5} onDoubleClick={() => onCharacterDoubleClick?.(char.id)}>
                       <div style={{width: '100%', height: '100%'}}><LegoCharacter character={char} pxPerCm={pxPerCm} /></div>
                    </Transformable>
                ))}
                
                {config.draggableItems.map(item => {
                    const isCharm = item.type === 'charm';
                    const part = isCharm ? null : allPartsMap[item.partId];
                    const img = isCharm ? item.partId : (item.selectedColor?.imageUrl || part?.imageUrl);
                    if (!img) return null;
                    return (
                        <Transformable key={`item-${item.id}`} id={`item-${item.id}`} initialTransform={item} onTransform={onItemTransform} isFlipped={item.isFlipped} parentRef={previewContainerRef} isSelected={selectedItemId === `item-${item.id}`} onSelect={setSelectedItemId} isResizable={isInteractive && isCharm} isRotatable={isInteractive} isDraggable={isInteractive} isPositionLocked={item.lockedPosition} zIndex={item.type === 'hat' ? 12 : 10}>
                            <div style={{ overflow: 'hidden', width: (isCharm ? 2 : (part?.widthCm || 1)) * pxPerCm, height: (isCharm ? 2 : (part?.heightCm || 1)) * pxPerCm }}>
                                <img crossOrigin="anonymous" referrerPolicy="no-referrer" src={img} alt="item" className="pointer-events-none w-full h-full object-cover" />
                            </div>
                        </Transformable>
                    );
                })}
                
                {config.texts.map(text => (
                    <Transformable key={`text-${text.id}`} id={`text-${text.id}`} initialTransform={{...text}} onTransform={onItemTransform} parentRef={previewContainerRef} isSelected={selectedItemId === `text-${text.id}`} onSelect={setSelectedItemId} isDraggable={isInteractive} zIndex={15} resizeMode="dimensions" isPositionLocked={text.lockedPosition} style={{ width: `${(text.width || 30) * backgroundWidth / 100}px` }} allowTextScaling={allowTextScaling}>
                        <EditableText text={text} fontSize={text.size * (backgroundWidth / 500)} onUpdate={(upd) => onTextUpdate(text.id, upd)} onBeginEditing={() => setIsEditingText(true)} onEndEditing={() => setIsEditingText(false)} isContentLocked={text.lockedContent} previewFont={selectedItemId === `text-${text.id}` ? previewFont : undefined} />
                    </Transformable>
                ))}
            </div>
        </div>
    </div>
  );
});

export default FramePreview;
