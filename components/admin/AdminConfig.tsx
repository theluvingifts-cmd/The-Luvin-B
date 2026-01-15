
import React, { useState, useEffect, useRef } from 'react';
import { FeedbackItem, ThemeConfig, CustomFont, StaffMember } from '../../types';
import { StoreConfig, updateStoreConfig, DEFAULT_THEME } from '../../services/configService';
import { addFeedback, updateFeedback, deleteFeedback } from '../../services/feedbackService';
import { uploadToCloudinary } from '../../services/uploadService';
import { ConfigImageUpload } from './shared/ConfigImageUpload';
import { FeedbackForm } from './forms/FeedbackForm';
import * as firebaseApp from 'firebase/app';
// Fix: Use standard modular imports for Firebase v9+
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../../config/firebase';
import { testTelegramConnection } from '../../services/telegramService';

interface AdminConfigProps {
    storeConfig: StoreConfig;
    setStoreConfig: React.Dispatch<React.SetStateAction<StoreConfig>>;
    feedbacks: FeedbackItem[];
    onRefreshFeedbacks: () => void;
}

type ConfigTab = 'branding' | 'theme' | 'sections' | 'content' | 'fonts' | 'staff' | 'seo';

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
                e.stopPropagation();
                onClick();
            }}
            title={`Sửa: ${label}`}
        >
            {children}
            <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/edit:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[60] shadow-md font-sans">
                🖊️ {label}
            </div>
        </div>
    );
};

export const AdminConfig: React.FC<AdminConfigProps> = ({ storeConfig, setStoreConfig, feedbacks, onRefreshFeedbacks }) => {
    const [activeTab, setActiveTab] = useState<ConfigTab>('branding');
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(storeConfig.theme || DEFAULT_THEME);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Font Management State
    const [newFontName, setNewFontName] = useState('');
    const [isUploadingFont, setIsUploadingFont] = useState(false);

    // Staff Management State
    const [newStaffEmail, setNewStaffEmail] = useState('');
    const [newStaffPassword, setNewStaffPassword] = useState('');
    const [newStaffRole, setNewStaffRole] = useState<'admin' | 'warehouse'>('warehouse');

    // Edit Modal States
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);

    // Telegram Config
    const [telegramToken, setTelegramToken] = useState(storeConfig.telegramBotToken || '');
    const [telegramChatId, setTelegramChatId] = useState(storeConfig.telegramChatId || '');

    // B2B Config
    const [b2bDiscount, setB2bDiscount] = useState(storeConfig.b2bDiscountPercent || 5);

    // Refs for scrolling to inputs
    const inputRefs = useRef<Record<string, HTMLElement | null>>({});

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

    useEffect(() => {
        if (storeConfig.theme) {
            setThemeConfig(storeConfig.theme);
        }
        if (storeConfig.telegramBotToken) setTelegramToken(storeConfig.telegramBotToken);
        if (storeConfig.telegramChatId) setTelegramChatId(storeConfig.telegramChatId);
        if (storeConfig.b2bDiscountPercent !== undefined) setB2bDiscount(storeConfig.b2bDiscountPercent);
    }, [storeConfig]);

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

    const handleSaveConfig = async () => {
        setLoading(true);
        const success = await updateStoreConfig({ 
            ...storeConfig,
            theme: themeConfig,
            telegramBotToken: telegramToken,
            telegramChatId: telegramChatId,
            b2bDiscountPercent: b2bDiscount
        });
        if (success) {
            setStoreConfig(prev => ({ 
                ...prev, 
                theme: themeConfig, 
                telegramBotToken: telegramToken, 
                telegramChatId: telegramChatId,
                b2bDiscountPercent: b2bDiscount
            }));
            alert("Đã lưu cấu hình thành công!");
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

    const handleToggleGiftBox = async () => {
        const newValue = !storeConfig.giftBoxOutOfStock;
        setStoreConfig(prev => ({ ...prev, giftBoxOutOfStock: newValue }));
        await updateStoreConfig({ giftBoxOutOfStock: newValue });
    };

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
                }
            } catch (error) {
                console.error(error);
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

    const handleAddStaff = async () => {
        if (!newStaffEmail.trim() || !newStaffPassword.trim()) {
            alert("Vui lòng nhập đầy đủ email và mật khẩu.");
            return;
        }
        
        setLoading(true);
        const secondaryApp = firebaseApp.initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            await createUserWithEmailAndPassword(secondaryAuth, newStaffEmail.trim(), newStaffPassword.trim());
            const newStaff: StaffMember = {
                email: newStaffEmail.trim(),
                role: newStaffRole,
                addedAt: new Date().toISOString()
            };
            const updatedStaff = [...(storeConfig.staff || []), newStaff];
            const success = await updateStoreConfig({ staff: updatedStaff });
            if (success) {
                setStoreConfig(prev => ({ ...prev, staff: updatedStaff }));
                setNewStaffEmail('');
                setNewStaffPassword('');
                alert("Đã thêm nhân viên thành công.");
            }
        } catch (error: any) {
            alert("Lỗi: " + error.message);
        } finally {
            await firebaseApp.deleteApp(secondaryApp);
            setLoading(false);
        }
    };

    const handleDeleteStaff = async (email: string) => {
        if (confirm(`Bạn có chắc muốn xóa quyền truy cập của ${email}?`)) {
            const updatedStaff = (storeConfig.staff || []).filter(s => s.email !== email);
            const success = await updateStoreConfig({ staff: updatedStaff });
            if (success) {
                setStoreConfig(prev => ({ ...prev, staff: updatedStaff }));
            }
        }
    };

    const handleResetTheme = () => {
        if(confirm("Bạn có chắc muốn quay về giao diện mặc định?")) {
            setThemeConfig(DEFAULT_THEME);
        }
    };

    const scrollToField = (tab: ConfigTab, fieldKey: string) => {
        setActiveTab(tab);
        setTimeout(() => {
            const element = inputRefs.current[fieldKey];
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.focus();
                element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50');
                setTimeout(() => {
                    element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50');
                }, 1500);
            }
        }, 100);
    };

    const handleSaveFeedback = async (fb: FeedbackItem) => { 
        setIsEditingFeedback(false); 
        if (editingFeedback) await updateFeedback(fb.id, fb); 
        else await addFeedback(fb); 
        onRefreshFeedbacks(); 
        setEditingFeedback(null); 
    };

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

            <div className="sticky top-16 z-20 bg-gray-50 pt-4 pb-2 border-b mb-6 overflow-x-auto no-scrollbar">
                <div className="flex gap-2">
                    {['branding', 'theme', 'sections', 'content', 'fonts', 'staff', 'seo'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as ConfigTab)} 
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}
                        >
                            {tab === 'branding' ? 'Hình ảnh & Doanh nghiệp' : tab === 'theme' ? 'Màu & Font' : tab === 'sections' ? 'Chi tiết' : tab === 'content' ? 'Nội dung' : tab === 'fonts' ? 'Quản lý Font' : tab === 'staff' ? 'Nhân sự & Bot' : 'SEO & Social'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-8 order-2 lg:order-1 h-[calc(100vh-180px)] overflow-y-auto pr-2 custom-scrollbar">
                    
                    {activeTab === 'branding' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Thiết lập Doanh nghiệp & Logo</h3>
                            
                            {/* B2B DISCOUNT CONFIG - MOVED UP FOR VISIBILITY */}
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <h4 className="text-sm font-black text-blue-800 uppercase tracking-tight mb-3 flex items-center gap-2">
                                    🏢 Chiết khấu Doanh nghiệp
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-blue-600 uppercase mb-1">% Chiết khấu sỉ (B2B)</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="number" 
                                                className="w-full p-2.5 border-2 border-blue-200 rounded-lg text-lg font-black text-blue-900 focus:border-blue-500 outline-none"
                                                value={b2bDiscount}
                                                onChange={(e) => setB2bDiscount(Number(e.target.value))}
                                                min="0" max="100"
                                            />
                                            <span className="font-black text-blue-400 text-xl">%</span>
                                        </div>
                                        <p className="text-[10px] text-blue-500 mt-2 leading-relaxed">
                                            Mức giảm này sẽ được áp dụng trực tiếp vào bảng "Dự toán ngân sách" tại trang <b>/business</b>. 
                                            Giúp khách hàng doanh nghiệp thấy ngay lợi ích khi đặt số lượng lớn.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 space-y-6">
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
                                <div ref={(el) => { inputRefs.current['giftBoxImageUrl'] = el; }} className="p-4 border-2 border-dashed border-gray-200 rounded-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-gray-700">Tùy chọn Hộp Quà</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase ${storeConfig.giftBoxOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                                                {storeConfig.giftBoxOutOfStock ? 'Hết hàng' : 'Còn hàng'}
                                            </span>
                                            <button 
                                                onClick={handleToggleGiftBox}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${storeConfig.giftBoxOutOfStock ? 'bg-gray-300' : 'bg-green-500'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${storeConfig.giftBoxOutOfStock ? '' : 'translate-x-6'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                    <ConfigImageUpload label="Ảnh Gói Quà" description="Tải ảnh hiển thị khi khách chọn Thêm Gói Quà" currentUrl={storeConfig.giftBoxImageUrl} onUpload={(f) => handleConfigUpload(f, 'giftBoxImageUrl')} isUploading={uploadingField === 'giftBoxImageUrl'} />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'seo' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">SEO & Social Meta</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1">Tiêu đề SEO (Browser Title)</label>
                                    <input className="w-full p-2 border rounded text-sm" value={storeConfig.seoTitle} onChange={(e) => setStoreConfig({...storeConfig, seoTitle: e.target.value})} placeholder="The Luvin - Quà tặng LEGO..." />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">Mô tả SEO (Description)</label>
                                    <textarea className="w-full p-2 border rounded text-sm" rows={3} value={storeConfig.seoDescription} onChange={(e) => setStoreConfig({...storeConfig, seoDescription: e.target.value})} placeholder="Nơi những mảnh ghép LEGO kể câu chuyện tình yêu..." />
                                </div>
                                <ConfigImageUpload label="Ảnh SEO (OG Image)" description="1200x630px" currentUrl={storeConfig.seoImageUrl} onUpload={(f) => handleConfigUpload(f, 'seoImageUrl')} isUploading={uploadingField === 'seoImageUrl'} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'theme' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Màu sắc & Phông chữ</h3>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Bảng màu</h4>
                                <div className="space-y-3">
                                    {[
                                        { key: 'primary', label: 'Màu chính', desc: 'Nút bấm, giá tiền' },
                                        { key: 'secondary', label: 'Màu phụ', desc: 'Nền phụ' },
                                        { key: 'text', label: 'Màu chữ', desc: 'Văn bản chính' },
                                        { key: 'background', label: 'Màu nền', desc: 'Nền toàn trang' },
                                        { key: 'accent', label: 'Màu nhấn', desc: 'Icon, chi tiết nhỏ' },
                                    ].map((color) => (
                                        <div key={color.key} className="flex items-center justify-between p-2 border rounded">
                                            <div>
                                                <p className="text-sm font-bold">{color.label}</p>
                                                <p className="text-[10px] text-gray-400">{color.desc}</p>
                                            </div>
                                            <input 
                                                type="color" 
                                                value={themeConfig.global.colors[color.key as keyof typeof themeConfig.global.colors]} 
                                                onChange={(e) => handleThemeChange(`global.colors.${color.key}`, e.target.value)}
                                                className="w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Kiểu chữ</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Font Tiêu đề</label>
                                        <select value={themeConfig.global.typography.headingFont} onChange={(e) => handleThemeChange('global.typography.headingFont', e.target.value)} className="w-full p-2 border rounded bg-white text-sm">
                                            {fontOptions.map((group, idx) => (
                                                <optgroup key={idx} label={group.label}>
                                                    {group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Font Nội dung</label>
                                        <select value={themeConfig.global.typography.bodyFont} onChange={(e) => handleThemeChange('global.typography.bodyFont', e.target.value)} className="w-full p-2 border rounded bg-white text-sm">
                                            {fontOptions.map((group, idx) => (
                                                <optgroup key={idx} label={group.label}>
                                                    {group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sections' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Cấu hình Từng Phần</h3>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Header</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="color" value={themeConfig.sections.header.backgroundColor} onChange={(e) => handleThemeChange('sections.header.backgroundColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                                    <input type="color" value={themeConfig.sections.header.textColor} onChange={(e) => handleThemeChange('sections.header.textColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Hero Section</h4>
                                <input type="color" value={themeConfig.sections.hero.backgroundColor} onChange={(e) => handleThemeChange('sections.hero.backgroundColor', e.target.value)} className="w-full h-10 rounded cursor-pointer mb-4" />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="color" value={themeConfig.sections.hero.headingColor} onChange={(e) => handleThemeChange('sections.hero.headingColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                                    <input type="color" value={themeConfig.sections.hero.textColor} onChange={(e) => handleThemeChange('sections.hero.textColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Nội dung Website</h3>
                            <div className="space-y-4">
                                <div><label className="block text-xs font-bold mb-1">Hotline</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.hotline} onChange={(e) => setStoreConfig({...storeConfig, hotline: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold mb-1">Tiêu đề Hero</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.heroTitle} onChange={(e) => setStoreConfig({...storeConfig, heroTitle: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold mb-1">Phụ đề Hero</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.heroSubtitle} onChange={(e) => setStoreConfig({...storeConfig, heroSubtitle: e.target.value})} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fonts' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Quản lý Font Tải lên</h3>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <input type="text" placeholder="Tên font" className="w-full p-2 mb-3 border rounded text-sm" value={newFontName} onChange={(e) => setNewFontName(e.target.value)} />
                                <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleAddNewFont} className="w-full p-3 rounded-lg border-2 border-dashed font-bold text-sm bg-white" />
                            </div>
                            <div className="divide-y">
                                {storeConfig.uploadedFonts?.map(font => (
                                    <div key={font.id} className="flex items-center justify-between py-3">
                                        <span style={{ fontFamily: font.name }} className="text-lg">{font.name}</span>
                                        <button onClick={() => handleDeleteFont(font.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'staff' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Nhân sự & Bot</h3>
                            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 space-y-3">
                                <label className="block text-xs font-bold text-indigo-700">Bot Token</label>
                                <input type="password" className="w-full p-2 border rounded text-xs font-mono" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} />
                                <label className="block text-xs font-bold text-indigo-700">Chat ID</label>
                                <input type="text" className="w-full p-2 border rounded text-xs font-mono" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} />
                            </div>
                            <div className="pt-4 space-y-3">
                                <input className="w-full p-2 border rounded text-sm" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="Email nhân viên" />
                                <input type="password" className="w-full p-2 border rounded text-sm" value={newStaffPassword} onChange={(e) => setNewStaffPassword(e.target.value)} placeholder="Mật khẩu" />
                                <select className="w-full p-2 border rounded text-sm" value={newStaffRole} onChange={(e: any) => setNewStaffRole(e.target.value)}>
                                    <option value="warehouse">Kho</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <button onClick={handleAddStaff} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">+ Thêm nhân viên</button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-4 border-t pt-4 sticky bottom-0 bg-gray-50 p-4 -mx-4 -mb-4">
                        <button onClick={handleResetTheme} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded">Reset Mặc định</button>
                        <button onClick={handleSaveConfig} className="px-6 py-2 bg-gray-900 text-white font-bold rounded hover:bg-black shadow-lg">Lưu cấu hình</button>
                    </div>
                </div>

                <div className="lg:col-span-8 order-1 lg:order-2">
                    <div className="sticky top-24 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                        <div className="bg-gray-100 p-3 border-b flex justify-between items-center flex-shrink-0">
                            <span className="text-xs font-bold text-gray-500 uppercase">🖥️ Live Preview (Click để sửa)</span>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar relative" style={{ backgroundColor: themeConfig.global.colors.background, color: themeConfig.global.colors.text, fontFamily: themeConfig.global.typography.bodyFont }}>
                            <EditableZone onClick={() => scrollToField('sections', 'sections.header.backgroundColor')} label="Nền Header" className="border-b sticky top-0 z-20" style={{ backgroundColor: themeConfig.sections.header.backgroundColor, color: themeConfig.sections.header.textColor }}>
                                <div className="container mx-auto px-6 py-4 flex justify-between items-center pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <EditableZone onClick={() => scrollToField('branding', 'logoUrl')} label="Logo">
                                            {storeConfig.logoUrl ? <img src={storeConfig.logoUrl} alt="Logo" className="h-12 object-contain" /> : <span style={{ fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.global.colors.primary }}>The Luvin</span>}
                                        </EditableZone>
                                    </div>
                                    <div className="hidden md:flex items-center space-x-6 text-sm font-semibold opacity-80">
                                        <div className="flex gap-6"><span>Trang chủ</span><span>Thiết kế</span><span>Bộ sưu tập</span><span>Tra cứu</span></div>
                                    </div>
                                </div>
                            </EditableZone>

                            <EditableZone onClick={() => scrollToField('sections', 'sections.hero.backgroundColor')} label="Nền Hero Section" style={{ backgroundColor: themeConfig.sections.hero.backgroundColor, color: themeConfig.sections.hero.textColor }} className="relative flex flex-col md:flex-row min-h-[400px]">
                                <div className="w-full md:w-1/2 flex flex-col justify-center px-6 md:px-12 py-12 z-10 pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <h1 className="text-4xl md:text-5xl leading-[1.1] mb-6">
                                            <EditableZone onClick={() => scrollToField('content', 'heroTitle')} label="Tiêu đề chính" className="block"><span style={{ fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.sections.hero.headingColor }}>{storeConfig.heroTitle || 'Gói ghém yêu thương'}</span></EditableZone>
                                            <EditableZone onClick={() => scrollToField('content', 'heroSubtitle')} label="Phụ đề" className="block mt-2"><span className="italic font-light" style={{ color: themeConfig.global.colors.primary }}>{storeConfig.heroSubtitle || 'trong từng mảnh ghép'}</span></EditableZone>
                                        </h1>
                                        <button className="px-8 py-3 rounded-full shadow-lg" style={{ backgroundColor: themeConfig.global.colors.primary, color: '#fff', borderRadius: themeConfig.global.borderRadius }}><span className="font-bold text-sm">Bắt đầu thiết kế</span></button>
                                    </div>
                                </div>
                                <div className="w-full md:w-1/2 relative min-h-[300px]">
                                    <EditableZone onClick={() => scrollToField('branding', 'heroImageUrl')} label="Ảnh Hero" className="absolute inset-0 md:rounded-bl-[80px] overflow-hidden">
                                        {storeConfig.heroImageUrl ? <img src={storeConfig.heroImageUrl} className="w-full h-full object-cover" alt="Hero" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">Hero Image</div>}
                                    </EditableZone>
                                </div>
                            </EditableZone>
                        </div>
                    </div>
                </div>
            </div>
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};
