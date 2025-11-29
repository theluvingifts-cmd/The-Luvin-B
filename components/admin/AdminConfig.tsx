
import React, { useState, useEffect } from 'react';
import { StoreConfig, updateStoreConfig, DEFAULT_THEME } from '../../services/configService';
import { uploadToCloudinary } from '../../services/uploadService';
import { ConfigImageUpload } from './shared/ConfigImageUpload';
import { ThemeConfig, SectionStyle } from '../../types';
import { Header } from '../Header';
import { Footer } from '../Footer';

interface AdminConfigProps {
    storeConfig: StoreConfig;
    setStoreConfig: React.Dispatch<React.SetStateAction<StoreConfig>>;
    templates: any[];
    feedbacks: any[];
    onRefreshTemplates: () => void;
    onRefreshFeedbacks: () => void;
}

type ConfigTab = 'images' | 'theme';
type ThemeSubTab = 'global' | 'sections' | 'fonts';

const AVAILABLE_FONTS = [
    { name: 'Playfair Display', value: 'Playfair Display' },
    { name: 'Montserrat', value: 'Montserrat' },
    { name: 'Dancing Script', value: 'Dancing Script' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
];

export const AdminConfig: React.FC<AdminConfigProps> = ({ storeConfig, setStoreConfig }) => {
    const [activeTab, setActiveTab] = useState<ConfigTab>('images');
    const [activeThemeTab, setActiveThemeTab] = useState<ThemeSubTab>('global');
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(storeConfig.theme || DEFAULT_THEME);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [previewSection, setPreviewSection] = useState<string>('header'); // For Live Preview

    useEffect(() => {
        if (storeConfig.theme) setThemeConfig(storeConfig.theme);
        else setThemeConfig(DEFAULT_THEME);
    }, [storeConfig.theme]);

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

    const handleSaveTheme = async () => {
        await updateStoreConfig({ theme: themeConfig });
        setStoreConfig(prev => ({ ...prev, theme: themeConfig }));
        // Reload page to apply global CSS vars fully if needed, or rely on App.tsx effect
        alert("Đã lưu giao diện!");
        window.location.reload(); 
    };

    const handleResetTheme = () => {
        if(confirm("Bạn có chắc muốn quay về giao diện mặc định?")) {
            setThemeConfig(DEFAULT_THEME);
        }
    };

    // --- Font Upload Logic ---
    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        setUploadingField('font');
        
        try {
            const url = await uploadToCloudinary(file);
            if (url) {
                const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, ''); // Sanitize
                const newFont = { id: Date.now().toString(), name: fontName, url, format: 'truetype' as const };
                const newConfig = {
                    ...themeConfig,
                    customFonts: [...(themeConfig.customFonts || []), newFont]
                };
                setThemeConfig(newConfig);
            }
        } catch (error) {
            alert("Lỗi upload font");
        } finally {
            setUploadingField(null);
        }
    };

    // --- Helpers for Style Injection in Preview ---
    const getPreviewStyle = (sectionKey: string): React.CSSProperties => {
        const sec = themeConfig.sections[sectionKey];
        if (sec?.useGlobal) {
            // Apply Global Styles
            return {
                '--color-primary': themeConfig.global.colors.primary,
                '--color-secondary': themeConfig.global.colors.secondary,
                '--color-background': themeConfig.global.colors.background,
                '--color-text': themeConfig.global.colors.text,
                '--color-accent': themeConfig.global.colors.accent,
                '--font-heading': themeConfig.global.typography.headingFont,
                '--font-body': themeConfig.global.typography.bodyFont,
            } as React.CSSProperties;
        }
        
        // Apply Override Styles
        return {
            '--color-primary': sec.colors?.primary || themeConfig.global.colors.primary,
            '--color-background': sec.colors?.background || themeConfig.global.colors.background,
            '--color-text': sec.colors?.text || themeConfig.global.colors.text,
            '--color-accent': sec.colors?.accent || themeConfig.global.colors.accent,
            '--font-heading': sec.typography?.headingFont || themeConfig.global.typography.headingFont,
            '--font-body': sec.typography?.bodyFont || themeConfig.global.typography.bodyFont,
        } as React.CSSProperties;
    };

    const renderPreview = () => {
        const style = getPreviewStyle(previewSection);
        // We use a wrapper with ID to scope styles if needed, but CSS vars inherit down.
        // We ensure the container has the class 'section-theme' to utilize the vars defined in index.html
        
        return (
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white sticky top-24">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase">Live Preview: {previewSection}</span>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 min-h-[300px] flex items-center justify-center overflow-auto">
                    {/* ISOLATED PREVIEW CONTAINER */}
                    <div 
                        className="w-full max-w-4xl bg-white shadow-lg transform scale-90 origin-top"
                        style={style}
                    >
                        {/* Mock wrapper to simulate :root behavior locally */}
                        <div className="text-[var(--color-text)] font-[var(--font-body)] bg-[var(--color-background)]">
                            {previewSection === 'header' && (
                                <Header navigateTo={() => {}} cartCount={2} onCartClick={() => {}} logoUrl={storeConfig.logoUrl || ''} />
                            )}
                            {previewSection === 'footer' && (
                                <Footer navigateTo={() => {}} />
                            )}
                            {previewSection === 'hero' && (
                                <div className="p-12 text-center">
                                    <h1 className="text-5xl font-heading text-[var(--color-text)] mb-4">Unique for <span className="text-[var(--color-accent)] italic">every moment</span></h1>
                                    <button className="bg-[var(--color-text)] text-white px-8 py-3 rounded-full font-bold">Bắt đầu thiết kế</button>
                                </div>
                            )}
                            {previewSection === 'collections' && (
                                <div className="p-8">
                                    <h2 className="text-3xl font-heading text-[var(--color-primary)] mb-6 text-center">Featured Collection</h2>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[1,2,3].map(i => (
                                            <div key={i} className="bg-white p-4 rounded shadow border border-gray-100">
                                                <div className="h-32 bg-gray-100 mb-2"></div>
                                                <h3 className="font-bold">Mẫu {i}</h3>
                                                <p className="text-[var(--color-primary)] font-bold">250.000đ</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const allFonts = [...AVAILABLE_FONTS, ...(themeConfig.customFonts || []).map(f => ({ name: f.name, value: f.name }))];

    return (
        <div className="animate-fade-in pb-20">
            <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('images')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'images' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Hình ảnh & Logo</button>
                <button onClick={() => setActiveTab('theme')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'theme' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Giao diện (Theme)</button>
            </div>

            {activeTab === 'images' && (
                <div className="bg-white p-6 rounded-lg border shadow-sm max-w-2xl">
                    <h3 className="text-lg font-bold mb-6">Cấu hình chung</h3>
                    <div className="space-y-6">
                        <ConfigImageUpload label="Logo Website" description="Hiển thị ở Header" currentUrl={storeConfig.logoUrl} onUpload={(f) => handleConfigUpload(f, 'logoUrl')} isUploading={uploadingField === 'logoUrl'} />
                        <ConfigImageUpload label="Favicon" description="Icon trên tab trình duyệt" currentUrl={storeConfig.faviconUrl} onUpload={(f) => handleConfigUpload(f, 'faviconUrl')} isUploading={uploadingField === 'faviconUrl'} />
                        <ConfigImageUpload label="Banner Hero" description="Ảnh lớn đầu trang chủ" currentUrl={storeConfig.heroImageUrl} onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')} isUploading={uploadingField === 'heroImageUrl'} />
                        <ConfigImageUpload label="Banner Inspire" description="Ảnh nền phần bộ sưu tập" currentUrl={storeConfig.inspireImageUrl} onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')} isUploading={uploadingField === 'inspireImageUrl'} />
                    </div>
                </div>
            )}

            {activeTab === 'theme' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-5 space-y-6">
                        {/* THEME CONTROL PANEL */}
                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                            <div className="flex border-b border-gray-200">
                                <button onClick={() => setActiveThemeTab('global')} className={`flex-1 py-3 text-sm font-bold ${activeThemeTab === 'global' ? 'bg-gray-50 text-luvin-pink border-b-2 border-luvin-pink' : 'text-gray-600'}`}>Toàn trang</button>
                                <button onClick={() => setActiveThemeTab('sections')} className={`flex-1 py-3 text-sm font-bold ${activeThemeTab === 'sections' ? 'bg-gray-50 text-luvin-pink border-b-2 border-luvin-pink' : 'text-gray-600'}`}>Từng phần</button>
                                <button onClick={() => setActiveThemeTab('fonts')} className={`flex-1 py-3 text-sm font-bold ${activeThemeTab === 'fonts' ? 'bg-gray-50 text-luvin-pink border-b-2 border-luvin-pink' : 'text-gray-600'}`}>Font chữ</button>
                            </div>

                            <div className="p-6">
                                {activeThemeTab === 'global' && (
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Màu sắc thương hiệu</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-xs text-gray-500">Primary (Chính)</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <input type="color" value={themeConfig.global.colors.primary} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, primary: e.target.value}}})} className="w-8 h-8 rounded border cursor-pointer" />
                                                        <input type="text" value={themeConfig.global.colors.primary} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, primary: e.target.value}}})} className="flex-1 p-1 text-xs border rounded" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Accent (Nhấn)</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <input type="color" value={themeConfig.global.colors.accent} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, accent: e.target.value}}})} className="w-8 h-8 rounded border cursor-pointer" />
                                                        <input type="text" value={themeConfig.global.colors.accent} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, accent: e.target.value}}})} className="flex-1 p-1 text-xs border rounded" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Background</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <input type="color" value={themeConfig.global.colors.background} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, background: e.target.value}}})} className="w-8 h-8 rounded border cursor-pointer" />
                                                        <input type="text" value={themeConfig.global.colors.background} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, background: e.target.value}}})} className="flex-1 p-1 text-xs border rounded" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Text (Chữ)</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <input type="color" value={themeConfig.global.colors.text} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, text: e.target.value}}})} className="w-8 h-8 rounded border cursor-pointer" />
                                                        <input type="text" value={themeConfig.global.colors.text} onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, colors: {...themeConfig.global.colors, text: e.target.value}}})} className="flex-1 p-1 text-xs border rounded" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Typography</label>
                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-xs text-gray-500">Font Tiêu đề</span>
                                                    <select 
                                                        value={themeConfig.global.typography.headingFont}
                                                        onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, typography: {...themeConfig.global.typography, headingFont: e.target.value}}})}
                                                        className="w-full mt-1 p-2 border rounded text-sm bg-white"
                                                    >
                                                        {allFonts.map((font, idx) => <option key={idx} value={font.value}>{font.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Font Nội dung</span>
                                                    <select 
                                                        value={themeConfig.global.typography.bodyFont}
                                                        onChange={(e) => setThemeConfig({...themeConfig, global: {...themeConfig.global, typography: {...themeConfig.global.typography, bodyFont: e.target.value}}})}
                                                        className="w-full mt-1 p-2 border rounded text-sm bg-white"
                                                    >
                                                        {allFonts.map((font, idx) => <option key={idx} value={font.value}>{font.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeThemeTab === 'sections' && (
                                    <div className="space-y-4">
                                        {['header', 'hero', 'collections', 'footer'].map(sectionKey => {
                                            const sec = themeConfig.sections[sectionKey] || { useGlobal: true };
                                            return (
                                                <div key={sectionKey} className={`border rounded-lg p-4 transition-all ${previewSection === sectionKey ? 'ring-2 ring-luvin-pink border-transparent' : 'border-gray-200'}`} onClick={() => setPreviewSection(sectionKey)}>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="font-bold text-sm capitalize">{sectionKey}</h4>
                                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={sec.useGlobal} 
                                                                onChange={(e) => {
                                                                    const newSections = { ...themeConfig.sections, [sectionKey]: { ...sec, useGlobal: e.target.checked } };
                                                                    setThemeConfig({ ...themeConfig, sections: newSections });
                                                                }}
                                                                className="rounded text-luvin-pink focus:ring-luvin-pink"
                                                            />
                                                            Dùng Global
                                                        </label>
                                                    </div>
                                                    
                                                    {!sec.useGlobal && (
                                                        <div className="space-y-3 animate-fade-in bg-gray-50 p-3 rounded text-sm">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <span className="text-[10px] text-gray-500">Background</span>
                                                                    <input type="color" className="w-full h-6 rounded cursor-pointer" value={sec.colors?.background || themeConfig.global.colors.background} 
                                                                        onChange={(e) => {
                                                                            const newSections = { ...themeConfig.sections, [sectionKey]: { ...sec, colors: { ...sec.colors, background: e.target.value } } };
                                                                            setThemeConfig({ ...themeConfig, sections: newSections });
                                                                        }} 
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] text-gray-500">Text</span>
                                                                    <input type="color" className="w-full h-6 rounded cursor-pointer" value={sec.colors?.text || themeConfig.global.colors.text} 
                                                                        onChange={(e) => {
                                                                            const newSections = { ...themeConfig.sections, [sectionKey]: { ...sec, colors: { ...sec.colors, text: e.target.value } } };
                                                                            setThemeConfig({ ...themeConfig, sections: newSections });
                                                                        }} 
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-gray-500">Heading Font</span>
                                                                <select 
                                                                    className="w-full p-1 text-xs border rounded"
                                                                    value={sec.typography?.headingFont || ''}
                                                                    onChange={(e) => {
                                                                        const newSections = { ...themeConfig.sections, [sectionKey]: { ...sec, typography: { ...sec.typography, headingFont: e.target.value } } };
                                                                        setThemeConfig({ ...themeConfig, sections: newSections });
                                                                    }} 
                                                                >
                                                                    <option value="">(Global)</option>
                                                                    {allFonts.map((font, idx) => <option key={idx} value={font.value}>{font.name}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {activeThemeTab === 'fonts' && (
                                    <div className="space-y-4">
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                            {uploadingField === 'font' ? (
                                                <span className="text-sm font-bold text-luvin-pink animate-pulse">Đang tải font...</span>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-gray-600 mb-2">Tải lên file font (.ttf, .otf, .woff)</p>
                                                    <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} className="text-xs" />
                                                </>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase">Font đã tải</h4>
                                            {themeConfig.customFonts?.map((font, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                                    <span>{font.name}</span>
                                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                                                </div>
                                            ))}
                                            {(!themeConfig.customFonts || themeConfig.customFonts.length === 0) && <p className="text-xs text-gray-400">Chưa có font nào.</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between">
                                <button onClick={handleResetTheme} className="text-sm text-red-600 hover:underline">Reset về mặc định</button>
                                <button onClick={handleSaveTheme} className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-colors">Lưu thay đổi</button>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-7">
                        {/* LIVE PREVIEW */}
                        {renderPreview()}
                    </div>
                </div>
            )}
        </div>
    );
};
