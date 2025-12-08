
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PresetBackground, TextLayer, CustomFont } from '../../types';
import { updateBackground } from '../../services/backgroundService';
import { getStoreConfig } from '../../services/configService';

interface AdminDesignStudioProps {
    background: PresetBackground;
    onClose: () => void;
    onSave: () => void;
}

// Base fonts + loaded custom fonts
const DEFAULT_FONTS = [
    'Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 
    'Dancing Script', 'Lora', 'Nunito', 'Pacifico'
];

export const AdminDesignStudio: React.FC<AdminDesignStudioProps> = ({ background, onClose, onSave }) => {
    const [layers, setLayers] = useState<TextLayer[]>(background.textLayers || []);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [availableFonts, setAvailableFonts] = useState<string[]>(DEFAULT_FONTS);
    const [zoom, setZoom] = useState(1);
    
    // Canvas Refs
    const canvasRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        const loadFonts = async () => {
            const config = await getStoreConfig();
            if (config && config.uploadedFonts) {
                const customFonts = config.uploadedFonts.map(f => f.name);
                setAvailableFonts([...DEFAULT_FONTS, ...customFonts]);
            }
        };
        loadFonts();
    }, []);

    // Helper: Add new text layer
    const addTextLayer = () => {
        const newLayer: TextLayer = {
            id: `layer_${Date.now()}`,
            label: 'Nhập tên...',
            defaultText: 'Your Text Here',
            x: 50,
            y: 50,
            fontSize: 24,
            fontFamily: 'Montserrat',
            color: '#000000',
            textAlign: 'center',
            rotation: 0,
            maxWidth: 80
        };
        setLayers([...layers, newLayer]);
        setSelectedLayerId(newLayer.id);
    };

    // Helper: Update layer
    const updateLayer = (id: string, updates: Partial<TextLayer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    // Helper: Delete layer
    const deleteLayer = (id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        setSelectedLayerId(null);
    };

    // Save Changes
    const handleSave = async () => {
        const updatedBackground = {
            ...background,
            textLayers: layers
        };
        const success = await updateBackground(background.id, updatedBackground);
        if (success) {
            alert("Đã lưu thiết kế Template thành công!");
            onSave();
        } else {
            alert("Lỗi khi lưu Template.");
        }
    };

    // --- DRAG LOGIC ---
    const [isDragging, setIsDragging] = useState(false);
    
    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedLayerId(id);
        setIsDragging(true);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !selectedLayerId || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        updateLayer(selectedLayerId, { 
            x: Math.max(0, Math.min(100, x)), 
            y: Math.max(0, Math.min(100, y)) 
        });
    }, [isDragging, selectedLayerId]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);

    const selectedLayer = layers.find(l => l.id === selectedLayerId);

    return (
        <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col animate-fade-in font-sans text-gray-900">
            {/* 1. Header Toolbar */}
            <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 font-bold text-sm">
                        &larr; Quay lại
                    </button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <h2 className="text-lg font-bold">Studio Design: <span className="font-normal text-gray-600">{background.name}</span></h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
                        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded font-bold">-</button>
                        <span className="w-12 flex items-center justify-center text-xs font-bold">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded font-bold">+</button>
                    </div>
                    <button onClick={addTextLayer} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 flex items-center gap-2">
                        <span className="text-lg">+</span> Thêm vùng chữ
                    </button>
                    <button onClick={handleSave} className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-black shadow-lg">
                        Lưu Template
                    </button>
                </div>
            </div>

            {/* 2. Main Workspace */}
            <div className="flex-grow flex overflow-hidden">
                
                {/* CANVAS AREA */}
                <div className="flex-grow bg-gray-200 overflow-auto flex items-center justify-center p-10 relative" ref={containerRef} onClick={() => setSelectedLayerId(null)}>
                    <div 
                        ref={canvasRef}
                        className="relative bg-white shadow-2xl transition-transform duration-200 ease-out"
                        style={{
                            width: background.type === 'square' ? '600px' : '400px',
                            aspectRatio: background.type === 'square' ? '1/1' : (background.orientation === 'landscape' ? '3/2' : '2/3'),
                            transform: `scale(${zoom})`,
                            backgroundImage: `url(${background.url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    >
                        {/* Layers Overlay */}
                        {layers.map(layer => (
                            <div
                                key={layer.id}
                                onMouseDown={(e) => handleMouseDown(e, layer.id)}
                                className={`absolute cursor-move group select-none hover:outline hover:outline-1 hover:outline-blue-400 ${selectedLayerId === layer.id ? 'outline outline-2 outline-blue-600 z-10' : 'z-0'}`}
                                style={{
                                    left: `${layer.x}%`,
                                    top: `${layer.y}%`,
                                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                                    maxWidth: `${layer.maxWidth}%`,
                                    minWidth: '50px',
                                }}
                            >
                                <div 
                                    className="px-2 py-1"
                                    style={{
                                        fontFamily: layer.fontFamily,
                                        fontSize: `${layer.fontSize}px`,
                                        color: layer.color,
                                        textAlign: layer.textAlign,
                                        fontWeight: layer.fontWeight,
                                        fontStyle: layer.fontStyle,
                                        lineHeight: 1.2,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    {layer.defaultText}
                                </div>
                                
                                {/* Helper UI shown when selected */}
                                {selectedLayerId === layer.id && (
                                    <>
                                        <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">
                                            {layer.label}
                                        </div>
                                        {/* Resize / Rotate Handles could go here in V2 */}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT SIDEBAR: PROPERTIES */}
                <div className="w-80 bg-white border-l shadow-xl z-20 flex flex-col">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-bold text-gray-800">Thuộc tính Layer</h3>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-4">
                        {selectedLayer ? (
                            <div className="space-y-6">
                                {/* Content Section */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Thông tin nhập liệu</label>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-xs text-gray-600 block mb-1">Nhãn (Label - Khách sẽ thấy)</span>
                                            <input 
                                                className="w-full border p-2 rounded text-sm font-bold text-blue-600" 
                                                value={selectedLayer.label}
                                                onChange={e => updateLayer(selectedLayer.id, { label: e.target.value })}
                                                placeholder="VD: Tên của bạn"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-600 block mb-1">Nội dung mẫu (Preview)</span>
                                            <textarea 
                                                className="w-full border p-2 rounded text-sm" 
                                                value={selectedLayer.defaultText}
                                                onChange={e => updateLayer(selectedLayer.id, { defaultText: e.target.value })}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <hr/>

                                {/* Style Section */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Giao diện chữ</label>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-xs text-gray-600 block mb-1">Font chữ</span>
                                                <select 
                                                    className="w-full border p-2 rounded text-sm"
                                                    value={selectedLayer.fontFamily}
                                                    onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                                                >
                                                    {availableFonts.map(f => <option key={f} value={f} style={{fontFamily: f}}>{f}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-600 block mb-1">Màu sắc</span>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="color" 
                                                        className="w-8 h-9 p-0 border rounded cursor-pointer"
                                                        value={selectedLayer.color}
                                                        onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}
                                                    />
                                                    <input 
                                                        className="w-full border p-2 rounded text-xs uppercase"
                                                        value={selectedLayer.color}
                                                        onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-xs text-gray-600 block mb-1">Cỡ chữ (px)</span>
                                                <input 
                                                    type="number"
                                                    className="w-full border p-2 rounded text-sm"
                                                    value={selectedLayer.fontSize}
                                                    onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-600 block mb-1">Góc xoay (độ)</span>
                                                <input 
                                                    type="number"
                                                    className="w-full border p-2 rounded text-sm"
                                                    value={selectedLayer.rotation}
                                                    onChange={e => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-max">
                                            {['left', 'center', 'right'].map(align => (
                                                <button
                                                    key={align}
                                                    onClick={() => updateLayer(selectedLayer.id, { textAlign: align as any })}
                                                    className={`p-1.5 rounded ${selectedLayer.textAlign === align ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
                                                >
                                                    {align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <hr/>

                                {/* Actions */}
                                <div>
                                    <button 
                                        onClick={() => deleteLayer(selectedLayer.id)}
                                        className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
                                    >
                                        Xóa Layer này
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <p className="mb-4">Chọn một vùng chữ để chỉnh sửa</p>
                                <button onClick={addTextLayer} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">
                                    + Thêm vùng chữ
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Layer List (Quick Select) */}
                    <div className="border-t max-h-48 overflow-y-auto bg-gray-50 p-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 px-2">Danh sách layers</p>
                        {layers.map((layer, idx) => (
                            <div 
                                key={layer.id}
                                onClick={() => setSelectedLayerId(layer.id)}
                                className={`flex items-center justify-between px-3 py-2 rounded mb-1 cursor-pointer text-sm ${selectedLayerId === layer.id ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'hover:bg-white text-gray-600 border border-transparent'}`}
                            >
                                <span className="truncate font-medium">{idx + 1}. {layer.label}</span>
                                <span className="text-[10px] opacity-60 ml-2 truncate max-w-[80px]">{layer.defaultText}</span>
                            </div>
                        ))}
                        {layers.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Chưa có layer nào.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
