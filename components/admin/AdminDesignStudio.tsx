
import React, { useState, useRef, useEffect } from 'react';
import { PresetBackground, BackgroundLayer } from '../../types';
import { uploadToCloudinary } from '../../services/uploadService';

interface AdminDesignStudioProps {
    initialData?: PresetBackground | null;
    onSave: (bg: PresetBackground) => void;
    onCancel: () => void;
}

// Reuse fonts from main config or generic list
const FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Dancing Script', 'Pacifico', 'Merriweather'];

export const AdminDesignStudio: React.FC<AdminDesignStudioProps> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<PresetBackground>(initialData || {
        id: `bg_${Date.now()}`, 
        name: '', 
        url: '', 
        category: 'Mẫu có chữ', 
        type: 'square', 
        orientation: 'portrait',
        layers: []
    });
    
    const [isUploading, setIsUploading] = useState(false);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- Basic Form Handlers ---
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) setFormData(prev => ({ ...prev, url }));
            } catch (error) {
                console.error(error);
                alert("Lỗi upload ảnh");
            } finally {
                setIsUploading(false);
            }
        }
    };

    // --- Layer Logic ---
    const addTextLayer = () => {
        const newLayer: BackgroundLayer = {
            id: `layer_${Date.now()}`,
            type: 'text',
            content: 'Nhập nội dung...',
            x: 50,
            y: 50,
            font: 'Montserrat',
            size: 20,
            color: '#000000',
            rotation: 0,
            textAlign: 'center',
            background: false
        };
        setFormData(prev => ({ ...prev, layers: [...(prev.layers || []), newLayer] }));
        setActiveLayerId(newLayer.id);
    };

    const updateLayer = (id: string, updates: Partial<BackgroundLayer>) => {
        setFormData(prev => ({
            ...prev,
            layers: (prev.layers || []).map(l => l.id === id ? { ...l, ...updates } : l)
        }));
    };

    const removeLayer = (id: string) => {
        setFormData(prev => ({
            ...prev,
            layers: (prev.layers || []).filter(l => l.id !== id)
        }));
        if (activeLayerId === id) setActiveLayerId(null);
    };

    // --- Drag Logic ---
    const handleDragStart = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setActiveLayerId(id);
        const layer = formData.layers?.find(l => l.id === id);
        if (!layer || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLayerX = layer.x;
        const startLayerY = layer.y;

        const handleMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            
            // Convert pixels to percentage
            const percentX = (dx / containerRect.width) * 100;
            const percentY = (dy / containerRect.height) * 100;

            updateLayer(id, {
                x: Math.max(0, Math.min(100, startLayerX + percentX)),
                y: Math.max(0, Math.min(100, startLayerY + percentY))
            });
        };

        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    };

    const activeLayer = formData.layers?.find(l => l.id === activeLayerId);

    // Dynamic styles for container aspect ratio
    const containerAspect = formData.type === 'square' ? 'aspect-square' : (formData.orientation === 'landscape' ? 'aspect-[3/2]' : 'aspect-[2/3]');

    return (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-5xl mx-auto h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-800">Studio Thiết Kế Nền Mẫu (Design Studio)</h3>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="text-gray-600 hover:bg-gray-200 px-4 py-2 rounded text-sm font-bold">Thoát</button>
                    <button onClick={() => onSave(formData)} disabled={!formData.url} className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg">Lưu Mẫu</button>
                </div>
            </div>

            <div className="flex-grow flex overflow-hidden">
                {/* Left Panel: Settings */}
                <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto flex-shrink-0">
                    <h4 className="font-bold text-sm text-gray-500 uppercase mb-4">1. Cấu hình Nền</h4>
                    <div className="space-y-4 mb-6 border-b pb-6 border-gray-200">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Tên mẫu</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded text-sm" placeholder="VD: Sinh nhật (Có tên)" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Danh mục</label>
                            <input name="category" value={formData.category} onChange={handleChange} className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Loại khung</label>
                                <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded text-sm">
                                    <option value="square">Vuông</option>
                                    <option value="rectangle">Chữ nhật</option>
                                </select>
                            </div>
                            {formData.type === 'rectangle' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Hướng</label>
                                    <select name="orientation" value={formData.orientation} onChange={handleChange} className="w-full p-2 border rounded text-sm">
                                        <option value="portrait">Dọc</option>
                                        <option value="landscape">Ngang</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Ảnh nền gốc (Chưa có chữ)</label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded bg-white p-2 text-center hover:bg-gray-50 cursor-pointer">
                                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
                                {isUploading ? <span className="text-xs">Đang tải...</span> : formData.url ? <img src={formData.url} className="h-20 mx-auto object-contain" /> : <span className="text-xs text-gray-400">Chọn ảnh</span>}
                            </div>
                        </div>
                    </div>

                    <h4 className="font-bold text-sm text-gray-500 uppercase mb-4 flex justify-between items-center">
                        2. Lớp Văn Bản
                        <button onClick={addTextLayer} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">+ Thêm</button>
                    </h4>
                    
                    {activeLayer ? (
                        <div className="space-y-3 bg-white p-3 rounded border border-blue-200 shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-blue-600">Đang sửa Layer</span>
                                <button onClick={() => removeLayer(activeLayer.id)} className="text-red-500 text-xs hover:underline">Xóa</button>
                            </div>
                            <textarea 
                                value={activeLayer.content} 
                                onChange={(e) => updateLayer(activeLayer.id, { content: e.target.value })} 
                                className="w-full p-2 border rounded text-sm font-bold"
                                rows={2}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500">Font</label>
                                    <select 
                                        value={activeLayer.font} 
                                        onChange={(e) => updateLayer(activeLayer.id, { font: e.target.value })} 
                                        className="w-full p-1 border rounded text-xs"
                                    >
                                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500">Cỡ chữ (px)</label>
                                    <input 
                                        type="number" 
                                        value={activeLayer.size} 
                                        onChange={(e) => updateLayer(activeLayer.id, { size: Number(e.target.value) })} 
                                        className="w-full p-1 border rounded text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500">Màu chữ</label>
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="color" 
                                            value={activeLayer.color} 
                                            onChange={(e) => updateLayer(activeLayer.id, { color: e.target.value })} 
                                            className="w-6 h-6 border-0 p-0 rounded cursor-pointer"
                                        />
                                        <span className="text-xs">{activeLayer.color}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500">Căn lề</label>
                                    <select 
                                        value={activeLayer.textAlign} 
                                        onChange={(e) => updateLayer(activeLayer.id, { textAlign: e.target.value as any })} 
                                        className="w-full p-1 border rounded text-xs"
                                    >
                                        <option value="left">Trái</option>
                                        <option value="center">Giữa</option>
                                        <option value="right">Phải</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={activeLayer.background || false} 
                                    onChange={(e) => updateLayer(activeLayer.id, { background: e.target.checked })}
                                    id="bg-check"
                                />
                                <label htmlFor="bg-check" className="text-xs">Nền mờ</label>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic text-center">Chọn một lớp chữ trên ảnh để chỉnh sửa.</p>
                    )}
                </div>

                {/* Main Canvas Area */}
                <div className="flex-grow bg-gray-200 flex items-center justify-center p-8 overflow-auto relative">
                    <div 
                        ref={containerRef}
                        className={`relative bg-white shadow-2xl transition-all duration-300 ${containerAspect}`}
                        style={{ 
                            height: '100%', 
                            maxHeight: '600px',
                            width: 'auto',
                            backgroundImage: formData.url.startsWith('#') ? 'none' : `url(${formData.url})`,
                            backgroundColor: formData.url.startsWith('#') ? formData.url : '#ffffff',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                        onClick={() => setActiveLayerId(null)}
                    >
                        {!formData.url && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold border-2 border-dashed border-gray-300 m-4">
                                Preview Area
                            </div>
                        )}

                        {/* Render Layers */}
                        {formData.layers?.map(layer => (
                            <div
                                key={layer.id}
                                onMouseDown={(e) => handleDragStart(e, layer.id)}
                                onClick={(e) => { e.stopPropagation(); setActiveLayerId(layer.id); }}
                                className={`absolute cursor-move select-none p-2 ${activeLayerId === layer.id ? 'ring-2 ring-blue-500 z-10' : 'hover:ring-1 hover:ring-blue-300'}`}
                                style={{
                                    left: `${layer.x}%`,
                                    top: `${layer.y}%`,
                                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                                    fontFamily: layer.font,
                                    fontSize: `${layer.size}px`, // Simplified scaling logic for admin preview
                                    color: layer.color,
                                    textAlign: layer.textAlign || 'center',
                                    backgroundColor: layer.background ? 'rgba(255,255,255,0.7)' : 'transparent',
                                    borderRadius: '4px',
                                    whiteSpace: 'pre-wrap',
                                    minWidth: '50px'
                                }}
                            >
                                {layer.content}
                            </div>
                        ))}
                    </div>
                    
                    <div className="absolute bottom-4 right-4 bg-white/90 p-2 rounded text-xs text-gray-500 shadow pointer-events-none">
                        Kéo thả để di chuyển chữ.
                    </div>
                </div>
            </div>
        </div>
    );
};
