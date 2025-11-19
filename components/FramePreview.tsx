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
  className?: string;
  isInteractive?: boolean;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  setIsEditingText: (isEditing: boolean) => void;
}

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
        <img src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} />
      )}
      {shirt && shirtImageUrl && (
        <img src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} />
      )}
      {face && face.imageUrl && (
        <img src={face.imageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} />
      )}
      {activeHeadwear && activeHeadwear.imageUrl && (
        <img src={activeHeadwear.imageUrl} alt={activeHeadwear.name} style={{ ...partStyle, zIndex: 4 }} />
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
    onRemove: (id: string) => void;
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
}> = ({ children, id, initialTransform, onTransform, onRemove, parentRef, isSelected, onSelect, isResizable = true, isRotatable = true, isDraggable = true, zIndex, style, isTextItem, containerSize }) => {
    
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

    return (
        <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="absolute"
            style={{
                ...style,
                left: `${initialTransform.x}%`,
                top: `${initialTransform.y}%`,
                transform: `translate(-50%, -50%) rotate(${initialTransform.rotation}deg) scale(${initialTransform.scale})`,
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
                  <div
                    onMouseDown={(e) => { e.stopPropagation(); onRemove(id); }}
                    onTouchStart={(e) => { e.stopPropagation(); onRemove(id); }}
                    className="transform-handle absolute -top-2 -left-2 cursor-pointer bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold border-2 border-white"
                    title="Remove Item"
                  >
                    &times;
                  </div>
                  {isTextItem ? (
                      <div onMouseDown={handleResizeWidthStart} onTouchStart={handleResizeWidthStart} className="transform-handle absolute top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize bg-luvin-pink w-2 h-6 rounded-sm border-2 border-white" title="Resize Width"></div>
                  ) : (
                    <>
                      {isRotatable && <div onMouseDown={handleRotateStart} onTouchStart={handleRotateStart} className="transform-handle absolute -top-6 left-1/2 -translate-x-1/2 cursor-alias bg-luvin-pink text-white rounded-full h-4 w-4" title="Rotate"></div>}
                      {isResizable && <div onMouseDown={handleResizeStart} onTouchStart={handleResizeStart} className="transform-handle absolute -bottom-2 -right-2 cursor-nwse-resize bg-luvin-pink w-3 h-3 rounded-full border-2 border-white" title="Resize"></div>}
                    </>
                  )}
                </>
            )}
        </div>
    );
};


const FramePreview = React.forwardRef<HTMLDivElement, FramePreviewProps>(({ config, containerWidth = 400, onItemTransform, onItemRemove, onTextUpdate, className, isInteractive = true, selectedItemId, setSelectedItemId, setIsEditingText }, ref) => {
  const frameOption = FRAME_OPTIONS.find(f => f.id === config.frameId) || FRAME_OPTIONS[0];
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // --- START OF FIX: Proportional Scaling Logic ---
  // 1. Find the largest dimension (width or height) across all available frames.
  const maxDimensionCm = useMemo(() => 
    Math.max(...FRAME_OPTIONS.map(f => Math.max(f.frameWidthCm, f.frameHeightCm)))
  , []);

  // 2. Create a consistent scaling factor (pixels per cm) based on the container width and the max dimension.
  const pxPerCm = containerWidth / maxDimensionCm;

  // 3. Calculate the total dimensions of the current frame in pixels.
  const frameWidth = frameOption.frameWidthCm * pxPerCm;
  const frameHeight = frameOption.frameHeightCm * pxPerCm;

  // 4. Calculate the background dimensions in pixels.
  const backgroundWidth = frameOption.backgroundWidthCm * pxPerCm;
  const backgroundHeight = frameOption.backgroundHeightCm * pxPerCm;
  // --- END OF FIX ---

  const backgroundStyle: React.CSSProperties =
    config.background.type === 'color'
      ? { backgroundColor: config.background.value }
      : { backgroundImage: `url(${config.background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  
  const allParts: Record<string, LegoPart> = {
      ...Object.values(LEGO_PARTS).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {})
  };

  return (
    // This outer div now correctly scales the entire component proportionally.
    <div ref={ref} className={`flex items-center justify-center ${className}`} style={{ width: frameWidth, height: frameHeight }}>
        {/* This div represents the white frame itself. */}
        <div 
          className="relative bg-white"
          style={{
            width: '100%',
            height: '100%',
            boxShadow: `0 4px 12px #d8d8d8`,
          }}
        >
            {/* This inner div is the background area where items are placed. */}
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
                            key={id} id={id} initialTransform={char} onTransform={onItemTransform} onRemove={onItemRemove}
                            parentRef={previewContainerRef} isSelected={selectedItemId === id} onSelect={setSelectedItemId}
                            isResizable={false} isRotatable={false} isDraggable={isInteractive}
                            zIndex={5} // Base z-index for characters
                        >
                           <LegoCharacter character={char} pxPerCm={pxPerCm} />
                        </Transformable>
                    );
                })}
                
                {config.draggableItems.map(item => {
                    const isCharm = item.type === 'charm';
                    const part = !isCharm ? allParts[item.partId] : null;
                    const imageUrl = isCharm ? item.partId : part?.imageUrl;
                    const name = isCharm ? 'charm' : part?.name;
                    const widthCm = isCharm ? 2 : (part?.widthCm || 1);
                    const heightCm = isCharm ? 2 : (part?.heightCm || 1);

                    if (!imageUrl) return null;

                    const id = `item-${item.id}`;
                    return (
                        <Transformable 
                            key={id} id={id} initialTransform={item} onTransform={onItemTransform} onRemove={onItemRemove}
                            parentRef={previewContainerRef} isSelected={selectedItemId === id} onSelect={setSelectedItemId}
                            isResizable={isInteractive} 
                            isRotatable={isInteractive} 
                            isDraggable={isInteractive}
                            zIndex={10} // Accessories are on top of characters
                        >
                            <img 
                              src={imageUrl} 
                              alt={name} 
                              className="pointer-events-none"
                              style={{
                                  width: widthCm * pxPerCm,
                                  height: heightCm * pxPerCm,
                                  objectFit: 'contain'
                              }}
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
                            onRemove={onItemRemove}
                            parentRef={previewContainerRef} 
                            isSelected={selectedItemId === id} 
                            onSelect={setSelectedItemId}
                            isDraggable={isInteractive}
                            zIndex={15} // Text is on top of everything
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
    </div>
  );
});

export default FramePreview;