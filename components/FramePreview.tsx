
// FIX: import useMemo from React
import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { FrameConfig, LegoCharacterConfig, LegoPart, TextConfig } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../constants';

type Transform = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  width?: number;
}

interface FramePreviewProps {
  config: FrameConfig;
  containerWidth?: number;
  onItemTransform: (id: string, newTransform: Transform) => void;
  onItemRemove: (id: string) => void;
  onTextUpdate: (id: number, updates: Partial<TextConfig>) => void;
  onItemFlip?: (id: string) => void;
  className?: string;
  isInteractive?: boolean;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  setIsEditingText: (isEditing: boolean) => void;
  allParts?: Record<string, LegoPart>;
}

// SafeImage component to handle broken URLs gracefully
const SafeImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => {
    const [hasError, setHasError] = useState(false);
    if (hasError) return null;
    return <img {...props} onError={() => setHasError(true)} />;
};

const LegoCharacter: React.FC<{ character: LegoCharacterConfig; pxPerCm: number }> = ({ character, pxPerCm }) => {
  const { hair, hat, face, shirt, pants } = character;
  const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
  const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
  const activeHeadwear = hat || hair;

  // Per user request, the character is composed of 4 same-sized, stacked images.
  // The container will have the final dimensions.
  const CHARACTER_WIDTH_CM = 2.5;
  const CHARACTER_HEIGHT_CM = 4.0;

  const px = (cm: number) => Math.round(cm * pxPerCm);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: px(CHARACTER_WIDTH_CM),
    height: px(CHARACTER_HEIGHT_CM),
    transformOrigin: 'center',
  };

  // This style will be applied to all parts. They are layers filling the container.
  const partStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain', // Use contain to respect aspect ratio of user's image
    pointerEvents: 'none',
  };

  return (
    <div style={containerStyle}>
      {/* 
        Each image is a full-size layer. The user must provide transparent PNGs 
        where the part is correctly positioned within the 2.5cm x 4cm frame.
        The stacking order is controlled by z-index.
      */}
      {pants && pantsImageUrl && (
        <SafeImage src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} />
      )}
      {shirt && shirtImageUrl && (
        <SafeImage src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} />
      )}
      {face && face.imageUrl && (
        <SafeImage src={face.imageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} />
      )}
      {activeHeadwear && activeHeadwear.imageUrl && (
        <SafeImage src={activeHeadwear.imageUrl} alt={activeHeadwear.name} style={{ ...partStyle, zIndex: 4 }} />
      )}
    </div>
  );
};


const getFontFamily = (fontName: string) => {
    switch (fontName) {
        case 'Anniversary': return '"Dancing Script", cursive';
        case 'Serif': return '"Noto Serif", serif';
        case 'Playfair Display': return '"Playfair Display", serif';
        default: return '"Montserrat", sans-serif';
    }
};

const EditableText: React.FC<{
    text: TextConfig;
    onUpdate: (updates: Partial<TextConfig>) => void;
    onBeginEditing: () => void;
    onEndEditing: () => void;
}> = ({ text, onUpdate, onBeginEditing, onEndEditing }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(text.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        if (e.key === 'Escape') {
            e.preventDefault();
            setEditedContent(text.content); // Revert changes
            handleBlur();
        }
    };

    const handleDoubleClick = () => {
        setIsEditing(true);
        setEditedContent(text.content);
        onBeginEditing();
    }

    const textStyle: React.CSSProperties = {
        fontFamily: getFontFamily(text.font),
        fontSize: `${text.size}px`,
        color: text.color,
        whiteSpace: 'pre-wrap',
        textAlign: text.textAlign || 'center',
        padding: '10px',
        wordBreak: 'break-word',
        textShadow: '0 0 5px white, 0 0 5px white',
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
                }}
            />
        );
    }

    return (
        <div style={{minWidth: '50px', width: '100%', height: '100%'}} onDoubleClick={handleDoubleClick}>
            <p style={textStyle} >
                {text.content || " "}
            </p>
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
    zIndex?: number;
    style?: React.CSSProperties;
    isTextItem?: boolean;
    containerSize?: { width: number; height: number; };
}> = ({ children, id, initialTransform, onTransform, isFlipped, parentRef, isSelected, onSelect, isResizable = true, isRotatable = true, isDraggable = true, zIndex, style, isTextItem, containerSize }) => {
    
    const getClientCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if ('clientX' in e) {
        return { x: e.clientX, y: e.clientY };
      }
      return null;
    };

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!isDraggable) return;
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

            onTransform(id, {
                ...initialTransform,
                x: Math.max(0, Math.min(100, newX)),
                y: Math.max(0, Math.min(100, newY)),
            });
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
            const deltaAngle = currentAngle - startAngle;
            onTransform(id, { ...initialTransform, rotation: startRotation + deltaAngle });
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
        const parentRect = parentRef.current?.getBoundingClientRect();
        if (!parentRect) return;
        
        const startCoords = getClientCoords(e.nativeEvent);
        if (!startCoords) return;

        const startScale = initialTransform.scale;
        
        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
             const moveCoords = getClientCoords(moveEvent);
             if (!moveCoords) return;
             const dx = moveCoords.x - startCoords.x;
             const scaleChange = dx / 100; // Adjust sensitivity
             onTransform(id, { ...initialTransform, scale: Math.max(0.2, startScale + scaleChange) });
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
        const parentRect = containerSize;
        if (!parentRect) return;
        
        const startCoords = getClientCoords(e.nativeEvent);
        if (!startCoords) return;
        
        const startWidth = initialTransform.width || 30; // start width in percent

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const moveCoords = getClientCoords(moveEvent);
            if (!moveCoords) return;

            const dx = moveCoords.x - startCoords.x;
            const dWidthPercent = (dx / parentRect.width) * 100;
            onTransform(id, { ...initialTransform, width: Math.max(10, startWidth + dWidthPercent) });
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

    // Calculate inverse scale for handles to keep them visually consistent size
    const handleScale = 1 / (initialTransform.scale || 1);
    
    return (
        <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="absolute"
            style={{
                ...style,
                left: `${initialTransform.x}%`,
                top: `${initialTransform.y}%`,
                transform: `translate(-50%, -50%) rotate(${initialTransform.rotation}deg) scale(${initialTransform.scale}) scaleX(${isFlipped ? -1 : 1})`,
                touchAction: 'none',
                cursor: isDraggable ? (isSelected ? 'move' : 'pointer') : 'default',
                outline: isSelected && isDraggable ? '2px dashed #efa3b5' : 'none',
                outlineOffset: '5px',
                zIndex: zIndex
            }}
        >
            {children}
            {isSelected && isDraggable && (
                <>
                  {isTextItem ? (
                      <div 
                        onMouseDown={handleResizeWidthStart} 
                        onTouchStart={handleResizeWidthStart} 
                        className="transform-handle absolute top-1/2 -right-3 -translate-y-1/2 cursor-ew-resize bg-luvin-pink w-4 h-8 rounded-md border-2 border-white shadow-sm" 
                        title="Resize Width"
                        style={{ transform: `translateY(-50%) scale(${handleScale})` }}
                      ></div>
                  ) : (
                    <>
                      {isRotatable && (
                          <div 
                            onMouseDown={handleRotateStart} 
                            onTouchStart={handleRotateStart} 
                            className="transform-handle absolute -top-8 left-1/2 -translate-x-1/2 cursor-alias bg-luvin-pink text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-sm" 
                            title="Rotate"
                            style={{ transform: `translateX(-50%) scale(${handleScale})` }}
                          >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </div>
                      )}
                      {isResizable && (
                          <div 
                            onMouseDown={handleResizeStart} 
                            onTouchStart={handleResizeStart} 
                            className="transform-handle absolute -bottom-3 -right-3 cursor-nwse-resize bg-luvin-pink w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center" 
                            title="Resize"
                            style={{ transform: `scale(${handleScale})` }}
                          >
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 20h16m0 0V4" /></svg>
                          </div>
                      )}
                    </>
                  )}
                </>
            )}
        </div>
    );
};


const FramePreview = React.forwardRef<HTMLDivElement, FramePreviewProps>(({ config, containerWidth = 400, onItemTransform, onItemRemove, onTextUpdate, onItemFlip, className, isInteractive = true, selectedItemId, setSelectedItemId, setIsEditingText, allParts: propAllParts }, ref) => {
  const frameOption = FRAME_OPTIONS.find(f => f.id === config.frameId) || FRAME_OPTIONS[0];
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  const maxDimensionCm = useMemo(() => 
    Math.max(...FRAME_OPTIONS.map(f => Math.max(f.frameWidthCm, f.frameHeightCm)))
  , []);

  const pxPerCm = containerWidth / maxDimensionCm;
  const frameWidth = frameOption.frameWidthCm * pxPerCm;
  const frameHeight = frameOption.frameHeightCm * pxPerCm;
  const backgroundWidth = frameOption.backgroundWidthCm * pxPerCm;
  const backgroundHeight = frameOption.backgroundHeightCm * pxPerCm;

  const backgroundStyle: React.CSSProperties =
    config.background.type === 'color'
      ? { backgroundColor: config.background.value }
      : { backgroundImage: `url(${config.background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  
  const allParts: Record<string, LegoPart> = useMemo(() => {
      if (propAllParts) return propAllParts;
      return Object.values(LEGO_PARTS).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>);
  }, [propAllParts]);

  // --- Context Toolbar Logic ---
  const selectedItemDetails = useMemo(() => {
      if (!selectedItemId) return null;
      const [type, idStr] = selectedItemId.split('-');
      const id = parseInt(idStr);
      
      if (type === 'item') {
          const item = config.draggableItems.find(i => i.id === id);
          return { type: 'item', data: item, canFlip: item && (item.type === 'accessory' || item.type === 'pet') };
      } else if (type === 'text') {
          const item = config.texts.find(t => t.id === id);
          return { type: 'text', data: item, canFlip: false };
      } else if (type === 'character') {
          const item = config.characters.find(c => c.id === id);
          return { type: 'character', data: item, canFlip: false };
      }
      return null;
  }, [selectedItemId, config]);

  const handleToolbarDelete = () => {
      if (selectedItemId) onItemRemove(selectedItemId);
  };

  const handleToolbarFlip = () => {
      if (selectedItemId && onItemFlip) onItemFlip(selectedItemId);
  };

  return (
    <div ref={ref} className={`flex items-center justify-center relative ${className}`} style={{ width: frameWidth, height: frameHeight }}>
        <div 
          className="relative bg-white"
          style={{ width: '100%', height: '100%', boxShadow: `0 4px 12px #d8d8d8` }}
        >
            <div
                ref={previewContainerRef}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
                style={{
                    width: backgroundWidth,
                    height: backgroundHeight,
                    ...backgroundStyle,
                    boxShadow: `inset 0 0 0 1px rgba(0, 0, 0, 0.15)`,
                }}
                onClick={(e) => {
                    if (isInteractive && e.target === previewContainerRef.current) {
                        setSelectedItemId(null);
                    }
                }}
            >
                {config.characters.map(char => {
                    const id = `character-${char.id}`;
                    return (
                        <Transformable 
                            key={id} id={id} initialTransform={char} onTransform={onItemTransform} 
                            parentRef={previewContainerRef} isSelected={selectedItemId === id} onSelect={setSelectedItemId}
                            isResizable={false} isRotatable={false} isDraggable={isInteractive}
                            zIndex={5}
                        >
                           <LegoCharacter character={char} pxPerCm={pxPerCm} />
                        </Transformable>
                    );
                })}
                
                {config.draggableItems.map(item => {
                    const isCharm = item.type === 'charm';
                    const part = !isCharm ? allParts[item.partId] : null;
                    // Use selected color image if available, else fallback to part image
                    const imageUrl = isCharm ? item.partId : (item.selectedColor?.imageUrl || part?.imageUrl);
                    const name = isCharm ? 'charm' : (item.selectedColor?.name ? `${part?.name} (${item.selectedColor.name})` : part?.name);
                    const widthCm = isCharm ? 2 : (part?.widthCm || 1);
                    const heightCm = isCharm ? 2 : (part?.heightCm || 1);

                    if (!imageUrl) return null;

                    const id = `item-${item.id}`;
                    return (
                        <Transformable 
                            key={id} id={id} initialTransform={item} onTransform={onItemTransform}
                            isFlipped={item.isFlipped}
                            parentRef={previewContainerRef} isSelected={selectedItemId === id} onSelect={setSelectedItemId}
                            isResizable={false} 
                            isRotatable={isInteractive} 
                            isDraggable={isInteractive}
                            zIndex={10}
                        >
                            <SafeImage 
                              src={imageUrl} 
                              alt={name} 
                              className="pointer-events-none"
                              style={{ width: widthCm * pxPerCm, height: heightCm * pxPerCm, objectFit: 'contain' }}
                            />
                        </Transformable>
                    );
                })}
                
                {config.texts.map(text => {
                    const id = `text-${text.id}`;
                    return (
                        <Transformable 
                            key={id} id={id} 
                            initialTransform={{x: text.x, y: text.y, rotation: text.rotation, scale: text.scale, width: text.width}} 
                            onTransform={onItemTransform} 
                            parentRef={previewContainerRef} 
                            isSelected={selectedItemId === id} 
                            onSelect={setSelectedItemId}
                            isDraggable={isInteractive}
                            zIndex={15}
                            isTextItem={true}
                            containerSize={{ width: backgroundWidth, height: backgroundHeight }}
                            style={{ width: `${(text.width || 30) * backgroundWidth / 100}px` }}
                        >
                           <EditableText
                             text={text}
                             onUpdate={(updates) => onTextUpdate(text.id, updates)}
                             onBeginEditing={() => setIsEditingText(true)}
                             onEndEditing={() => setIsEditingText(false)}
                           />
                        </Transformable>
                    );
                })}
            </div>
        </div>

        {/* --- Floating Mobile Action Toolbar (Moved outside the frame content area) --- */}
        {isInteractive && selectedItemId && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full px-3 py-1.5 animate-fade-in transform-handle">
                {selectedItemDetails?.canFlip && (
                    <button onClick={handleToolbarFlip} className="p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors" title="Lật">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </button>
                )}
                <button onClick={handleToolbarDelete} className="p-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors" title="Xóa">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <button onClick={() => setSelectedItemId(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors" title="Xong">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </button>
            </div>
        )}
    </div>
  );
});

export default FramePreview;
