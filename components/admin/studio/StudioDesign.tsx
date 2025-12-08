
import React, { useState, useEffect, useRef } from 'react';
import { BackgroundTemplate, DesignLayer, FrameOption } from '../../../types';
import { getAllDesignTemplates, saveDesignTemplate, deleteDesignTemplate } from '../../../services/designTemplateService';
import { uploadToCloudinary } from '../../../services/uploadService';
import { FRAME_OPTIONS } from '../../../constants';
import html2canvas from 'html2canvas';

// --- ICONS ---
const Icons = {
    Text: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>,
    Image: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Shape: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    Layers: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    Settings: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Lock: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    Unlock: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>,
};

export const StudioDesign: React.FC = () => {
    const [templates, setTemplates] = useState<BackgroundTemplate[]>([]);
    const [currentTemplate, setCurrentTemplate] = useState<BackgroundTemplate | null>(null);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'editor'>('list');
    const canvasRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        const data = await getAllDesignTemplates();
        setTemplates(data);
    };

    const handleCreateNew = () => {
        const newTemplate: BackgroundTemplate = {
            id: `tpl_${Date.now()}`,
            name: 'New Template',
            thumbnailUrl: '',
            frameId: 'lg',
            layers: [],
            canvasColor: '#ffffff',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setCurrentTemplate(newTemplate);
        setView('editor');
    };

    const handleEditTemplate = (tpl: BackgroundTemplate) => {
        setCurrentTemplate(JSON.parse(JSON.stringify(tpl))); // Deep copy
        setView('editor');
    };

    const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Xóa template này?')) {
            await deleteDesignTemplate(id);
            loadTemplates();
        }
    };

    const handleSave = async () => {
        if (!currentTemplate) return;
        setIsSaving(true);

        try {
            // Generate Thumbnail
            if (canvasRef.current) {
                // Temporary hide selection outlines
                setSelectedLayerId(null);
                await new Promise(resolve => setTimeout(resolve, 100)); // Wait for render

                const canvas = await html2canvas(canvasRef.current, { 
                    backgroundColor: null, 
                    scale: 0.5,
                    useCORS: true
                });
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
                if (blob) {
                    const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
                    const url = await uploadToCloudinary(file);
                    if (url) currentTemplate.thumbnailUrl = url;
                }
            }

            await saveDesignTemplate(currentTemplate);
            await loadTemplates();
            setView('list');
        } catch (error) {
            console.error(error);
            alert('Lỗi lưu template');
        } finally {
            setIsSaving(false);
        }
    };

    const addLayer = (type: 'text' | 'image' | 'shape', src?: string) => {
        if (!currentTemplate) return;
        const newLayer: DesignLayer = {
            id: `layer_${Date.now()}`,
            type,
            name: type === 'text' ? 'Text Layer' : type === 'image' ? 'Image Layer' : 'Shape Layer',
            x: 50, y: 50, width: 20, height: 10,
            rotation: 0,
            zIndex: currentTemplate.layers.length + 1,
            opacity: 1,
            visible: true,
            isLocked: false,
            allowContentEdit: true,
            allowStyleEdit: true,
            text: type === 'text' ? 'Enter text' : undefined,
            fontSize: 24,
            fontFamily: 'Montserrat',
            color: '#000000',
            textAlign: 'center',
            src: src,
            shapeType: type === 'shape' ? 'rectangle' : undefined,
            backgroundColor: type === 'shape' ? '#cccccc' : undefined
        };
        
        // Specific Defaults
        if (type === 'image') {
            newLayer.width = 30;
            newLayer.height = 30; // Aspect ratio fixed later?
        }
        if (type === 'shape') {
            newLayer.width = 20;
            newLayer.height = 20;
        }

        setCurrentTemplate({
            ...currentTemplate,
            layers: [...currentTemplate.layers, newLayer]
        });
        setSelectedLayerId(newLayer.id);
    };

    const updateLayer = (id: string, updates: Partial<DesignLayer>) => {
        if (!currentTemplate) return;
        setCurrentTemplate({
            ...currentTemplate,
            layers: currentTemplate.layers.map(l => l.id === id ? { ...l, ...updates } : l)
        });
    };

    const deleteLayer = (id: string) => {
        if (!currentTemplate) return;
        setCurrentTemplate({
            ...currentTemplate,
            layers: currentTemplate.layers.filter(l => l.id !== id)
        });
        setSelectedLayerId(null);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const url = await uploadToCloudinary(e.target.files[0]);
            if (url) addLayer('image', url);
        }
    };

    const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0] && currentTemplate) {
            const url = await uploadToCloudinary(e.target.files[0]);
            if (url) setCurrentTemplate({...currentTemplate, canvasImage: url});
        }
    };

    // --- RENDER LIST VIEW ---
    if (view === 'list') {
        return (
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Thư viện Template</h2>
                    <button onClick={handleCreateNew} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-black">+ Tạo Template Mới</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {templates.map(tpl => (
                        <div key={tpl.id} onClick={() => handleEditTemplate(tpl)} className="group bg-white border rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all hover:ring-2 hover:ring-blue-500 relative">
                            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                                {tpl.thumbnailUrl ? (
                                    <img src={tpl.thumbnailUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-gray-400 text-xs">No Preview</span>
                                )}
                            </div>
                            <div className="p-3">
                                <h4 className="font-bold text-sm truncate">{tpl.name}</h4>
                                <p className="text-xs text-gray-500">Frame: {tpl.frameId}</p>
                            </div>
                            <button onClick={(e) => handleDeleteTemplate(tpl.id, e)} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- RENDER EDITOR VIEW ---
    if (!currentTemplate) return null;

    const selectedLayer = currentTemplate.layers.find(l => l.id === selectedLayerId);
    const frame = FRAME_OPTIONS.find(f => f.id === currentTemplate.frameId) || FRAME_OPTIONS[0];
    
    // Canvas Dimension Logic (Scale to fit)
    const CANVAS_BASE_SIZE = 500;
    const aspectRatio = frame.backgroundWidthCm / frame.backgroundHeightCm;
    const canvasWidth = aspectRatio >= 1 ? CANVAS_BASE_SIZE : CANVAS_BASE_SIZE * aspectRatio;
    const canvasHeight = aspectRatio >= 1 ? CANVAS_BASE_SIZE / aspectRatio : CANVAS_BASE_SIZE;

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 border-t border-gray-200 -mx-6 -my-8 overflow-hidden">
            {/* 1. LEFT TOOLBAR */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm">
                <div className="p-4 border-b">
                    <button onClick={() => setView('list')} className="text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-4">
                        &larr; Quay lại
                    </button>
                    <h3 className="font-bold text-gray-800">Công cụ</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2">
                    <button onClick={() => addLayer('text')} className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors">
                        <Icons.Text />
                        <span className="text-xs font-bold mt-1">Thêm Chữ</span>
                    </button>
                    <label className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer">
                        <Icons.Image />
                        <span className="text-xs font-bold mt-1">Thêm Ảnh</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    <button onClick={() => addLayer('shape')} className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors">
                        <Icons.Shape />
                        <span className="text-xs font-bold mt-1">Hình Khối</span>
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 border-t">
                    <h4 className="font-bold text-xs text-gray-500 uppercase mb-2 flex items-center gap-2">
                        <Icons.Layers /> Layers ({currentTemplate.layers.length})
                    </h4>
                    <div className="space-y-1">
                        {[...currentTemplate.layers].reverse().map((layer) => (
                            <div 
                                key={layer.id}
                                onClick={() => setSelectedLayerId(layer.id)}
                                className={`p-2 rounded text-sm flex justify-between items-center cursor-pointer border ${selectedLayerId === layer.id ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="opacity-50">{layer.type === 'text' ? 'T' : layer.type === 'image' ? 'IMG' : 'S'}</span>
                                    <span className="truncate max-w-[100px]">{layer.name || layer.text || 'Unnamed'}</span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { isLocked: !layer.isLocked }); }} className={`p-1 rounded hover:bg-gray-200 ${layer.isLocked ? 'text-red-500' : 'text-gray-300'}`}>
                                        {layer.isLocked ? <Icons.Lock /> : <Icons.Unlock />}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500">×</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. CENTER CANVAS AREA */}
            <div className="flex-grow flex flex-col bg-gray-100 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center p-8 overflow-auto">
                    <div 
                        ref={canvasRef}
                        className="bg-white shadow-2xl relative transition-all"
                        style={{ 
                            width: canvasWidth, 
                            height: canvasHeight,
                            backgroundColor: currentTemplate.canvasColor,
                            backgroundImage: currentTemplate.canvasImage ? `url(${currentTemplate.canvasImage})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                        onClick={() => setSelectedLayerId(null)}
                    >
                        {/* Canvas Overlay if Image */}
                        
                        {currentTemplate.layers.map(layer => (
                            <StudioLayerComponent 
                                key={layer.id} 
                                layer={layer} 
                                isSelected={selectedLayerId === layer.id}
                                onSelect={() => setSelectedLayerId(layer.id)}
                                onChange={(updates) => updateLayer(layer.id, updates)}
                                containerSize={{ width: canvasWidth, height: canvasHeight }}
                            />
                        ))}
                    </div>
                </div>
                
                {/* Bottom Bar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-2 rounded-full shadow-lg flex gap-4 items-center">
                    <button onClick={() => setView('list')} className="text-sm font-medium text-gray-500 hover:text-red-500">Hủy</button>
                    <div className="h-4 w-px bg-gray-300"></div>
                    <span className="text-xs text-gray-400">
                        {frame.name} ({frame.backgroundWidthCm}x{frame.backgroundHeightCm}cm)
                    </span>
                    <div className="h-4 w-px bg-gray-300"></div>
                    <button onClick={handleSave} disabled={isSaving} className="bg-gray-900 text-white px-4 py-1.5 rounded-full text-sm font-bold hover:bg-black disabled:opacity-50">
                        {isSaving ? 'Đang lưu...' : 'Lưu Template'}
                    </button>
                </div>
            </div>

            {/* 3. RIGHT PROPERTIES PANEL */}
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col z-10 shadow-sm overflow-y-auto custom-scrollbar">
                <div className="p-4 border-b">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Icons.Settings /> Thuộc tính
                    </h3>
                </div>
                
                <div className="p-4 space-y-6">
                    {/* General Template Settings */}
                    {!selectedLayer && (
                        <>
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Tên Template</label>
                                <input value={currentTemplate.name} onChange={e => setCurrentTemplate({...currentTemplate, name: e.target.value})} className="w-full border rounded p-2 text-sm" />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Khung áp dụng</label>
                                <select value={currentTemplate.frameId} onChange={e => setCurrentTemplate({...currentTemplate, frameId: e.target.value})} className="w-full border rounded p-2 text-sm">
                                    {FRAME_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Màu nền Canvas</label>
                                <div className="flex gap-2">
                                    <input type="color" value={currentTemplate.canvasColor} onChange={e => setCurrentTemplate({...currentTemplate, canvasColor: e.target.value, canvasImage: ''})} className="w-8 h-8 rounded cursor-pointer border-none" />
                                    <input value={currentTemplate.canvasColor} onChange={e => setCurrentTemplate({...currentTemplate, canvasColor: e.target.value, canvasImage: ''})} className="w-full border rounded p-1 text-sm uppercase" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Hoặc Ảnh nền</label>
                                <input type="file" accept="image/*" onChange={handleBgImageUpload} className="text-xs" />
                                {currentTemplate.canvasImage && (
                                    <div className="relative mt-2 rounded overflow-hidden border">
                                        <img src={currentTemplate.canvasImage} className="w-full h-20 object-cover" />
                                        <button onClick={() => setCurrentTemplate({...currentTemplate, canvasImage: ''})} className="absolute top-1 right-1 bg-white text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs shadow">×</button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Layer Specific Settings */}
                    {selectedLayer && (
                        <>
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Tên Layer</label>
                                <input value={selectedLayer.name} onChange={e => updateLayer(selectedLayer.id, { name: e.target.value })} className="w-full border rounded p-2 text-sm" />
                            </div>

                            {/* Position */}
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="text-[10px] text-gray-400 uppercase">X (%)</label><input type="number" value={Math.round(selectedLayer.x)} onChange={e => updateLayer(selectedLayer.id, { x: Number(e.target.value) })} className="w-full border rounded p-1 text-sm" /></div>
                                <div><label className="text-[10px] text-gray-400 uppercase">Y (%)</label><input type="number" value={Math.round(selectedLayer.y)} onChange={e => updateLayer(selectedLayer.id, { y: Number(e.target.value) })} className="w-full border rounded p-1 text-sm" /></div>
                                <div><label className="text-[10px] text-gray-400 uppercase">Width</label><input type="number" value={Math.round(selectedLayer.width || 0)} onChange={e => updateLayer(selectedLayer.id, { width: Number(e.target.value) })} className="w-full border rounded p-1 text-sm" /></div>
                                <div><label className="text-[10px] text-gray-400 uppercase">Rotation</label><input type="number" value={Math.round(selectedLayer.rotation)} onChange={e => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })} className="w-full border rounded p-1 text-sm" /></div>
                            </div>

                            {/* Appearance */}
                            <div className="border-t pt-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Giao diện</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center"><label className="text-sm">Opacity</label><input type="range" min="0" max="1" step="0.1" value={selectedLayer.opacity} onChange={e => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })} className="w-20" /></div>
                                    
                                    {selectedLayer.type === 'text' && (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1">Nội dung mẫu</label>
                                                <textarea value={selectedLayer.text} onChange={e => updateLayer(selectedLayer.id, { text: e.target.value })} className="w-full border rounded p-2 text-sm" rows={2} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className="text-[10px] text-gray-400 block">Font Size</label><input type="number" value={selectedLayer.fontSize} onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })} className="w-full border rounded p-1 text-sm" /></div>
                                                <div><label className="text-[10px] text-gray-400 block">Color</label><input type="color" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })} className="w-full h-7 rounded cursor-pointer border-none" /></div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 block mb-1">Font Family</label>
                                                <select value={selectedLayer.fontFamily} onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })} className="w-full border rounded p-1 text-sm">
                                                    <option value="Montserrat">Montserrat</option>
                                                    <option value="Playfair Display">Playfair Display</option>
                                                    <option value="Dancing Script">Dancing Script</option>
                                                    <option value="Roboto">Roboto</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 block mb-1">Align</label>
                                                <div className="flex border rounded overflow-hidden">
                                                    {['left', 'center', 'right'].map(align => (
                                                        <button key={align} onClick={() => updateLayer(selectedLayer.id, { textAlign: align as any })} className={`flex-1 p-1 text-xs capitalize ${selectedLayer.textAlign === align ? 'bg-blue-100 text-blue-600' : 'bg-white'}`}>{align}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {selectedLayer.type === 'shape' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="text-[10px] text-gray-400 block">Fill Color</label><input type="color" value={selectedLayer.backgroundColor} onChange={e => updateLayer(selectedLayer.id, { backgroundColor: e.target.value })} className="w-full h-7 rounded" /></div>
                                            <div><label className="text-[10px] text-gray-400 block">Radius</label><input type="number" value={selectedLayer.borderRadius || 0} onChange={e => updateLayer(selectedLayer.id, { borderRadius: Number(e.target.value) })} className="w-full border rounded p-1 text-sm" /></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Constraints */}
                            <div className="border-t pt-4 bg-yellow-50 -mx-4 px-4 pb-4">
                                <h4 className="text-xs font-bold text-yellow-800 uppercase mb-3 flex items-center gap-1">🔒 Quyền hạn Khách hàng</h4>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={selectedLayer.isLocked} onChange={e => updateLayer(selectedLayer.id, { isLocked: e.target.checked })} className="rounded text-yellow-600 focus:ring-yellow-500" />
                                        <span className="text-sm">Khóa vị trí (Không cho di chuyển)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={selectedLayer.allowContentEdit} onChange={e => updateLayer(selectedLayer.id, { allowContentEdit: e.target.checked })} className="rounded text-yellow-600 focus:ring-yellow-500" />
                                        <span className="text-sm">Cho phép sửa nội dung/ảnh</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={selectedLayer.allowStyleEdit} onChange={e => updateLayer(selectedLayer.id, { allowStyleEdit: e.target.checked })} className="rounded text-yellow-600 focus:ring-yellow-500" />
                                        <span className="text-sm">Cho phép đổi Font/Màu</span>
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- HELPER COMPONENT: StudioLayerComponent ---
// Handles Dragging, Resizing, and Rendering of a single layer
const StudioLayerComponent: React.FC<{
    layer: DesignLayer;
    isSelected: boolean;
    onSelect: () => void;
    onChange: (updates: Partial<DesignLayer>) => void;
    containerSize: { width: number, height: number };
}> = ({ layer, isSelected, onSelect, onChange, containerSize }) => {
    
    // Convert % to pixels for interaction
    const widthPx = (layer.width! / 100) * containerSize.width;
    // For height, if it's text, auto. If image/shape, % relative to canvas HEIGHT.
    const heightPx = layer.type === 'text' ? 'auto' : (layer.height! / 100) * containerSize.height; 
    const xPx = (layer.x / 100) * containerSize.width;
    const yPx = (layer.y / 100) * containerSize.height;

    // --- Simple Drag Logic ---
    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const initialX = layer.x;
        const initialY = layer.y;

        const handleMouseMove = (me: MouseEvent) => {
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;
            
            // Convert pixel delta to percentage delta
            const dxPercent = (dx / containerSize.width) * 100;
            const dyPercent = (dy / containerSize.height) * 100;

            onChange({
                x: initialX + dxPercent,
                y: initialY + dyPercent
            });
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // --- Simple Resize Logic (Bottom Right Handle) ---
    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        const startX = e.clientX;
        const initialWidth = layer.width || 10;
        // height resize logic omitted for brevity in text, added for shapes/images if needed

        const handleMouseMove = (me: MouseEvent) => {
            const dx = me.clientX - startX;
            const dxPercent = (dx / containerSize.width) * 100;
            onChange({ width: Math.max(5, initialWidth + dxPercent) });
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            className={`absolute group cursor-move select-none ${isSelected ? 'z-50' : ''}`}
            style={{
                left: `${layer.x}%`,
                top: `${layer.y}%`,
                width: layer.type === 'text' ? `${layer.width}%` : widthPx,
                height: layer.type === 'text' ? 'auto' : heightPx,
                transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                opacity: layer.opacity,
                zIndex: layer.zIndex,
                display: layer.visible ? 'block' : 'none'
            }}
        >
            {/* Outline on Select or Hover */}
            <div className={`absolute inset-0 border-2 transition-colors pointer-events-none ${isSelected ? 'border-blue-500' : 'border-transparent group-hover:border-blue-300 border-dashed'}`}></div>

            {/* CONTENT RENDER */}
            <div className="w-full h-full overflow-hidden flex items-center justify-center">
                {layer.type === 'text' && (
                    <div style={{
                        fontSize: `${layer.fontSize}px`,
                        fontFamily: layer.fontFamily,
                        color: layer.color,
                        textAlign: layer.textAlign,
                        width: '100%',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.2
                    }}>
                        {layer.text}
                    </div>
                )}
                {layer.type === 'image' && (
                    <img src={layer.src} className="w-full h-full object-cover pointer-events-none" />
                )}
                {layer.type === 'shape' && (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: layer.backgroundColor,
                        borderRadius: `${layer.borderRadius}px`,
                        border: `${layer.borderWidth}px solid ${layer.borderColor}`
                    }}></div>
                )}
            </div>

            {/* CONTROLS (Only when selected) */}
            {isSelected && (
                <>
                    {/* Resize Handle */}
                    <div 
                        onMouseDown={handleResizeStart}
                        className="absolute bottom-0 right-0 w-4 h-4 bg-white border border-blue-500 rounded-full cursor-nwse-resize z-50 transform translate-x-1/2 translate-y-1/2 shadow-sm"
                    ></div>
                    
                    {/* Rotate Handle (Simple Top) */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-blue-500"></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full cursor-grab shadow-sm"></div>
                </>
            )}
        </div>
    );
};
