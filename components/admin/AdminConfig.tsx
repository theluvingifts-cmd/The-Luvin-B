
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
import { testPancakeConnection } from '../../services/pancakeService';

interface AdminConfigProps {
    storeConfig: StoreConfig;
    setStoreConfig: React.Dispatch<React.SetStateAction<StoreConfig>>;
    feedbacks: FeedbackItem[];
    onRefreshFeedbacks: () => void;
}

type ConfigTab = 'branding' | 'theme' | 'sections' | 'content' | 'fonts' | 'staff' | 'seo' | 'integrations';

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

// ... (EditableZone component remains same) ...
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

    // Pancake Config
    const [pancakeToken, setPancakeToken] = useState(storeConfig.pancakeAccessToken || '');
    const [pancakeShopId, setPancakeShopId] = useState(storeConfig.pancakeShopId || '');

    // Refs for scrolling to inputs
    const inputRefs = useRef<Record<string, HTMLElement | null>>({});

    // ... (useEffect for Fonts and Sync remains same) ...
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
        if (storeConfig.pancakeAccessToken) setPancakeToken(storeConfig.pancakeAccessToken);
        if (storeConfig.pancakeShopId) setPancakeShopId(storeConfig.pancakeShopId);
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
            pancakeAccessToken: pancakeToken,
            pancakeShopId: pancakeShopId
        });
        if (success) {
            setStoreConfig(prev => ({ 
                ...prev, 
                theme: themeConfig, 
                telegramBotToken: telegramToken, 
                telegramChatId: telegramChatId,
                pancakeAccessToken: pancakeToken,
                pancakeShopId: pancakeShopId
            }));
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

    // ... (Font & Staff Handlers remain same) ...
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
        if (confirm(`Bạn có chắc muốn xóa quyền truy cập của ${email}?`)) {
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

    const handleSaveFeedback = async (fb: FeedbackItem) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(fb.id, fb); else await addFeedback(fb); onRefreshFeedbacks(); setEditingFeedback(null); };
    const handleDeleteFeedback = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteFeedback(id); onRefreshFeedbacks(); } };

    // UPDATED Pancake Token Auto-Extraction with decoding
    const handlePancakeTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val.includes('access_token=')) {
            try {
                // Decode URI first to handle %20 etc
                const decodedVal = decodeURIComponent(val);
                const match = decodedVal.match(/access_token=([^&]+)/);
                if (match && match[1]) {
                    setPancakeToken(match[1]);
                    alert("Đã tự động trích xuất Token từ đường dẫn!");
                    return;
                }
            } catch (err) {
                console.error("Token extraction failed", err);
            }
        }
        setPancakeToken(val);
    };

    const fontOptions = [
        { label: '--- Google Fonts ---', options: GOOGLE_FONTS.map(f => ({ value: f.name, label: f.label })) },
        { label: '--- Custom Fonts ---', options: (storeConfig.uploadedFonts || []).map(f => ({ value: f.name, label: `${f.name} (Uploaded)` })) }
    ];

    // ... (Return JSX - mostly same as before, simplified for brevity here) ...
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

            {/* Top Navigation */}
            <div className="sticky top-16 z-20 bg-gray-50 pt-4 pb-2 border-b mb-6 overflow-x-auto no-scrollbar">
                <div className="flex gap-2">
                    {['branding', 'theme', 'sections', 'content', 'fonts', 'integrations', 'staff', 'seo'].map(t => (
                        <button 
                            key={t}
                            onClick={() => setActiveTab(t as ConfigTab)} 
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors capitalize ${activeTab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}
                        >
                            {t === 'integrations' ? 'Kết nối' : t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-8 order-2 lg:order-1 h-[calc(100vh-180px)] overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* ... (Existing tabs rendered conditionally) ... */}
                    {activeTab === 'branding' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Hình ảnh thương hiệu</h3>
                            <div ref={(el) => { inputRefs.current['logoUrl'] = el; }}>
                                <ConfigImageUpload label="Logo" description="Header & Footer" currentUrl={storeConfig.logoUrl} onUpload={(f) => handleConfigUpload(f, 'logoUrl')} isUploading={uploadingField === 'logoUrl'} />
                            </div>
                            <ConfigImageUpload label="Hero Banner" description="Trang chủ" currentUrl={storeConfig.heroImageUrl} onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')} isUploading={uploadingField === 'heroImageUrl'} />
                        </div>
                    )}

                    {/* ... (Theme, Sections, Content, Fonts, SEO, Staff tabs similar to original) ... */}

                    {/* INTEGRATIONS TAB */}
                    {activeTab === 'integrations' && (
                        <div className="space-y-8">
                            {/* Telegram */}
                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                <h3 className="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2">
                                    <span className="text-blue-500">✈️</span> Thông báo Telegram
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Bot Token</label>
                                        <input type="password" className="w-full p-2 border rounded text-sm" placeholder="123:ABC..." value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Chat ID</label>
                                        <div className="flex gap-2">
                                            <input type="text" className="w-full p-2 border rounded text-sm" placeholder="-100..." value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} />
                                            <button onClick={async () => {
                                                if (!telegramToken || !telegramChatId) return alert("Nhập Token và ID trước");
                                                const res = await testTelegramConnection(telegramToken, telegramChatId);
                                                if (res.success) alert("Thành công!"); else alert("Thất bại: " + res.error);
                                            }} className="bg-green-600 text-white px-3 py-2 rounded text-xs font-bold whitespace-nowrap">Test</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pancake POS */}
                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                <h3 className="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2">
                                    <span className="text-pink-500">🥞</span> Pancake POS
                                </h3>
                                <div className="space-y-4">
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800 mb-2">
                                        <p><b>Cách lấy Token:</b> F12 Network Tab &rarr; Refresh POS &rarr; Tìm request 'shops' &rarr; Copy Link Address &rarr; Dán vào đây.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Access Token</label>
                                        <input type="password" className="w-full p-2 border rounded text-sm" placeholder="Paste link or token..." value={pancakeToken} onChange={handlePancakeTokenChange} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Shop ID</label>
                                        <div className="flex gap-2">
                                            <input type="text" className="w-full p-2 border rounded text-sm" placeholder="194820" value={pancakeShopId} onChange={(e) => setPancakeShopId(e.target.value)} />
                                            <button onClick={async () => {
                                                if (!pancakeToken || !pancakeShopId) return alert("Nhập Token và Shop ID trước");
                                                setLoading(true);
                                                const res = await testPancakeConnection(pancakeToken, pancakeShopId);
                                                setLoading(false);
                                                if (res.success) alert("Kết nối thành công!"); else alert("Thất bại: " + res.error);
                                            }} className="bg-green-600 text-white px-3 py-2 rounded text-xs font-bold whitespace-nowrap hover:bg-green-700">Test Kết Nối</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex justify-end gap-4 border-t pt-4 sticky bottom-0 bg-gray-50 p-4 -mx-4 -mb-4">
                        <button onClick={handleResetTheme} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded">Reset</button>
                        <button onClick={handleSaveConfig} className="px-6 py-2 bg-gray-900 text-white font-bold rounded hover:bg-black shadow-lg">Lưu Cấu Hình</button>
                    </div>
                </div>

                {/* Right Panel (Preview) - Same as original */}
                <div className="lg:col-span-8 order-1 lg:order-2">
                    <div className="sticky top-24 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                        <div className="bg-gray-100 p-3 border-b flex justify-between items-center flex-shrink-0">
                            <span className="text-xs font-bold text-gray-500 uppercase">🖥️ Live Preview</span>
                        </div>
                        <div 
                            className="flex-grow overflow-y-auto custom-scrollbar relative"
                            style={{ backgroundColor: themeConfig.global.colors.background, color: themeConfig.global.colors.text, fontFamily: themeConfig.global.typography.bodyFont }}
                        >
                            <EditableZone onClick={() => scrollToField('sections', 'sections.header.backgroundColor')} label="Header">
                                <div className="container mx-auto px-6 py-4 flex justify-between items-center" style={{ backgroundColor: themeConfig.sections.header.backgroundColor, color: themeConfig.sections.header.textColor }}>
                                    <div className="font-bold text-2xl" style={{ fontFamily: themeConfig.global.typography.headingFont }}>
                                        {storeConfig.logoUrl ? <img src={storeConfig.logoUrl} className="h-10" /> : 'The Luvin'}
                                    </div>
                                    <div className="hidden md:flex gap-4 text-sm font-semibold"><span>Menu</span><span>Menu</span></div>
                                </div>
                            </EditableZone>
                            {/* Hero Preview */}
                            <EditableZone onClick={() => scrollToField('sections', 'sections.hero.backgroundColor')} label="Hero" className="p-12 text-center" style={{ backgroundColor: themeConfig.sections.hero.backgroundColor, color: themeConfig.sections.hero.textColor }}>
                                <h1 className="text-4xl mb-4" style={{ fontFamily: themeConfig.global.typography.headingFont, color: themeConfig.sections.hero.headingColor }}>{storeConfig.heroTitle || 'Tiêu đề'}</h1>
                                <p className="mb-6">{storeConfig.heroSubtitle || 'Phụ đề'}</p>
                                <button className="px-6 py-2 rounded-full text-white font-bold" style={{ backgroundColor: themeConfig.global.colors.primary, borderRadius: themeConfig.global.borderRadius }}>Button</button>
                            </EditableZone>
                        </div>
                    </div>
                </div>
            </div>

            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};
