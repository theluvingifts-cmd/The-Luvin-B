
import React, { useState, useEffect, useRef } from 'react';
import { FeedbackItem, ThemeConfig, CustomFont, StaffMember } from '../../types';
import { StoreConfig, updateStoreConfig, DEFAULT_THEME } from '../../services/configService';
import { addFeedback, updateFeedback, deleteFeedback } from '../../services/feedbackService';
import { uploadToCloudinary } from '../../services/uploadService';
import { ConfigImageUpload } from './shared/ConfigImageUpload';
import { FeedbackForm } from './forms/FeedbackForm';
import * as firebaseApp from 'firebase/app';
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

// --- HELPER COMPONENT: EDITABLE ZONE ---
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
        if (storeConfig.telegramBotToken) setTelegramToken(storeConfig.telegramBotToken);
        if (storeConfig.telegramChatId) setTelegramChatId(storeConfig.telegramChatId);
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
            theme: themeConfig,
            telegramBotToken: telegramToken,
            telegramChatId: telegramChatId
        });
        if (success) {
            setStoreConfig(prev => ({ ...prev, theme: themeConfig, telegramBotToken: telegramToken, telegramChatId: telegramChatId }));
            alert("Đã lưu cấu hình thành công! Website sẽ tải lại để áp dụng.");
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

    // --- STAFF MANAGEMENT HANDLERS ---
    const handleAddStaff = async () => {
        if (!newStaffEmail.trim() || !newStaffPassword.trim()) {
            alert("Vui lòng nhập đầy đủ email và mật khẩu.");
            return;
        }
        
        const existing = storeConfig.staff?.find(s => s.email === newStaffEmail.trim());
        if (existing) {
            alert("Nhân viên này đã tồn tại.");
            return;
        }

        setLoading(true);
        // Create secondary app to create user without logging out current admin
        const secondaryApp = firebaseApp.initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            await createUserWithEmailAndPassword(secondaryAuth, newStaffEmail.trim(), newStaffPassword.trim());
            
            // If successful, update Firestore config
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
                alert("Đã tạo tài khoản và thêm nhân viên thành công.");
            } else {
                alert("Lỗi khi lưu thông tin nhân viên.");
            }
        } catch (error: any) {
            console.error("Error creating user:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert("Email này đã được đăng ký tài khoản Firebase.");
            } else if (error.code === 'auth/weak-password') {
                alert("Mật khẩu phải có ít nhất 6 ký tự.");
            } else {
                alert("Lỗi tạo tài khoản: " + error.message);
            }
        } finally {
            await firebaseApp.deleteApp(secondaryApp);
            setLoading(false);
        }
    };

    const handleDeleteStaff = async (email: string) => {
        if (confirm(`Bạn có chắc muốn xóa quyền truy cập của ${email}? (Tài khoản đăng nhập vẫn tồn tại, chỉ xóa quyền truy cập Admin)`)) {
            const updatedStaff = (storeConfig.staff || []).filter(s => s.email !== email);
            const success = await updateStoreConfig({ staff: updatedStaff });
            if (success) {
                setStoreConfig(prev => ({ ...prev, staff: updatedStaff }));
            } else {
                alert("Lỗi khi xóa nhân viên.");
            }
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
                    <button onClick={() => setActiveTab('staff')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'staff' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Nhân sự & Bot</button>
                    <button onClick={() => setActiveTab('seo')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'seo' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>SEO & Social</button>
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
                            <div ref={(el) => { inputRefs.current['giftBoxImageUrl'] = el; }}>
                                <ConfigImageUpload label="Ảnh Gói Quà" description="Ảnh hiển thị khi khách chọn Thêm Gói Quà" currentUrl={storeConfig.giftBoxImageUrl} onUpload={(f) => handleConfigUpload(f, 'giftBoxImageUrl')} isUploading={uploadingField === 'giftBoxImageUrl'} />
                            </div>
                        </div>
                    )}
                    
                    {/* SEO TAB */}
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
                                <ConfigImageUpload 
                                    label="Ảnh SEO (OG Image)" 
                                    description="Ảnh hiển thị khi chia sẻ link qua Facebook/Zalo (1200x630px)" 
                                    currentUrl={storeConfig.seoImageUrl} 
                                    onUpload={(f) => handleConfigUpload(f, 'seoImageUrl')} 
                                    isUploading={uploadingField === 'seoImageUrl'} 
                                />
                            </div>
                        </div>
                    )}

                    {/* THEME TAB */}
                    {activeTab === 'theme' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Cấu hình Giao diện Chung</h3>
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
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTIONS TAB */}
                    {activeTab === 'sections' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Cấu hình Từng Phần</h3>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Header</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Màu nền Header</label>
                                        <input 
                                            ref={(el) => { inputRefs.current['sections.header.backgroundColor'] = el; }}
                                            type="color" 
                                            value={themeConfig.sections.header.backgroundColor} 
                                            onChange={(e) => handleThemeChange('sections.header.backgroundColor', e.target.value)}
                                            className="w-full h-10 rounded cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Màu chữ Header</label>
                                        <input 
                                            ref={(el) => { inputRefs.current['sections.header.textColor'] = el; }}
                                            type="color" 
                                            value={themeConfig.sections.header.textColor} 
                                            onChange={(e) => handleThemeChange('sections.header.textColor', e.target.value)}
                                            className="w-full h-10 rounded cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Hero Section (Trang chủ)</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Màu nền Hero</label>
                                        <input 
                                            ref={(el) => { inputRefs.current['sections.hero.backgroundColor'] = el; }}
                                            type="color" 
                                            value={themeConfig.sections.hero.backgroundColor} 
                                            onChange={(e) => handleThemeChange('sections.hero.backgroundColor', e.target.value)}
                                            className="w-full h-10 rounded cursor-pointer"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1">Màu tiêu đề Hero</label>
                                            <input 
                                                ref={(el) => { inputRefs.current['sections.hero.headingColor'] = el; }}
                                                type="color" 
                                                value={themeConfig.sections.hero.headingColor} 
                                                onChange={(e) => handleThemeChange('sections.hero.headingColor', e.target.value)}
                                                className="w-full h-10 rounded cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1">Màu chữ Hero</label>
                                            <input 
                                                ref={(el) => { inputRefs.current['sections.hero.textColor'] = el; }}
                                                type="color" 
                                                value={themeConfig.sections.hero.textColor} 
                                                onChange={(e) => handleThemeChange('sections.hero.textColor', e.target.value)}
                                                className="w-full h-10 rounded cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Footer</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Màu nền Footer</label>
                                        <input 
                                            type="color" 
                                            value={themeConfig.sections.footer.backgroundColor} 
                                            onChange={(e) => handleThemeChange('sections.footer.backgroundColor', e.target.value)}
                                            className="w-full h-10 rounded cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Màu chữ Footer</label>
                                        <input 
                                            type="color" 
                                            value={themeConfig.sections.footer.textColor} 
                                            onChange={(e) => handleThemeChange('sections.footer.textColor', e.target.value)}
                                            className="w-full h-10 rounded cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTENT TAB */}
                    {activeTab === 'content' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Nội dung Website</h3>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Thông tin liên hệ</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Địa chỉ</label>
                                        <input className="w-full p-2 border rounded text-sm" value={storeConfig.address} onChange={(e) => setStoreConfig({...storeConfig, address: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Hotline</label>
                                        <input className="w-full p-2 border rounded text-sm" value={storeConfig.hotline} onChange={(e) => setStoreConfig({...storeConfig, hotline: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Email</label>
                                        <input className="w-full p-2 border rounded text-sm" value={storeConfig.email} onChange={(e) => setStoreConfig({...storeConfig, email: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Social Links</h4>
                                <div className="space-y-3">
                                    <input placeholder="Facebook URL" className="w-full p-2 border rounded text-sm" value={storeConfig.facebookUrl} onChange={(e) => setStoreConfig({...storeConfig, facebookUrl: e.target.value})} />
                                    <input placeholder="Instagram URL" className="w-full p-2 border rounded text-sm" value={storeConfig.instagramUrl} onChange={(e) => setStoreConfig({...storeConfig, instagramUrl: e.target.value})} />
                                    <input placeholder="TikTok URL" className="w-full p-2 border rounded text-sm" value={storeConfig.tiktokUrl} onChange={(e) => setStoreConfig({...storeConfig, tiktokUrl: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Text Trang chủ (Hero)</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Tiêu đề chính</label>
                                        <input ref={(el) => { inputRefs.current['heroTitle'] = el; }} className="w-full p-2 border rounded text-sm" value={storeConfig.heroTitle} onChange={(e) => setStoreConfig({...storeConfig, heroTitle: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Phụ đề</label>
                                        <input ref={(el) => { inputRefs.current['heroSubtitle'] = el; }} className="w-full p-2 border rounded text-sm" value={storeConfig.heroSubtitle} onChange={(e) => setStoreConfig({...storeConfig, heroSubtitle: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FONTS TAB */}
                    {activeTab === 'fonts' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Quản lý Font Tải lên</h3>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <label className="block text-sm font-bold text-blue-800 mb-2">Thêm Font mới (.ttf, .otf)</label>
                                <input 
                                    type="text" 
                                    placeholder="Tên font (VD: Dancing Script)" 
                                    className="w-full p-2 mb-3 border rounded text-sm"
                                    value={newFontName}
                                    onChange={(e) => setNewFontName(e.target.value)}
                                />
                                <div className="relative">
                                    <input 
                                        type="file" 
                                        accept=".ttf,.otf,.woff,.woff2" 
                                        onChange={handleAddNewFont}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={isUploadingFont}
                                    />
                                    <button className={`w-full p-3 rounded-lg border-2 border-dashed font-bold text-sm ${isUploadingFont ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-100'}`}>
                                        {isUploadingFont ? 'Đang tải lên...' : '+ Chọn file font để tải lên'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase">Danh sách Font hiện tại</h4>
                                {storeConfig.uploadedFonts && storeConfig.uploadedFonts.length > 0 ? (
                                    storeConfig.uploadedFonts.map(font => (
                                        <div key={font.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                                            <span style={{ fontFamily: font.name }} className="text-lg">{font.name}</span>
                                            <button onClick={() => handleDeleteFont(font.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-4">Chưa có font nào được tải lên.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STAFF TAB */}
                    {activeTab === 'staff' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Quản lý Nhân sự & Bot</h3>
                            
                            {/* Telegram Integration */}
                            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                                    Thông báo Telegram (Bot)
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">Bot Token</label>
                                        <input 
                                            type="password"
                                            className="w-full p-2 border border-indigo-200 rounded text-xs font-mono"
                                            placeholder="123456:ABC-DEF..."
                                            value={telegramToken}
                                            onChange={(e) => setTelegramToken(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">Chat ID (Group/Admin)</label>
                                        <input 
                                            type="text"
                                            className="w-full p-2 border border-indigo-200 rounded text-xs font-mono"
                                            placeholder="-100123456789"
                                            value={telegramChatId}
                                            onChange={(e) => setTelegramChatId(e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            if(!telegramToken || !telegramChatId) return alert("Vui lòng nhập Token và Chat ID");
                                            const res = await testTelegramConnection(telegramToken, telegramChatId);
                                            if(res.success) alert("Kiểm tra thành công! Hãy kiểm tra tin nhắn Telegram.");
                                            else alert("Lỗi: " + res.error);
                                        }}
                                        className="w-full py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                                    >
                                        Gửi tin nhắn thử (Test)
                                    </button>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="text-sm font-bold text-gray-700 mb-4">Thêm nhân viên mới</h4>
                                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Email đăng nhập</label>
                                        <input className="w-full p-2 border rounded text-sm" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="nhanvien@theluvin.com" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Mật khẩu (Tối thiểu 6 ký tự)</label>
                                        <input type="password" className="w-full p-2 border rounded text-sm" value={newStaffPassword} onChange={(e) => setNewStaffPassword(e.target.value)} placeholder="******" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Vai trò</label>
                                        <select className="w-full p-2 border rounded text-sm" value={newStaffRole} onChange={(e: any) => setNewStaffRole(e.target.value)}>
                                            <option value="warehouse">Kho (Chỉ xem/đóng gói đơn)</option>
                                            <option value="admin">Admin (Toàn quyền)</option>
                                        </select>
                                    </div>
                                    <button onClick={handleAddStaff} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black">+ Tạo tài khoản</button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase">Danh sách nhân sự ({storeConfig.staff?.length || 0})</h4>
                                <div className="divide-y border rounded-lg overflow-hidden">
                                    {storeConfig.staff?.map(s => (
                                        <div key={s.email} className="flex items-center justify-between p-3 bg-white hover:bg-gray-50">
                                            <div>
                                                <p className="text-sm font-bold">{s.email}</p>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{s.role === 'admin' ? '🔴 Quản trị viên' : '🔵 Nhân viên kho'}</p>
                                            </div>
                                            <button onClick={() => handleDeleteStaff(s.email)} className="text-red-500 p-2 hover:bg-red-50 rounded">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
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

                {/* --- RIGHT PANEL: VISUAL PREVIEW --- */}
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
                        
                        <div 
                            className="flex-grow overflow-y-auto custom-scrollbar relative"
                            style={{ 
                                backgroundColor: themeConfig.global.colors.background,
                                color: themeConfig.global.colors.text,
                                fontFamily: themeConfig.global.typography.bodyFont 
                            }}
                        >
                            <EditableZone 
                                onClick={() => scrollToField('sections', 'sections.header.backgroundColor')} 
                                label="Nền Header"
                                className="border-b sticky top-0 z-20"
                                style={{ 
                                    backgroundColor: themeConfig.sections.header.backgroundColor,
                                    color: themeConfig.sections.header.textColor 
                                }}
                            >
                                <div className="container mx-auto px-6 py-4 flex justify-between items-center pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <EditableZone onClick={() => scrollToField('branding', 'logoUrl')} label="Logo">
                                            <div className="font-bold text-2xl">
                                                {storeConfig.logoUrl ? (
                                                    <img src={storeConfig.logoUrl} alt="Logo" className="h-12 object-contain" />
                                                ) : (
                                                    <span style={{ fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.global.colors.primary }}>The Luvin</span>
                                                )}
                                            </div>
                                        </EditableZone>
                                    </div>
                                    <div className="hidden md:flex items-center space-x-6 text-sm font-semibold opacity-80 pointer-events-auto">
                                        <EditableZone onClick={() => scrollToField('sections', 'sections.header.textColor')} label="Menu Text">
                                            <div className="flex gap-6"><span>Trang chủ</span><span>Thiết kế</span><span>Bộ sưu tập</span><span>Tra cứu</span><span>Giỏ hàng (0)</span></div>
                                        </EditableZone>
                                    </div>
                                </div>
                            </EditableZone>

                            <EditableZone
                                onClick={() => scrollToField('sections', 'sections.hero.backgroundColor')}
                                label="Nền Hero Section"
                                style={{ backgroundColor: themeConfig.sections.hero.backgroundColor, color: themeConfig.sections.hero.textColor }}
                                className="relative flex flex-col md:flex-row min-h-[400px]"
                            >
                                <div className="w-full md:w-1/2 flex flex-col justify-center px-6 md:px-12 py-12 z-10 pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <div className="flex items-center gap-3 mb-6">
                                            <span className="h-px w-12" style={{backgroundColor: themeConfig.global.colors.primary}}></span>
                                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-60">The Luvin Gifts</span>
                                        </div>
                                        <h1 className="text-4xl md:text-5xl leading-[1.1] mb-6">
                                            <EditableZone onClick={() => scrollToField('content', 'heroTitle')} label="Tiêu đề chính" className="block"><span style={{ fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.sections.hero.headingColor }}>{storeConfig.heroTitle || 'Gói ghém yêu thương'}</span></EditableZone>
                                            <EditableZone onClick={() => scrollToField('content', 'heroSubtitle')} label="Phụ đề" className="block mt-2"><span className="italic font-light" style={{ color: themeConfig.global.colors.primary }}>{storeConfig.heroSubtitle || 'trong từng mảnh ghép'}</span></EditableZone>
                                        </h1>
                                        <EditableZone onClick={() => scrollToField('theme', 'global.colors.primary')} label="Nút bấm" className="inline-block"><button className="px-8 py-3 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: themeConfig.global.colors.primary, color: '#fff', borderRadius: themeConfig.global.borderRadius }}><span className="font-bold text-sm tracking-wide">Bắt đầu thiết kế</span></button></EditableZone>
                                    </div>
                                </div>
                                <div className="w-full md:w-1/2 relative min-h-[300px] pointer-events-auto">
                                    <EditableZone onClick={() => scrollToField('branding', 'heroImageUrl')} label="Ảnh Hero" className="absolute inset-0 md:rounded-bl-[80px] overflow-hidden">
                                        {storeConfig.heroImageUrl ? <img src={storeConfig.heroImageUrl} className="w-full h-full object-cover" alt="Hero" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">Hero Image</div>}
                                    </EditableZone>
                                </div>
                            </EditableZone>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};
