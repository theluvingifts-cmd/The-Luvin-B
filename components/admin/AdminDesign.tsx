
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { getAllAssets, addAsset, deleteAsset } from '../../services/assetService';
import { uploadFile } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';

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

const BG_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Khác'];

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
    const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([]);
    
    // History State
    const [history, setHistory] = useState<FrameConfig[]>([INITIAL_FRAME_CONFIG]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    
    // Edit/Save State
    const [editingBgId, setEditingBgId] = useState<string | null>(null);
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    const [existingPreviewUrl, setExistingPreviewUrl] = useState<string>(''); 
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
    const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string>('');
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const [quickFontName, setQuickFontName] = useState('');
    const [isUploadingFont, setIsUploadingFont] = useState(false);
    
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

    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData, assetsData] = await Promise.all([
                getAllFrames(),
                getStoreConfig(),
                getAllBackgrounds(),
                getAllAssets()
            ]);
            
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
            if (bgData) setExistingBackgrounds(bgData);
            if (assetsData) setSavedAssets(assetsData);
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        const styleId = 'admin-dynamic-fonts';
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
            style = document.createElement('style');
            style.id = 'admin-dynamic-fonts';
            document.head.appendChild(style);
        }
        
        let css = '';
        uploadedFonts.forEach(font => {
            css += `
                @font-face {
                    font-family: '${font.name}';
                    src: url('${font.url}');
                    font-weight: normal;
                    font-style: normal;
                    font-display: swap;
                }
            `;
        });
        style.innerHTML = css;
    }, [uploadedFonts]);

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
                const url = await uploadFile(file);
                
                if (url) {
                    const newFont: CustomFont = {
                        id: `font_${Date.now()}`,
                        name: quickFontName.trim(),
                        url: url
                    };
                    
                    const currentConfig = await getStoreConfig();
                    const updatedFonts = [...(currentConfig?.uploadedFonts || []), newFont];
                    await updateStoreConfig({ uploadedFonts: updatedFonts });
                    
                    setUploadedFonts(updatedFonts);
                    setQuickFontName('');
                    alert(`Font "${newFont.name}" đã sẵn sàng sử dụng!`);
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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (e.shiftKey) handleRedo(); else handleUndo();
                return;
            }
            if (isCtrl && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                handleRedo();
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedItemId) {
                    e.preventDefault();
                    handleItemRemove(selectedItemId);
                }
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                setSelectedItemId(null);
                return;
            }
            if (isCtrl && e.key === 'c') {
                if (selectedItemId) {
                    e.preventDefault();
                    const [type, idStr] = selectedItemId.split('-');
                    const id = parseInt(idStr);
                    let data = null;
                    let itemType: 'text' | 'shape' | 'item' | null = null;
                    if (type === 'text') { data = config.texts.find(t => t.id === id); itemType = 'text'; }
                    else if (type === 'shape') { data = config.shapes?.find(s => s.id === id); itemType = 'shape'; }
                    else if (type === 'item') { data = config.draggableItems.find(i => i.id === id); itemType = 'item'; }
                    if (data && itemType) { setClipboard({ type: itemType, data: JSON.parse(JSON.stringify(data)) }); }
                }
                return;
            }
            if (isCtrl && e.key === 'v') {
                if (clipboard) {
                    e.preventDefault();
                    const newId = Date.now();
                    const newItem = { ...clipboard.data, id: newId, x: Math.min(95, (clipboard.data.x || 50) + 2), y: Math.min(95, (clipboard.data.y || 50) + 2) };
                    setConfigWithHistory(prev => {
                        const next = { ...prev };
                        if (clipboard.type === 'text') next.texts = [...prev.texts, newItem];
                        else if (clipboard.type === 'shape') next.shapes = [...(prev.shapes || []), newItem];
                        else if (clipboard.type === 'item') next.draggableItems = [...prev.draggableItems, newItem];
                        return next;
                    });
                    setSelectedItemId(`${clipboard.type}-${newId}`);
                }
                return;
            }
            if (selectedItemId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 5 : 0.5;
                let dx = 0; let dy = 0;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;
                const [type, idStr] = selectedItemId.split('-');
                const id = parseInt(idStr);
                const updatePos = (item: any) => ({ ...item, x: Math.max(0, Math.min(100