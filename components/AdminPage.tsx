
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuthInstance } from '../config/firebase';
import { getAllOrders, updateOrder, deleteOrder, countPartsInOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase, adjustStock, reorderParts } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds, reorderBackgrounds } from '../services/backgroundService';
import { getAllTemplates, addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../services/templateService';
import { getAllFeedbacks, addFeedback, updateFeedback, deleteFeedback, seedFeedbacks } from '../services/feedbackService';
import { getAllFrames, addFrame, updateFrame, deleteFrame, seedFrames } from '../services/frameService'; 
import { uploadToCloudinary } from '../services/uploadService'; 
import { updateStoreConfig, getStoreConfig, StoreConfig } from '../services/configService'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem, PresetBackground, OutfitColor, CollectionTemplate, FeedbackItem, FrameOption } from '../types';
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

const getCountdownText = (dateString: string) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(dateString);
    delivery.setHours(0, 0, 0, 0);
    
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return <span className="text-red-600 font-bold text-[10px] block mt-0.5">Trễ {Math.abs(diffDays)} ngày</span>;
    if (diffDays === 0) return <span className="text-orange-600 font-bold text-[10px] block mt-0.5">Hôm nay</span>;
    if (diffDays === 1) return <span className="text-green-600 font-bold text-[10px] block mt-0.5">Ngày mai</span>;
    return <span className="text-blue-600 font-medium text-[10px] block mt-0.5">Còn {diffDays} ngày</span>;
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
    canCancel: boolean;
    canDelete: boolean;
}> = ({ currentStatus, onStatusChange, onDelete, canCancel, canDelete }) => {
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
        <div className="relative inline-block" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all border shadow-sm ${currentConfig.color} bg-white border-gray-200 hover:brightness-95`}
            >
                <span>{currentConfig.icon}</span>
                <span>{currentStatus}</span>
                <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                    <div className="p-1 max-h-80 overflow-y-auto">
                        {STATUS_CONFIG.map((status) => {
                            if (status.label === 'Huỷ đơn' && !canCancel) return null;
                            if (status.label === 'Xoá đơn' && !canDelete) return null;

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

// --- NEW: FRAME FORM COMPONENT ---
const FrameForm: React.FC<{
    initialData?: FrameOption | null;
    onSave: (frame: FrameOption) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<FrameOption>(initialData || {
        id: `frame_${Date.now()}`,
        name: '',
        frameWidthCm: 15,
        frameHeightCm: 15,
        backgroundWidthCm: 12,
        backgroundHeightCm: 12,
        price: 0,
        imageUrl: '',
        description: '',
        stock: 100,
        colors: ['black', 'white'] 
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: ['price', 'frameWidthCm', 'frameHeightCm', 'backgroundWidthCm', 'backgroundHeightCm', 'stock'].includes(name) ? Number(value) : value
        }));
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const colors = e.target.value.split(',').map(c => c.trim()).filter(c => c !== '');
        setFormData(prev => ({ ...prev, colors }));
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Khung' : 'Thêm Khung Mới'}</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">ID (Unique)</label>
                            <input name="id" value={formData.id} onChange={handleChange} disabled={!!initialData} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm disabled:bg-gray-100" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên Khung</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" placeholder="15x15cm..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng Khung (cm)</label>
                            <input type="number" name="frameWidthCm" value={formData.frameWidthCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao Khung (cm)</label>
                            <input type="number" name="frameHeightCm" value={formData.frameHeightCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng Nền (cm)</label>
                            <input type="number" name="backgroundWidthCm" value={formData.backgroundWidthCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao Nền (cm)</label>
                            <input type="number" name="backgroundHeightCm" value={formData.backgroundHeightCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá (VNĐ)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tồn kho</label>
                            <input type="number" name="stock" value={formData.stock} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mô tả ngắn</label>
                            <input name="description" value={formData.description} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" placeholder="Nhỏ gọn, tinh tế..." />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Màu sắc (Phân cách dấu phẩy)</label>
                            <input 
                                value={formData.colors.join(', ')} 
                                onChange={handleColorChange} 
                                className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" 
                                placeholder="black, white, wood..." 
                            />
                            <div className="flex gap-2 mt-2">
                                {formData.colors.map(c => (
                                    <span key={c} className="px-2 py-1 bg-gray-200 rounded text-xs">{c}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={() => onSave(formData)} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded">Lưu</button>
                </div>
            </div>
        </div>
    );
};

// Fix: Complete ProductForm component and add proper return to satisfy FC type
const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1, colors: []
    });
    const [isUploading, setIsUploading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'stock') {
            const stockVal = value === '' ? undefined : Number(value);
            setFormData(prev => ({ ...prev, stock: stockVal }));
        } else {
            setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setFormData(prev => ({ ...prev, imageUrl: url }));
                } else {
                    alert("Lỗi upload ảnh.");
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload ảnh.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Sản Phẩm' : 'Thêm Sản Phẩm'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên linh kiện</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm">
                                <option value="hair">Tóc</option>
                                <option value="face">Mặt</option>
                                <option value="shirt">Áo</option>
                                <option value="pants">Quần</option>
                                <option value="accessory">Phụ kiện</option>
                                <option value="pet">Thú cưng</option>
                                <option value="hat">Mũ</option>
                                <option value="set">Set</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ảnh</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 relative h-32 flex items-center justify-center">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            {isUploading ? <span>Đang tải...</span> : formData.imageUrl ? <img src={formData.imageUrl} className="max-h-full object-contain" /> : <span>Bấm để tải ảnh</span>}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={() => onSave(formData)} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded">Lưu</button>
                </div>
            </div>
        </div>
    );
};

const AdminPage: React.FC = () => {
    return <div>Admin Page Placeholder (Ghost file, actual page is in pages/AdminPage.tsx)</div>;
};

export default AdminPage;
