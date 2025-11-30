
import React, { useState, useEffect } from 'react';
import { CollectionTemplate, FeedbackItem, ThemeConfig, CustomFont } from '../../types';
import { StoreConfig, updateStoreConfig, DEFAULT_THEME } from '../../services/configService';
import { addTemplate, updateTemplate, deleteTemplate } from '../../services/templateService';
import { addFeedback, updateFeedback, deleteFeedback } from '../../services/feedbackService';
import { uploadToCloudinary } from '../../services/uploadService';
import { ConfigImageUpload } from './shared/ConfigImageUpload';
import { TemplateForm } from './forms/TemplateForm';
import { FeedbackForm } from './forms/FeedbackForm';

interface AdminConfigProps {
    storeConfig: StoreConfig;
    setStoreConfig: React.Dispatch<React.SetStateAction<StoreConfig>>;
    templates: CollectionTemplate[];
    feedbacks: FeedbackItem[];
    onRefreshTemplates: () => void;
    onRefreshFeedbacks: () => void;
}

// Định nghĩa các Element có thể click và sửa
type ElementId = 
    | 'global_settings' // Mặc định
    | 'logo'
    | 'favicon'
    | 'header_bg'
    | 'header_text'
    | 'hero_bg'
    | 'hero_title'
    | 'hero_subtitle'
    | 'hero_button'
    | 'hero_image'
    | 'footer_bg'
    | 'footer_title'
    | 'footer_text'
    | 'card_style';

const GOOGLE_FONTS = [
    { name: 'Playfair Display', label: 'Playfair Display (Serif Elegant)' },
    { name: 'Montserrat', label: 'Montserrat (Sans Modern)' },
    { name: 'Roboto', label: 'Roboto (Standard)' },
    { name: 'Open Sans', label: 'Open Sans (Readable)' },
    { name: 'Merriweather', label: 'Merriweather (Classic)' },
    { name: 'Dancing Script', label: 'Dancing Script (Handwritten)' },
    { name: 'Lora', label: 'Lora (Story)' },
    { name: 'Nunito', label: 'Nunito (Friendly)' },
    { name: 'Pacifico', label: 'Pacifico (Fun)' }
];

// --- COMPONENT: SELECTABLE ZONE ---
// Vùng chọn thông minh: Click vào là active, chặn sự kiện lan ra cha
const SelectableZone: React.FC<{
    id: ElementId;
    activeId: ElementId;
    onSelect: (id: ElementId) => void;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    label?: string; // Label hiển thị khi hover
}> = ({ id, activeId, onSelect, children, className = '', style, label }) => {
    const isActive = id === activeId;

    return (
        <div
            className={`relative transition-all duration-200 ${className} ${isActive ? 'ring-2 ring-blue-600 ring-offset-2 z-50' : 'hover:ring-1 hover:ring-blue-400 hover:ring-dashed'}`}
            style={{ ...style, cursor: 'pointer' }}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // CHẶN LAN SỰ KIỆN: Click con không ảnh hưởng cha
                onSelect(id);
            }}
        >
            {children}
            {/* Label hiển thị khi hover hoặc active */}
            {(isActive) && (
                <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded shadow-md font-sans whitespace-nowrap z-[60] font-bold uppercase tracking-wider">
                    {label || id}
                </div>
            )}
        </div>
    );
};

export const AdminConfig: React.FC<AdminConfigProps> = ({ storeConfig, setStoreConfig, templates, feedbacks, onRefreshTemplates, onRefreshFeedbacks }) => {
    const [activeElement, setActiveElement] = useState<ElementId>('global_settings');
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(storeConfig.theme || DEFAULT_THEME);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Font Management State
    const [newFontName, setNewFontName] = useState('');
    const [isUploadingFont, setIsUploadingFont] = useState(false);

    // Edit Modal States
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);

    // --- EFFECT: Load Fonts for Admin Preview ---
    useEffect(() => {
        const loadFonts = () => {
            const existingStyle = document.getElementById('admin-preview-fonts');
            if (existingStyle) existingStyle.remove();

            const style = document.createElement('style');
            style.id = 'admin-preview-fonts';
            let css = '';
            
            if (storeConfig.uploadedFonts) {
                storeConfig.uploadedFonts.forEach(font => {
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
            }
            style.innerHTML = css;
            document.head.appendChild(style);
        };
        loadFonts();
    }, [storeConfig.uploadedFonts]);

    // Sync themeConfig
    useEffect(() => {
        if (storeConfig.theme) {
            setThemeConfig(storeConfig.theme);
        }
    }, [storeConfig]);

    // --- DATA HANDLERS ---

    const handleThemeChange = (path: string, value: string) => {
        setThemeConfig(prev => {
            const newConfig = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let current = newConfig;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newConfig;
        });
    };

    const handleContentChange = (field: keyof StoreConfig, value: string) => {
        setStoreConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        const success = await updateStoreConfig({ 
            ...storeConfig,
            theme: themeConfig 
        });
        if (success) {
            alert("Đã lưu cấu hình thành công!");
        } else {
            alert("Lỗi lưu cấu hình.");
        }
        setLoading(false);
    };

    const handleImageUpload = async (file: File, field: keyof StoreConfig) => {
        setUploadingField(field);
        try {
            const url = await uploadToCloudinary(file);
            if (url) {
                const updates = { [field]: url };
                await updateStoreConfig(updates); // Save immediately
                setStoreConfig(prev => ({ ...prev, ...updates }));
            } else {
                alert("Lỗi upload.");
            }
        } catch (error) {
            console.error(error);
            alert("Lỗi upload.");
        } finally {
            setUploadingField(null);
        }
    };

    // --- FONT HANDLERS ---
    const handleAddNewFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!newFontName.trim()) { alert("Nhập tên font trước!"); e.target.value = ''; return; }
        if (e.target.files && e.target.files[0]) {
            setIsUploadingFont(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    const newFont: CustomFont = { id: `font_${Date.now()}`, name: newFontName.trim(), url };
                    const updatedFonts = [...(storeConfig.uploadedFonts || []), newFont];
                    await updateStoreConfig({ uploadedFonts: updatedFonts });
                    setStoreConfig(prev => ({ ...prev, uploadedFonts: updatedFonts }));
                    setNewFontName('');
                    alert("Đã thêm font!");
                }
            } catch (e) { console.error(e); alert("Lỗi"); } finally { setIsUploadingFont(false); }
        }
    };
    const handleDeleteFont = async (id: string) => {
        if(confirm("Xóa font này?")) {
            const updated = (storeConfig.uploadedFonts || []).filter(f => f.id !== id);
            await updateStoreConfig({ uploadedFonts: updated });
            setStoreConfig(prev => ({ ...prev, uploadedFonts: updated }));
        }
    };

    // Template/Feedback Handlers
    const handleSaveTemplate = async (tpl: CollectionTemplate) => { setIsEditingTemplate(false); if (editingTemplate) await updateTemplate(tpl.id, tpl); else await addTemplate(tpl); onRefreshTemplates(); setEditingTemplate(null); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Xóa mẫu?")) { await deleteTemplate(id); onRefreshTemplates(); } };
    const handleSaveFeedback = async (fb: FeedbackItem) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(fb.id, fb); else await addFeedback(fb); onRefreshFeedbacks(); setEditingFeedback(null); };
    const handleDeleteFeedback = async (id: string) => { if (confirm("Xóa feedback?")) { await deleteFeedback(id); onRefreshFeedbacks(); } };

    const fontOptions = [
        { label: 'Google Fonts', options: GOOGLE_FONTS.map(f => ({ value: f.name, label: f.label })) },
        { label: 'Custom Fonts', options: (storeConfig.uploadedFonts || []).map(f => ({ value: f.name, label: `${f.name} (Uploaded)` })) }
    ];

    // --- DYNAMIC SIDEBAR RENDERER ---
    const renderSidebar = () => {
        const BackButton = () => (
            <button 
                onClick={() => setActiveElement('global_settings')}
                className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 mb-4"
            >
                ← Quay lại Cài đặt chung
            </button>
        );

        switch (activeElement) {
            // --- HEADER GROUP ---
            case 'logo':
                return (
                    <div className="animate-fade-in">
                        <BackButton />
                        <h3 className="text-lg font-bold mb-4">Logo Website</h3>
                        <ConfigImageUpload label="File ảnh Logo" description="Nên dùng ảnh PNG nền trong suốt" currentUrl={storeConfig.logoUrl} onUpload={(f) => handleImageUpload(f, 'logoUrl')} isUploading={uploadingField === 'logoUrl'} />
                    </div>
                );
            case 'header_bg':
                return (
                    <div className="animate-fade-in">
                        <BackButton />
                        <h3 className="text-lg font-bold mb-4">Nền Header (Menu)</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Màu nền (Background)</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-10 border rounded cursor-pointer" value={themeConfig.sections.header.backgroundColor} onChange={(e) => handleThemeChange('sections.header.backgroundColor', e.target.value)} />
                                <input className="border rounded px-2 w-full text-sm" value={themeConfig.sections.header.backgroundColor} onChange={(e) => handleThemeChange('sections.header.backgroundColor', e.target.value)} />
                            </div>
                        </div>
                    </div>
                );
            case 'header_text':
                return (
                    <div className="animate-fade-in">
                        <BackButton />
                        <h3 className="text-lg font-bold mb-4">Chữ trên Menu</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Màu chữ (Text Color)</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-10 border rounded cursor-pointer" value={themeConfig.sections.header.textColor} onChange={(e) => handleThemeChange('sections.header.textColor', e.target.value)} />
                                <input className="border rounded px-2 w-full text-sm" value={themeConfig.sections.header.textColor} onChange={(e) => handleThemeChange('sections.header.textColor', e.target.value)} />
                            </div>
                        </div>
                    </div>
                );

            // --- HERO GROUP ---
            case 'hero_bg':
            case 'hero_image':
                return (
                    <div className="animate-fade-in">
                        <BackButton />
                        <h3 className="text-lg font-bold mb-4">Nền Hero (Đầu trang)</h3>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Màu nền</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-10 border rounded cursor-pointer" value={themeConfig.sections.hero.backgroundColor} onChange={(e) => handleThemeChange('sections.hero.backgroundColor', e.target.value)} />
                                <input className="border rounded px-2 w-full text-sm" value={themeConfig.sections.hero.backgroundColor} onChange={(e) => handleThemeChange('sections.hero.backgroundColor', e.target.value)} />
                            </div>
                        </div>
                        <ConfigImageUpload label="Hoặc Ảnh nền (Hero Image)" description="Ảnh này sẽ đè lên màu nền ở giao diện Desktop" currentUrl={storeConfig.heroImageUrl} onUpload={(f) => handleImageUpload(f, 'heroImageUrl')} isUploading={uploadingField === 'heroImageUrl'} />
                    </div>
                );
            case 'hero_title':
                return (
                    <div className="animate-fade-in">
                        <BackButton />
                        <h3 className="text-lg font-bold mb-4">Tiêu đề lớn (Hero Title)</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Nội dung chữ</label>
                            <input className="w-full p-2 border rounded text-sm" value={storeConfig.heroTitle} onChange={(e) => handleContentChange('heroTitle', e.target.value)} />
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Màu chữ</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-10 border rounded cursor-pointer" value={themeConfig.sections.hero.headingColor} onChange={(e) => handleThemeChange('sections.hero.headingColor', e.target.value)} />
                                <input className="border rounded px-2 w-full text-sm" value={themeConfig.sections.hero.headingColor} onChange={(e) => handleThemeChange('sections.hero.headingColor', e.target.value)} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 italic">Font chữ dùng "Font Tiêu đề" trong Cài đặt chung.</p>
                    </div>
                );
            case 'hero_subtitle':
                return (
                    <div className="animate-fade-in">
                        <BackButton />
                        <h3 className="text-lg font-bold mb-4">Phụ đề (Accent Text)</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Nội dung chữ</label>
                            <input className="w-full p-2 border rounded text-sm" value={storeConfig.heroSubtitle} onChange={(e) => handleContentChange('heroSubtitle', e.target.value)} />
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Màu chữ (Dùng màu Accent)</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-10 border rounded cursor-pointer" value={themeConfig.global.colors.accent} onChange={(e) => handleThemeChange('global.colors.accent', e.target.value)} />
                                <input className="border rounded px-2 w-full text-sm" value={themeConfig.global.colors.accent} onChange={(e) => handleThemeChange('global.colors.accent', e.target.value)} />
                            </div>
                        </div>
                    </div>
                );
            case 'hero_button':
                return (
                    <div className="animate-fade-in">
                        <BackButton />
                        <h3 className="text-lg font-bold mb-4">Nút bấm chính</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Màu nền nút (Primary Color)</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-10 border rounded cursor-pointer" value={themeConfig.global.colors.primary} onChange={(e) => handleThemeChange('global.colors.primary', e.target.value)} />
                                <input className="border rounded px-2 w-full text-sm" value={themeConfig.global.colors.primary} onChange={(e) => handleThemeChange('global.colors.primary', e.target.value)} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Thay đổi màu này sẽ ảnh hưởng toàn bộ nút bấm chính trên web.</p>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Bo góc nút (Border Radius)</label>
                            <select 
                                value={themeConfig.global.borderRadius} 
                                onChange={(e) => handleThemeChange('global.borderRadius', e.target.value)}
                                className="w-full p-2 border rounded bg-white text-sm"
                            >
                                <option value="0px">Vuông (Square)</option>
                                <option value="4px">Bo nhẹ (Small)</option>
                                <option value="8px">Bo vừa (Medium)</option>
                                <option value="9999px">Tròn (Rounded)</option>
                            </select>
                        </div>
                    </div>
                );

            // --- GLOBAL DEFAULT ---
            default:
                return (
                    <div className="animate-fade-in space-y-6">
                        <div className="border-b pb-4">
                            <h3 className="text-lg font-bold text-gray-800">Cấu hình chung</h3>
                            <p className="text-xs text-gray-500">Click vào các thành phần bên phải để sửa chi tiết.</p>
                        </div>

                        {/* GLOBAL COLORS */}
                        <div>
                            <h4 className="text-sm font-bold text-gray-600 uppercase mb-2">Màu sắc thương hiệu</h4>
                            <div className="space-y-3">
                                {[
                                    { key: 'primary', label: 'Màu chính (Primary)', desc: 'Nút bấm, giá tiền' },
                                    { key: 'secondary', label: 'Màu phụ (Secondary)', desc: 'Nền phụ' },
                                    { key: 'text', label: 'Màu chữ (Text)', desc: 'Văn bản chính' },
                                    { key: 'background', label: 'Màu nền web', desc: 'Nền toàn trang' },
                                ].map((c) => (
                                    <div key={c.key} className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{c.label}</p>
                                            <p className="text-[10px] text-gray-400">{c.desc}</p>
                                        </div>
                                        <input 
                                            type="color" 
                                            className="h-8 w-8 rounded cursor-pointer border-none bg-transparent"
                                            value={themeConfig.global.colors[c.key as keyof typeof themeConfig.global.colors]} 
                                            onChange={(e) => handleThemeChange(`global.colors.${c.key}`, e.target.value)} 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* GLOBAL FONTS */}
                        <div>
                            <h4 className="text-sm font-bold text-gray-600 uppercase mb-2">Font chữ toàn trang</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Font Tiêu đề</label>
                                    <select 
                                        value={themeConfig.global.typography.headingFont} 
                                        onChange={(e) => handleThemeChange('global.typography.headingFont', e.target.value)}
                                        className="w-full p-2 border rounded text-sm"
                                    >
                                        {fontOptions.map((g, i) => <optgroup key={i} label={g.label}>{g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Font Nội dung</label>
                                    <select 
                                        value={themeConfig.global.typography.bodyFont} 
                                        onChange={(e) => handleThemeChange('global.typography.bodyFont', e.target.value)}
                                        className="w-full p-2 border rounded text-sm"
                                    >
                                        {fontOptions.map((g, i) => <optgroup key={i} label={g.label}>{g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* FONT UPLOAD */}
                        <div className="bg-gray-50 p-3 rounded border">
                            <h4 className="text-xs font-bold uppercase mb-2 text-gray-500">Upload Font Riêng</h4>
                            <div className="flex gap-2 mb-2">
                                <input 
                                    className="border p-1 text-xs rounded flex-grow" 
                                    placeholder="Tên font (VD: UTM Avo)" 
                                    value={newFontName} 
                                    onChange={e => setNewFontName(e.target.value)} 
                                />
                            </div>
                            <div className="relative">
                                <input type="file" accept=".ttf,.otf,.woff" onChange={handleAddNewFont} disabled={isUploadingFont} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                                <button className="w-full bg-white border border-dashed border-gray-400 text-gray-600 text-xs py-2 rounded text-center hover:bg-gray-100">
                                    {isUploadingFont ? 'Đang tải...' : '+ Chọn file Font (.ttf/.otf)'}
                                </button>
                            </div>
                            {storeConfig.uploadedFonts && storeConfig.uploadedFonts.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {storeConfig.uploadedFonts.map(f => (
                                        <div key={f.id} className="flex justify-between text-xs bg-white p-1 rounded border">
                                            <span>{f.name}</span>
                                            <button onClick={() => handleDeleteFont(f.id)} className="text-red-500 font-bold">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ADVANCED CONTENT MNGT */}
                        <div className="pt-4 border-t">
                            <button onClick={() => setIsEditingTemplate(true)} className="w-full bg-white border text-gray-700 font-bold py-2 rounded text-xs mb-2 hover:bg-gray-50">Quản lý Mẫu (Templates)</button>
                            <button onClick={() => setIsEditingFeedback(true)} className="w-full bg-white border text-gray-700 font-bold py-2 rounded text-xs hover:bg-gray-50">Quản lý Feedback</button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] overflow-hidden bg-gray-100 rounded-xl shadow-inner border border-gray-200">
            {loading && (
                <div className="absolute inset-0 bg-black/20 z-[100] flex items-center justify-center">
                    <div className="bg-white p-4 rounded shadow flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                        <span>Đang lưu...</span>
                    </div>
                </div>
            )}

            {/* SIDEBAR (Dynamic Context) */}
            <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-10 shadow-lg">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="font-bold text-gray-800">Cấu hình</h2>
                    <button onClick={handleSaveConfig} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-green-700 shadow-sm">Lưu</button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {renderSidebar()}
                </div>
            </div>

            {/* PREVIEW AREA */}
            <div className="flex-grow bg-gray-200 p-4 overflow-hidden flex flex-col relative" onClick={() => setActiveElement('global_settings')}>
                <div className="bg-white/80 backdrop-blur-sm absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-gray-500 shadow-sm z-10 pointer-events-none">
                    CLICK VÀO THÀNH PHẦN ĐỂ CHỈNH SỬA
                </div>

                <div className="bg-white w-full h-full shadow-2xl rounded-lg overflow-y-auto custom-scrollbar relative border-4 border-gray-800/10">
                    <div 
                        className="min-h-full flex flex-col"
                        style={{ 
                            backgroundColor: themeConfig.global.colors.background,
                            color: themeConfig.global.colors.text,
                            fontFamily: themeConfig.global.typography.bodyFont 
                        }}
                    >
                        {/* --- HEADER --- */}
                        <SelectableZone id="header_bg" activeId={activeElement} onSelect={setActiveElement} label="Header Background" 
                            style={{ backgroundColor: themeConfig.sections.header.backgroundColor }}
                            className="sticky top-0 z-40 border-b border-gray-100"
                        >
                            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                                <SelectableZone id="logo" activeId={activeElement} onSelect={setActiveElement} label="Logo">
                                    {storeConfig.logoUrl ? (
                                        <img src={storeConfig.logoUrl} alt="Logo" className="h-10 object-contain" />
                                    ) : (
                                        <span className="font-heading text-2xl font-bold" style={{fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.global.colors.primary}}>The Luvin</span>
                                    )}
                                </SelectableZone>
                                <SelectableZone id="header_text" activeId={activeElement} onSelect={setActiveElement} label="Menu Text">
                                    <div className="hidden md:flex space-x-6 text-sm font-semibold" style={{ color: themeConfig.sections.header.textColor }}>
                                        <span>Trang chủ</span>
                                        <span>Thiết kế</span>
                                        <span>Bộ sưu tập</span>
                                        <span>Tra cứu</span>
                                        <span>Giỏ hàng (0)</span>
                                    </div>
                                </SelectableZone>
                            </div>
                        </SelectableZone>

                        {/* --- HERO --- */}
                        <SelectableZone id="hero_bg" activeId={activeElement} onSelect={setActiveElement} label="Nền Hero"
                            style={{ backgroundColor: themeConfig.sections.hero.backgroundColor }}
                            className="py-16 md:py-24 text-center relative overflow-hidden"
                        >
                            {storeConfig.heroImageUrl && (
                                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                                    <img src={storeConfig.heroImageUrl} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold opacity-60 tracking-[0.3em] uppercase">Christmas Edition</p>
                                    <h1 className="text-5xl md:text-7xl leading-[1.1]">
                                        <SelectableZone id="hero_title" activeId={activeElement} onSelect={setActiveElement} label="Tiêu đề chính" className="inline-block">
                                            <span style={{ fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.sections.hero.headingColor }}>
                                                {storeConfig.heroTitle || 'Unique for'}
                                            </span>
                                        </SelectableZone>
                                        <br/>
                                        <SelectableZone id="hero_subtitle" activeId={activeElement} onSelect={setActiveElement} label="Phụ đề" className="inline-block mt-2">
                                            <span className="italic font-light" style={{ color: themeConfig.global.colors.accent }}>
                                                {storeConfig.heroSubtitle || 'every moment'}
                                            </span>
                                        </SelectableZone>
                                    </h1>
                                </div>
                                <SelectableZone id="hero_button" activeId={activeElement} onSelect={setActiveElement} label="Nút bấm chính">
                                    <button
                                        className="h-14 px-8 flex items-center justify-center shadow-lg pointer-events-none"
                                        style={{ 
                                            backgroundColor: themeConfig.global.colors.primary, 
                                            color: '#fff', 
                                            borderRadius: themeConfig.global.borderRadius === '9999px' ? '9999px' : themeConfig.global.borderRadius
                                        }}
                                    >
                                        <span className="font-bold text-base">Bắt đầu thiết kế</span>
                                    </button>
                                </SelectableZone>
                            </div>
                        </SelectableZone>

                        {/* --- PRODUCT SAMPLE --- */}
                        <div className="py-12 bg-white container mx-auto px-6">
                            <h3 className="text-center text-xl font-bold mb-8" style={{fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.global.colors.text}}>Sản phẩm mẫu</h3>
                            <div className="flex justify-center">
                                <div 
                                    className="w-64 border p-4 shadow-sm group/card cursor-pointer pointer-events-none"
                                    style={{ 
                                        backgroundColor: '#fff',
                                        borderRadius: themeConfig.global.borderRadius,
                                        borderColor: themeConfig.global.colors.secondary
                                    }}
                                >
                                    <div className="w-full aspect-square bg-gray-100 mb-3 rounded-sm flex items-center justify-center text-gray-300">Image</div>
                                    <div className="flex justify-between items-center pointer-events-auto">
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">Khung LEGO</p>
                                            <p className="text-xs opacity-60 text-gray-500">Custom</p>
                                        </div>
                                        <SelectableZone id="global_settings" activeId={activeElement} onSelect={() => setActiveElement('global_settings')} label="Màu giá (Primary)">
                                            <span className="font-bold text-sm" style={{ color: themeConfig.global.colors.primary }}>
                                                250.000đ
                                            </span>
                                        </SelectableZone>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- FOOTER --- */}
                        <SelectableZone id="footer_bg" activeId={activeElement} onSelect={setActiveElement} label="Nền Footer"
                            style={{ backgroundColor: themeConfig.sections.footer.backgroundColor, color: themeConfig.sections.footer.textColor }}
                            className="p-10 border-t mt-auto"
                        >
                            <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
                                <div>
                                    <h3 className="font-bold text-lg mb-3" style={{ color: themeConfig.global.colors.primary, fontFamily: themeConfig.global.typography.headingFont }}>The Luvin</h3>
                                    <p className="opacity-70 text-xs">Nơi những mảnh ghép LEGO kể câu chuyện tình yêu.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-3 uppercase opacity-90">Liên hệ</h4>
                                    <p className="opacity-70 mb-1">Hotline: 0964 393 115</p>
                                    <p className="opacity-70">Email: theluvin.gifts@gmail.com</p>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-3 uppercase opacity-90">Hỗ trợ</h4>
                                    <p className="opacity-70 mb-1">Chính sách bảo hành</p>
                                    <p className="opacity-70">Tra cứu đơn hàng</p>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-3 uppercase opacity-90">Social</h4>
                                    <div className="flex gap-2 opacity-50">
                                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </SelectableZone>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isEditingTemplate && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={() => { setIsEditingTemplate(false); setEditingTemplate(null); }} />}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};
