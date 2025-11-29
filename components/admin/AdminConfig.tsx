
import React, { useState, useEffect } from 'react';
import { CollectionTemplate, FeedbackItem, ThemeConfig } from '../../types';
import { StoreConfig, updateStoreConfig, DEFAULT_THEME } from '../../services/configService';
import { addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../../services/templateService';
import { addFeedback, updateFeedback, deleteFeedback, seedFeedbacks } from '../../services/feedbackService';
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

type ConfigTab = 'branding' | 'theme' | 'sections' | 'content';

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

const PREVIEW_SECTIONS = ['Header', 'Hero', 'Footer'];

export const AdminConfig: React.FC<AdminConfigProps> = ({ storeConfig, setStoreConfig, templates, feedbacks, onRefreshTemplates, onRefreshFeedbacks }) => {
    const [activeTab, setActiveTab] = useState<ConfigTab>('branding');
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(storeConfig.theme || DEFAULT_THEME);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Edit Modal States
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);

    // Sync themeConfig when storeConfig changes (initial load)
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
        const success = await updateStoreConfig({ theme: themeConfig });
        if (success) {
            setStoreConfig(prev => ({ ...prev, theme: themeConfig }));
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
                await updateStoreConfig({ [field]: url });
                setStoreConfig(prev => ({ ...prev, [field]: url }));
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

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLoading(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    handleThemeChange('global.typography.customFontUrl', url);
                    handleThemeChange('global.typography.headingFont', 'CustomBrandFont');
                } else {
                    alert("Lỗi upload font.");
                }
            } catch (error) {
                alert("Lỗi upload font.");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleResetTheme = () => {
        if(confirm("Bạn có chắc muốn quay về giao diện mặc định?")) {
            setThemeConfig(DEFAULT_THEME);
        }
    }

    // Template & Feedback Handlers
    const handleSaveTemplate = async (tpl: CollectionTemplate) => { setIsEditingTemplate(false); if (editingTemplate) await updateTemplate(tpl.id, tpl); else await addTemplate(tpl); onRefreshTemplates(); setEditingTemplate(null); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteTemplate(id); onRefreshTemplates(); } };
    const handleSaveFeedback = async (fb: FeedbackItem) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(fb.id, fb); else await addFeedback(fb); onRefreshFeedbacks(); setEditingFeedback(null); };
    const handleDeleteFeedback = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteFeedback(id); onRefreshFeedbacks(); } };

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
                    <button onClick={() => setActiveTab('theme')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'theme' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Theme Toàn Trang</button>
                    <button onClick={() => setActiveTab('sections')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'sections' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Theme Chi tiết</button>
                    <button onClick={() => setActiveTab('content')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'content' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Nội dung & Mẫu</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* --- LEFT PANEL: CONTROLS --- */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* BRANDING TAB */}
                    {activeTab === 'branding' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Hình ảnh thương hiệu</h3>
                            <ConfigImageUpload label="Logo Website" description="Header & Footer (PNG trong suốt)" currentUrl={storeConfig.logoUrl} onUpload={(f) => handleConfigUpload(f, 'logoUrl')} isUploading={uploadingField === 'logoUrl'} />
                            <ConfigImageUpload label="Favicon" description="Icon tab trình duyệt (Vuông)" currentUrl={storeConfig.faviconUrl} onUpload={(f) => handleConfigUpload(f, 'faviconUrl')} isUploading={uploadingField === 'faviconUrl'} />
                            <ConfigImageUpload label="Banner Hero" description="Ảnh lớn đầu trang chủ" currentUrl={storeConfig.heroImageUrl} onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')} isUploading={uploadingField === 'heroImageUrl'} />
                            <ConfigImageUpload label="Banner Inspire" description="Ảnh nền phần Collection" currentUrl={storeConfig.inspireImageUrl} onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')} isUploading={uploadingField === 'inspireImageUrl'} />
                        </div>
                    )}

                    {/* THEME TAB */}
                    {activeTab === 'theme' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Cấu hình Giao diện Chung</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                        type="color" 
                                                        value={themeConfig.global.colors[color.key as keyof typeof themeConfig.global.colors]} 
                                                        onChange={(e) => handleThemeChange(`global.colors.${color.key}`, e.target.value)}
                                                        className="w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={themeConfig.global.colors[color.key as keyof typeof themeConfig.global.colors]} 
                                                        onChange={(e) => handleThemeChange(`global.colors.${color.key}`, e.target.value)}
                                                        className="w-20 text-xs border rounded text-center uppercase"
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
                                                value={themeConfig.global.typography.headingFont} 
                                                onChange={(e) => handleThemeChange('global.typography.headingFont', e.target.value)}
                                                className="w-full p-2 border rounded bg-white text-sm"
                                            >
                                                <option value="CustomBrandFont">Custom Font (Upload)</option>
                                                {GOOGLE_FONTS.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
                                            </select>
                                            {themeConfig.global.typography.headingFont === 'CustomBrandFont' && (
                                                <div className="mt-2 text-xs">
                                                    <input type="file" accept=".ttf,.otf,.woff2" onChange={handleFontUpload} className="block w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>
                                                    <p className="mt-1 text-gray-400">Current: {themeConfig.global.typography.customFontUrl ? 'Uploaded' : 'None'}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-1">Font Nội dung (Body)</label>
                                            <select 
                                                value={themeConfig.global.typography.bodyFont} 
                                                onChange={(e) => handleThemeChange('global.typography.bodyFont', e.target.value)}
                                                className="w-full p-2 border rounded bg-white text-sm"
                                            >
                                                {GOOGLE_FONTS.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-1">Bo góc (Border Radius)</label>
                                            <select 
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
                        </div>
                    )}

                    {/* SECTIONS TAB */}
                    {activeTab === 'sections' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Tùy chỉnh từng phần (Sections)</h3>
                            
                            {['header', 'hero', 'footer'].map(section => (
                                <div key={section} className="p-4 border rounded-lg bg-gray-50">
                                    <h4 className="text-md font-bold text-gray-800 capitalize mb-3">{section}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold block mb-1">Màu nền</label>
                                            <div className="flex gap-2">
                                                <input type="color" className="h-8 w-8 rounded cursor-pointer" value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.backgroundColor || '#ffffff'} onChange={(e) => handleThemeChange(`sections.${section}.backgroundColor`, e.target.value)} />
                                                <input className="text-xs border rounded w-full px-2" value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.backgroundColor || ''} onChange={(e) => handleThemeChange(`sections.${section}.backgroundColor`, e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold block mb-1">Màu chữ</label>
                                            <div className="flex gap-2">
                                                <input type="color" className="h-8 w-8 rounded cursor-pointer" value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.textColor || '#000000'} onChange={(e) => handleThemeChange(`sections.${section}.textColor`, e.target.value)} />
                                                <input className="text-xs border rounded w-full px-2" value={themeConfig.sections[section as keyof typeof themeConfig.sections]?.textColor || ''} onChange={(e) => handleThemeChange(`sections.${section}.textColor`, e.target.value)} />
                                            </div>
                                        </div>
                                        {section === 'hero' && (
                                            <div>
                                                <label className="text-xs font-semibold block mb-1">Màu tiêu đề lớn</label>
                                                <div className="flex gap-2">
                                                    <input type="color" className="h-8 w-8 rounded cursor-pointer" value={themeConfig.sections.hero?.headingColor || '#000000'} onChange={(e) => handleThemeChange(`sections.hero.headingColor`, e.target.value)} />
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
                                            value={storeConfig.heroTitle || 'Unique for'} 
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                setStoreConfig(prev => ({...prev, heroTitle: val}));
                                                await updateStoreConfig({ heroTitle: val });
                                            }}
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Tiêu đề Hero (Dòng 2 - Accent)</label>
                                        <input 
                                            value={storeConfig.heroSubtitle || 'every moment'} 
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                setStoreConfig(prev => ({...prev, heroSubtitle: val}));
                                                await updateStoreConfig({ heroSubtitle: val });
                                            }}
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

                    {/* Action Bar */}
                    <div className="flex justify-end gap-4 border-t pt-4 sticky bottom-0 bg-gray-50 p-4 -mx-4 -mb-4">
                        <button onClick={handleResetTheme} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded">Reset Mặc định</button>
                        <button onClick={handleSaveConfig} className="px-6 py-2 bg-gray-900 text-white font-bold rounded hover:bg-black shadow-lg">Lưu Tất Cả Thay Đổi</button>
                    </div>
                </div>

                {/* --- RIGHT PANEL: LIVE PREVIEW --- */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="bg-gray-100 p-3 border-b flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase">Live Preview (Mô phỏng)</span>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                            </div>
                        </div>
                        
                        {/* Simulated Website */}
                        <div 
                            className="p-0 overflow-y-auto max-h-[600px] no-scrollbar transition-all duration-300"
                            style={{ 
                                backgroundColor: themeConfig.global.colors.background,
                                color: themeConfig.global.colors.text,
                                fontFamily: themeConfig.global.typography.bodyFont 
                            }}
                        >
                            {/* Mock Header */}
                            <div 
                                className="p-4 flex justify-between items-center border-b"
                                style={{ 
                                    backgroundColor: themeConfig.sections.header.backgroundColor,
                                    color: themeConfig.sections.header.textColor 
                                }}
                            >
                                <span 
                                    className="font-bold text-lg"
                                    style={{ 
                                        fontFamily: themeConfig.global.typography.headingFont,
                                        color: themeConfig.global.colors.primary 
                                    }}
                                >
                                    The Luvin
                                </span>
                                <div className="flex gap-3 text-xs font-bold opacity-70">
                                    <span>Home</span>
                                    <span>Shop</span>
                                    <span>Contact</span>
                                </div>
                            </div>

                            {/* Mock Hero */}
                            <div 
                                className="p-8 text-center"
                                style={{ 
                                    backgroundColor: themeConfig.sections.hero.backgroundColor,
                                    color: themeConfig.sections.hero.textColor 
                                }}
                            >
                                <h2 
                                    className="text-3xl mb-2 font-bold"
                                    style={{ 
                                        fontFamily: themeConfig.global.typography.headingFont,
                                        color: themeConfig.sections.hero.headingColor 
                                    }}
                                >
                                    Unique Gift
                                </h2>
                                <p className="text-sm opacity-80 mb-4">Every moment matters</p>
                                <button 
                                    className="px-6 py-2 text-sm font-bold text-white shadow-md transition-transform active:scale-95"
                                    style={{ 
                                        backgroundColor: themeConfig.global.colors.primary,
                                        borderRadius: themeConfig.global.borderRadius 
                                    }}
                                >
                                    Mua Ngay
                                </button>
                            </div>

                            {/* Mock Product Card */}
                            <div className="p-6">
                                <h3 className="text-sm font-bold mb-4 uppercase text-gray-400">Sản phẩm mẫu</h3>
                                <div 
                                    className="border p-4 shadow-sm"
                                    style={{ 
                                        backgroundColor: '#fff',
                                        borderRadius: themeConfig.global.borderRadius,
                                        borderColor: themeConfig.global.colors.secondary
                                    }}
                                >
                                    <div className="w-full h-32 bg-gray-100 mb-3 rounded-sm flex items-center justify-center text-gray-300">Image</div>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-sm">Khung LEGO</p>
                                            <p className="text-xs opacity-60">Custom</p>
                                        </div>
                                        <span 
                                            className="font-bold"
                                            style={{ color: themeConfig.global.colors.primary }}
                                        >
                                            250.000đ
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Mock Footer */}
                            <div 
                                className="p-6 text-center text-xs mt-4"
                                style={{ 
                                    backgroundColor: themeConfig.sections.footer.backgroundColor,
                                    color: themeConfig.sections.footer.textColor 
                                }}
                            >
                                <p className="font-bold mb-2">The Luvin Store</p>
                                <p className="opacity-70">Designed for love.</p>
                            </div>
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
