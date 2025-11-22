
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds } from '../services/backgroundService';
import { getAllTemplates, addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../services/templateService';
import { getAllFeedbacks, addFeedback, updateFeedback, deleteFeedback, seedFeedbacks } from '../services/feedbackService';
import { uploadToCloudinary } from '../services/uploadService';
import { updateStoreConfig, getStoreConfig, StoreConfig } from '../services/configService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem, PresetBackground, OutfitColor, CollectionTemplate, FeedbackItem } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS, INITIAL_FRAME_CONFIG } from '../constants';

// --- CONSTANTS & HELPERS ---

const CHARACTER_BASE_PRICE = 10000;

const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const getStartOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

const getEndOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
};

// --- STATUS CONFIGURATION ---
const STATUS_CONFIG = [
    { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800', icon: '🕒' },
    { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800', icon: '🛡️' }, 
    { label: 'Ưu tiên xuất đơn', color: 'bg-pink-100 text-pink-800', icon: '⚡' },
    { label: 'Đang đóng hàng', color: 'bg-indigo-100 text-indigo-800', icon: '🎁' },
    { label: 'Chờ chuyển hàng', color: 'bg-purple-100 text-purple-800', icon: '✓' },
    { label: 'Gửi hàng đi', color: 'bg-orange-100 text-orange-800', icon: '🚚' },
    { label: 'Đã giao hàng', color: 'bg-green-100 text-green-800', icon: '✅' },
    { label: 'Huỷ đơn', color: 'bg-red-100 text-red-800', icon: '❌' },
    { label: 'Xoá đơn', color: 'bg-gray-200 text-gray-800', icon: '🗑️', isAction: true },
];

// --- COMPONENT: STATUS DROPDOWN ---
const StatusDropdown: React.FC<{ 
    currentStatus: string; 
    onStatusChange: (status: string) => void;
    onDelete?: () => void;
    isAdmin: boolean;
}> = ({ currentStatus, onStatusChange, onDelete, isAdmin }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentConfig = STATUS_CONFIG.find(s => s.label === currentStatus) || STATUS_CONFIG[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm ${currentConfig.color} bg-white border-gray-200 hover:bg-gray-50`}
            >
                <span>{currentConfig.icon}</span>
                <span>{currentStatus}</span>
                <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="p-1">
                        {STATUS_CONFIG.map((status) => {
                            if (status.isAction && !isAdmin) return null;
                            return (
                                <button
                                    key={status.label}
                                    onClick={() => {
                                        setIsOpen(false);
                                        if (status.isAction && status.label === 'Xoá đơn' && onDelete) {
                                            onDelete();
                                        } else {
                                            onStatusChange(status.label);
                                        }
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 hover:bg-gray-50 transition-colors ${status.label === currentStatus ? 'bg-blue-50 text-blue-600' : 'text-gray-700'} ${status.isAction ? 'text-red-600 hover:bg-red-50' : ''}`}
                                >
                                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-md text-xs">{status.icon}</span>
                                    {status.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- COMPONENT: FORM SẢN PHẨM ---
const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1, colors: []
    });
    const [isUploading, setIsUploading] = useState(false);
    
    const [colors, setColors] = useState<OutfitColor[]>(initialData?.colors || []);
    const [newColor, setNewColor] = useState<OutfitColor>({ name: '', hex: '#000000', price: 0, imageUrl: '' });
    const [isUploadingColorImg, setIsUploadingColorImg] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) setFormData(prev => ({ ...prev, imageUrl: url }));
                else alert("Lỗi upload ảnh.");
            } catch (error) {
                console.error(error);
                alert("Lỗi upload ảnh.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleColorFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploadingColorImg(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) setNewColor(prev => ({ ...prev, imageUrl: url }));
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploadingColorImg(false);
            }
        }
    };

    const addColor = () => {
        if (!newColor.name || !newColor.imageUrl) {
            alert("Vui lòng nhập tên màu và tải ảnh cho màu đó.");
            return;
        }
        setColors([...colors, newColor]);
        setNewColor({ name: '', hex: '#000000', price: 0, imageUrl: '' });
    };

    const removeColor = (index: number) => {
        setColors(colors.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên sản phẩm</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" placeholder="Nhập tên..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm">
                                <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="hat">Mũ</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá cơ bản (VNĐ)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh mặc định</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 relative">
                                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                                {isUploading ? <span className="text-xs text-gray-500">Đang tải ảnh lên...</span> : formData.imageUrl ? <img src={formData.imageUrl} alt="Preview" className="max-h-32 object-contain rounded" /> : <span className="text-xs text-gray-400">Bấm để chọn ảnh</span>}
                            </div>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng (cm)</label>
                             <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" step="0.1" />
                        </div>
                         <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao (cm)</label>
                             <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" step="0.1" />
                        </div>
                    </div>

                    {(formData.type === 'shirt' || formData.type === 'pants') && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                            <h4 className="font-bold text-sm text-gray-800 mb-3">Biến thể màu sắc (Tùy chọn)</h4>
                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                {colors.map((color, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: color.hex }}></div>
                                            <img src={color.imageUrl} alt="" className="w-8 h-8 object-contain bg-white rounded border" />
                                            <div>
                                                <p className="text-xs font-bold">{color.name}</p>
                                                <p className="text-[10px] text-gray-500">+{formatCurrency(color.price)}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => removeColor(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">&times;</button>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <p className="text-xs font-bold text-blue-800 mb-2">Thêm màu mới</p>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <input placeholder="Tên màu" className="p-1.5 text-xs border rounded" value={newColor.name} onChange={e => setNewColor({...newColor, name: e.target.value})} />
                                    <input type="number" placeholder="Giá thêm" className="p-1.5 text-xs border rounded" value={newColor.price} onChange={e => setNewColor({...newColor, price: Number(e.target.value)})} />
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Mã màu:</span>
                                        <input type="color" className="w-8 h-8 border rounded cursor-pointer" value={newColor.hex} onChange={e => setNewColor({...newColor, hex: e.target.value})} />
                                    </div>
                                    <div className="relative">
                                        <input type="file" accept="image/*" onChange={handleColorFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploadingColorImg} />
                                        <button className="w-full p-1.5 text-xs border rounded bg-white text-left truncate text-gray-500">{isUploadingColorImg ? 'Đang tải...' : newColor.imageUrl ? 'Đã chọn ảnh' : 'Tải ảnh màu...'}</button>
                                    </div>
                                </div>
                                <button onClick={addColor} disabled={isUploadingColorImg} className="w-full bg-blue-600 text-white text-xs font-bold py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">+ Thêm biến thể</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy bỏ</button>
                    <button onClick={() => onSave({ ...formData, colors })} disabled={isUploading} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded disabled:opacity-50">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: FORM BACKGROUND ---
const BackgroundForm: React.FC<{
    initialData?: PresetBackground | null;
    onSave: (bg: PresetBackground) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<PresetBackground>(initialData || {
        id: `bg_${Date.now()}`, name: '', url: '', category: 'Khác', type: 'square'
    });
    const [isUploading, setIsUploading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) setFormData(prev => ({ ...prev, url }));
            } finally { setIsUploading(false); }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[450px] border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Background' : 'Thêm Background'}</h3>
                <div className="space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên hiển thị</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border rounded text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Danh mục</label><input name="category" value={formData.category} onChange={handleChange} className="w-full p-2.5 border rounded text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại khung</label><select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border rounded text-sm"><option value="square">Vuông (15x15, 23x23)</option><option value="rectangle">Chữ nhật (A5)</option></select></div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                            {isUploading ? <span className="text-xs text-gray-500">Đang tải...</span> : formData.url ? <img src={formData.url} className="max-h-32 object-contain mx-auto rounded" /> : <span className="text-xs text-gray-400">Chọn ảnh</span>}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={() => onSave(formData)} disabled={isUploading || !formData.url} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded disabled:opacity-50">Lưu</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: FORM TEMPLATE ---
const TemplateForm: React.FC<{
    initialData?: CollectionTemplate | null;
    onSave: (tpl: CollectionTemplate) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<CollectionTemplate>(initialData || {
        id: `tpl_${Date.now()}`, name: '', imageUrl: '', config: INITIAL_FRAME_CONFIG
    });
    const [isUploading, setIsUploading] = useState(false);
    const [configJson, setConfigJson] = useState(JSON.stringify(initialData?.config || INITIAL_FRAME_CONFIG, null, 2));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try { const url = await uploadToCloudinary(e.target.files[0]); if (url) setFormData(prev => ({ ...prev, imageUrl: url })); } finally { setIsUploading(false); }
        }
    };
    const handleSave = () => {
        try { onSave({ ...formData, config: JSON.parse(configJson) }); } catch (e) { alert("Lỗi định dạng JSON!"); }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Mẫu' : 'Thêm Mẫu Mới'}</h3>
                <div className="space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên mẫu</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border rounded text-sm" /></div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                        <div className="border-2 border-dashed rounded-lg p-4 text-center relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                            {isUploading ? <span className="text-xs">Uploading...</span> : formData.imageUrl ? <img src={formData.imageUrl} className="max-h-32 mx-auto" /> : <span className="text-xs text-gray-400">Chọn ảnh</span>}
                        </div>
                    </div>
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cấu hình (JSON)</label><textarea value={configJson} onChange={e => setConfigJson(e.target.value)} className="w-full p-2.5 border rounded text-xs font-mono h-40" /></div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={handleSave} disabled={isUploading || !formData.imageUrl} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded disabled:opacity-50">Lưu</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: FORM FEEDBACK ---
const FeedbackForm: React.FC<{
    initialData?: FeedbackItem | null;
    onSave: (fb: FeedbackItem) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<FeedbackItem>(initialData || { id: `fb_${Date.now()}`, name: '', text: '', imageUrl: '' });
    const [isUploading, setIsUploading] = useState(false);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try { const url = await uploadToCloudinary(e.target.files[0]); if (url) setFormData(prev => ({ ...prev, imageUrl: url })); } finally { setIsUploading(false); }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[450px] border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Feedback' : 'Thêm Feedback'}</h3>
                <div className="space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên khách hàng</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border rounded text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nội dung</label><textarea name="text" value={formData.text} onChange={handleChange} className="w-full p-2.5 border rounded text-sm" rows={3} /></div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                        <div className="border-2 border-dashed rounded-lg p-4 text-center relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                            {isUploading ? <span className="text-xs">Uploading...</span> : formData.imageUrl ? <img src={formData.imageUrl} className="max-h-32 mx-auto" /> : <span className="text-xs text-gray-400">Chọn ảnh</span>}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={() => onSave(formData)} disabled={isUploading || !formData.imageUrl} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded disabled:opacity-50">Lưu</button>
                </div>
            </div>
        </div>
    );
};

const ConfigImageUpload: React.FC<{ label: string; description: string; currentUrl?: string; onUpload: (file: File) => Promise<void>; isUploading: boolean; }> = ({ label, description, currentUrl, onUpload, isUploading }) => {
    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
            <p className="text-xs text-gray-500 mb-4">{description}</p>
            <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden relative">
                    {currentUrl ? <img src={currentUrl} alt="Preview" className="w-full h-full object-contain p-2" /> : <span className="text-xs text-gray-400 text-center px-2">Chưa có ảnh</span>}
                    {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><span className="text-xs font-bold text-blue-600 animate-pulse">Uploading...</span></div>}
                </div>
                <div className="flex-grow">
                    <div className="relative inline-block">
                        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
                        <button className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isUploading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black'}`}>{isUploading ? 'Đang xử lý...' : 'Tải ảnh mới'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- ADMIN PAGE ---
const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true); // Added loading state
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]);
    const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);

    const role = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        const ADMIN_EMAILS = ['jinbduong@gmail.com']; 
        if (ADMIN_EMAILS.includes(currentUser.email) || currentUser.email.includes('admin')) return 'admin';
        return 'warehouse';
    }, [currentUser]);

    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'config'>('dashboard');
    const [activeProductSubTab, setActiveProductSubTab] = useState<'parts' | 'backgrounds'>('parts');
    const [activeConfigSubTab, setActiveConfigSubTab] = useState<'general' | 'templates' | 'feedbacks'>('general');

    const [filterType, setFilterType] = useState<'period' | 'month'>('period');
    const [period, setPeriod] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');
    const [month, setMonth] = useState<number>(new Date().getMonth());
    const [year, setYear] = useState<number>(new Date().getFullYear());

    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');

    const [isEditingBackground, setIsEditingBackground] = useState(false);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [bgSearch, setBgSearch] = useState('');
    const [bgTypeFilter, setBgTypeFilter] = useState<'all' | 'square' | 'rectangle'>('all');

    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);

    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const [storeConfig, setStoreConfig] = useState<StoreConfig>({});
    const [uploadingField, setUploadingField] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchOrders(); fetchProducts(); fetchBackgrounds(); fetchTemplates(); fetchFeedbacks(); fetchConfig();
            } else {
                setCurrentUser(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => { if (selectedOrder) { setNoteInput(selectedOrder.internalNotes || ''); setAdminDeadlineInput(selectedOrder.adminDeadline || ''); } }, [selectedOrder]);

    const handleLogin = async (e: React.FormEvent) => { e.preventDefault(); setLoginError(''); try { await signInWithEmailAndPassword(auth, email, loginPass); } catch (error: any) { setLoginError("Thông tin đăng nhập không chính xác."); } };
    const handleLogout = async () => { await signOut(auth); };
    
    const fetchOrders = async () => setOrders(await getAllOrders());
    const fetchProducts = async () => setProducts(await getAllParts());
    const fetchBackgrounds = async () => setBackgrounds(await getAllBackgrounds());
    const fetchTemplates = async () => setTemplates(await getAllTemplates());
    const fetchFeedbacks = async () => setFeedbacks(await getAllFeedbacks());
    const fetchConfig = async () => { const cfg = await getStoreConfig(); if (cfg) setStoreConfig(cfg); };

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => { const success = await updateOrder(orderId, updates); if (success) { setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); if (showMsg) alert("Đã cập nhật!"); } };
    const handleDeleteOrder = async () => { if (selectedOrder && confirm(`Xóa vĩnh viễn đơn ${selectedOrder.id}?`)) { await deleteOrder(selectedOrder.id); setOrders(prev => prev.filter(o => o.id !== selectedOrder.id)); setSelectedOrder(null); alert('Đã xoá đơn hàng.'); } };

    const handleConfigUpload = async (file: File, field: keyof StoreConfig) => {
        setUploadingField(field);
        try { const url = await uploadToCloudinary(file); if (url) { await updateStoreConfig({ [field]: url }); setStoreConfig(prev => ({ ...prev, [field]: url })); alert("Cập nhật thành công!"); } else alert("Lỗi upload."); } catch (e) { alert("Lỗi upload."); } finally { setUploadingField(null); }
    };

    const analytics = useMemo(() => {
        let start: Date, end: Date;
        if (filterType === 'month') { start = new Date(year, month, 1); end = new Date(year, month + 1, 0, 23, 59, 59, 999); }
        else { const now = new Date(); start = getStartOfDay(now); end = getEndOfDay(now); if (period === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); } else if (period === '7days') { start.setDate(start.getDate() - 7); } else if (period === '30days') { start.setDate(start.getDate() - 30); } }
        
        const currentOrders = orders.filter(o => { const t = o.createdAt || Number(o.id.slice(3)) || 0; return t >= start.getTime() && t <= end.getTime(); });
        const revenue = currentOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        
        return { revenue, orderCount: currentOrders.length };
    }, [orders, filterType, period, month, year]);

    const sortedOrders = useMemo(() => {
        let result = [...orders];
        if (filterStatus !== 'all') result = result.filter(o => o.status === filterStatus);
        result.sort((a, b) => sortMode === 'urgent' ? (a.isUrgent === b.isUrgent ? 0 : a.isUrgent ? -1 : 1) : (b.createdAt || 0) - (a.createdAt || 0));
        return result;
    }, [orders, sortMode, filterStatus]);

    const filteredProducts = useMemo(() => products.filter(p => (productCategory === 'all' || p.type === productCategory) && p.name.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch, productCategory]);
    const filteredBackgrounds = useMemo(() => backgrounds.filter(bg => (bgTypeFilter === 'all' || bg.type === bgTypeFilter) && bg.name.toLowerCase().includes(bgSearch.toLowerCase())), [backgrounds, bgTypeFilter, bgSearch]);

    if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
        </div>
    );

    if (!currentUser) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow w-96 text-center">
                <h1 className="text-2xl font-bold mb-4 text-gray-900">The Luvin Admin</h1>
                <form onSubmit={handleLogin} className="space-y-4 text-left">
                    <input type="email" className="w-full p-2 border rounded" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
                    <input type="password" className="w-full p-2 border rounded" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Mật khẩu" required />
                    {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
                    <button type="submit" className="w-full bg-gray-900 text-white font-bold py-2 rounded mt-4">Đăng nhập</button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="text-xl font-bold">The Luvin <span className="font-normal text-gray-400 text-base">| Quản lý</span></div>
                        <nav className="hidden md:flex gap-6">
                            {(['dashboard', 'orders', 'products', 'config'] as const).map(tab => (
                                (role === 'admin' || tab === 'orders') && <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold bg-gray-100 px-3 py-1 rounded-full text-gray-600">{currentUser.email}</span>
                        <button onClick={handleLogout} className="text-sm font-bold text-red-600 hover:underline">Đăng xuất</button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-6 py-8">
                {activeTab === 'dashboard' && role === 'admin' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Tổng quan kinh doanh</h2>
                            <div className="flex bg-white rounded-lg border p-1 gap-1">
                                {['today', 'yesterday', '7days', '30days'].map(p => <button key={p} onClick={() => { setFilterType('period'); setPeriod(p as any); }} className={`px-3 py-1 text-xs font-bold rounded ${filterType === 'period' && period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>)}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl shadow-sm border"><p className="text-sm text-gray-500 font-bold">DOANH THU</p><h3 className="text-3xl font-bold mt-2 text-gray-900">{formatCurrency(analytics.revenue)}</h3></div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border"><p className="text-sm text-gray-500 font-bold">ĐƠN HÀNG</p><h3 className="text-3xl font-bold mt-2 text-gray-900">{analytics.orderCount}</h3></div>
                        </div>
                    </div>
                )}

                {activeTab === 'orders' && (
                    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
                        <div className="col-span-4 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
                            <div className="p-4 border-b space-y-3 bg-gray-50">
                                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Danh sách đơn ({sortedOrders.length})</h3></div>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {['all', ...STATUS_CONFIG.map(s => s.label)].map(s => <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${filterStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300'}`}>{s}</button>)}
                                </div>
                            </div>
                            <div className="flex-grow overflow-y-auto p-2 space-y-2">
                                {sortedOrders.map(order => (
                                    <div key={order.id} onClick={() => setSelectedOrder(order)} className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${selectedOrder?.id === order.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200'}`}>
                                        <div className="flex justify-between mb-1"><span className="font-bold text-gray-900">{order.id}</span><span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span></div>
                                        <div className="flex justify-between items-center"><span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_CONFIG.find(s => s.label === order.status)?.color}`}>{order.status}</span><span className="font-bold text-sm text-gray-900">{formatCurrency(order.totalPrice)}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-8 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
                            {selectedOrder ? (
                                <div className="flex flex-col h-full">
                                    <div className="p-6 border-b bg-gray-50 flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">{selectedOrder.id} {selectedOrder.isUrgent && <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded font-bold">GẤP</span>}</h2>
                                            <p className="text-sm text-gray-500 mt-1">Đặt lúc: {new Date(selectedOrder.createdAt).toLocaleString('vi-VN')}</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <StatusDropdown currentStatus={selectedOrder.status} onStatusChange={(s) => handleUpdate(selectedOrder.id, { status: s })} onDelete={handleDeleteOrder} isAdmin={role === 'admin'} />
                                            <button onClick={() => alert("Tính năng in đơn đang phát triển")} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50">In đơn</button>
                                        </div>
                                    </div>
                                    <div className="flex-grow overflow-y-auto p-6">
                                        <div className="grid grid-cols-2 gap-8 mb-8">
                                            <div><h3 className="font-bold text-gray-900 mb-3 border-b pb-1">Khách hàng</h3><p className="text-sm text-gray-600 leading-relaxed"><strong>Tên:</strong> {selectedOrder.customer.name}<br /><strong>SĐT:</strong> {selectedOrder.customer.phone}<br /><strong>Đ/C:</strong> {selectedOrder.customer.address}</p></div>
                                            <div><h3 className="font-bold text-gray-900 mb-3 border-b pb-1">Thanh toán & Giao hàng</h3><p className="text-sm text-gray-600 leading-relaxed"><strong>Hình thức:</strong> {selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Full 100%'}<br /><strong>Cần thu:</strong> <span className="text-red-600 font-bold">{formatCurrency(selectedOrder.amountToPay)}</span><br /><strong>Ship:</strong> {selectedOrder.shipping.method} ({formatCurrency(selectedOrder.shipping.fee)})</p></div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-3 border-b pb-1">Chi tiết sản phẩm</h3>
                                            {selectedOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
                                                    <div className="w-24 h-24 bg-white rounded border overflow-hidden flex-shrink-0"><img src={item.previewImageUrl} className="w-full h-full object-contain" /></div>
                                                    <div><p className="font-bold text-gray-800">Khung {item.frameId} - {item.characters.length} Nhân vật</p><div className="text-xs text-gray-500 mt-1 space-y-1">{item.characters.map((char, cIdx) => <p key={cIdx}>- NV{cIdx + 1}: {char.hair?.name}, {char.face?.name}, {char.shirt?.name}, {char.pants?.name}</p>)}</div></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : <div className="flex items-center justify-center h-full text-gray-400">Chọn một đơn hàng để xem chi tiết</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'products' && role === 'admin' && (
                    <div>
                        <div className="flex gap-4 mb-6 border-b pb-1">
                            <button onClick={() => setActiveProductSubTab('parts')} className={`pb-2 px-2 text-sm font-bold ${activeProductSubTab === 'parts' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`}>Linh kiện LEGO</button>
                            <button onClick={() => setActiveProductSubTab('backgrounds')} className={`pb-2 px-2 text-sm font-bold ${activeProductSubTab === 'backgrounds' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`}>Hình nền</button>
                        </div>
                        {activeProductSubTab === 'parts' ? (
                            <>
                                <div className="flex justify-between mb-4"><div className="flex gap-2"><input placeholder="Tìm kiếm..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="border p-2 rounded text-sm w-64" /><select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="border p-2 rounded text-sm"><option value="all">Tất cả</option><option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="hat">Mũ</option><option value="accessory">Phụ kiện</option></select></div><button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold">+ Thêm linh kiện</button></div>
                                <div className="grid grid-cols-6 gap-4">{filteredProducts.map(p => (<div key={p.id} onClick={() => { setEditingPart(p); setIsEditingProduct(true); }} className="bg-white p-3 rounded border hover:shadow cursor-pointer"><img src={p.imageUrl} className="w-full h-24 object-contain mb-2" /><p className="font-bold text-sm truncate">{p.name}</p><p className="text-xs text-gray-500">{formatCurrency(p.price)}</p></div>))}</div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between mb-4"><div className="flex gap-2"><input placeholder="Tìm background..." value={bgSearch} onChange={e => setBgSearch(e.target.value)} className="border p-2 rounded text-sm w-64" /><select value={bgTypeFilter} onChange={e => setBgTypeFilter(e.target.value as any)} className="border p-2 rounded text-sm"><option value="all">Tất cả</option><option value="square">Vuông</option><option value="rectangle">Chữ nhật</option></select></div><button onClick={() => { setEditingBg(null); setIsEditingBackground(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold">+ Thêm nền</button></div>
                                <div className="grid grid-cols-6 gap-4">{filteredBackgrounds.map(bg => (<div key={bg.id} onClick={() => { setEditingBg(bg); setIsEditingBackground(true); }} className="bg-white p-3 rounded border hover:shadow cursor-pointer"><img src={bg.url} className="w-full h-24 object-cover mb-2 rounded" /><p className="font-bold text-sm truncate">{bg.name}</p><p className="text-xs text-gray-500">{bg.category}</p></div>))}</div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'config' && role === 'admin' && (
                    <div>
                        <div className="flex gap-4 mb-6 border-b pb-1">
                            <button onClick={() => setActiveConfigSubTab('general')} className={`pb-2 px-2 text-sm font-bold ${activeConfigSubTab === 'general' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`}>Chung</button>
                            <button onClick={() => setActiveConfigSubTab('templates')} className={`pb-2 px-2 text-sm font-bold ${activeConfigSubTab === 'templates' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`}>Mẫu có sẵn</button>
                            <button onClick={() => setActiveConfigSubTab('feedbacks')} className={`pb-2 px-2 text-sm font-bold ${activeConfigSubTab === 'feedbacks' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`}>Feedback</button>
                        </div>
                        {activeConfigSubTab === 'general' && (
                            <div className="bg-white p-6 rounded-xl border space-y-8 max-w-3xl">
                                <ConfigImageUpload label="Logo Website" description="Ảnh logo hiển thị ở header (PNG/SVG, height ~50px)" currentUrl={storeConfig.logoUrl} onUpload={(f) => handleConfigUpload(f, 'logoUrl')} isUploading={uploadingField === 'logoUrl'} />
                                <ConfigImageUpload label="Favicon" description="Icon nhỏ trên tab trình duyệt (PNG/ICO, 32x32)" currentUrl={storeConfig.faviconUrl} onUpload={(f) => handleConfigUpload(f, 'faviconUrl')} isUploading={uploadingField === 'faviconUrl'} />
                                <ConfigImageUpload label="Banner Hero (Trang chủ)" description="Ảnh lớn đầu trang chủ (1920x1080)" currentUrl={storeConfig.heroImageUrl} onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')} isUploading={uploadingField === 'heroImageUrl'} />
                                <ConfigImageUpload label="Ảnh Cảm Hứng (Trang chủ)" description="Ảnh bên cạnh slider sản phẩm (Vuông hoặc dọc)" currentUrl={storeConfig.inspireImageUrl} onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')} isUploading={uploadingField === 'inspireImageUrl'} />
                            </div>
                        )}
                        {activeConfigSubTab === 'templates' && (
                            <div>
                                <div className="flex justify-end mb-4"><button onClick={() => { setEditingTemplate(null); setIsEditingTemplate(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold">+ Thêm mẫu</button></div>
                                <div className="grid grid-cols-4 gap-4">{templates.map(t => (<div key={t.id} onClick={() => { setEditingTemplate(t); setIsEditingTemplate(true); }} className="bg-white p-3 rounded border cursor-pointer hover:shadow"><img src={t.imageUrl} className="w-full h-32 object-cover mb-2 rounded" /><p className="font-bold text-sm">{t.name}</p></div>))}</div>
                            </div>
                        )}
                        {activeConfigSubTab === 'feedbacks' && (
                            <div>
                                <div className="flex justify-end mb-4"><button onClick={() => { setEditingFeedback(null); setIsEditingFeedback(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold">+ Thêm Feedback</button></div>
                                <div className="grid grid-cols-4 gap-4">{feedbacks.map(f => (<div key={f.id} onClick={() => { setEditingFeedback(f); setIsEditingFeedback(true); }} className="bg-white p-3 rounded border cursor-pointer hover:shadow"><img src={f.imageUrl} className="w-full h-32 object-cover mb-2 rounded" /><p className="font-bold text-sm">{f.name}</p><p className="text-xs text-gray-500 truncate">{f.text}</p></div>))}</div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {isEditingProduct && <ProductForm initialData={editingPart} onSave={async (p) => { setIsEditingProduct(false); if (editingPart) await updatePart(p.id, p); else await addPart(p); fetchProducts(); }} onCancel={() => setIsEditingProduct(false)} />}
            {isEditingBackground && <BackgroundForm initialData={editingBg} onSave={async (bg) => { setIsEditingBackground(false); if (editingBg) await updateBackground(bg.id, bg); else await addBackground(bg); fetchBackgrounds(); }} onCancel={() => setIsEditingBackground(false)} />}
            {isEditingTemplate && <TemplateForm initialData={editingTemplate} onSave={async (t) => { setIsEditingTemplate(false); if (editingTemplate) await updateTemplate(t.id, t); else await addTemplate(t); fetchTemplates(); }} onCancel={() => setIsEditingTemplate(false)} />}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={async (f) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(f.id, f); else await addFeedback(f); fetchFeedbacks(); }} onCancel={() => setIsEditingFeedback(false)} />}
        </div>
    );
};

export default AdminPage;
