
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BackgroundTemplate, DesignLayer, LayerType, FrameOption } from '../../../types';
import { uploadToCloudinary } from '../../../services/uploadService';
import { saveDesignTemplate, getAllDesignTemplates, deleteDesignTemplate } from '../../../services/designTemplateService';
import { getAllFrames } from '../../../services/frameService';

declare var html2canvas: any;

const DEFAULT_LAYER: Partial<DesignLayer> = {
    x: 50, y: 50, width: 30, height: 10, rotation: 0, opacity: 1, zIndex: 1,
    isLocked: false, allowContentEdit: true, allowStyleEdit: true, isHidden: false
};

const FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Dancing Script', 'Pacifico', 'Nunito'];

export const StudioDesign: React.FC = () => {
    const [templates, setTemplates] = useState<BackgroundTemplate[]>([]);
    const [currentTemplate, setCurrentTemplate] = useState<BackgroundTemplate | null>(null);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [frames, setFrames] = useState<FrameOption[]>([]);
    
    const [canvasScale, setCanvasScale] = useState(1);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const [tpls, frs] = await Promise.all([getAllDesignTemplates(), getAllFrames()]);
        setTemplates(tpls);
        setFrames(frs);
    };

    // --- CANVAS HELPERS ---
    const getFrameDimensions = () => {
        if (!currentTemplate) return { w: 500, h: 500, ratio: 1 };
        // Default to Square logic if not specific
        if (currentTemplate.frameSize === 'rectangle') return { w: 420, h: 594, ratio: 420/594 }; // A5 approx
        return { w: 500, h: 500, ratio: 1 };
    };

    const handleCreateTemplate = () => {
        const newTemplate: BackgroundTemplate = {
            id: `tpl_${Date.now()}`,
            name: 'New Template',
            category: 'General',
            frameSize: 'square',
            layers: [],
            thumbnailUrl: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        setCurrentTemplate(newTemplate);
        setSelectedLayerId(null);
    };

    const handleAddLayer = (type: LayerType) => {
        if (!currentTemplate) return;
        const id = `layer_${Date.now()}`;
        const newLayer: DesignLayer = {
            id, type, name: `${type} ${currentTemplate.layers.length + 1}`,
            ...DEFAULT_LAYER,
            zIndex: currentTemplate.layers.length + 1,
            // Type specifics
            ...(type === 'text' ? { content: 'Double click to edit', fontFamily: 'Montserrat', fontSize: 24, textColor: '#000000', width: 40, height: 10 } : {}),
            ...(type === 'shape' ? { backgroundColor: '#e5e7eb', width: 20, height: 20 } : {}),
            ...(type === 'image' ? { src: '', width: 30, height: 30 } : {})
        } as DesignLayer;

        setCurrentTemplate({
            ...currentTemplate,
            layers: [...currentTemplate.layers, newLayer]
        });
        setSelectedLayerId(id);
    };

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        if (!currentTemplate) return;
        setCurrentTemplate({
            ...currentTemplate,
            layers: currentTemplate.layers.map(l => l.id === id ? { ...l, ...updates } : l)
        });
    };

    const handleDeleteLayer = (id: string) => {
        if (!currentTemplate) return;
        if(confirm("Delete this layer?")) {
            setCurrentTemplate({
                ...currentTemplate,
                layers: currentTemplate.layers.filter(l => l.id !== id)
            });
            setSelectedLayerId(null);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, layerId?: string) => {
        if (e.target.files && e.target.files[0]) {
            const url = await uploadToCloudinary(e.target.files[0]);
            if (url) {
                if (layerId) {
                    updateLayer(layerId, { src: url });
                } else {
                    // New Image Layer
                    if (!currentTemplate) return;
                    const id = `layer_${Date.now()}`;
                    const newLayer: DesignLayer = {
                        id, type: 'image', name: `Image ${currentTemplate.layers.length + 1}`,
                        ...DEFAULT_LAYER, src: url, width: 30, height: 30, zIndex: currentTemplate.layers.length + 1
                    } as DesignLayer;
                    setCurrentTemplate({
                        ...currentTemplate,
                        layers: [...currentTemplate.layers, newLayer]
                    });
                    setSelectedLayerId(id);
                }
            }
        }
    };

    const handleSave = async () => {
        if (!currentTemplate) return;
        setIsSaving(true);
        try {
            // Generate Thumbnail
            let thumbUrl = currentTemplate.thumbnailUrl;
            if (canvasRef.current && typeof html2canvas !== 'undefined') {
                // Temp hide drag handles for screenshot
                setSelectedLayerId(null);
                await new Promise(r => setTimeout(r, 100)); // Wait for render
                
                const canvas = await html2canvas(canvasRef.current, { scale: 1, backgroundColor: null });
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    const file = new File([blob], "thumbnail.png", { type: "image/png" });
                    const url = await uploadToCloudinary(file);
                    if (url) thumbUrl = url;
                }
            }

            await saveDesignTemplate({ ...currentTemplate, thumbnailUrl: thumbUrl });
            await fetchData();
            alert("Template saved!");
        } catch (e) {
            console.error(e);
            alert("Error saving template");
        } finally {
            setIsSaving(false);
        }
    };

    const selectedLayer = useMemo(() => 
        currentTemplate?.layers.find(l => l.id === selectedLayerId), 
    [currentTemplate, selectedLayerId]);

    // --- RENDER ---
    return (
        <div className="h-[calc(100vh-100px)] flex flex-col bg-gray-100 overflow-hidden rounded-xl border border-gray-300">
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 p-3 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => setCurrentTemplate(null)} className="text-gray-500 hover:text-gray-900 font-bold">&larr; Back</button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    {currentTemplate ? (
                        <>
                            <input 
                                className="font-bold text-lg bg-transparent border-none focus:ring-0 p-0 w-48" 
                                value={currentTemplate.name} 
                                onChange={e => setCurrentTemplate({...currentTemplate, name: e.target.value})} 
                            />
                            <select 
                                value={currentTemplate.frameSize} 
                                onChange={e => setCurrentTemplate({...currentTemplate, frameSize: e.target.value as any})}
                                className="text-xs border rounded p-1 bg-gray-50"
                            >
                                <option value="square">Square (1:1)</option>
                                <option value="rectangle">Rectangle (A5)</option>
                            </select>
                        </>
                    ) : (
                        <span className="font-bold text-lg">Studio Library</span>
                    )}
                </div>
                <div>
                    {currentTemplate ? (
                        <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                            {isSaving ? 'Saving...' : 'Save Template'}
                        </button>
                    ) : (
                        <button onClick={handleCreateTemplate} className="bg-gray-900 text-white px-4 py-2 rounded shadow font-bold text-sm hover:bg-black">
                            + Create New Template
                        </button>
                    )}
                </div>
            </div>

            {currentTemplate ? (
                <div className="flex flex-grow overflow-hidden">
                    {/* LEFT SIDEBAR: LAYERS & TOOLS */}
                    <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-10">
                        <div className="p-4 grid grid-cols-2 gap-2 border-b border-gray-100">
                            <button onClick={() => handleAddLayer('text')} className="bg-gray-50 border hover:bg-gray-100 p-3 rounded flex flex-col items-center gap-1 text-xs font-bold text-gray-700">
                                <span className="text-lg">T</span> Text
                            </button>
                            <label className="bg-gray-50 border hover:bg-gray-100 p-3 rounded flex flex-col items-center gap-1 text-xs font-bold text-gray-700 cursor-pointer">
                                <span className="text-lg">🖼️</span> Image
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} />
                            </label>
                            <button onClick={() => handleAddLayer('shape')} className="bg-gray-50 border hover:bg-gray-100 p-3 rounded flex flex-col items-center gap-1 text-xs font-bold text-gray-700">
                                <span className="text-lg">⬜</span> Box
                            </button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Layers</h4>
                            <div className="space-y-1">
                                {[...currentTemplate.layers].reverse().map((layer) => (
                                    <div 
                                        key={layer.id} 
                                        onClick={() => setSelectedLayerId(layer.id)}
                                        className={`flex justify-between items-center p-2 rounded cursor-pointer text-sm ${selectedLayerId === layer.id ? 'bg-blue-50 border-blue-200 text-blue-700 border' : 'hover:bg-gray-50 border border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span>{layer.type === 'text' ? 'T' : layer.type === 'image' ? '🖼️' : '⬜'}</span>
                                            <span className="truncate max-w-[100px]">{layer.name}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { isHidden: !layer.isHidden }) }} className="text-gray-400 hover:text-gray-600 text-xs">
                                                {layer.isHidden ? '🙈' : '👁️'}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id) }} className="text-gray-400 hover:text-red-600 text-xs">×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CENTER: CANVAS */}
                    <div className="flex-grow bg-gray-200 overflow-auto flex items-center justify-center p-10 relative">
                        <div 
                            ref={canvasRef}
                            className="bg-white shadow-2xl relative transition-all"
                            style={{ 
                                width: getFrameDimensions().w, 
                                height: getFrameDimensions().h,
                                transform: `scale(${canvasScale})`,
                                transformOrigin: 'center center'
                            }}
                            onClick={() => setSelectedLayerId(null)}
                        >
                            {/* Grid/Ruler visual aid */}
                            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                            {/* Layers Rendering */}
                            {currentTemplate.layers.map(layer => {
                                if (layer.isHidden) return null;
                                return (
                                    <StudioLayer 
                                        key={layer.id} 
                                        layer={layer} 
                                        isSelected={selectedLayerId === layer.id}
                                        onSelect={() => setSelectedLayerId(layer.id)}
                                        onUpdate={(updates) => updateLayer(layer.id, updates)}
                                        containerSize={getFrameDimensions()}
                                    />
                                );
                            })}
                        </div>
                        
                        {/* Zoom Controls */}
                        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow border p-1 flex gap-2">
                            <button onClick={() => setCanvasScale(s => Math.max(0.5, s - 0.1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100">-</button>
                            <span className="flex items-center text-xs font-mono">{Math.round(canvasScale * 100)}%</span>
                            <button onClick={() => setCanvasScale(s => Math.min(2, s + 0.1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100">+</button>
                        </div>
                    </div>

                    {/* RIGHT SIDEBAR: PROPERTIES */}
                    <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto z-10">
                        {selectedLayer ? (
                            <div className="p-4 space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Layer Name</label>
                                    <input value={selectedLayer.name} onChange={e => updateLayer(selectedLayer.id, { name: e.target.value })} className="w-full border p-2 rounded text-sm" />
                                </div>

                                {/* RULES / PERMISSIONS */}
                                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-2">Customer Rules</label>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={selectedLayer.isLocked} onChange={e => updateLayer(selectedLayer.id, { isLocked: e.target.checked })} />
                                            <span>Lock Position (Cannot move)</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={selectedLayer.allowContentEdit} onChange={e => updateLayer(selectedLayer.id, { allowContentEdit: e.target.checked })} />
                                            <span>Allow Content Edit (Text/Img)</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={selectedLayer.allowStyleEdit} onChange={e => updateLayer(selectedLayer.id, { allowStyleEdit: e.target.checked })} />
                                            <span>Allow Style Edit (Color/Font)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Style Properties */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Position & Size (%)</label>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>X: <input type="number" value={Math.round(selectedLayer.x)} onChange={e => updateLayer(selectedLayer.id, { x: Number(e.target.value) })} className="w-full border p-1 rounded" /></div>
                                        <div>Y: <input type="number" value={Math.round(selectedLayer.y)} onChange={e => updateLayer(selectedLayer.id, { y: Number(e.target.value) })} className="w-full border p-1 rounded" /></div>
                                        <div>W: <input type="number" value={Math.round(selectedLayer.width)} onChange={e => updateLayer(selectedLayer.id, { width: Number(e.target.value) })} className="w-full border p-1 rounded" /></div>
                                        {selectedLayer.type !== 'text' && (
                                            <div>H: <input type="number" value={Math.round(selectedLayer.height)} onChange={e => updateLayer(selectedLayer.id, { height: Number(e.target.value) })} className="w-full border p-1 rounded" /></div>
                                        )}
                                        <div>Rot: <input type="number" value={Math.round(selectedLayer.rotation)} onChange={e => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })} className="w-full border p-1 rounded" /></div>
                                        <div>Opac: <input type="number" step="0.1" max="1" min="0" value={selectedLayer.opacity} onChange={e => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })} className="w-full border p-1 rounded" /></div>
                                    </div>
                                </div>

                                {selectedLayer.type === 'text' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Text Style</label>
                                        <textarea value={selectedLayer.content} onChange={e => updateLayer(selectedLayer.id, { content: e.target.value })} className="w-full border p-2 rounded text-sm mb-2" rows={2} />
                                        <select value={selectedLayer.fontFamily} onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })} className="w-full border p-2 rounded text-sm mb-2">
                                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                        <div className="flex gap-2 mb-2">
                                            <input type="color" value={selectedLayer.textColor} onChange={e => updateLayer(selectedLayer.id, { textColor: e.target.value })} className="h-8 w-8 rounded cursor-pointer border-none" />
                                            <input type="number" value={selectedLayer.fontSize} onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })} className="border p-1 rounded w-16" placeholder="Size" />
                                        </div>
                                        <div className="flex gap-1 border rounded p-1 justify-center">
                                            {['left', 'center', 'right'].map(align => (
                                                <button key={align} onClick={() => updateLayer(selectedLayer.id, { textAlign: align as any })} className={`p-1 w-full rounded ${selectedLayer.textAlign === align ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
                                                    {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedLayer.type === 'image' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Image Source</label>
                                        <div className="mb-2">
                                            <img src={selectedLayer.src} className="w-full h-32 object-contain bg-gray-50 border rounded" />
                                        </div>
                                        <label className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-2 rounded cursor-pointer">
                                            Change Image
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, selectedLayer.id)} />
                                        </label>
                                    </div>
                                )}

                                {selectedLayer.type === 'shape' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Shape Style</label>
                                        <div className="flex gap-2 items-center mb-2">
                                            <span className="text-xs">Fill:</span>
                                            <input type="color" value={selectedLayer.backgroundColor} onChange={e => updateLayer(selectedLayer.id, { backgroundColor: e.target.value })} className="h-6 w-6 rounded border-none" />
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-xs">Radius:</span>
                                            <input type="number" value={selectedLayer.borderRadius || 0} onChange={e => updateLayer(selectedLayer.id, { borderRadius: Number(e.target.value) })} className="border p-1 rounded w-16 text-xs" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                Select a layer to edit properties or add a new one.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // TEMPLATE LIST VIEW
                <div className="p-8 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        <button onClick={handleCreateTemplate} className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center h-64 hover:bg-gray-50 hover:border-gray-400 transition-all group">
                            <span className="text-4xl text-gray-300 group-hover:text-gray-500 mb-2">+</span>
                            <span className="text-gray-500 font-bold">New Template</span>
                        </button>
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group relative">
                                <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                                    {tpl.thumbnailUrl ? (
                                        <img src={tpl.thumbnailUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-gray-300 text-4xl">📄</span>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h4 className="font-bold text-gray-800 truncate">{tpl.name}</h4>
                                    <p className="text-xs text-gray-500">{tpl.frameSize} • {tpl.layers.length} layers</p>
                                </div>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => setCurrentTemplate(tpl)} className="bg-white text-gray-900 px-3 py-1 rounded text-sm font-bold">Edit</button>
                                    <button onClick={async () => { await deleteDesignTemplate(tpl.id); fetchData(); }} className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- HELPER COMPONENT: DRAGGABLE LAYER ---
const StudioLayer: React.FC<{
    layer: DesignLayer;
    isSelected: boolean;
    onSelect: () => void;
    onUpdate: (u: Partial<DesignLayer>) => void;
    containerSize: { w: number, h: number };
}> = ({ layer, isSelected, onSelect, onUpdate, containerSize }) => {
    
    // Basic drag logic (simplified for brevity)
    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startLayerX = layer.x;
        const startLayerY = layer.y;

        const handleMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            
            // Convert px delta to percentage delta
            const dxPct = (dx / containerSize.w) * 100;
            const dyPct = (dy / containerSize.h) * 100;

            onUpdate({
                x: startLayerX + dxPct,
                y: startLayerY + dyPct
            });
        };

        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    };

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.width}%`,
        height: layer.type === 'text' ? 'auto' : `${layer.height}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        opacity: layer.opacity,
        zIndex: layer.zIndex,
        cursor: 'move',
        border: isSelected ? '2px dashed #3b82f6' : '1px solid transparent' // Selection outline
    };

    return (
        <div style={style} onMouseDown={handleMouseDown}>
            {layer.type === 'text' && (
                <div style={{ 
                    fontFamily: layer.fontFamily, 
                    fontSize: `${layer.fontSize}px`, 
                    color: layer.textColor, 
                    textAlign: layer.textAlign,
                    width: '100%',
                    whiteSpace: 'pre-wrap'
                }}>
                    {layer.content}
                </div>
            )}
            {layer.type === 'image' && layer.src && (
                <img src={layer.src} className="w-full h-full object-contain pointer-events-none" />
            )}
            {layer.type === 'shape' && (
                <div style={{
                    width: '100%', height: '100%', 
                    backgroundColor: layer.backgroundColor, 
                    borderRadius: `${layer.borderRadius}px`
                }}></div>
            )}
            {/* Corner Handles for resize could be added here similar to drag logic */}
            {isSelected && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize"></div>}
        </div>
    );
};
