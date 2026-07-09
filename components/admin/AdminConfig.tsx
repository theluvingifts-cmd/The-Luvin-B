
import React, { useState, useEffect, useRef } from 'react';
import { FeedbackItem, ThemeConfig, CustomFont, StaffMember } from '../../types';
import { StoreConfig, updateStoreConfig, DEFAULT_THEME } from '../../services/configService';
import { addFeedback, updateFeedback, deleteFeedback } from '../../services/feedbackService';
import { addVoucher } from '../../services/voucherService';
import { uploadFile } from '../../services/uploadService';
import { ConfigImageUpload } from './shared/ConfigImageUpload';
import { FeedbackForm } from './forms/FeedbackForm';
import * as firebaseApp from 'firebase/app';
// Fix: Use standard modular imports for Firebase v9+
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../../config/firebase';
import { testTelegramConnection } from '../../services/telegramService';
import { findUnusedImages, deleteStorageFiles, UnusedFile, cleanupOldOrderImages } from '../../services/cleanupService';

interface AdminConfigProps {
    storeConfig: StoreConfig;
    setStoreConfig: React.Dispatch<React.SetStateAction<StoreConfig>>;
    feedbacks: FeedbackItem[];
    onRefreshFeedbacks: () => void;
}

type ConfigTab = 'branding' | 'theme' | 'sections' | 'content' | 'fonts' | 'staff' | 'seo' | 'cleanup' | 'restore';

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

    // Cleanup State
    const [unusedFiles, setUnusedFiles] = useState<UnusedFile[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCleaningOldOrders, setIsCleaningOldOrders] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<{ ordersProcessed: number; filesDeleted: number } | null>(null);
    const [cleanupLogs, setCleanupLogs] = useState<{msg: string, type: 'info' | 'success' | 'error', time: string}[]>([]);

    // Restore State
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreLogs, setRestoreLogs] = useState<{time: string, msg: string, type: 'info' | 'success' | 'error'}[]>([]);
    const [restoreFiles, setRestoreFiles] = useState<File[]>([]);
    const [restoreResult, setRestoreResult] = useState<{updatedCount: number} | null>(null);

    const addRestoreLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
        setRestoreLogs(prev => [{time: new Date().toLocaleTimeString('vi-VN'), msg, type}, ...prev].slice(0, 50));
    };

    const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
        setCleanupLogs(prev => [{
            msg,
            type,
            time: new Date().toLocaleTimeString('vi-VN')
        }, ...prev].slice(0, 10)); // Giữ 10 log gần nhất
    };

    // Telegram Config
    const [telegramToken, setTelegramToken] = useState(storeConfig.telegramBotToken || '');
    const [telegramChatId, setTelegramChatId] = useState(storeConfig.telegramChatId || '');

    // B2B Config
    const [b2bDiscount, setB2bDiscount] = useState(storeConfig.b2bDiscountPercent || 5);
    const [museumSurcharge, setMuseumSurcharge] = useState(storeConfig.museumSurcharge !== undefined ? storeConfig.museumSurcharge : 70000);

    // Pancake POS Config
    const [pancakeShopId, setPancakeShopId] = useState(storeConfig.pancakeShopId || '');
    const [pancakeAccessToken, setPancakeAccessToken] = useState(storeConfig.pancakeAccessToken || '');
    const [enablePancakePush, setEnablePancakePush] = useState(storeConfig.enablePancakePush || false);

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
        if (storeConfig.museumSurcharge !== undefined) setMuseumSurcharge(storeConfig.museumSurcharge);

        // Auto Cleanup Logic
        const runAutoCleanup = async () => {
            if (storeConfig.enableAutoCleanup) {
                const now = Date.now();
                const lastRun = storeConfig.lastAutoCleanupAt || 0;
                const oneDay = 24 * 60 * 60 * 1000;

                if (now - lastRun > oneDay) {
                    console.log("Running scheduled auto-cleanup...");
                    try {
                        const days = storeConfig.autoCleanupDays || 30;
                        await cleanupOldOrderImages(days);
                        await updateStoreConfig({ lastAutoCleanupAt: now });
                    } catch (error) {
                        console.error("Auto-cleanup failed:", error);
                    }
                }
            }
        };
        runAutoCleanup();
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
            pancakeShopId,
            pancakeAccessToken,
            enablePancakePush,
            b2bDiscountPercent: b2bDiscount,
            museumSurcharge: museumSurcharge,
            disableThankYouEmail: storeConfig.disableThankYouEmail,
            lightPrice: storeConfig.lightPrice,
            appIconUrl: storeConfig.appIconUrl,
            standardPrintImageUrl: storeConfig.standardPrintImageUrl,
            standardPrintOutOfStock: storeConfig.standardPrintOutOfStock,
            premiumPrintImageUrl: storeConfig.premiumPrintImageUrl,
            polaroidSampleImages: storeConfig.polaroidSampleImages,
            warehouseAddress: storeConfig.warehouseAddress,
            googleMapsUrl: storeConfig.googleMapsUrl
        });
        if (success) {
            setStoreConfig(prev => ({ 
                ...prev, 
                theme: themeConfig, 
                telegramBotToken: telegramToken, 
                telegramChatId: telegramChatId,
                pancakeShopId,
                pancakeAccessToken,
                enablePancakePush,
                b2bDiscountPercent: b2bDiscount,
                museumSurcharge: museumSurcharge,
                disableThankYouEmail: storeConfig.disableThankYouEmail,
                lightPrice: storeConfig.lightPrice,
                appIconUrl: storeConfig.appIconUrl,
                standardPrintImageUrl: storeConfig.standardPrintImageUrl,
                standardPrintOutOfStock: storeConfig.standardPrintOutOfStock,
                premiumPrintImageUrl: storeConfig.premiumPrintImageUrl,
                polaroidSampleImages: storeConfig.polaroidSampleImages,
                warehouseAddress: storeConfig.warehouseAddress,
                googleMapsUrl: storeConfig.googleMapsUrl
            }));
            alert("Đã lưu cấu hình thành công!");
        } else {
            alert("Lỗi lưu cấu hình.");
        }
        setLoading(false);
    };

    const handleScanUnused = async () => {
        setIsScanning(true);
        addLog("Đang quét ảnh thừa trong Storage...", "info");
        try {
            const files = await findUnusedImages();
            setUnusedFiles(files);
            if (files.length === 0) {
                addLog("Không tìm thấy ảnh thừa nào.", "success");
            } else {
                addLog(`Tìm thấy ${files.length} ảnh không được sử dụng.`, "info");
            }
        } catch (error) {
            console.error(error);
            addLog("Lỗi khi quét ảnh thừa.", "error");
        } finally {
            setIsScanning(false);
        }
    };

    const handleDeleteUnused = async () => {
        if (unusedFiles.length === 0) return;
        if (!confirm(`Bạn có chắc muốn xóa ${unusedFiles.length} ảnh này không? Hành động này không thể hoàn tác!`)) return;

        setIsDeleting(true);
        addLog(`Đang xóa ${unusedFiles.length} ảnh thừa...`, "info");
        try {
            const result = await deleteStorageFiles(unusedFiles);
            addLog(`Đã xóa thành công ${result.success} ảnh. Thất bại: ${result.failed}`, result.failed === 0 ? "success" : "error");
            setUnusedFiles([]);
        } catch (error) {
            console.error(error);
            addLog("Lỗi khi xóa ảnh thừa.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCleanupOldOrders = async () => {
        if (!confirm("Bạn có chắc muốn xóa ảnh của các đơn hàng cũ hơn 30 ngày? Hành động này không thể hoàn tác!")) return;
        
        setIsCleaningOldOrders(true);
        setCleanupResult(null);
        addLog("Đang bắt đầu dọn dẹp ảnh đơn hàng cũ (>30 ngày)...", "info");
        try {
            const result = await cleanupOldOrderImages(30);
            setCleanupResult(result);
            addLog(`Dọn dẹp hoàn tất! Đã xử lý ${result.ordersProcessed} đơn hàng, xóa ${result.filesDeleted} tệp ảnh.`, "success");
        } catch (error) {
            console.error(error);
            addLog("Lỗi khi dọn dẹp ảnh đơn hàng cũ.", "error");
        } finally {
            setIsCleaningOldOrders(false);
        }
    };

    const handleRestoreFiles = async () => {
        if (restoreFiles.length === 0) return;
        setIsRestoring(true);
        setRestoreLogs([]);
        setRestoreResult(null);
        
        try {
            const { restoreImagesByFileName } = await import('../../services/restoreService');
            const result = await restoreImagesByFileName(restoreFiles, (msg) => {
                const type = msg.startsWith('✅') ? 'success' : msg.startsWith('❓') ? 'error' : 'info';
                addRestoreLog(msg, type);
            });
            
            if (result.success) {
                setRestoreResult({ updatedCount: result.updatedCount });
                addRestoreLog(`Hoàn tất khôi phục ${result.updatedCount} mục!`, 'success');
            } else {
                addRestoreLog(`Lỗi khôi phục: ${result.message}`, 'error');
            }
        } catch (error: any) {
            addRestoreLog(`Lỗi hệ thống: ${error.message}`, 'error');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleConfigUpload = async (file: File, field: keyof StoreConfig) => {
        setUploadingField(field);
        try {
            const url = await uploadFile(file, 'assets');
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

    const handleToggleLight = async () => {
        const newValue = !storeConfig.lightOutOfStock;
        setStoreConfig(prev => ({ ...prev, lightOutOfStock: newValue }));
        await updateStoreConfig({ lightOutOfStock: newValue });
    };

    const handleToggleCard = async () => {
        const newValue = !storeConfig.cardOutOfStock;
        setStoreConfig(prev => ({ ...prev, cardOutOfStock: newValue }));
        await updateStoreConfig({ cardOutOfStock: newValue });
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
                const url = await uploadFile(file, 'assets');
                
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
            const updatedStaffEmails = updatedStaff.map(s => s.email);
            const success = await updateStoreConfig({ 
                staff: updatedStaff,
                staffEmails: updatedStaffEmails
            });
            if (success) {
                setStoreConfig(prev => ({ 
                    ...prev, 
                    staff: updatedStaff,
                    staffEmails: updatedStaffEmails
                }));
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
            const updatedStaffEmails = updatedStaff.map(s => s.email);
            const success = await updateStoreConfig({ 
                staff: updatedStaff,
                staffEmails: updatedStaffEmails
            });
            if (success) {
                setStoreConfig(prev => ({ 
                    ...prev, 
                    staff: updatedStaff,
                    staffEmails: updatedStaffEmails
                }));
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
                    {['branding', 'theme', 'sections', 'content', 'fonts', 'staff', 'pancake', 'seo', 'cleanup', 'restore'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as ConfigTab)} 
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === tab ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}
                        >
                            {tab === 'branding' ? 'Hình ảnh & Doanh nghiệp' : tab === 'theme' ? 'Màu & Font' : tab === 'sections' ? 'Chi tiết' : tab === 'content' ? 'Nội dung' : tab === 'fonts' ? 'Quản lý Font' : tab === 'staff' ? 'Nhân sự & Thông báo' : tab === 'pancake' ? 'Kết nối POS' : tab === 'seo' ? 'SEO & Social' : tab === 'cleanup' ? 'Dọn dẹp Storage' : 'Khôi phục ảnh'}
                            {tab === 'cleanup' && (isScanning || isDeleting || isCleaningOldOrders) && (
                                <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                            )}
                            {tab === 'restore' && isRestoring && (
                                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            )}
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

                            {/* MUSEUM SURCHARGE CONFIG - ADDED FOR USER REQUEST */}
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <h4 className="text-sm font-black text-indigo-800 uppercase tracking-tight mb-3 flex items-center gap-2">
                                    🖼️ Hoàn thiện Khung bảo tàng / Gallery
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Phí shop lắp hoàn thiện (VNĐ)</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="number" 
                                                className="w-full p-2.5 border-2 border-indigo-200 rounded-lg text-lg font-black text-indigo-900 focus:border-indigo-500 outline-none"
                                                value={museumSurcharge}
                                                onChange={(e) => setMuseumSurcharge(Number(e.target.value))}
                                                min="0"
                                            />
                                            <span className="font-black text-indigo-400 text-xl">₫</span>
                                        </div>
                                        <p className="text-[10px] text-indigo-500 mt-2 leading-relaxed">
                                            Mức phí này được áp dụng khi khách hàng chọn tùy chọn "Shop hoàn thiện / Lắp sẵn" cho Khung bảo tàng/Gallery.
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
                                <div ref={(el) => { inputRefs.current['appIconUrl'] = el; }}>
                                    <div className="mb-4">
                                        <ConfigImageUpload 
                                            label="App Icon (Icon màn hình chính)" 
                                            description="Bắt buộc là hình VUÔNG (1:1). Nếu dùng logo dài sẽ bị méo khi cài ra điện thoại." 
                                            currentUrl={storeConfig.appIconUrl} 
                                            onUpload={(f) => handleConfigUpload(f, 'appIconUrl')} 
                                            isUploading={uploadingField === 'appIconUrl'} 
                                        />
                                        {storeConfig.appIconUrl && (
                                            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-3">Xem trước trên điện thoại (iPhone/Android)</p>
                                                <div className="flex gap-8 justify-center items-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg border-2 border-white">
                                                            <img src={storeConfig.appIconUrl} className="w-full h-full object-cover" alt="Square preview" />
                                                        </div>
                                                        <span className="text-[9px] font-bold text-gray-500">Android/Web</span>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white">
                                                            <img src={storeConfig.appIconUrl} className="w-full h-full object-cover" alt="Circle preview" />
                                                        </div>
                                                        <span className="text-[9px] font-bold text-gray-500">iOS/Shortcut</span>
                                                    </div>
                                                </div>
                                                <div className="mt-4 p-2 bg-yellow-50 rounded-lg border border-yellow-100 text-[10px] text-yellow-700 flex items-start gap-2">
                                                    <span className="text-sm">💡</span>
                                                    <div className="space-y-1">
                                                        <p className="font-bold">Làm sao để không bị méo ảnh?</p>
                                                        <p>Ảnh trên PHẢI LÀ HÌNH VUÔNG (Tỷ lệ 1:1, ví dụ 512x512 pixel). Nếu bạn thấy logo trong hình TRÒN bị bóp méo, hãy dùng ứng dụng chỉnh ảnh để cắt logo thành hình vuông trước khi tải lên đây.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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

                                <div ref={(el) => { inputRefs.current['lightImageUrl'] = el; }} className="p-4 border-2 border-dashed border-gray-200 rounded-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-gray-700">Tùy chọn Đèn khung tranh</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase ${storeConfig.lightOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                                                {storeConfig.lightOutOfStock ? 'Hết hàng' : 'Còn hàng'}
                                            </span>
                                            <button 
                                                onClick={handleToggleLight}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${storeConfig.lightOutOfStock ? 'bg-gray-300' : 'bg-green-500'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${storeConfig.lightOutOfStock ? '' : 'translate-x-6'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Giá đèn (+VND)</label>
                                        <input 
                                            type="number" 
                                            className="w-full p-2 border rounded text-sm" 
                                            value={storeConfig.lightPrice || 0} 
                                            onChange={(e) => setStoreConfig({...storeConfig, lightPrice: Number(e.target.value)})} 
                                        />
                                    </div>
                                    <ConfigImageUpload label="Ảnh mẫu Đèn" description="Tải ảnh mẫu hiển thị ở trang Checkout" currentUrl={storeConfig.lightImageUrl} onUpload={(f) => handleConfigUpload(f, 'lightImageUrl')} isUploading={uploadingField === 'lightImageUrl'} />
                                </div>

                                <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-700">Tùy chọn Thiệp đi kèm</h4>
                                            <p className="text-xs text-gray-400 mt-0.5">Bật/tắt hiển thị thiệp chúc mừng đi kèm hộp quà và các trang trưng bày sản phẩm.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase ${storeConfig.cardOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                                                {storeConfig.cardOutOfStock ? 'Tạm ẩn (Hết hàng)' : 'Hiển thị (Còn hàng)'}
                                            </span>
                                            <button 
                                                type="button"
                                                onClick={handleToggleCard}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${storeConfig.cardOutOfStock ? 'bg-gray-300' : 'bg-green-500'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${storeConfig.cardOutOfStock ? '' : 'translate-x-6'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl bg-orange-50/30">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            🎨 Ảnh mẫu In Yêu Cầu
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase ${storeConfig.standardPrintOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                                                {storeConfig.standardPrintOutOfStock ? 'In thường: Tạm tắt' : 'In thường: Đang bật'}
                                            </span>
                                            <button 
                                                onClick={async () => {
                                                    const newValue = !storeConfig.standardPrintOutOfStock;
                                                    setStoreConfig(prev => ({ ...prev, standardPrintOutOfStock: newValue }));
                                                    await updateStoreConfig({ standardPrintOutOfStock: newValue });
                                                }}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${storeConfig.standardPrintOutOfStock ? 'bg-gray-300' : 'bg-green-500'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${storeConfig.standardPrintOutOfStock ? '' : 'translate-x-6'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <ConfigImageUpload 
                                            label="Ảnh In Thường" 
                                            description="Ví dụ cho gói 100k" 
                                            currentUrl={storeConfig.standardPrintImageUrl} 
                                            onUpload={(f) => handleConfigUpload(f, 'standardPrintImageUrl')} 
                                            isUploading={uploadingField === 'standardPrintImageUrl'} 
                                        />
                                        <ConfigImageUpload 
                                            label="Ảnh In Cao Cấp" 
                                            description="Ví dụ cho gói 300k" 
                                            currentUrl={storeConfig.premiumPrintImageUrl} 
                                            onUpload={(f) => handleConfigUpload(f, 'premiumPrintImageUrl')} 
                                            isUploading={uploadingField === 'premiumPrintImageUrl'} 
                                        />
                                    </div>
                                </div>

                                <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl bg-pink-50/20">
                                    <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                        📸 Ảnh mẫu Polaroid
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-3">
                                            {(storeConfig.polaroidSampleImages || []).map((url, idx) => (
                                                <div key={idx} className="relative group w-24 h-32 border rounded-lg bg-white overflow-hidden">
                                                    <img src={url} alt={`Sample ${idx}`} className="w-full h-full object-cover" />
                                                    <button 
                                                        onClick={() => {
                                                            const updated = (storeConfig.polaroidSampleImages || []).filter((_, i) => i !== idx);
                                                            setStoreConfig(prev => ({ ...prev, polaroidSampleImages: updated }));
                                                            updateStoreConfig({ polaroidSampleImages: updated });
                                                        }}
                                                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="relative w-24 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-white transition-colors cursor-pointer group">
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    multiple
                                                    onChange={async (e) => {
                                                        if (e.target.files) {
                                                            const files = Array.from(e.target.files);
                                                            setUploadingField('polaroidSampleImages');
                                                            try {
                                                                const urls = await Promise.all(files.map((f: File) => uploadFile(f, 'assets')));
                                                                const validUrls = urls.filter((u): u is string => !!u);
                                                                const updated = [...(storeConfig.polaroidSampleImages || []), ...validUrls];
                                                                setStoreConfig(prev => ({ ...prev, polaroidSampleImages: updated }));
                                                                await updateStoreConfig({ polaroidSampleImages: updated });
                                                            } finally {
                                                                setUploadingField(null);
                                                            }
                                                        }
                                                    }}
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                />
                                                {uploadingField === 'polaroidSampleImages' ? (
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
                                                ) : (
                                                    <span className="text-2xl text-gray-400 group-hover:text-pink-500">+</span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-400 italic">* Tải lên các ảnh mẫu để khách hàng dễ hình dung về sản phẩm in Polaroid.</p>
                                    </div>
                                </div>

                                <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl bg-blue-50/20">
                                    <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                        📍 Thông tin Kho & Google Maps
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Tên Kho (Hiển thị trang Thanh toán)</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2.5 border rounded-lg text-sm"
                                                value={storeConfig.warehouseAddress || ''}
                                                onChange={(e) => setStoreConfig({...storeConfig, warehouseAddress: e.target.value})}
                                                placeholder="Kho: Thư Lâm, Đông Anh, HN"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Link Google Maps (Ghim địa chỉ)</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2.5 border rounded-lg text-sm"
                                                value={storeConfig.googleMapsUrl || ''}
                                                onChange={(e) => setStoreConfig({...storeConfig, googleMapsUrl: e.target.value})}
                                                placeholder="https://www.google.com/maps/..."
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1 italic leading-tight">
                                                Link này sẽ hiện nút "Xem trên Google Maps" ở phần Xác nhận khoảng cách khi khách chọn Tự book ship.
                                            </p>
                                        </div>
                                    </div>
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

                    {activeTab === 'restore' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2">
                                <span className="text-2xl">🛠️</span> Khôi phục ảnh khẩn cấp
                            </h3>
                            
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-sm text-green-800">
                                <p className="font-bold mb-1">💡 Hướng dẫn khôi phục:</p>
                                <p>1. Chọn toàn bộ ảnh gốc (Tóc, Mặt, Nền...) từ máy tính của bạn.</p>
                                <p>2. Hệ thống sẽ tự động so sánh tên file và cập nhật lại link ảnh vào Firestore.</p>
                                <p className="mt-2 text-[10px] opacity-70 italic">* Lưu ý: Tên file nên giống với tên file cũ bạn đã upload trước đây.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-green-400 transition-colors bg-gray-50/50">
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*"
                                        onChange={(e) => setRestoreFiles(Array.from(e.target.files || []))}
                                        className="hidden" 
                                        id="restore-upload"
                                    />
                                    <label htmlFor="restore-upload" className="cursor-pointer space-y-2 block">
                                        <div className="text-4xl">📁</div>
                                        <p className="text-sm font-bold text-gray-700">
                                            {restoreFiles.length > 0 ? `Đã chọn ${restoreFiles.length} tệp` : 'Nhấn để chọn ảnh khôi phục'}
                                        </p>
                                        <p className="text-xs text-gray-400">Hỗ trợ chọn nhiều file cùng lúc</p>
                                    </label>
                                </div>

                                <button 
                                    onClick={handleRestoreFiles}
                                    disabled={isRestoring || restoreFiles.length === 0}
                                    className="w-full py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2"
                                >
                                    {isRestoring ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Đang khôi phục...
                                        </>
                                    ) : '🚀 Bắt đầu khôi phục tự động'}
                                </button>
                            </div>

                            {restoreLogs.length > 0 && (
                                <div className="p-4 bg-gray-900 rounded-xl font-mono text-[11px] text-green-400 space-y-1 max-h-60 overflow-y-auto shadow-inner custom-scrollbar">
                                    <div className="text-gray-500 border-b border-gray-800 pb-2 mb-2 uppercase flex justify-between items-center sticky top-0 bg-gray-900">
                                        <span>Nhật ký khôi phục</span>
                                        <button onClick={() => setRestoreLogs([])} className="text-[9px] hover:text-white">Xóa log</button>
                                    </div>
                                    {restoreLogs.map((log, i) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-gray-600">[{log.time}]</span>
                                            <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-blue-400'}>
                                                {log.msg}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {restoreResult && (
                                <div className="p-4 bg-green-100 text-green-800 rounded-xl border border-green-200 text-center animate-bounce">
                                    <p className="font-bold">🎉 Khôi phục hoàn tất!</p>
                                    <p className="text-sm">Đã cập nhật thành công {restoreResult.updatedCount} mục dữ liệu.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'cleanup' && (
                        <div className="bg-red-50 p-12 rounded-2xl border-2 border-red-200 text-center space-y-6 shadow-sm">
                            <div className="text-6xl animate-bounce">⚠️</div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-red-800 uppercase tracking-tight">Tính năng tạm khóa bảo trì</h3>
                                <p className="text-red-600 font-medium max-w-md mx-auto leading-relaxed">
                                    Chúng tôi đang nâng cấp thuật toán bảo vệ dữ liệu để đảm bảo an toàn tuyệt đối cho hình ảnh sản phẩm, linh kiện và hình nền của bạn. 
                                    <br/><span className="font-bold">Vui lòng quay lại sau khi quá trình bảo trì hoàn tất.</span>
                                </p>
                            </div>
                            <div className="pt-4">
                                <button 
                                    onClick={() => setActiveTab('branding')}
                                    className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                                >
                                    Quay lại Trang chủ
                                </button>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold mb-1">Hotline 1</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.hotline} onChange={(e) => setStoreConfig({...storeConfig, hotline: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold mb-1">Hotline 2</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.hotline2 || ''} onChange={(e) => setStoreConfig({...storeConfig, hotline2: e.target.value})} /></div>
                                </div>
                                <div><label className="block text-xs font-bold mb-1">Email Liên hệ</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.email || ''} onChange={(e) => setStoreConfig({...storeConfig, email: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold mb-1">Tiêu đề Hero</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.heroTitle} onChange={(e) => setStoreConfig({...storeConfig, heroTitle: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold mb-1">Phụ đề Hero</label><input className="w-full p-2 border rounded text-sm" value={storeConfig.heroSubtitle} onChange={(e) => setStoreConfig({...storeConfig, heroSubtitle: e.target.value})} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pancake' && (
                        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <h3 className="text-lg font-bold">Kết nối Pancake POS</h3>
                                    <p className="text-xs text-gray-500">Đẩy đơn hàng tự động sang hệ thống Pancake POS</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-600">Kích hoạt</span>
                                    <button 
                                        onClick={() => setEnablePancakePush(!enablePancakePush)}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${enablePancakePush ? 'bg-green-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${enablePancakePush ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Shop ID</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            placeholder="Ví dụ: 1328233541"
                                            value={pancakeShopId}
                                            onChange={(e) => setPancakeShopId(e.target.value)}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1 italic">Lấy từ thanh địa chỉ trình duyệt khi vào Pancake POS</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Access Token</label>
                                        <input 
                                            type="password" 
                                            className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            placeholder="Nhập Access Token từ Pancake"
                                            value={pancakeAccessToken}
                                            onChange={(e) => setPancakeAccessToken(e.target.value)}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1 italic">Lấy từ phần Cấu hình &gt; Kết nối bên thứ 3 &gt; Webhook/API</p>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center">
                                    <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        Hướng dẫn kết nối
                                    </h4>
                                    <ul className="text-xs text-blue-700 space-y-2 list-disc pl-4">
                                        <li>Truy cập <b>pos.pancake.vn</b></li>
                                        <li>Vào <b>Cấu hình</b> {'>'} <b>Nâng cao</b> {'>'} <b>Kết nối bên thứ 3</b></li>
                                        <li>Chọn <b>Webhook/API</b> và nhấn <b>Chi tiết</b></li>
                                        <li>Copy <b>Access Token</b> và dán vào ô bên trái</li>
                                        <li>Nhấn <b>Lưu cấu hình</b> để hoàn tất</li>
                                    </ul>
                                </div>
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
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Nhân sự & Thông báo</h3>
                            
                            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-orange-800">Mail cảm ơn khi giao hàng</h4>
                                    <p className="text-[10px] text-orange-600">Gửi mail tự động khi trạng thái chuyển sang "Đã giao hàng"</p>
                                </div>
                                <button 
                                    onClick={() => setStoreConfig(prev => ({ ...prev, disableThankYouEmail: !prev.disableThankYouEmail }))}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors ${storeConfig.disableThankYouEmail ? 'bg-gray-300' : 'bg-orange-500'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${storeConfig.disableThankYouEmail ? '' : 'translate-x-6'}`}></div>
                                </button>
                            </div>

                            <button 
                                onClick={async () => {
                                    const success = await addVoucher({
                                        id: 'THELUVIN5',
                                        code: 'THELUVIN5',
                                        type: 'percent',
                                        value: 5,
                                        minOrderValue: 0,
                                        usedCount: 0,
                                        isActive: true,
                                        description: 'Voucher 5% tặng kèm mail cảm ơn'
                                    });
                                    if (success) alert('Đã kích hoạt mã THELUVIN5 (giảm 5%) thành công!');
                                    else alert('Lỗi khi kích hoạt voucher.');
                                }}
                                className="w-full py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                Kích hoạt mã THELUVIN5 (Voucher 5%)
                            </button>

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
