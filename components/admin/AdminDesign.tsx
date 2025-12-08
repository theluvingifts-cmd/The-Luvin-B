
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, CollectionTemplate, FrameOption } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addTemplate } from '../../services/templateService';
import { uploadToCloudinary } from '../../services/uploadService';
import { formatCurrency } from '../../utils/pricing';

declare var html2canvas: any;

const TOOLS = [
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

export const AdminDesign: React.FC = () => {
    // State
    const [activeTool, setActiveTool] = useState('background');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    // Refs
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load frames on mount
    useEffect(() => {
        const fetchFrames = async () => {
            const data = await getAllFrames();
            if (data.length > 0) setFrames(data);
        };
        fetchFrames();
    }, []);

    // Helpers
    const selectedFrame = useMemo(() => frames.find(f => f.id === config.frameId) || frames[0], [frames, config.frameId]);
    
    const handleFrameChange = (frameId: string) => {
        setConfig(prev => ({ ...prev, frameId }));
    };

    const handleBackgroundChange = (type: 'color' | 'image', value: string) => {
        setConfig(prev => ({ ...prev, background: { type, value } }));
    };

    const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) handleBackgroundChange('image', url);
            } catch (err) {
                alert('Lỗi upload ảnh');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleAddText = () => {
        const newText: TextConfig = {
            id: Date.now(),
            content: 'Nhập văn bản',
            font: 'Playfair Display',
            size: 24,
            color: '#333333',
            x: 50, y: 50, rotation: 0, scale: 1,
            background: false,
            width: 40
        };
        setConfig(prev => ({ ...prev, texts: [...prev.texts, newText] }));
        setSelectedItemId(`text-${newText.id}`);
        setActiveTool('text');
    };

    const handleAddUploadItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    const newItem: DraggableItem = {
                        id: Date.now(),
                        partId: url, // Store URL in partId for charms/uploads
                        type: 'charm',
                        x: 50, y: 50, rotation: 0, scale: 1
                    };
                    setConfig(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
                }
            } catch (err) {
                alert('Lỗi upload ảnh');
            } finally {
                setIsSaving(false);
            }
        }
    };

    // FramePreview Handlers (Mimicking BuilderPage)
    const handleItemTransform = (id: string, newTransform: any) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);

        setConfig(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, ...newTransform } : t) };
            }
            if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...newTransform } : i) };
            }
            return prev;
        });
    };

    const handleItemRemove = (id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        setSelectedItemId(null);
        setConfig(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== numericId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numericId) };
            return prev;
        });
    };

    const handleTextUpdate = (id: number, updates: Partial<TextConfig>) => {
        setConfig(prev => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) }));
    };

    // Export & Save
    const handleDownloadImage = async () => {
        const originalSelected = selectedItemId;
        setSelectedItemId(null);
        setIsSaving(true);
        setTimeout(async () => {
            if (previewRef.current && typeof html2canvas !== 'undefined') {
                try {
                    const canvas = await html2canvas(previewRef.current, { useCORS: true, scale: 2, backgroundColor: null });
                    const link = document.createElement('a');
                    link.download = `design_${Date.now()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                } catch (e) {
                    console.error(e);
                    alert("Lỗi xuất ảnh");
                }
            }
            setIsSaving(false);
            setSelectedItemId(originalSelected);
        }, 100);
    };

    const handleSaveTemplate = async () => {
        if (!templateName) return alert("Vui lòng nhập tên mẫu");
        setIsSaving(true);
        
        // 1. Generate Thumbnail
        const originalSelected = selectedItemId;
        setSelectedItemId(null);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for deselect
            let thumbUrl = '';
            
            if (previewRef.current && typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(previewRef.current, { useCORS: true, scale: 1, backgroundColor: null });
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    const file = new File([blob], "thumbnail.png", { type: "image/png" });
                    const url = await uploadToCloudinary(file);
                    if (url) thumbUrl = url;
                }
            }

            const newTemplate: CollectionTemplate = {
                id: `tpl_${Date.now()}`,
                name: templateName,
                imageUrl: thumbUrl || 'https://via.placeholder.com/300?text=No+Preview',
                config: config
            };

            await addTemplate(newTemplate);
            alert("Đã lưu mẫu thành công!");
            setShowSaveModal(false);
            setTemplateName('');
        } catch (e) {
            console.error(e);
            alert("Lỗi khi lưu mẫu");
        } finally {
            setIsSaving(false);
            setSelectedItemId(originalSelected);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl border border-gray-300 overflow-hidden shadow-lg animate-fade-in">
            {/* 1. Sidebar Tools */}
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20">
                {TOOLS.map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition-all ${
                            activeTool === tool.id ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                    >
                        <span className="text-xl mb-1">{tool.icon}</span>
                        <span className="text-[10px] font-bold uppercase">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* 2. Tool Panel (Dynamic) */}
            <div className="w-72 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 text-lg">
                        {TOOLS.find(t => t.id === activeTool)?.label}
                    </h3>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    
                    {activeTool === 'background' && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Màu sắc</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['#ffffff', '#f4eee8', '#e2e8f0', '#fed7aa', '#fbcfe8', '#bbf7d0', '#bfdbfe', '#000000'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleBackgroundChange('color', color)}
                                            className="w-8 h-8 rounded-full border shadow-sm hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <div className="relative w-8 h-8 rounded-full border overflow-hidden">
                                        <input 
                                            type="color" 
                                            className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                                            onChange={(e) => handleBackgroundChange('color', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Hình nền</label>
                                <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                                    <div className="text-2xl mb-1">☁️</div>
                                    <span className="text-sm font-medium text-gray-600">Tải ảnh lên</span>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBackground} />
                            </div>
                        </div>
                    )}

                    {activeTool === 'text' && (
                        <div className="space-y-4">
                            <button onClick={handleAddText} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold shadow-md hover:bg-black transition-transform active:scale-95">
                                + Thêm văn bản
                            </button>
                            
                            {selectedItemId && selectedItemId.startsWith('text') ? (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                    <p className="text-xs font-bold text-blue-600 uppercase">Đang chọn văn bản</p>
                                    {/* Properties handled in FramePreview/TextEditor, but could mirror here */}
                                    <p className="text-xs text-gray-500 italic">Nhấp đúp vào chữ trên khung để sửa nội dung.</p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Chọn một chữ để chỉnh sửa.</p>
                            )}
                        </div>
                    )}

                    {activeTool === 'upload' && (
                        <div className="space-y-4">
                            <label className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer block">
                                <input type="file" className="hidden" accept="image/*" onChange={handleAddUploadItem} />
                                <div className="text-2xl mb-2">🖼️</div>
                                <span className="text-sm font-bold text-gray-700">Tải Sticker / Ảnh</span>
                                <p className="text-xs text-gray-400 mt-1">PNG trong suốt là tốt nhất</p>
                            </label>
                        </div>
                    )}

                    {activeTool === 'layers' && (
                        <div className="space-y-2">
                            {config.texts.map((t, idx) => (
                                <div key={t.id} className="flex justify-between items-center p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedItemId(`text-${t.id}`)}>
                                    <span className="text-xs font-medium truncate w-32">{t.content || 'Text'}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`text-${t.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                </div>
                            ))}
                            {config.draggableItems.map((item, idx) => (
                                <div key={item.id} className="flex justify-between items-center p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedItemId(`item-${item.id}`)}>
                                    <span className="text-xs font-medium text-blue-600">{item.type === 'charm' ? 'Hình ảnh/Sticker' : item.type}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`item-${item.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                </div>
                            ))}
                            {config.texts.length === 0 && config.draggableItems.length === 0 && (
                                <p className="text-sm text-gray-400 text-center italic">Chưa có lớp nào.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Main Canvas Area */}
            <div className="flex-grow flex flex-col bg-gray-100 relative">
                {/* Top Toolbar */}
                <div className="h-14 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <select 
                            value={config.frameId} 
                            onChange={(e) => handleFrameChange(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 font-bold"
                        >
                            {frames.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.frameWidthCm}x{f.frameHeightCm})</option>
                            ))}
                        </select>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:bg-gray-100 rounded text-gray-600 text-lg font-bold">-</button>
                            <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-gray-100 rounded text-gray-600 text-lg font-bold">+</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleDownloadImage}
                            className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Tải ảnh PNG
                        </button>
                        <button 
                            onClick={() => setShowSaveModal(true)}
                            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                            Lưu Mẫu
                        </button>
                    </div>
                </div>

                {/* Canvas Workspace */}
                <div className="flex-grow overflow-auto flex items-center justify-center p-8 bg-[url('https://res.cloudinary.com/dbdqd93km/image/upload/v1/transparent-bg.png')] bg-repeat">
                    <div 
                        style={{ 
                            transform: `scale(${zoom})`, 
                            transformOrigin: 'center center',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            transition: 'width 0.3s ease, height 0.3s ease'
                        }}
                        className="bg-white"
                    >
                        <FramePreview 
                            ref={previewRef}
                            config={config}
                            containerWidth={500} // Fixed base width, scaled by zoom
                            onItemTransform={handleItemTransform}
                            onItemRemove={handleItemRemove}
                            onTextUpdate={handleTextUpdate}
                            isInteractive={true}
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            setIsEditingText={() => {}} // Not needed for admin
                            allParts={{}} // Empty parts list as we use direct uploads mostly
                            className="pointer-events-auto"
                        />
                    </div>
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-96">
                        <h3 className="text-lg font-bold mb-4">Lưu làm Mẫu thiết kế</h3>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-gray-300 rounded mb-4"
                            placeholder="Nhập tên mẫu..."
                            value={templateName}
                            onChange={e => setTemplateName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                            <button onClick={handleSaveTemplate} disabled={isSaving} className="px-4 py-2 text-sm bg-blue-600 text-white font-bold rounded hover:bg-blue-700">
                                {isSaving ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Loading Overlay */}
            {isSaving && (
                <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center">
                    <div className="bg-white p-4 rounded-lg flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                        <span className="font-bold text-sm">Đang xử lý...</span>
                    </div>
                </div>
            )}
        </div>
    );
};
