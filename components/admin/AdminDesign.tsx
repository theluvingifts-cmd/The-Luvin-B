
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig, CollectionTemplate } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { getAllAssets, addAsset, deleteAsset } from '../../services/assetService';
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';
import { addTemplate, updateTemplate, getAllTemplates } from '../../services/templateService';

declare var html2canvas: any;

const TOOLS = [
    { id: 'templates', icon: '📂', label: 'Mẫu' }, 
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'shape', icon: '🟥', label: 'Cấu trúc' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];

const CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Khác'];

// FIX: Define Transform type for handleItemTransform
type Transform = { x: number; y: number; rotation: number; scale: number; width?: number; height?: number };

// Reusable FontSelector
const FontSelector: React.FC<{ 
    value: string; 
    onChange: (font: string) => void;
    onPreview: (font: string | null) => void;
    uploadedFonts: CustomFont[];
}> = ({ value, onChange, onPreview, uploadedFonts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const groups = [
        { label: 'Phông chữ cơ bản', fonts: DEFAULT_FONTS },
        { label: 'Phông chữ tải lên', fonts: uploadedFonts.map(f => f.name) }
    ];

    return (
        <div className="relative" ref={dropdownRef} onMouseLeave={() => onPreview(null)}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-left flex justify-between items-center"
            >
                <span className="truncate">{value}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {groups.map((group) => (
                        group.fonts.length > 0 && (
                            <div key={group.label}>
                                <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{group.label}</div>
                                {group.fonts.map(font => (
                                    <div 
                                        key={font}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-pink-50 transition-colors ${value === font ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'}`}
                                        onMouseEnter={() => onPreview(font)}
                                        onClick={() => { onChange(font); setIsOpen(false); }}
                                    >
                                        <span style={{ fontFamily: font }}>{font}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
    );
};

export const AdminDesign: React.FC = () => {
    // State
    const [activeTool, setActiveTool] = useState('templates');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [existingBackgrounds, setExistingBackgrounds] = useState<PresetBackground[]>([]);
    const [existingTemplates, setExistingTemplates] = useState<CollectionTemplate[]>([]);
    const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([]);
    
    // History State
    const [history, setHistory] = useState<FrameConfig[]>([INITIAL_FRAME_CONFIG]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    
    // Save Modal State
    const [saveTarget, setSaveTarget] = useState<'background' | 'collection'>('collection');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [itemName, setItemName] = useState('');
    const [itemCategory, setItemCategory] = useState('Khác');
    const [itemType, setItemType] = useState<'square' | 'rectangle'>('square');
    const [existingPreviewUrl, setExistingPreviewUrl] = useState<string>('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    // Thumbnail Preview State
    const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
    const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string>('');
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Font Manager State
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const [quickFontName, setQuickFontName] = useState('');
    const [isUploadingFont, setIsUploadingFont] = useState(false);
    
    // Clipboard State
    const [clipboard, setClipboard] = useState<{ type: 'text' | 'shape' | 'item'; data: any } | null>(null);

    // Refs
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setConfigWithHistory = useCallback((newConfigOrFn: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => {
        setConfig(prev => {
            const newConfig = typeof newConfigOrFn === 'function' ? newConfigOrFn(prev) : newConfigOrFn;
            if (JSON.stringify(newConfig) !== JSON.stringify(prev)) {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(newConfig);
                if (newHistory.length > 30) newHistory.shift();
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            }
            return newConfig;
        });
    }, [history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setConfig(history[newIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setConfig(history[newIndex]);
        }
    };

    // FIX: Add missing handleTextUpdate for updating text configuration
    const handleTextUpdate = useCallback((id: number, updates: Partial<TextConfig>) => {
        setConfigWithHistory((prev: FrameConfig) => ({
            ...prev,
            texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t)
        }));
    }, [setConfigWithHistory]);

    // FIX: Add missing handleItemTransform for updating item positions/scale/rotation
    const handleItemTransform = useCallback((id: string, newTransform: Transform) => {
        const [type, ...rest] = id.split('-');
        const rawId = rest.join('-');
        
        setConfigWithHistory((prev: FrameConfig) => {
            if (type === 'text') {
                const idToUpdate = parseInt(rawId);
                return { ...prev, texts: prev.texts.map(item => item.id === idToUpdate ? { ...item, ...newTransform } : item) };
            }
            const itemId = parseInt(rawId);
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map((item: DraggableItem) => item.id === itemId ? { ...item, ...newTransform } : item) };
            if (type === 'shape') {
                const shapeId = parseInt(rawId);
                return { ...prev, shapes: (prev.shapes || []).map(item => item.id === shapeId ? { ...item, ...newTransform } : item) };
            }
            return prev;
        });
    }, [setConfigWithHistory]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData, assetsData, tplData] = await Promise.all([
                getAllFrames(),
                getStoreConfig(),
                getAllBackgrounds(),
                getAllAssets(),
                getAllTemplates()
            ]);
            
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
            if (bgData) setExistingBackgrounds(bgData);
            if (assetsData) setSavedAssets(assetsData);
            if (tplData) setExistingTemplates(tplData);
        };
        fetchInitialData();
    }, []);

    const handleQuickFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!quickFontName.trim()) {
            alert("Vui lòng nhập tên font trước.");
            e.target.value = ''; 
            return;
        }

        if (e.target.files && e.target.files[0]) {
            setIsUploadingFont(true);
            try {
                const file = e.target.files[0];
                const url = await uploadToCloudinary(file);
                if (url) {
                    const newFont: CustomFont = { id: `font_${Date.now()}`, name: quickFontName.trim(), url: url };
                    const currentConfig = await getStoreConfig();
                    const updatedFonts = [...(currentConfig?.uploadedFonts || []), newFont];
                    await updateStoreConfig({ uploadedFonts: updatedFonts });
                    setUploadedFonts(updatedFonts);
                    setQuickFontName('');
                    alert(`Font "${newFont.name}" đã sẵn sàng!`);
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload font.");
            } finally {
                setIsUploadingFont(false);
            }
        }
    };

    const handleItemRemove = (id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        setSelectedItemId(null);
        setConfigWithHistory(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== numericId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numericId) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== numericId) };
            return prev;
        });
    };

    const handleFrameChange = (frameId: string) => {
        setConfigWithHistory(prev => ({ ...prev, frameId }));
        const frame = frames.find(f => f.id === frameId);
        if (frame) setItemType(Math.abs(frame.frameWidthCm - frame.frameHeightCm) > 1 ? 'rectangle' : 'square');
    };

    const handleBackgroundChange = (type: 'color' | 'image', value: string) => {
        setConfigWithHistory(prev => ({ ...prev, background: { type, value } }));
    };

    const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    handleBackgroundChange('image', url);
                    const newAsset = await addAsset(url, 'background');
                    if (newAsset) setSavedAssets(prev => [newAsset, ...prev]);
                }
            } catch (err) {
                alert('Lỗi upload ảnh');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleAddText = () => {
        const newText: TextConfig = {
            id: Date.now(), content: 'Nhập nội dung', font: 'Playfair Display', size: 24, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: false, width: 40
        };
        setConfigWithHistory(prev => ({ ...prev, texts: [...prev.texts, newText] }));
        setSelectedItemId(`text-${newText.id}`);
        setActiveTool('text');
    };

    const handleAddShape = () => {
        const newShape: ShapeConfig = {
            id: Date.now(), type: 'rect', x: 50, y: 50, rotation: 0, width: 20, height: 15, strokeColor: '#333333', strokeWidth: 2, strokeType: 'dashed', borderRadius: 0
        };
        setConfigWithHistory(prev => ({ ...prev, shapes: [...(prev.shapes || []), newShape] }));
        setSelectedItemId(`shape-${newShape.id}`);
        setActiveTool('shape');
    };

    const handleLoadTemplate = (bg: PresetBackground) => {
        if (confirm("Tải mẫu này sẽ thay thế thiết kế hiện tại. Tiếp tục?")) {
            setSaveTarget('background');
            setEditingItemId(bg.id);
            setItemName(bg.name);
            setItemCategory(bg.category);
            setItemType(bg.type);
            setExistingPreviewUrl(bg.previewUrl || '');
            const isColor = bg.url.startsWith('#');
            setConfigWithHistory({
                frameId: bg.type === 'rectangle' ? 'md' : 'lg',
                background: { type: isColor ? 'color' : 'image', value: bg.url },
                texts: bg.overlayConfig?.texts || [],
                draggableItems: bg.overlayConfig?.draggableItems || [],
                shapes: bg.overlayConfig?.shapes || [],
                characters: []
            });
            setActiveTool('layers');
        }
    };

    const handleLoadCollectionItem = (tpl: CollectionTemplate) => {
        if (confirm("Chỉnh sửa mẫu này từ bộ sưu tập?")) {
            setSaveTarget('collection');
            setEditingItemId(tpl.id);
            setItemName(tpl.name);
            setItemCategory(tpl.category || 'Khác');
            setExistingPreviewUrl(tpl.imageUrl || '');
            setConfigWithHistory(tpl.config);
            setActiveTool('layers');
        }
    }

    const handlePrepareSave = async () => {
        setIsSaving(true);
        const originalSelected = selectedItemId;
        setSelectedItemId(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));
            await document.fonts.ready;
            if (previewRef.current && typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(previewRef.current, { 
                    useCORS: true, allowTaint: true, scale: 2, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0
                });
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    setGeneratedThumbnailBlob(blob);
                    setGeneratedThumbnailUrl(URL.createObjectURL(blob));
                }
            }
            setShowSaveModal(true);
        } catch (e) {
            console.error(e);
            setShowSaveModal(true); 
        } finally {
            setIsSaving(false);
            setSelectedItemId(originalSelected);
        }
    };

    const handleConfirmSave = async () => {
        if (!itemName) return alert("Vui lòng nhập tên");
        setIsSaving(true);
        try {
            let previewUrl = existingPreviewUrl || '';
            if (generatedThumbnailBlob) {
                const fileToUpload = new File([generatedThumbnailBlob], "thumb.png", { type: "image/png" });
                const uploaded = await uploadToCloudinary(fileToUpload);
                if (uploaded) previewUrl = uploaded;
                else throw new Error("Lỗi upload ảnh thumbnail");
            }
            if (!previewUrl) throw new Error("Chưa có ảnh thumbnail");

            if (saveTarget === 'background') {
                const bgData: PresetBackground = {
                    id: editingItemId || `bg_${Date.now()}`,
                    name: itemName,
                    url: config.background.value,
                    previewUrl: previewUrl, 
                    category: itemCategory,
                    type: itemType,
                    overlayConfig: { texts: config.texts, draggableItems: config.draggableItems, shapes: config.shapes || [] }
                };
                if (editingItemId) await updateBackground(editingItemId, bgData);
                else await addBackground(bgData);
                const newData = await getAllBackgrounds();
                setExistingBackgrounds(newData);
            } else {
                const tplData: CollectionTemplate = {
                    id: editingItemId || `tpl_${Date.now()}`,
                    name: itemName,
                    imageUrl: previewUrl,
                    category: itemCategory,
                    config: config
                };
                if (editingItemId) await updateTemplate(editingItemId, tplData);
                else await addTemplate(tplData);
                const newData = await getAllTemplates();
                setExistingTemplates(newData);
            }
            alert("Lưu thành công!");
            setShowSaveModal(false);
        } catch (e: any) {
            alert(e.message || "Lỗi khi lưu.");
        } finally {
            setIsSaving(false);
        }
    };

    const alignItem = (dir: string) => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        const update = (item: any) => {
            if (dir === 'centerH') return { ...item, x: 50 };
            if (dir === 'centerV') return { ...item, y: 50 };
            return item;
        }
        setConfigWithHistory(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.map(t => t.id === id ? update(t) : t) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? update(i) : i) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? update(s) : s) };
            return prev;
        });
    }

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl border border-gray-300 overflow-hidden shadow-lg animate-fade-in relative font-sans">
            {/* Sidebar Tools */}
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20">
                {TOOLS.map(tool => (
                    <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`w-14 h-14 flex-shrink-0 flex flex-col items-center justify-center rounded-lg transition-all ${activeTool === tool.id ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                        <span className="text-xl mb-1">{tool.icon}</span>
                        <span className="text-[10px] font-bold uppercase">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* Tool Panel */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm">
                <div className="p-4 border-b border-gray-100 font-bold text-gray-800 text-lg">
                    {TOOLS.find(t => t.id === activeTool)?.label}
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-4">
                    {activeTool === 'templates' && (
                        <div className="space-y-6">
                            <button onClick={() => { setConfig(INITIAL_FRAME_CONFIG); setEditingItemId(null); setItemName(''); }} className="w-full border-2 border-dashed py-3 rounded-lg font-bold text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-all">
                                + Thiết kế mới
                            </button>
                            
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Bộ sưu tập ({existingTemplates.length})</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {existingTemplates.map(tpl => (
                                        <div key={tpl.id} onClick={() => handleLoadCollectionItem(tpl)} className="group cursor-pointer border rounded-lg overflow-hidden bg-gray-50 hover:border-blue-400 relative">
                                            <img src={tpl.imageUrl} className="w-full aspect-square object-contain p-2" />
                                            <div className="p-1 bg-white/90 text-[10px] font-bold truncate text-center border-t">{tpl.name}</div>
                                            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Mẫu nền ({existingBackgrounds.length})</p>
                                <div className="space-y-2">
                                    {existingBackgrounds.map(bg => (
                                        <div key={bg.id} onClick={() => handleLoadTemplate(bg)} className="flex items-center gap-2 p-2 rounded cursor-pointer border hover:bg-gray-50">
                                            <img src={bg.previewUrl || bg.url} className="w-10 h-10 object-cover rounded border" />
                                            <div className="min-w-0 flex-grow"><p className="text-xs font-bold truncate">{bg.name}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTool === 'background' && (
                        <div className="space-y-4">
                            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-gray-100 py-4 rounded-lg border-2 border-dashed font-bold text-gray-500 hover:bg-gray-200">+ Tải ảnh nền</button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBackground} />
                            <div className="grid grid-cols-3 gap-2">
                                {savedAssets.filter(a => a.type === 'background').map(a => (
                                    <img key={a.id} src={a.url} onClick={() => handleBackgroundChange('image', a.url)} className="aspect-square object-cover rounded border cursor-pointer hover:ring-2 hover:ring-blue-400" />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTool === 'text' && (
                        <div className="space-y-4">
                            <button onClick={handleAddText} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-md hover:bg-blue-700">+ Thêm văn bản</button>
                            {selectedItemId?.startsWith('text') && (
                                <div className="p-3 bg-gray-50 rounded-lg border space-y-3 animate-fade-in">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Tùy chỉnh</label>
                                    <FontSelector value={config.texts.find(t => `text-${t.id}` === selectedItemId)?.font || ''} onChange={(font) => handleTextUpdate(parseInt(selectedItemId.split('-')[1]), { font })} onPreview={setPreviewFont} uploadedFonts={uploadedFonts} />
                                    <div className="flex gap-2">
                                        <input type="number" className="w-1/2 p-2 border rounded text-sm" value={config.texts.find(t => `text-${t.id}` === selectedItemId)?.size || 20} onChange={e => handleTextUpdate(parseInt(selectedItemId.split('-')[1]), { size: Number(e.target.value) })} />
                                        <input type="color" className="w-1/2 h-9 border rounded p-1" value={config.texts.find(t => `text-${t.id}` === selectedItemId)?.color || '#000000'} onChange={e => handleTextUpdate(parseInt(selectedItemId.split('-')[1]), { color: e.target.value })} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => alignItem('centerH')} className="flex-1 bg-white border p-2 rounded text-xs font-bold">Căn giữa H</button>
                                        <button onClick={() => alignItem('centerV')} className="flex-1 bg-white border p-2 rounded text-xs font-bold">Căn giữa V</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTool === 'shape' && (
                         <div className="space-y-4">
                            <button onClick={handleAddShape} className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold">+ Thêm khối/viền</button>
                         </div>
                    )}

                    {activeTool === 'layers' && (
                        <div className="space-y-2">
                            {[...config.texts, ...(config.shapes || []), ...config.draggableItems].reverse().map((layer: any) => {
                                const lId = `${layer.content !== undefined ? 'text' : layer.strokeColor !== undefined ? 'shape' : 'item'}-${layer.id}`;
                                return (
                                    <div key={lId} onClick={() => setSelectedItemId(lId)} className={`flex items-center justify-between p-2 rounded border cursor-pointer ${selectedItemId === lId ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white hover:bg-gray-50'}`}>
                                        <span className="text-xs truncate max-w-[150px] font-medium">{layer.content || lId}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); handleItemRemove(lId); }} className="text-red-500 hover:bg-red-50 px-1.5 rounded">×</button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-grow flex items-center justify-center bg-repeat relative overflow-hidden" style={{ backgroundImage: "url('https://res.cloudinary.com/dbdqd93km/image/upload/v1/transparent-bg.png')" }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}>
                    <FramePreview 
                        ref={previewRef}
                        config={config}
                        containerWidth={500}
                        onItemTransform={handleItemTransform}
                        onItemRemove={handleItemRemove}
                        onTextUpdate={(id, up) => handleTextUpdate(id, up)}
                        selectedItemId={selectedItemId}
                        setSelectedItemId={setSelectedItemId}
                        isInteractive={true}
                        setIsEditingText={() => {}}
                        previewFont={previewFont}
                        allowTextScaling={true}
                    />
                </div>
                
                {/* Canvas Controls */}
                <div className="absolute bottom-6 left-6 flex bg-white rounded-lg shadow-lg border p-1 gap-1">
                    <button onClick={() => setZoom(z => Math.max(0.2, z-0.1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 font-bold">-</button>
                    <span className="px-2 flex items-center text-xs font-bold text-gray-500">{Math.round(zoom*100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z+0.1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 font-bold">+</button>
                    <button onClick={handlePrepareSave} className="ml-2 bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold shadow-md hover:bg-blue-700">Lưu Mẫu</button>
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-bounce-small">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">Lưu thiết kế</h3>
                            <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setSaveTarget('collection')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${saveTarget === 'collection' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Bộ sưu tập (Sản phẩm mẫu)</button>
                                <button onClick={() => setSaveTarget('background')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${saveTarget === 'background' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Mẫu nền (Trống cho khách)</button>
                            </div>

                            <div className="flex gap-4">
                                <div className="w-24 h-32 bg-gray-100 border rounded flex-shrink-0 flex items-center justify-center relative group">
                                    {generatedThumbnailUrl ? <img src={generatedThumbnailUrl} className="w-full h-full object-cover" /> : <div className="text-[10px] text-gray-400">No Thumb</div>}
                                    <button onClick={() => thumbnailInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold">Thay ảnh</button>
                                    <input type="file" ref={thumbnailInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setGeneratedThumbnailBlob(e.target.files[0])} />
                                </div>
                                <div className="flex-grow space-y-4">
                                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tên mẫu</label><input className="w-full p-2 border rounded-lg outline-none focus:border-blue-500" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="VD: Anniversary Pink..." /></div>
                                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Danh mục</label><select className="w-full p-2 border rounded-lg bg-white" value={itemCategory} onChange={e => setItemCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 font-bold text-gray-500">Hủy</button>
                            <button onClick={handleConfirmSave} disabled={isSaving} className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50">{isSaving ? 'Đang lưu...' : 'Xác nhận Lưu'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
