
import React, { useState, useEffect, useRef } from 'react';
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

type ConfigTab = 'branding' | 'theme' | 'sections' | 'content' | 'fonts';

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

// --- HELPER COMPONENT: EDITABLE ZONE ---
// Đây là thành phần cốt lõi để giải quyết vấn đề "Click đâu sửa đó"
const EditableZone: React.FC<{
    onClick: () => void;
    label: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}> = ({ onClick, label, children, className = '', style }) => {
    return (
        <div
            className={`relative group/edit cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 hover:z-50 ${className}`}
            style={style}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // QUAN TRỌNG: Chặn sự kiện lan ra cha
                onClick();
            }}
            title={`Sửa: ${label}`}
        >
            {children}
            {/* Label hiển thị khi hover */}
            <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/edit:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] shadow-md font-sans">
                🖊️ {label}
            </div>
        </div>
    );
};

export const AdminConfig: React.FC<AdminConfigProps> = ({ storeConfig, setStoreConfig, templates, feedbacks, onRefreshTemplates, onRefreshFeedbacks }) => {
    const [activeTab, setActiveTab] = useState<ConfigTab>('branding');
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

    // Refs for scrolling to inputs
    const inputRefs = useRef<Record<string, HTMLElement | null>>({});

    // --- EFFECT: Load Fonts for Admin Preview ---
    useEffect(() => {
        const loadFonts = () => {
            const existingStyle = document.getElementById('admin-preview-fonts');
            if (existingStyle) existingStyle.remove();

            const style = document.createElement('style');
            style.id = 'admin-preview-fonts';
            let css = '';
            
            // Load Custom Fonts
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

    // Sync themeConfig when storeConfig changes
    useEffect(() => {
        if (storeConfig.theme) {
            setThemeConfig(storeConfig.theme);
        }
    }, [storeConfig]);

    // --- HANDLERS ---

    const handleThemeChange = (path: string, value: string) => {
        setThemeConfig(prev => {
            const newConfig = JSON.parse(JSON.stringify(prev)); // Deep copy
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

    const handleSaveConfig = async () => {
        setLoading(true);
        // Save both storeConfig fields and themeConfig
        const success = await updateStoreConfig({ 
            ...storeConfig,
            theme: themeConfig 
        });
        if (success) {
            alert("Đã lưu cấu hình Theme thành công! Website sẽ tải lại để áp dụng.");
            window.location.reload();
        } else {
            alert("Lỗi lưu cấu hình.");
        }
        setLoading(false);
    };

    const handleConfigUpload = async (file: File, field: keyof StoreConfig) => {
        setUploadingField(field);
        try {
            const url = await uploadToCloudinary(file);
            if (url) {
                const updates = { [field]: url };
                await updateStoreConfig(updates);
                setStoreConfig(prev => ({ ...prev, ...updates }));
                alert(`Đã cập nhật hình ảnh thành công!`);
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

    // --- FONT MANAGEMENT HANDLERS ---
    const handleAddNewFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!newFontName.trim()) {
            alert("Vui lòng nhập tên font trước khi chọn file.");
            e.target.value = ''; 
            return;
        }

        if (e.target.files && e.target.files[0]) {
            setIsUploadingFont(true);
            try {
                const file = e.target.files[0];
                const url = await uploadToCloudinary(file);
                
                if (url) {
                    const newFont: CustomFont = {
                        id: `font_${Date.now()}`,
                        name: newFontName.trim(),
                        url: url
                    };
                    
                    const updatedFonts = [...(storeConfig.uploadedFonts || []), newFont];
                    await updateStoreConfig({ uploadedFonts: updatedFonts });
                    setStoreConfig(prev => ({ ...prev, uploadedFonts: updatedFonts }));
                    setNewFontName('');
                    alert(`Đã thêm font "${newFont.name}" thành công!`);
                } else {
                    alert("Lỗi upload file font.");
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload font.");
            } finally {
                setIsUploadingFont(false);
            }
        }
    };

    const handleDeleteFont = async (fontId: string) => {
        if(confirm("Bạn có chắc muốn xóa font này?")) {
            const updatedFonts = (storeConfig.uploadedFonts || []).filter(f => f.id !== fontId);
            await updateStoreConfig({ uploadedFonts: updatedFonts });
            setStoreConfig(prev => ({ ...prev, uploadedFonts: updatedFonts }));
        }
    };

    const handleResetTheme = () => {
        if(confirm("Bạn có chắc muốn quay về giao diện mặc định?")) {
            setThemeConfig(DEFAULT_THEME);
        }
    }

    // --- VISUAL EDITING HANDLER ---
    const scrollToField = (tab: ConfigTab, fieldKey: string) => {
        setActiveTab(tab);
        // Wait for tab switch
        setTimeout(() => {
            const element = inputRefs.current[fieldKey];
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.focus();
                
                // Highlight visual cue
                element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50');
                setTimeout(() => {
                    element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50');
                }, 1500);
            } else {
                console.warn(`Element ref not found for key: ${fieldKey}`);
            }
        }, 100);
    };

    // Template & Feedback Handlers
    const handleSaveTemplate = async (tpl: CollectionTemplate) => { setIsEditingTemplate(false); if (editingTemplate) await updateTemplate(tpl.id, tpl); else await addTemplate(tpl); onRefreshTemplates(); setEditingTemplate(null); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteTemplate(id); onRefreshTemplates(); } };
    const handleSaveFeedback = async (fb: FeedbackItem) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(fb.id, fb); else await addFeedback(fb); onRefreshFeedbacks(); setEditingFeedback(null); };
    const handleDeleteFeedback = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteFeedback(id); onRefreshFeedbacks(); } };

    // Font Options
    const fontOptions = [
        { label: '--- Google Fonts ---', options: GOOGLE_FONTS.map(f => ({ value: f.name, label: f.label })) },
        { label: '--- Custom Fonts ---', options: (storeConfig.uploadedFonts || []).map(f => ({ value: f.name, label: `${f.name} (Uploaded)` })) }
    ];

    return (
        <div className="animate-fade-in relative min-h-screen pb-20">
            {loading && (
                <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded shadow flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                        <span>Đang xử lý...</span>
                    </div>
                </div>
            )}

            {/* Top Navigation for Config */}
            <div className="sticky top-16 z-20 bg-gray-50 pt-4 pb-2 border-b mb-6 overflow-x-auto no-scrollbar">
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('branding')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'branding' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Hình ảnh & Logo</button>
                    <button onClick={() => setActiveTab('theme')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'theme' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Màu & Font</button>
                    <button onClick={() => setActiveTab('sections')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'sections' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Chi tiết</button>
                    <button onClick={() => setActiveTab('content')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'content' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Nội dung</button>
                    <button onClick={() => setActiveTab('fonts')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'fonts' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Quản lý Font</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* --- LEFT PANEL: CONTROLS (4 Columns) --- */}
                <div className="lg:col-span-4 space-y-8 order-2 lg:order-1 h-[calc(100vh-180px)] overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* BRANDING TAB */}
                    {activeTab === 'branding' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Hình ảnh thương hiệu</h3>
                            <div ref={(el) => { inputRefs.current['logoUrl'] = el; }}>
                                <ConfigImageUpload label="Logo Website" description="Header & Footer (PNG trong suốt)" currentUrl={storeConfig.logoUrl} onUpload={(f) => handleConfigUpload(f, 'logoUrl')} isUploading={uploadingField === 'logoUrl'} />
                            </div>
                            <div ref={(el) => { inputRefs.current['faviconUrl'] = el; }}>
                                <ConfigImageUpload label="Favicon" description="Icon tab trình duyệt (Vuông)" currentUrl={storeConfig.faviconUrl} onUpload={(f) => handleConfigUpload(f, 'faviconUrl')} isUploading={uploadingField === 'faviconUrl'} />
                            </div>
                            <div ref={(el) => { inputRefs.current['heroImageUrl'] = el; }}>
                                <ConfigImageUpload label="Banner Hero" description="Ảnh lớn đầu trang chủ" currentUrl={storeConfig.heroImageUrl} onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')} isUploading={uploadingField === 'heroImageUrl'} />
                            </div>
                            <ConfigImageUpload label="Banner Inspire" description="Ảnh nền phần Collection" currentUrl={storeConfig.inspireImageUrl} onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')} isUploading={uploadingField === 'inspireImageUrl'} />
                        </div>
                    )}

                    {/* THEME TAB */}
                    {activeTab === 'theme' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Cấu hình Giao diện Chung</h3>
                            
                            {/* Colors */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Bảng màu (Global)</h4>
                                <div className="space-y-3">
                                    {[
                                        { key: 'primary', label: 'Màu chính (Primary)', desc: 'Nút bấm, điểm nhấn, giá tiền' },
                                        { key: 'secondary', label: 'Màu phụ (Secondary)', desc: 'Nền phụ, khối trang trí' },
                                        { key: 'text', label: 'Màu chữ (Text)', desc: 'Văn bản chính' },
                                        { key: 'background', label: 'Màu nền (Background)', desc: 'Nền toàn trang' },
                                        { key: 'accent', label: 'Màu nhấn (Accent)', desc: 'Icon, chi tiết nhỏ' },
                                    ].map((color) => (
                                        <div key={color.key} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                                            <div>
                                                <p className="text-sm font-bold">{color.label}</p>
                                                <p className="text-xs text-gray-400">{color.desc}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    ref={(el) => { inputRefs.current[`global.colors.${color.key}`] = el; }}
                                                    type="color" 
                                                    value={themeConfig.global.colors[color.key as keyof typeof themeConfig.global.colors]} 
                                                    onChange={(e) => handleThemeChange(`global.colors.${color.key}`, e.target.value)}
                                                    className="w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Typography & Shape */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Font chữ & Kiểu dáng</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Font Tiêu đề (Headings)</label>
                                        <select 
                                            ref={(el) => { inputRefs.current['global.typography.headingFont'] = el; }}
                                            value={themeConfig.global.typography.headingFont} 
                                            onChange={(e) => handleThemeChange('global.typography.headingFont', e.target.value)}
                                            className="w-full p-2 border rounded bg-white text-sm"
                                        >
                                            {fontOptions.map((group, idx) => (
                                                <optgroup key={idx} label={group.label}>
                                                    {group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Font Nội dung (Body)</label>
                                        <select 
                                            ref={(el) => { inputRefs.current['global.typography.bodyFont'] = el; }}
                                            value={themeConfig.global.typography.bodyFont} 
                                            onChange={(e) => handleThemeChange('global.typography.bodyFont', e.target.value)}
                                            className="w-full p-2 border rounded bg-white text-sm"
                                        >
                                            {fontOptions.map((group, idx) => (
                                                <optgroup key={idx} label={group.label}>
                                                    {group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Bo góc (Border Radius)</label>
                                        <select 
                                            ref={(el) => { inputRefs.current['global.borderRadius'] = el; }}
                                            value={themeConfig.global.borderRadius} 
                                            onChange={(e) => handleThemeChange('global.borderRadius', e.target.value)}
                                            className="w-full p-2 border rounded bg-white text-sm"
                                        >
                                            <option value="0px">Vuông (Square)</option>
                                            <option value="4px">Bo nhẹ (Small)</option>
                                            <option value="8px">Bo vừa (Medium - Default)</option>
                                            <option value="16px">Bo lớn (Large)</option>
                                            <option value="9999px">Tròn (Rounded)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTIONS TAB */}
                    {activeTab === 'sections' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Tùy chỉnh từng phần</h3>
                            
                            {['header', 'hero', 'footer'].map(section => (
                                <div key={section} className="p-4 border rounded-lg bg-gray-50">
                                    <h4 className="text-md font-bold text-gray-800 capitalize mb-3">{section}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold block mb-1">Màu nền</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    ref={(el) => { inputRefs.current[`sections.${section}.backgroundColor`] = el; }}
                                                    type="color" 
                                                    className="h-8 w-8 rounded cursor-pointer" 
                                                    value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.backgroundColor || '#ffffff'} 
                                                    onChange={(e) => handleThemeChange(`sections.${section}.backgroundColor`, e.target.value)} 
                                                />
                                                <input className="text-xs border rounded w-full px-2" value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.backgroundColor || ''} onChange={(e) => handleThemeChange(`sections.${section}.backgroundColor`, e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold block mb-1">Màu chữ</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    ref={(el) => { inputRefs.current[`sections.${section}.textColor`] = el; }}
                                                    type="color" 
                                                    className="h-8 w-8 rounded cursor-pointer" 
                                                    value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.textColor || '#000000'} 
                                                    onChange={(e) => handleThemeChange(`sections.${section}.textColor`, e.target.value)} 
                                                />
                                                <input className="text-xs border rounded w-full px-2" value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.textColor || ''} onChange={(e) => handleThemeChange(`sections.${section}.textColor`, e.target.value)} />
                                            </div>
                                        </div>
                                        {section === 'hero' && (
                                            <div>
                                                <label className="text-xs font-semibold block mb-1">Màu tiêu đề lớn</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        ref={(el) => { inputRefs.current[`sections.hero.headingColor`] = el; }}
                                                        type="color" 
                                                        className="h-8 w-8 rounded cursor-pointer" 
                                                        value={themeConfig.sections.hero?.headingColor || '#000000'} 
                                                        onChange={(e) => handleThemeChange(`sections.hero.headingColor`, e.target.value)} 
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CONTENT TAB */}
                    {activeTab === 'content' && (
                        <div className="space-y-8">
                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                <h3 className="text-lg font-bold mb-4">Nội dung Trang chủ</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Tiêu đề Hero (Dòng 1)</label>
                                        <input 
                                            ref={(el) => { inputRefs.current['heroTitle'] = el; }}
                                            value={storeConfig.heroTitle || 'Unique for'} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setStoreConfig(prev => ({...prev, heroTitle: val}));
                                            }}
                                            onBlur={async (e) => await updateStoreConfig({ heroTitle: e.target.value })}
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Tiêu đề Hero (Dòng 2 - Accent)</label>
                                        <input 
                                            ref={(el) => { inputRefs.current['heroSubtitle'] = el; }}
                                            value={storeConfig.heroSubtitle || 'every moment'} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setStoreConfig(prev => ({...prev, heroSubtitle: val}));
                                            }}
                                            onBlur={async (e) => await updateStoreConfig({ heroSubtitle: e.target.value })}
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold">Mẫu (Templates)</h3>
                                    <button onClick={() => setIsEditingTemplate(true)} className="px-3 py-1 bg-green-600 text-white rounded text-sm font-bold">+ Thêm</button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {templates.map(tpl => (
                                        <div key={tpl.id} className="border p-2 rounded flex justify-between items-center bg-gray-50">
                                            <span className="text-sm font-medium truncate w-32">{tpl.name}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditingTemplate(tpl); setIsEditingTemplate(true); }} className="text-blue-600 text-xs font-bold p-1">Sửa</button>
                                                <button onClick={() => handleDeleteTemplate(tpl.id)} className="text-red-600 text-xs font-bold p-1">Xóa</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold">Feedbacks</h3>
                                    <button onClick={() => setIsEditingFeedback(true)} className="px-3 py-1 bg-green-600 text-white rounded text-sm font-bold">+ Thêm</button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {feedbacks.map(fb => (
                                        <div key={fb.id} className="border p-2 rounded flex justify-between items-center bg-gray-50">
                                            <span className="text-sm font-medium truncate w-32">{fb.name}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditingFeedback(fb); setIsEditingFeedback(true); }} className="text-blue-600 text-xs font-bold p-1">Sửa</button>
                                                <button onClick={() => handleDeleteFeedback(fb.id)} className="text-red-600 text-xs font-bold p-1">Xóa</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FONTS TAB */}
                    {activeTab === 'fonts' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Quản lý Font chữ (Upload)</h3>
                            <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="text-sm font-bold mb-3">Thêm font mới</h4>
                                <div className="flex gap-4 items-end">
                                    <div className="flex-grow">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Tên Font (Hiển thị)</label>
                                        <input 
                                            type="text" 
                                            placeholder="VD: My Brand Font" 
                                            className="w-full p-2 border rounded text-sm"
                                            value={newFontName}
                                            onChange={(e) => setNewFontName(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-grow">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">File Font (.ttf, .otf, .woff)</label>
                                        <div className="relative">
                                            <input 
                                                type="file" 
                                                accept=".ttf,.otf,.woff,.woff2" 
                                                onChange={handleAddNewFont}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={isUploadingFont}
                                            />
                                            <button className={`w-full p-2 border rounded text-sm bg-white text-left ${isUploadingFont ? 'text-gray-400' : 'text-gray-700'}`}>
                                                {isUploadingFont ? 'Đang upload...' : 'Chọn file & Upload'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic">* Lưu ý: Đặt tên font trước khi chọn file.</p>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold mb-3">Danh sách Font đã upload</h4>
                                {storeConfig.uploadedFonts && storeConfig.uploadedFonts.length > 0 ? (
                                    <div className="space-y-2">
                                        {storeConfig.uploadedFonts.map(font => (
                                            <div key={font.id} className="flex justify-between items-center p-3 border rounded bg-gray-50">
                                                <div>
                                                    <p className="font-bold text-sm" style={{fontFamily: font.name}}>{font.name} (Preview)</p>
                                                    <a href={font.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate max-w-[200px] block">{font.url}</a>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteFont(font.id)}
                                                    className="text-red-600 hover:bg-red-100 p-2 rounded text-xs font-bold"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">Chưa có font nào được upload.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex justify-end gap-4 border-t pt-4 sticky bottom-0 bg-gray-50 p-4 -mx-4 -mb-4">
                        <button onClick={handleResetTheme} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded">Reset Mặc định</button>
                        <button onClick={handleSaveConfig} className="px-6 py-2 bg-gray-900 text-white font-bold rounded hover:bg-black shadow-lg">Lưu Tất Cả Thay Đổi</button>
                    </div>
                </div>

                {/* --- RIGHT PANEL: VISUAL PREVIEW (8 Columns) --- */}
                <div className="lg:col-span-8 order-1 lg:order-2">
                    <div className="sticky top-24 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                        <div className="bg-gray-100 p-3 border-b flex justify-between items-center flex-shrink-0">
                            <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <span>🖥️ Live Preview (Click để sửa)</span>
                            </span>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                            </div>
                        </div>
                        
                        {/* Simulated Website - FULL HEIGHT PREVIEW */}
                        <div 
                            className="flex-grow overflow-y-auto custom-scrollbar relative"
                            style={{ 
                                backgroundColor: themeConfig.global.colors.background,
                                color: themeConfig.global.colors.text,
                                fontFamily: themeConfig.global.typography.bodyFont 
                            }}
                        >
                            {/* --- HEADER PREVIEW --- */}
                            <EditableZone 
                                onClick={() => scrollToField('sections', 'sections.header.backgroundColor')} 
                                label="Nền Header"
                                className="border-b"
                                style={{ 
                                    backgroundColor: themeConfig.sections.header.backgroundColor,
                                    color: themeConfig.sections.header.textColor 
                                }}
                            >
                                <div className="container mx-auto px-6 py-4 flex justify-between items-center pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <EditableZone 
                                            onClick={() => scrollToField('branding', 'logoUrl')} 
                                            label="Logo"
                                        >
                                            <div className="font-bold text-2xl">
                                                {storeConfig.logoUrl ? (
                                                    <img src={storeConfig.logoUrl} alt="Logo" className="h-12 object-contain" />
                                                ) : (
                                                    <span style={{ 
                                                        fontFamily: themeConfig.global.typography.headingFont,
                                                        color: themeConfig.global.colors.primary 
                                                    }}>The Luvin</span>
                                                )}
                                            </div>
                                        </EditableZone>
                                    </div>
                                    <div className="hidden md:flex items-center space-x-6 text-sm font-semibold opacity-80 pointer-events-auto">
                                        <EditableZone 
                                            onClick={() => scrollToField('sections', 'sections.header.textColor')} 
                                            label="Menu Text"
                                        >
                                            <div className="flex gap-6">
                                                <span>Trang chủ</span>
                                                <span>Thiết kế</span>
                                                <span>Bộ sưu tập</span>
                                                <span>Tra cứu</span>
                                                <span>Giỏ hàng (0)</span>
                                            </div>
                                        </EditableZone>
                                    </div>
                                </div>
                            </EditableZone>

                            {/* --- HERO PREVIEW --- */}
                            <EditableZone
                                onClick={() => scrollToField('sections', 'sections.hero.backgroundColor')}
                                label="Nền Hero Section"
                                style={{ 
                                    backgroundColor: themeConfig.sections.hero.backgroundColor,
                                    color: themeConfig.sections.hero.textColor 
                                }}
                                className="py-16 md:py-24 text-center"
                            >
                                <div className="container mx-auto px-6 relative z-10 flex flex-col items-center pointer-events-none">
                                    <div className="mb-8 pointer-events-auto">
                                        <p className="text-[10px] font-bold opacity-60 tracking-[0.3em] uppercase mb-4">Christmas Edition</p>
                                        <h1 className="text-5xl md:text-7xl leading-[1.1] rounded transition-colors -m-2">
                                            <EditableZone 
                                                onClick={() => scrollToField('content', 'heroTitle')} 
                                                label="Tiêu đề chính"
                                                className="inline-block"
                                            >
                                                <span 
                                                    style={{ fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.sections.hero.headingColor }}
                                                >
                                                    {storeConfig.heroTitle || 'Unique for'}
                                                </span>
                                            </EditableZone>
                                            <br/>
                                            <EditableZone 
                                                onClick={() => scrollToField('content', 'heroSubtitle')} 
                                                label="Phụ đề"
                                                className="inline-block mt-2"
                                            >
                                                <span 
                                                    className="italic font-light" 
                                                    style={{ color: themeConfig.global.colors.accent }}
                                                >
                                                    {storeConfig.heroSubtitle || 'every moment'}
                                                </span>
                                            </EditableZone>
                                        </h1>
                                    </div>

                                    <div className="pointer-events-auto">
                                        <EditableZone 
                                            onClick={() => scrollToField('theme', 'global.colors.primary')} 
                                            label="Nút bấm (Primary Color)"
                                        >
                                            <button
                                                className="h-14 px-8 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95"
                                                style={{ 
                                                    backgroundColor: themeConfig.global.colors.primary, 
                                                    color: '#fff', 
                                                    borderRadius: themeConfig.global.borderRadius === '9999px' ? '9999px' : themeConfig.global.borderRadius
                                                }}
                                            >
                                                <span className="font-bold text-base tracking-wide">Bắt đầu thiết kế</span>
                                            </button>
                                        </EditableZone>
                                    </div>
                                </div>
                            </EditableZone>

                            {/* --- PRODUCT CARD PREVIEW --- */}
                            <div className="py-12 bg-white container mx-auto px-6">
                                <h3 className="text-center text-2xl font-bold mb-8" style={{ fontFamily: themeConfig.global.typography.headingFont }}>Sản phẩm mẫu</h3>
                                <div className="flex justify-center">
                                    <EditableZone 
                                        onClick={() => scrollToField('theme', 'global.borderRadius')} 
                                        label="Bo góc Card (Global Radius)"
                                    >
                                        <div 
                                            className="w-64 border p-4 shadow-sm group/card cursor-pointer"
                                            style={{ 
                                                backgroundColor: '#fff',
                                                borderRadius: themeConfig.global.borderRadius,
                                                borderColor: themeConfig.global.colors.secondary
                                            }}
                                        >
                                            <div className="w-full aspect-square bg-gray-100 mb-3 rounded-sm flex items-center justify-center text-gray-300">Image</div>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm">Khung LEGO</p>
                                                    <p className="text-xs opacity-60">Custom</p>
                                                </div>
                                                <EditableZone 
                                                    onClick={() => scrollToField('theme', 'global.colors.primary')} 
                                                    label="Màu giá tiền (Primary)"
                                                >
                                                    <span 
                                                        className="font-bold p-1 rounded"
                                                        style={{ color: themeConfig.global.colors.primary }}
                                                    >
                                                        250.000đ
                                                    </span>
                                                </EditableZone>
                                            </div>
                                        </div>
                                    </EditableZone>
                                </div>
                            </div>

                            {/* --- FOOTER PREVIEW --- */}
                            <EditableZone
                                onClick={() => scrollToField('sections', 'sections.footer.backgroundColor')}
                                label="Nền Footer"
                                style={{ 
                                    backgroundColor: themeConfig.sections.footer.backgroundColor,
                                    color: themeConfig.sections.footer.textColor 
                                }}
                                className="p-10 border-t mt-auto"
                            >
                                <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <EditableZone 
                                            onClick={() => scrollToField('theme', 'global.typography.headingFont')} 
                                            label="Font Tiêu đề Footer"
                                        >
                                            <h3 
                                                className="font-bold text-lg mb-3 inline-block" 
                                                style={{ color: themeConfig.global.colors.primary, fontFamily: themeConfig.global.typography.headingFont }}
                                            >
                                                The Luvin
                                            </h3>
                                        </EditableZone>
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
                                        <div className="flex gap-2">
                                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </EditableZone>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isEditingTemplate && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={() => { setIsEditingTemplate(false); setEditingTemplate(null); }} />}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};
