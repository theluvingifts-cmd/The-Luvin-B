
import React, { useState, useEffect } from 'react';
import { CollectionTemplate, FeedbackItem } from '../../types';
import { StoreConfig, updateStoreConfig } from '../../services/configService';
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

type ConfigSubTab = 'general' | 'templates' | 'feedbacks';

const GOOGLE_FONTS = [
    { name: 'BrandFont', label: 'Brand Font (Gốc)' },
    { name: 'Playfair Display', label: 'Playfair Display (Serif)' },
    { name: 'Montserrat', label: 'Montserrat (Sans)' },
    { name: 'Roboto', label: 'Roboto' },
    { name: 'Open Sans', label: 'Open Sans' },
    { name: 'Merriweather', label: 'Merriweather' },
    { name: 'Dancing Script', label: 'Dancing Script (Cursive)' },
    { name: 'Lora', label: 'Lora' },
    { name: 'Nunito', label: 'Nunito' },
    { name: 'Pacifico', label: 'Pacifico' }
];

export const AdminConfig: React.FC<AdminConfigProps> = ({ storeConfig, setStoreConfig, templates, feedbacks, onRefreshTemplates, onRefreshFeedbacks }) => {
    const [activeConfigSubTab, setActiveConfigSubTab] = useState<ConfigSubTab>('general');
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);
    const [loading, setLoading] = useState(false);

    // Config form state for live editing before save
    const [tempConfig, setTempConfig] = useState<StoreConfig>(storeConfig);
    const [fontMode, setFontMode] = useState<'google' | 'custom'>(storeConfig.customFontUrl ? 'custom' : 'google');
    const [isUploadingFont, setIsUploadingFont] = useState(false);

    useEffect(() => {
        setTempConfig(storeConfig);
        setFontMode(storeConfig.customFontUrl ? 'custom' : 'google');
    }, [storeConfig]);

    // Helper: Inject font immediately for preview in Admin
    useEffect(() => {
        if (tempConfig.customFontUrl) {
            const styleId = 'admin-preview-font';
            let style = document.getElementById(styleId) as HTMLStyleElement;
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            style.innerHTML = `
                @font-face {
                    font-family: 'AdminCustomFont';
                    src: url('${tempConfig.customFontUrl}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
            `;
        }
    }, [tempConfig.customFontUrl]);

    const handleConfigUpload = async (file: File, field: keyof StoreConfig) => {
        setUploadingField(field);
        try {
            const url = await uploadToCloudinary(file);
            if (url) {
                await updateStoreConfig({ [field]: url });
                setStoreConfig(prev => ({ ...prev, [field]: url }));
                alert(`Đã cập nhật thành công!`);
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
            const file = e.target.files[0];
            setIsUploadingFont(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setTempConfig(prev => ({ 
                        ...prev, 
                        customFontUrl: url,
                        headingFont: 'CustomBrandFont' // Đặt tên định danh
                    }));
                } else {
                    alert("Lỗi upload font.");
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload font.");
            } finally {
                setIsUploadingFont(false);
            }
        }
    };

    const handleThemeChange = (field: keyof StoreConfig, value: string) => {
        setTempConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveTheme = async () => {
        setLoading(true);
        const configToSave = {
            primaryColor: tempConfig.primaryColor,
            headingFont: fontMode === 'custom' ? 'CustomBrandFont' : tempConfig.headingFont,
            bodyFont: tempConfig.bodyFont,
            customFontUrl: fontMode === 'custom' ? tempConfig.customFontUrl : '' // Clear custom URL if switching back to Google
        };

        const success = await updateStoreConfig(configToSave);
        if (success) {
            setStoreConfig(prev => ({ ...prev, ...configToSave }));
            alert("Đã lưu giao diện thành công! Website sẽ tải lại để áp dụng.");
            window.location.reload(); 
        } else {
            alert("Lỗi lưu cấu hình.");
        }
        setLoading(false);
    }

    const handleSeedTemplates = async () => { if (confirm("Reset templates về mặc định?")) { setLoading(true); await seedTemplates(); setLoading(false); onRefreshTemplates(); } };
    const handleSaveTemplate = async (tpl: CollectionTemplate) => { setIsEditingTemplate(false); if (editingTemplate) await updateTemplate(tpl.id, tpl); else await addTemplate(tpl); onRefreshTemplates(); setEditingTemplate(null); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteTemplate(id); onRefreshTemplates(); } };

    const handleSeedFeedbacks = async () => { if (confirm("Reset feedbacks về mặc định?")) { setLoading(true); await seedFeedbacks(); setLoading(false); onRefreshFeedbacks(); } };
    const handleSaveFeedback = async (fb: FeedbackItem) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(fb.id, fb); else await addFeedback(fb); onRefreshFeedbacks(); setEditingFeedback(null); };
    const handleDeleteFeedback = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteFeedback(id); onRefreshFeedbacks(); } };

    // Get current preview font family
    const previewHeadingFont = fontMode === 'custom' && tempConfig.customFontUrl ? 'AdminCustomFont' : tempConfig.headingFont;

    return (
        <div className="animate-fade-in">
            {loading && <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded shadow">Loading...</div></div>}
            
            <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveConfigSubTab('general')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'general' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Chung & Theme</button>
                <button onClick={() => setActiveConfigSubTab('templates')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'templates' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Mẫu (Collection)</button>
                <button onClick={() => setActiveConfigSubTab('feedbacks')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'feedbacks' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Feedbacks</button>
            </div>

            {activeConfigSubTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-8">
                        <div className="bg-white p-6 rounded-lg border shadow-sm">
                            <h3 className="text-lg font-bold mb-6 text-gray-800">Hình ảnh thương hiệu</h3>
                            <div className="space-y-6">
                                <ConfigImageUpload 
                                    label="Logo Website" 
                                    description="Hiển thị ở Header (Khuyên dùng PNG trong suốt)"
                                    currentUrl={storeConfig.logoUrl}
                                    onUpload={(f) => handleConfigUpload(f, 'logoUrl')}
                                    isUploading={uploadingField === 'logoUrl'}
                                />
                                <ConfigImageUpload 
                                    label="Favicon" 
                                    description="Icon trên tab trình duyệt (Vuông, nhỏ)"
                                    currentUrl={storeConfig.faviconUrl}
                                    onUpload={(f) => handleConfigUpload(f, 'faviconUrl')}
                                    isUploading={uploadingField === 'faviconUrl'}
                                />
                                <ConfigImageUpload 
                                    label="Banner Hero (Trang chủ)" 
                                    description="Ảnh lớn đầu trang chủ"
                                    currentUrl={storeConfig.heroImageUrl}
                                    onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')}
                                    isUploading={uploadingField === 'heroImageUrl'}
                                />
                                <ConfigImageUpload 
                                    label="Banner Inspire (Trang chủ)" 
                                    description="Ảnh nền phần bộ sưu tập nổi bật"
                                    currentUrl={storeConfig.inspireImageUrl}
                                    onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')}
                                    isUploading={uploadingField === 'inspireImageUrl'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg border shadow-sm h-fit">
                        <h3 className="text-lg font-bold mb-6 text-gray-800">Theme Builder (Giao diện)</h3>
                        <div className="space-y-6">
                            {/* Live Preview Card */}
                            <div className="border rounded-xl p-4 bg-gray-50">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Xem trước (Live Preview)</p>
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center space-y-3">
                                    <h2 
                                        className="text-3xl font-bold" 
                                        style={{ 
                                            color: tempConfig.primaryColor, 
                                            fontFamily: previewHeadingFont 
                                        }}
                                    >
                                        The Luvin Demo
                                    </h2>
                                    <p 
                                        className="text-gray-600 text-sm leading-relaxed"
                                        style={{ fontFamily: tempConfig.bodyFont }}
                                    >
                                        Đây là đoạn văn bản mẫu để bạn hình dung font chữ nội dung sẽ hiển thị như thế nào trên website.
                                    </p>
                                    <button 
                                        className="px-6 py-2 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-90"
                                        style={{ 
                                            backgroundColor: tempConfig.primaryColor,
                                            fontFamily: tempConfig.bodyFont
                                        }}
                                    >
                                        Nút Bấm Mẫu
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Màu chủ đạo (Primary Color)</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={tempConfig.primaryColor || '#efa3b5'} 
                                        onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                                        className="h-10 w-20 rounded border cursor-pointer"
                                    />
                                    <input 
                                        type="text" 
                                        value={tempConfig.primaryColor || '#efa3b5'}
                                        onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                                        className="border rounded p-2 text-sm w-32 uppercase"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Font tiêu đề (Heading)</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg mb-3">
                                    <button 
                                        onClick={() => setFontMode('google')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${fontMode === 'google' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Google Fonts (Có sẵn)
                                    </button>
                                    <button 
                                        onClick={() => setFontMode('custom')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${fontMode === 'custom' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Upload Font Riêng
                                    </button>
                                </div>

                                {fontMode === 'google' ? (
                                    <select 
                                        value={tempConfig.headingFont || 'BrandFont'} 
                                        onChange={(e) => handleThemeChange('headingFont', e.target.value)}
                                        className="w-full p-2 border rounded bg-white text-sm"
                                    >
                                        {GOOGLE_FONTS.map(font => (
                                            <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>
                                                {font.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                                            <input 
                                                type="file" 
                                                accept=".ttf,.otf,.woff,.woff2" 
                                                onChange={handleFontUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                disabled={isUploadingFont}
                                            />
                                            {isUploadingFont ? (
                                                <span className="text-xs text-blue-600 font-bold animate-pulse">Đang tải font...</span>
                                            ) : tempConfig.customFontUrl ? (
                                                <div className="text-green-600">
                                                    <p className="text-xs font-bold">✓ Đã tải font lên</p>
                                                    <p className="text-[10px] text-gray-500 truncate max-w-[200px] mx-auto">{tempConfig.customFontUrl}</p>
                                                </div>
                                            ) : (
                                                <div className="text-gray-400">
                                                    <p className="text-xs font-bold">Bấm để tải file .ttf, .otf</p>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-500 italic">Lưu ý: Chỉ sử dụng font bạn có bản quyền.</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Font nội dung (Body)</label>
                                <select 
                                    value={tempConfig.bodyFont || 'Montserrat'} 
                                    onChange={(e) => handleThemeChange('bodyFont', e.target.value)}
                                    className="w-full p-2 border rounded bg-white text-sm"
                                >
                                    {GOOGLE_FONTS.map(font => (
                                        <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>
                                            {font.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                onClick={handleSaveTheme} 
                                disabled={isUploadingFont}
                                className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition-colors shadow-lg disabled:opacity-50"
                            >
                                Lưu cấu hình Theme
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeConfigSubTab === 'templates' && (
                <>
                    <div className="flex justify-end gap-2 mb-4">
                            <button onClick={handleSeedTemplates} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset Mẫu</button>
                            <button onClick={() => setIsEditingTemplate(true)} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700">+ Thêm Mẫu</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-white border rounded-lg overflow-hidden group relative">
                                <img src={tpl.imageUrl} className="w-full h-48 object-cover" />
                                <div className="p-3">
                                    <h4 className="font-bold">{tpl.name}</h4>
                                </div>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => { setEditingTemplate(tpl); setIsEditingTemplate(true); }} className="px-3 py-1 bg-white text-gray-900 rounded font-bold text-sm">Sửa</button>
                                    <button onClick={() => handleDeleteTemplate(tpl.id)} className="px-3 py-1 bg-red-600 text-white rounded font-bold text-sm">Xóa</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {activeConfigSubTab === 'feedbacks' && (
                <>
                    <div className="flex justify-end gap-2 mb-4">
                            <button onClick={handleSeedFeedbacks} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset FB</button>
                            <button onClick={() => setIsEditingFeedback(true)} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700">+ Thêm Feedback</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {feedbacks.map(fb => (
                            <div key={fb.id} className="bg-white border rounded-lg p-4 relative group">
                                <div className="flex items-center gap-3 mb-2">
                                    <img src={fb.imageUrl} className="w-10 h-10 rounded-full object-cover" />
                                    <h4 className="font-bold text-sm">{fb.name}</h4>
                                </div>
                                <p className="text-xs text-gray-600 italic">"{fb.text}"</p>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={() => { setEditingFeedback(fb); setIsEditingFeedback(true); }} className="p-1 bg-blue-100 text-blue-600 rounded text-xs">Sửa</button>
                                    <button onClick={() => handleDeleteFeedback(fb.id)} className="p-1 bg-red-100 text-red-600 rounded text-xs">Xóa</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {isEditingTemplate && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={() => { setIsEditingTemplate(false); setEditingTemplate(null); }} />}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};
