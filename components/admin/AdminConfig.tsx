
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
                        headingFont: 'CustomBrandFont' // Auto select after upload
                    }));
                    setFontMode('custom');
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

    const handleContactChange = (field: string, value: string) => {
        setTempConfig(prev => ({ 
            ...prev, 
            contact: { ...prev.contact, [field]: value } 
        }));
    };

    const handleSaveTheme = async () => {
        setLoading(true);
        const configToSave = {
            primaryColor: tempConfig.primaryColor,
            headingFont: fontMode === 'custom' ? 'CustomBrandFont' : tempConfig.headingFont,
            bodyFont: tempConfig.bodyFont,
            customFontUrl: fontMode === 'custom' ? tempConfig.customFontUrl : '',
            contact: tempConfig.contact
        };

        const success = await updateStoreConfig(configToSave);
        if (success) {
            setStoreConfig(prev => ({ ...prev, ...configToSave }));
            alert("Đã lưu cấu hình thành công! Website sẽ tải lại để áp dụng.");
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
                <button onClick={() => setActiveConfigSubTab('general')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'general' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Cấu hình chung</button>
                <button onClick={() => setActiveConfigSubTab('templates')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'templates' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Mẫu (Collection)</button>
                <button onClick={() => setActiveConfigSubTab('feedbacks')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'feedbacks' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Feedbacks</button>
            </div>

            {activeConfigSubTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Branding & Contact */}
                    <div className="space-y-8">
                        <div className="bg-white p-6 rounded-lg border shadow-sm">
                            <h3 className="text-lg font-bold mb-6 text-gray-800 border-b pb-2">Hình ảnh thương hiệu</h3>
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
                                    label="Banner Hero" 
                                    description="Ảnh lớn đầu trang chủ"
                                    currentUrl={storeConfig.heroImageUrl}
                                    onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')}
                                    isUploading={uploadingField === 'heroImageUrl'}
                                />
                                <ConfigImageUpload 
                                    label="Banner Inspire" 
                                    description="Ảnh nền phần bộ sưu tập nổi bật"
                                    currentUrl={storeConfig.inspireImageUrl}
                                    onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')}
                                    isUploading={uploadingField === 'inspireImageUrl'}
                                />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg border shadow-sm">
                            <h3 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Thông tin liên hệ (Footer)</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Địa chỉ Shop</label>
                                    <input 
                                        type="text" 
                                        value={tempConfig.contact?.address || ''} 
                                        onChange={(e) => handleContactChange('address', e.target.value)}
                                        className="w-full p-2.5 border rounded bg-gray-50 text-sm"
                                        placeholder="Khu 6, Thư Lâm, Hà Nội"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hotline / Zalo</label>
                                        <input 
                                            type="text" 
                                            value={tempConfig.contact?.hotline || ''} 
                                            onChange={(e) => handleContactChange('hotline', e.target.value)}
                                            className="w-full p-2.5 border rounded bg-gray-50 text-sm"
                                            placeholder="0964 393 115"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                                        <input 
                                            type="text" 
                                            value={tempConfig.contact?.email || ''} 
                                            onChange={(e) => handleContactChange('email', e.target.value)}
                                            className="w-full p-2.5 border rounded bg-gray-50 text-sm"
                                            placeholder="contact@theluvin.vn"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Link Facebook</label>
                                    <input 
                                        type="text" 
                                        value={tempConfig.contact?.facebook || ''} 
                                        onChange={(e) => handleContactChange('facebook', e.target.value)}
                                        className="w-full p-2.5 border rounded bg-gray-50 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Link Instagram</label>
                                    <input 
                                        type="text" 
                                        value={tempConfig.contact?.instagram || ''} 
                                        onChange={(e) => handleContactChange('instagram', e.target.value)}
                                        className="w-full p-2.5 border rounded bg-gray-50 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Link TikTok</label>
                                    <input 
                                        type="text" 
                                        value={tempConfig.contact?.tiktok || ''} 
                                        onChange={(e) => handleContactChange('tiktok', e.target.value)}
                                        className="w-full p-2.5 border rounded bg-gray-50 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Theme Builder */}
                    <div className="bg-white p-6 rounded-lg border shadow-sm h-fit sticky top-24">
                        <div className="flex justify-between items-center mb-6 border-b pb-2">
                            <h3 className="text-lg font-bold text-gray-800">Giao diện & Font chữ</h3>
                            <button 
                                onClick={handleSaveTheme} 
                                disabled={isUploadingFont}
                                className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-black transition-colors disabled:opacity-50"
                            >
                                Lưu cấu hình
                            </button>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Theme Preview Box */}
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gray-50 text-center relative overflow-hidden">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest absolute top-3 left-1/2 -translate-x-1/2">Xem trước Font & Màu</p>
                                
                                <div className="mt-4 space-y-4">
                                    <h1 
                                        className="text-4xl sm:text-5xl font-bold transition-all duration-300"
                                        style={{ 
                                            color: tempConfig.primaryColor, 
                                            fontFamily: previewHeadingFont 
                                        }}
                                    >
                                        The Luvin
                                    </h1>
                                    <h2 
                                        className="text-xl font-medium text-gray-800"
                                        style={{ fontFamily: previewHeadingFont }}
                                    >
                                        Unique for every moment
                                    </h2>
                                    <p 
                                        className="text-gray-600 text-sm leading-relaxed max-w-xs mx-auto"
                                        style={{ fontFamily: tempConfig.bodyFont }}
                                    >
                                        Đây là đoạn văn bản mẫu để bạn hình dung font chữ nội dung sẽ hiển thị như thế nào.
                                    </p>
                                    <button 
                                        className="px-6 py-2.5 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-90 shadow-md"
                                        style={{ 
                                            backgroundColor: tempConfig.primaryColor,
                                            fontFamily: tempConfig.bodyFont
                                        }}
                                    >
                                        Mua Ngay
                                    </button>
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Màu chủ đạo (Primary Color)</label>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <input 
                                            type="color" 
                                            value={tempConfig.primaryColor || '#efa3b5'} 
                                            onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                                            className="h-10 w-16 rounded cursor-pointer opacity-0 absolute inset-0 z-10"
                                        />
                                        <div className="h-10 w-16 rounded border shadow-sm" style={{ backgroundColor: tempConfig.primaryColor || '#efa3b5' }}></div>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={tempConfig.primaryColor || '#efa3b5'}
                                        onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                                        className="border rounded-lg p-2.5 text-sm w-32 uppercase bg-gray-50 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Font Selection */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Font tiêu đề (Heading)</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                                    <button 
                                        onClick={() => { setFontMode('google'); handleThemeChange('headingFont', 'BrandFont'); }}
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${fontMode === 'google' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Google Fonts
                                    </button>
                                    <button 
                                        onClick={() => setFontMode('custom')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${fontMode === 'custom' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Upload Font
                                    </button>
                                </div>

                                {fontMode === 'google' ? (
                                    <select 
                                        value={tempConfig.headingFont || 'BrandFont'} 
                                        onChange={(e) => handleThemeChange('headingFont', e.target.value)}
                                        className="w-full p-2.5 border rounded-lg bg-white text-sm"
                                    >
                                        {GOOGLE_FONTS.map(font => (
                                            <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>
                                                {font.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="text-center">
                                            <label className="cursor-pointer inline-block">
                                                <input 
                                                    type="file" 
                                                    accept=".ttf,.otf,.woff,.woff2" 
                                                    onChange={handleFontUpload}
                                                    className="hidden"
                                                    disabled={isUploadingFont}
                                                />
                                                <div className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${isUploadingFont ? 'bg-gray-200 text-gray-500' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                                                    {isUploadingFont ? 'Đang tải lên...' : '📂 Chọn file font (.ttf, .otf)'}
                                                </div>
                                            </label>
                                        </div>
                                        {tempConfig.customFontUrl && (
                                            <div className="text-green-600 text-center">
                                                <p className="text-xs font-bold flex items-center justify-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                    Đã tải font thành công
                                                </p>
                                                <p className="text-[10px] text-gray-500 truncate max-w-[200px] mx-auto mt-1 bg-white px-2 py-1 rounded border">{tempConfig.customFontUrl.split('/').pop()}</p>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-400 italic text-center">Khuyên dùng font định dạng .ttf hoặc .otf</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Font nội dung (Body)</label>
                                <select 
                                    value={tempConfig.bodyFont || 'Montserrat'} 
                                    onChange={(e) => handleThemeChange('bodyFont', e.target.value)}
                                    className="w-full p-2.5 border rounded-lg bg-white text-sm"
                                >
                                    {GOOGLE_FONTS.map(font => (
                                        <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>
                                            {font.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
