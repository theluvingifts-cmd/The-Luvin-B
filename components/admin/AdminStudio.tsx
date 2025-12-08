
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BackgroundTemplate, TemplateTextLayer, CustomFont } from '../../types';
import { getAllDesignTemplates, addDesignTemplate, updateDesignTemplate, deleteDesignTemplate } from '../../services/designTemplateService';
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig } from '../../services/configService';

declare var html2canvas: any;

const PRESET_FONTS = [
    'Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 
    'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'
];

interface StudioTransformableProps {
    id: string;
    x: number; // percentage
    y: number; // percentage
    rotation: number;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onChange: (id: string, updates: Partial<TemplateTextLayer>) => void;
    children: React.ReactNode;
    containerRef: React.RefObject<HTMLDivElement>;
}

const StudioTransformable: React.FC<StudioTransformableProps> = ({ id, x, y, rotation, isSelected, onSelect, onChange, children, containerRef }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(id);
        
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = (x / 100) * containerRect.width;
        const startTop = (y / 100) * containerRect.height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            
            const newLeft = startLeft + dx;
            const newTop = startTop + dy;

            const newXPct = (newLeft / containerRect.width) * 100;
            const newYPct = (newTop / containerRect.height) * 100;

            onChange(id, { x: newXPct, y: newYPct });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            className={`absolute cursor-move select-none group ${isSelected ? 'z-50' : 'z-10'}`}
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                border: isSelected ? '1px dashed #3b82f6' : '1px dashed transparent',
                padding: '4px'
            }}
        >
            {children}
            {isSelected && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] px-1 rounded whitespace-nowrap pointer-events-none">
                    Drag to move
                </div>
            )}
        </div>
    );
};

export const AdminStudio: React.FC = () => {
    const [templates, setTemplates] = useState<BackgroundTemplate[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
    const [fonts, setFonts] = useState<string[]>(PRESET_FONTS);
    
    // Editor State
    const [currentTemplate, setCurrentTemplate] = useState<Partial<BackgroundTemplate>>({
        name: 'Mẫu mới',
        category: 'Chung',
        type: 'square',
        orientation: 'portrait',
        layers: [],
        baseImageUrl: ''
    });
    
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchTemplates();
        fetchFonts();
    }, []);

    const fetchTemplates = async () => {
        const data = await getAllDesignTemplates();
        setTemplates(data);
    };

    const fetchFonts = async () => {
        const config = await getStoreConfig();
        if (config && config.uploadedFonts) {
            const customFontNames = config.uploadedFonts.map(f => f.name);
            setFonts([...PRESET_FONTS, ...customFontNames]);
        }
    };

    const handleCreateNew = () => {
        setCurrentTemplate({
            id: `tpl_bg_${Date.now()}`,
            name: 'Mẫu thiết kế mới',
            category: 'Tình yêu',
            type: 'square',
            orientation: 'portrait',
            layers: [],
            baseImageUrl: '',
            createdAt: Date.now()
        });
        setViewMode('editor');
    };

    const handleEdit = (tpl: BackgroundTemplate) => {
        setCurrentTemplate({ ...tpl });
        setViewMode('editor');
    };

    const handleUploadBaseImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    // Auto detect orientation
                    const img = new Image();
                    img.onload = () => {
                        const isLandscape = img.width > img.height;
                        setCurrentTemplate(prev => ({ 
                            ...prev, 
                            baseImageUrl: url,
                            // Auto suggest type based on ratio, but let user override
                            type: Math.abs(img.width - img.height) < 10 ? 'square' : 'rectangle',
                            orientation: isLandscape ? 'landscape' : 'portrait'
                        }));
                    };
                    img.src = url;
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload ảnh");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleAddTextLayer = () => {
        const newLayer: TemplateTextLayer = {
            id: `layer_${Date.now()}`,
            label: 'Nhãn mới',
            content: 'Nội dung mẫu',
            font: 'Montserrat',
            size: 24,
            color: '#000000',
            x: 50,
            y: 50,
            rotation: 0,
            textAlign: 'center'
        };
        setCurrentTemplate(prev => ({
            ...prev,
            layers: [...(prev.layers || []), newLayer]
        }));
        setSelectedLayerId(newLayer.id);
    };

    const handleUpdateLayer = (id: string, updates: Partial<TemplateTextLayer>) => {
        setCurrentTemplate(prev => ({
            ...prev,
            layers: prev.layers?.map(l => l.id === id ? { ...l, ...updates } : l)
        }));
    };

    const handleDeleteLayer = (id: string) => {
        setCurrentTemplate(prev => ({
            ...prev,
            layers: prev.layers?.filter(l => l.id !== id)
        }));
        if (selectedLayerId === id) setSelectedLayerId(null);
    };

    const handleSaveTemplate = async () => {
        if (!currentTemplate.baseImageUrl) {
            alert("Vui lòng tải ảnh nền trước.");
            return;
        }
        if (!currentTemplate.name) {
            alert("Vui lòng đặt tên cho mẫu.");
            return;
        }

        setIsSaving(true);
        try {
            // Generate Thumbnail
            let thumbnailUrl = currentTemplate.baseImageUrl;
            if (canvasRef.current) {
                // Temporarily remove selection borders for screenshot
                const selected = selectedLayerId;
                setSelectedLayerId(null);
                
                // Wait for react to render changes
                await new Promise(r => setTimeout(r, 100));

                const canvas = await html2canvas(canvasRef.current, { useCORS: true, scale: 0.5 }); // Low res thumbnail
                const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
                if (blob) {
                    const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
                    const url = await uploadToCloudinary(file);
                    if (url) thumbnailUrl = url;
                }
                
                // Restore selection
                setSelectedLayerId(selected);
            }

            const templateData = {
                ...currentTemplate,
                thumbnailUrl,
                updatedAt: Date.now()
            } as BackgroundTemplate;

            if (templates.some(t => t.id === templateData.id)) {
                await updateDesignTemplate(templateData.id, templateData);
            } else {
                await addDesignTemplate(templateData);
            }

            await fetchTemplates();
            setViewMode('list');
            alert("Đã lưu mẫu thành công!");
        } catch (error) {
            console.error(error);
            alert("Lỗi khi lưu mẫu.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (confirm("Bạn có chắc chắn muốn xóa mẫu này?")) {
            await deleteDesignTemplate(id);
            fetchTemplates();
        }
    };

    // Calculate canvas size based on type
    const getCanvasStyle = () => {
        const baseWidth = 500; // px
        let width = baseWidth;
        let height = baseWidth;

        if (currentTemplate.type === 'rectangle') {
            if (currentTemplate.orientation === 'landscape') {
                height = baseWidth * 0.7; // A5 Landscape approx
            } else {
                height = baseWidth * 1.41; // A5 Portrait
                // If height gets too tall, scale down width
                if (height > 600) {
                    const scale = 600 / height;
                    height = 600;
                    width = baseWidth * scale;
                }
            }
        }
        return { width: `${width}px`, height: `${height}px` };
    };

    const selectedLayer = currentTemplate.layers?.find(l => l.id === selectedLayerId);

    if (viewMode === 'list') {
        return (
            <div className="animate-fade-in p-6">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Studio Thiết Kế Nền</h2>
                        <p className="text-sm text-gray-500">Tạo các mẫu nền động cho phép khách hàng chỉnh sửa thông tin.</p>
                    </div>
                    <button 
                        onClick={handleCreateNew}
                        className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg hover:bg-black transition-all flex items-center gap-2"
                    >
                        <span>+</span> Tạo Mẫu Mới
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {templates.map(tpl => (
                        <div key={tpl.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="aspect-square bg-gray-100 relative">
                                <img src={tpl.thumbnailUrl || tpl.baseImageUrl} className="w-full h-full object-cover" alt={tpl.name} />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => handleEdit(tpl)} className="bg-white text-gray-900 px-3 py-1.5 rounded-full text-xs font-bold hover:scale-105 transition-transform">Sửa</button>
                                    <button onClick={() => handleDeleteTemplate(tpl.id)} className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold hover:scale-105 transition-transform">Xóa</button>
                                </div>
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                                    {tpl.layers.length} layers
                                </div>
                            </div>
                            <div className="p-3">
                                <h3 className="font-bold text-gray-800 text-sm truncate">{tpl.name}</h3>
                                <p className="text-xs text-gray-500">{tpl.category} • {tpl.type}</p>
                            </div>
                        </div>
                    ))}
                    {templates.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed">
                            Chưa có mẫu nào. Hãy tạo mới!
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewMode('list')} className="text-gray-500 hover:text-gray-900 font-bold flex items-center gap-1 text-sm">
                        &larr; Quay lại
                    </button>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <input 
                        className="font-bold text-lg text-gray-900 border-none focus:ring-0 p-0 placeholder-gray-400"
                        value={currentTemplate.name}
                        onChange={(e) => setCurrentTemplate({...currentTemplate, name: e.target.value})}
                        placeholder="Tên mẫu thiết kế..."
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleSaveTemplate} 
                        disabled={isSaving}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
                        Lưu Mẫu
                    </button>
                </div>
            </div>

            <div className="flex-grow flex overflow-hidden">
                {/* Left Sidebar: Tools */}
                <div className="w-64 bg-white border-r flex flex-col overflow-y-auto z-10">
                    <div className="p-4 space-y-6">
                        {/* 1. Base Image */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">1. Ảnh Nền (Base)</h4>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                {currentTemplate.baseImageUrl ? (
                                    <div className="relative group">
                                        <img src={currentTemplate.baseImageUrl} className="w-full h-24 object-cover rounded shadow-sm" alt="Base" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity rounded">Đổi ảnh</div>
                                    </div>
                                ) : (
                                    <div className="text-gray-400 text-sm">
                                        {isUploading ? 'Đang tải...' : '+ Tải ảnh lên'}
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBaseImage} />
                            </div>
                        </div>

                        {/* 2. Configuration */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">2. Cấu hình khung</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-600 block mb-1">Loại khung</label>
                                    <select 
                                        className="w-full p-2 border rounded text-sm bg-gray-50"
                                        value={currentTemplate.type}
                                        onChange={(e) => setCurrentTemplate({...currentTemplate, type: e.target.value as any})}
                                    >
                                        <option value="square">Vuông (Square)</option>
                                        <option value="rectangle">Chữ nhật (Rect)</option>
                                    </select>
                                </div>
                                {currentTemplate.type === 'rectangle' && (
                                    <div>
                                        <label className="text-xs text-gray-600 block mb-1">Hướng</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setCurrentTemplate({...currentTemplate, orientation: 'portrait'})}
                                                className={`flex-1 py-1.5 text-xs border rounded ${currentTemplate.orientation === 'portrait' ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'bg-white text-gray-600'}`}
                                            >
                                                Dọc
                                            </button>
                                            <button 
                                                onClick={() => setCurrentTemplate({...currentTemplate, orientation: 'landscape'})}
                                                className={`flex-1 py-1.5 text-xs border rounded ${currentTemplate.orientation === 'landscape' ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'bg-white text-gray-600'}`}
                                            >
                                                Ngang
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-gray-600 block mb-1">Danh mục</label>
                                    <input 
                                        className="w-full p-2 border rounded text-sm"
                                        value={currentTemplate.category}
                                        onChange={(e) => setCurrentTemplate({...currentTemplate, category: e.target.value})}
                                        placeholder="VD: Sinh nhật"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Add Layer */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">3. Layer</h4>
                            <button 
                                onClick={handleAddTextLayer}
                                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-bold text-sm border border-gray-300 flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>T</span> Thêm chữ mới
                            </button>
                        </div>

                        {/* Layer List */}
                        <div className="flex-grow overflow-y-auto">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Danh sách lớp ({currentTemplate.layers?.length})</h4>
                            <div className="space-y-1">
                                {currentTemplate.layers?.map((layer, idx) => (
                                    <div 
                                        key={layer.id}
                                        onClick={() => setSelectedLayerId(layer.id)}
                                        className={`p-2 rounded text-sm cursor-pointer flex justify-between items-center group ${selectedLayerId === layer.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-gray-50 text-gray-700 border border-transparent'}`}
                                    >
                                        <div className="truncate">
                                            <span className="font-bold mr-2 text-xs opacity-50">{idx + 1}.</span>
                                            {layer.label || 'Chưa đặt tên'}
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id); }}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: Canvas */}
                <div className="flex-grow bg-gray-200 flex items-center justify-center overflow-auto p-8 relative" onClick={() => setSelectedLayerId(null)}>
                    {currentTemplate.baseImageUrl ? (
                        <div 
                            ref={canvasRef}
                            className="bg-white shadow-2xl relative overflow-hidden transition-all duration-300"
                            style={getCanvasStyle()}
                        >
                            {/* Base Image */}
                            <img src={currentTemplate.baseImageUrl} className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" alt="Base" />
                            
                            {/* Layers */}
                            {currentTemplate.layers?.map(layer => (
                                <StudioTransformable
                                    key={layer.id}
                                    id={layer.id}
                                    x={layer.x}
                                    y={layer.y}
                                    rotation={layer.rotation}
                                    isSelected={selectedLayerId === layer.id}
                                    onSelect={setSelectedLayerId}
                                    onChange={handleUpdateLayer}
                                    containerRef={canvasRef}
                                >
                                    <div 
                                        style={{
                                            fontFamily: layer.font,
                                            fontSize: `${layer.size}px`,
                                            color: layer.color,
                                            fontWeight: layer.fontWeight,
                                            fontStyle: layer.fontStyle,
                                            textAlign: layer.textAlign,
                                            whiteSpace: 'nowrap',
                                            lineHeight: 1.2
                                        }}
                                    >
                                        {layer.content}
                                    </div>
                                </StudioTransformable>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-400 text-center">
                            <p className="text-xl font-bold mb-2">Chưa có ảnh nền</p>
                            <p className="text-sm">Vui lòng tải ảnh lên từ cột bên trái</p>
                        </div>
                    )}
                </div>

                {/* Right Sidebar: Properties */}
                <div className="w-72 bg-white border-l flex flex-col overflow-y-auto z-10">
                    {selectedLayer ? (
                        <div className="p-4 space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-blue-600 uppercase mb-4 border-b border-blue-100 pb-2">Thuộc tính Layer</h4>
                                
                                <div className="space-y-4">
                                    {/* 1. Label (Important) */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <label className="block text-xs font-bold text-blue-800 mb-1">Nhãn (Label)</label>
                                        <input 
                                            className="w-full p-2 border border-blue-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={selectedLayer.label}
                                            onChange={(e) => handleUpdateLayer(selectedLayer.id, { label: e.target.value })}
                                            placeholder="VD: Tên Chú Rể"
                                        />
                                        <p className="text-[10px] text-blue-600 mt-1 italic">Tên trường này sẽ hiển thị cho khách nhập.</p>
                                    </div>

                                    {/* 2. Content */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Nội dung mẫu</label>
                                        <input 
                                            className="w-full p-2 border rounded text-sm"
                                            value={selectedLayer.content}
                                            onChange={(e) => handleUpdateLayer(selectedLayer.id, { content: e.target.value })}
                                        />
                                    </div>

                                    {/* 3. Font Style */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Font chữ</label>
                                        <select 
                                            className="w-full p-2 border rounded text-sm"
                                            value={selectedLayer.font}
                                            onChange={(e) => handleUpdateLayer(selectedLayer.id, { font: e.target.value })}
                                        >
                                            {fonts.map(f => (
                                                <option key={f} value={f} style={{fontFamily: f}}>{f}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Cỡ chữ (px)</label>
                                            <input 
                                                type="number"
                                                className="w-full p-2 border rounded text-sm"
                                                value={selectedLayer.size}
                                                onChange={(e) => handleUpdateLayer(selectedLayer.id, { size: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Màu sắc</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="color"
                                                    className="w-8 h-9 p-0 border rounded cursor-pointer"
                                                    value={selectedLayer.color}
                                                    onChange={(e) => handleUpdateLayer(selectedLayer.id, { color: e.target.value })}
                                                />
                                                <input 
                                                    className="w-full p-2 border rounded text-xs uppercase"
                                                    value={selectedLayer.color}
                                                    onChange={(e) => handleUpdateLayer(selectedLayer.id, { color: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Xoay (độ)</label>
                                            <input 
                                                type="number"
                                                className="w-full p-2 border rounded text-sm"
                                                value={selectedLayer.rotation}
                                                onChange={(e) => handleUpdateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Canh lề</label>
                                            <div className="flex border rounded overflow-hidden">
                                                {['left', 'center', 'right'].map((align: any) => (
                                                    <button 
                                                        key={align}
                                                        onClick={() => handleUpdateLayer(selectedLayer.id, { textAlign: align })}
                                                        className={`flex-1 py-1.5 hover:bg-gray-50 ${selectedLayer.textAlign === align ? 'bg-gray-100 font-bold' : ''}`}
                                                    >
                                                        {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => handleUpdateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                            className={`py-2 border rounded text-sm font-bold transition-colors ${selectedLayer.fontWeight === 'bold' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}
                                        >
                                            In đậm
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateLayer(selectedLayer.id, { fontStyle: selectedLayer.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                            className={`py-2 border rounded text-sm italic transition-colors ${selectedLayer.fontStyle === 'italic' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}
                                        >
                                            In nghiêng
                                        </button>
                                    </div>
                                    
                                    <div className="pt-4 border-t">
                                        <button 
                                            onClick={() => handleDeleteLayer(selectedLayer.id)}
                                            className="w-full py-2 bg-red-50 text-red-600 rounded font-bold text-sm hover:bg-red-100 transition-colors"
                                        >
                                            Xóa Layer này
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                            <p>Chọn một layer chữ trên hình hoặc trong danh sách để chỉnh sửa.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
