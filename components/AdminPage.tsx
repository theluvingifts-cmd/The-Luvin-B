
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder, countPartsInOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase, adjustStock } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds } from '../services/backgroundService';
import { getAllTemplates, addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../services/templateService';
import { getAllFeedbacks, addFeedback, updateFeedback, deleteFeedback, seedFeedbacks } from '../services/feedbackService';
import { uploadToCloudinary } from '../services/uploadService'; // Import hàm upload
import { updateStoreConfig, getStoreConfig, StoreConfig } from '../services/configService'; // Import config service
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
    { label: 'Chờ chuyển hàng', color: 'bg-purple-100 text-purple-800', icon: '✓' }, // Status after packing
    { label: 'Gửi hàng đi', color: 'bg-orange-100 text-orange-800', icon: '🚚' },
    { label: 'Đã giao hàng', color: 'bg-green-100 text-green-800', icon: '✅' },
    { label: 'Huỷ đơn', color: 'bg-red-100 text-red-800', icon: '❌' },
    { label: 'Xoá đơn', color: 'bg-gray-200 text-gray-800', icon: '🗑️', isAction: true }, // Special action
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
                {/* Minimal Icon */}
                <span>{currentConfig.icon}</span>
                <span>{currentStatus}</span>
                <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                    <div className="p-1 max-h-60 overflow-y-auto">
                        {STATUS_CONFIG.map((status) => {
                            // Hide 'Delete' from list if not admin or for standard flow
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

// --- COMPONENT: FORM SẢN PHẨM (MODAL) ---
// ... (ProductForm, BackgroundForm, TemplateForm, FeedbackForm, ConfigImageUpload components remain unchanged)
// ... skipping for brevity ... 
const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1, colors: []
    });
    const [isUploading, setIsUploading] = useState(false);
    
    // State for managing colors
    const [colors, setColors] = useState<OutfitColor[]>(initialData?.colors || []);
    const [newColor, setNewColor] = useState<OutfitColor>({ name: '', hex: '#000000', price: 0, imageUrl: '', stock: undefined });
    const [isUploadingColorImg, setIsUploadingColorImg] = useState(false);
    const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
    const [draggedColorIndex, setDraggedColorIndex] = useState<number | null>(null);

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

    const handleColorFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploadingColorImg(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setNewColor(prev => ({ ...prev, imageUrl: url }));
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploadingColorImg(false);
            }
        }
    };

    const handleSaveColor = () => {
        if (!newColor.name) {
            alert("Vui lòng nhập tên màu.");
            return;
        }

        if (editingColorIndex !== null) {
            const updatedColors = [...colors];
            updatedColors[editingColorIndex] = newColor;
            setColors(updatedColors);
            setEditingColorIndex(null);
        } else {
            setColors([...colors, newColor]);
        }
        setNewColor({ name: '', hex: '#000000', price: 0, imageUrl: '', stock: undefined });
    };

    const startEditColor = (index: number) => {
        setEditingColorIndex(index);
        setNewColor(colors[index]);
    };

    const cancelColorEdit = () => {
        setEditingColorIndex(null);
        setNewColor({ name: '', hex: '#000000', price: 0, imageUrl: '', stock: undefined });
    };

    const removeColor = (index: number) => {
        const updatedColors = colors.filter((_, i) => i !== index);
        setColors(updatedColors);
        if (editingColorIndex === index) {
            cancelColorEdit();
        } else if (editingColorIndex !== null && editingColorIndex > index) {
            setEditingColorIndex(editingColorIndex - 1);
        }
    };

    const handleColorDragStart = (e: React.DragEvent, index: number) => {
        setDraggedColorIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
    };

    const handleColorDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleColorDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedColorIndex === null || draggedColorIndex === index) return;

        const updatedColors = [...colors];
        const [movedItem] = updatedColors.splice(draggedColorIndex, 1);
        updatedColors.splice(index, 0, movedItem);

        setColors(updatedColors);
        
        if (editingColorIndex === draggedColorIndex) {
            setEditingColorIndex(index);
        } else if (editingColorIndex !== null) {
            if (draggedColorIndex < editingColorIndex && index >= editingColorIndex) {
                setEditingColorIndex(editingColorIndex - 1);
            } else if (draggedColorIndex > editingColorIndex && index <= editingColorIndex) {
                setEditingColorIndex(editingColorIndex + 1);
            }
        }
        setDraggedColorIndex(null);
    };

    const handleSave = () => {
        const dataToSave = { ...formData, colors: colors };
        const cleanData = JSON.parse(JSON.stringify(dataToSave));
        onSave(cleanData);
    };

    const canHaveColors = ['shirt', 'pants', 'accessory', 'pet', 'hair', 'hat'].includes(formData.type);

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên sản phẩm</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" placeholder="Nhập tên..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm">
                                <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="hat">Mũ</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá cơ bản (VNĐ)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" />
                        </div>
                        
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh mặc định</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                                {isUploading ? (
                                    <span className="text-xs text-gray-500">Đang tải ảnh lên...</span>
                                ) : formData.imageUrl ? (
                                    <div className="relative flex items-center justify-center">
                                        <img src={formData.imageUrl} alt="Preview" className="max-h-32 object-contain rounded shadow-sm" />
                                    </div>
                                ) : (
                                    <div className="py-4 text-gray-400">
                                        <span className="text-xs">Bấm để chọn ảnh</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng (cm)</label>
                             <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                         <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao (cm)</label>
                             <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                        <div className="col-span-2">
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Số lượng tồn kho (Để trống = Vô hạn)</label>
                             <input type="number" name="stock" value={formData.stock === undefined ? '' : formData.stock} onChange={handleChange} placeholder="Vô hạn" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" />
                        </div>
                    </div>

                    {canHaveColors && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                            <h4 className="font-bold text-sm text-gray-800 mb-3">Biến thể màu sắc (Kéo thả để sắp xếp)</h4>
                            
                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                {colors.map((color, idx) => (
                                    <div 
                                        key={idx} 
                                        draggable
                                        onDragStart={(e) => handleColorDragStart(e, idx)}
                                        onDragOver={handleColorDragOver}
                                        onDrop={(e) => handleColorDrop(e, idx)}
                                        className={`flex items-center justify-between bg-gray-50 p-2 rounded border cursor-move transition-all ${
                                            editingColorIndex === idx ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'
                                        } ${draggedColorIndex === idx ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="cursor-move text-gray-400 px-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                            </div>
                                            <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: color.hex }}></div>
                                            {color.imageUrl ? (
                                                <img src={color.imageUrl} alt="" className="w-8 h-8 object-contain bg-white rounded border" />
                                            ) : (
                                                <div className="w-8 h-8 bg-gray-100 rounded border flex items-center justify-center text-[8px] text-gray-400">No IMG</div>
                                            )}
                                            <div>
                                                <p className="text-xs font-bold">{color.name}</p>
                                                <div className="flex gap-2 text-[10px] text-gray-500">
                                                    <span>+{formatCurrency(color.price)}</span>
                                                    <span className={color.stock === 0 ? 'text-red-500 font-bold' : 'text-gray-500'}>
                                                        Kho: {color.stock === undefined || color.stock === null ? '∞' : color.stock}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => startEditColor(idx)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded text-xs font-bold">
                                                Sửa
                                            </button>
                                            <button onClick={() => removeColor(idx)} className="text-red-500 hover:bg-red-100 p-1.5 rounded">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {colors.length === 0 && <p className="text-xs text-gray-400 italic">Chưa có màu nào được thêm.</p>}
                            </div>

                            <div className={`p-3 rounded-lg border transition-colors ${editingColorIndex !== null ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <p className={`text-xs font-bold ${editingColorIndex !== null ? 'text-yellow-800' : 'text-blue-800'}`}>
                                        {editingColorIndex !== null ? `Đang sửa: ${colors[editingColorIndex].name}` : 'Thêm màu mới'}
                                    </p>
                                    {editingColorIndex !== null && (
                                        <button onClick={cancelColorEdit} className="text-xs text-red-500 hover:underline font-semibold">Hủy sửa</button>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    <div className="col-span-3 sm:col-span-1">
                                        <input 
                                            placeholder="Tên màu (VD: Đỏ)" 
                                            className="w-full p-1.5 text-xs border rounded"
                                            value={newColor.name}
                                            onChange={e => setNewColor({...newColor, name: e.target.value})}
                                        />
                                    </div>
                                    <input 
                                        type="number"
                                        placeholder="Giá thêm (VNĐ)" 
                                        className="p-1.5 text-xs border rounded"
                                        value={newColor.price}
                                        onChange={e => setNewColor({...newColor, price: Number(e.target.value)})}
                                    />
                                    <input 
                                        type="number"
                                        placeholder="SL (Trống=∞)" 
                                        className="p-1.5 text-xs border rounded"
                                        value={newColor.stock === undefined ? '' : newColor.stock}
                                        onChange={e => setNewColor({...newColor, stock: e.target.value === '' ? undefined : Number(e.target.value)})}
                                    />
                                    <div className="col-span-3 flex gap-2">
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs text-gray-500">Mã màu:</span>
                                            <input 
                                                type="color" 
                                                className="w-8 h-8 border rounded cursor-pointer"
                                                value={newColor.hex}
                                                onChange={e => setNewColor({...newColor, hex: e.target.value})}
                                            />
                                        </div>
                                        <div className="relative flex-grow">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleColorFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={isUploadingColorImg}
                                            />
                                            <button className={`w-full p-1.5 text-xs border rounded bg-white text-left truncate ${isUploadingColorImg ? 'text-gray-400' : ''}`}>
                                                {isUploadingColorImg ? 'Đang tải...' : newColor.imageUrl ? 'Đã chọn ảnh ✓' : 'Tải ảnh màu (Tùy chọn)'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSaveColor} 
                                    disabled={isUploadingColorImg}
                                    className={`w-full text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 ${editingColorIndex !== null ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    {editingColorIndex !== null ? 'Lưu thay đổi' : '+ Thêm biến thể'}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">Hủy bỏ</button>
                    <button onClick={handleSave} disabled={isUploading} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded transition-colors shadow-sm disabled:opacity-50">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    );
};

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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setFormData(prev => ({ ...prev, url: url }));
                } else {
                    alert("Lỗi tải ảnh");
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[450px] border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Background' : 'Thêm Background'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên hiển thị</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white text-sm" placeholder="Ví dụ: Sinh nhật 1..." />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Danh mục</label>
                        <input name="category" value={formData.category} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white text-sm" placeholder="Kỷ niệm, Sinh nhật,..." />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại khung</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white text-sm">
                            <option value="square">Vuông (15x15, 23x23)</option>
                            <option value="rectangle">Chữ nhật (A5)</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                         <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                            {isUploading ? (
                                <span className="text-xs text-gray-500">Đang tải...</span>
                            ) : formData.url ? (
                                <img src={formData.url} alt="Preview" className="max-h-32 object-contain mx-auto rounded" />
                            ) : (
                                <span className="text-xs text-gray-400">Chọn ảnh</span>
                            )}
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) setFormData(prev => ({ ...prev, imageUrl: url }));
                else alert("Lỗi tải ảnh");
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleSave = () => {
        try {
            const parsedConfig = JSON.parse(configJson);
            onSave({ ...formData, config: parsedConfig });
        } catch (e) {
            alert("Lỗi định dạng JSON trong cấu hình!");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Mẫu' : 'Thêm Mẫu Mới'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên mẫu</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                            {isUploading ? <span className="text-xs">Uploading...</span> : formData.imageUrl ? <img src={formData.imageUrl} className="max-h-32 mx-auto" /> : <span className="text-xs text-gray-400">Chọn ảnh</span>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cấu hình (JSON)</label>
                        <textarea 
                            value={configJson} 
                            onChange={(e) => setConfigJson(e.target.value)} 
                            className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-xs font-mono h-40"
                            placeholder="Paste frame config JSON here..." 
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Dành cho admin: Copy config từ console khi thiết kế xong.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={handleSave} disabled={isUploading || !formData.imageUrl} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded disabled:opacity-50">Lưu</button>
                </div>
            </div>
        </div>
    );
};

const FeedbackForm: React.FC<{
    initialData?: FeedbackItem | null;
    onSave: (fb: FeedbackItem) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<FeedbackItem>(initialData || {
        id: `fb_${Date.now()}`, name: '', text: '', imageUrl: ''
    });
    const [isUploading, setIsUploading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) setFormData(prev => ({ ...prev, imageUrl: url }));
                else alert("Lỗi tải ảnh");
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[450px] border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Feedback' : 'Thêm Feedback'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên khách hàng</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nội dung</label>
                        <textarea name="text" value={formData.text} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" rows={3} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 relative">
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

const ConfigImageUpload: React.FC<{
    label: string;
    description: string;
    currentUrl?: string;
    onUpload: (file: File) => Promise<void>;
    isUploading: boolean;
}> = ({ label, description, currentUrl, onUpload, isUploading }) => {
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) onUpload(e.target.files[0]);
    };

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
            <p className="text-xs text-gray-500 mb-4">{description}</p>
            
            <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden relative">
                    {currentUrl ? (
                        <img src={currentUrl} alt="Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                        <span className="text-xs text-gray-400 text-center px-2">Chưa có ảnh</span>
                    )}
                    {isUploading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-600 animate-pulse">Uploading...</span>
                        </div>
                    )}
                </div>
                
                <div className="flex-grow">
                    <div className="relative inline-block">
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFile}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploading}
                        />
                        <button 
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isUploading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black'}`}
                        >
                            {isUploading ? 'Đang xử lý...' : 'Tải ảnh mới'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

type MainTab = 'dashboard' | 'orders' | 'products' | 'config';
type ProductSubTab = 'parts' | 'backgrounds';
type ConfigSubTab = 'general' | 'templates' | 'feedbacks';

// --- ADMIN PAGE ---
const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true); 
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
    const [addingAccessoryToItemIndex, setAddingAccessoryToItemIndex] = useState<number | null>(null);

    const role = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        const ADMIN_EMAILS = ['jinbduong@gmail.com']; 
        if (ADMIN_EMAILS.includes(currentUser.email) || currentUser.email.includes('admin')) {
            return 'admin';
        }
        return 'warehouse';
    }, [currentUser]);

    const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
    const [activeProductSubTab, setActiveProductSubTab] = useState<ProductSubTab>('parts');
    const [activeConfigSubTab, setActiveConfigSubTab] = useState<ConfigSubTab>('general');

    const [filterType, setFilterType] = useState<'period' | 'month' | 'custom'>('period');
    const [period, setPeriod] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');
    const [month, setMonth] = useState<number>(new Date().getMonth()); 
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');

    const [isEditingBackground, setIsEditingBackground] = useState(false);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [bgSearch, setBgSearch] = useState('');
    const [bgTypeFilter, setBgTypeFilter] = useState<'all' | 'square' | 'rectangle'>('all');
    const [bgCategoryFilter, setBgCategoryFilter] = useState<string>('all');

    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);

    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState(''); // Added Search Term

    const [storeConfig, setStoreConfig] = useState<StoreConfig>({});
    const [uploadingField, setUploadingField] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthChecking(false); // Auth check done
            if (user) {
                setCurrentUser(user);
                fetchOrders();
                fetchProducts();
                fetchBackgrounds();
                fetchTemplates();
                fetchFeedbacks();
                fetchConfig();
            } else {
                setCurrentUser(null);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (role === 'warehouse' && activeTab === 'dashboard') {
            setActiveTab('orders');
        }
    }, [role, activeTab]);

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
            setAdminDeadlineInput(selectedOrder.adminDeadline || '');
        }
    }, [selectedOrder]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            await signInWithEmailAndPassword(auth, email, loginPass);
        } catch (error: any) {
            setLoginError("Thông tin đăng nhập không chính xác.");
        }
    };

    const handleLogout = async () => { await signOut(auth); };
    const fetchOrders = async () => { const data = await getAllOrders(); setOrders(data); };
    const fetchProducts = async () => { const data = await getAllParts(); setProducts(data); };
    const fetchBackgrounds = async () => { const data = await getAllBackgrounds(); setBackgrounds(data); };
    const fetchTemplates = async () => { const data = await getAllTemplates(); setTemplates(data); };
    const fetchFeedbacks = async () => { const data = await getAllFeedbacks(); setFeedbacks(data); };
    const fetchConfig = async () => {
        const cfg = await getStoreConfig();
        if (cfg) setStoreConfig(cfg);
    }
    
    const handleSeedData = async () => { if (confirm("Thao tác này sẽ reset database về mặc định. Tiếp tục?")) { setLoading(true); await seedDatabase(); setLoading(false); fetchProducts(); } };
    const handleSeedBackgrounds = async () => { if (confirm("Reset backgrounds về mặc định?")) { setLoading(true); await seedBackgrounds(); setLoading(false); fetchBackgrounds(); } };
    const handleSeedTemplates = async () => { if (confirm("Reset templates về mặc định?")) { setLoading(true); await seedTemplates(); setLoading(false); fetchTemplates(); } };
    const handleSeedFeedbacks = async () => { if (confirm("Reset feedbacks về mặc định?")) { setLoading(true); await seedFeedbacks(); setLoading(false); fetchFeedbacks(); } };
    
    const handleSaveProduct = async (part: LegoPart) => { setIsEditingProduct(false); if (editingPart) await updatePart(part.id, part); else await addPart(part); fetchProducts(); setEditingPart(null); };
    const handleDeleteProduct = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deletePart(id); fetchProducts(); } };
    
    const handleSaveBackground = async (bg: PresetBackground) => { setIsEditingBackground(false); if (editingBg) await updateBackground(bg.id, bg); else await addBackground(bg); fetchBackgrounds(); setEditingBg(null); };
    const handleDeleteBackground = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteBackground(id); fetchBackgrounds(); } };

    const handleSaveTemplate = async (tpl: CollectionTemplate) => { setIsEditingTemplate(false); if (editingTemplate) await updateTemplate(tpl.id, tpl); else await addTemplate(tpl); fetchTemplates(); setEditingTemplate(null); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteTemplate(id); fetchTemplates(); } };

    const handleSaveFeedback = async (fb: FeedbackItem) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(fb.id, fb); else await addFeedback(fb); fetchFeedbacks(); setEditingFeedback(null); };
    const handleDeleteFeedback = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteFeedback(id); fetchFeedbacks(); } };

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => { 
        const res = await updateOrder(orderId, updates); 
        if (res.success) { 
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); 
            if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); 
            if (showMsg) alert("Đã cập nhật!"); 
        } else {
            if (showMsg) alert(`Lỗi cập nhật: ${res.error?.message || 'Không xác định'}`);
        }
    };
    const handleSaveAdminInfo = () => { if (selectedOrder) { handleUpdate(selectedOrder.id, { internalNotes: noteInput, adminDeadline: adminDeadlineInput }); } };
    
    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XOÁ VĨNH VIỄN đơn hàng ${selectedOrder.id} không? Hành động này không thể hoàn tác.`)) {
            setLoading(true);
            await deleteOrder(selectedOrder.id);
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            setSelectedOrder(null);
            setLoading(false);
            alert('Đã xoá đơn hàng.');
        }
    };

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

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 1.5; 
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };


    const calculateOrderPrice = (order: Order, allParts: LegoPart[]) => {
        let subtotal = 0;
        const partLookup = allParts.reduce((acc, p) => ({...acc, [p.id]: p}), {} as Record<string, LegoPart>);

        order.items.forEach(item => {
            const frame = FRAME_OPTIONS.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
            subtotal += frame.price;
            
            subtotal += item.characters.length * CHARACTER_BASE_PRICE;
            item.characters.forEach(char => {
                if (char.customPrintPrice) subtotal += char.customPrintPrice;
                if (char.hair?.price) subtotal += char.hair.price;
                if (char.hat?.price) subtotal += char.hat.price;
                if (char.shirt?.price) subtotal += char.shirt.price;
                if (char.selectedShirtColor?.price) subtotal += char.selectedShirtColor.price;
                if (char.pants?.price) subtotal += char.pants.price;
                if (char.selectedPantsColor?.price) subtotal += char.selectedPantsColor.price;
            });

            item.draggableItems.forEach(di => {
                if (di.type !== 'charm' && partLookup[di.partId]) {
                     subtotal += partLookup[di.partId].price;
                     if (di.selectedColor?.price) subtotal += di.selectedColor.price;
                }
            });
        });

        const giftBoxFee = order.addGiftBox ? 30000 : 0;
        const shippingFee = order.shipping.fee || 0;
        const totalPrice = subtotal + giftBoxFee + shippingFee;
        
        let amountToPay = totalPrice;
        if (order.payment.method === 'deposit') {
            amountToPay = Math.round(totalPrice * 0.7);
        }

        return { totalPrice, amountToPay };
    };

    const startEditingOrder = () => {
        if (!selectedOrder) return;
        setEditForm(JSON.parse(JSON.stringify(selectedOrder))); 
        setIsEditingOrder(true);
    };

    const cancelEditingOrder = () => {
        setEditForm(null);
        setIsEditingOrder(false);
        setAddingAccessoryToItemIndex(null);
    };

    const saveOrderChanges = async () => {
        if (!editForm || !selectedOrder) return;
        
        setLoading(true);

        // --- STOCK ADJUSTMENT LOGIC ---
        const oldParts = countPartsInOrder(selectedOrder.items);
        const newParts = countPartsInOrder(editForm.items);
        
        const stockAdjustments: Record<string, number> = {};
        
        Object.keys(oldParts).forEach(partId => {
            const oldQty = oldParts[partId] || 0;
            const newQty = newParts[partId] || 0;
            const diff = oldQty - newQty;
            if (diff !== 0) stockAdjustments[partId] = diff;
        });

        Object.keys(newParts).forEach(partId => {
            if (!oldParts[partId]) {
                stockAdjustments[partId] = -(newParts[partId]);
            }
        });

        if (Object.keys(stockAdjustments).length > 0) {
            await adjustStock(stockAdjustments);
            fetchProducts();
        }
        // ------------------------------

        await handleUpdate(selectedOrder.id, editForm, false);
        setIsEditingOrder(false);
        setEditForm(null);
        setLoading(false);
        alert("Đã lưu thay đổi!");
    };

    const updateEditFormWithPrice = (newOrder: Order) => {
        const { totalPrice, amountToPay } = calculateOrderPrice(newOrder, products);
        return { ...newOrder, totalPrice, amountToPay };
    };

    const handleEditFormChange = (field: string, value: any, nestedField?: string, itemIndex?: number) => {
        if (!editForm) return;
        
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            
            if (itemIndex !== undefined && nestedField === 'frameId') {
                 const newItems = [...newOrder.items];
                 newItems[itemIndex] = { ...newItems[itemIndex], frameId: value };
                 newOrder.items = newItems;
                 newOrder = updateEditFormWithPrice(newOrder); 
            } else if (nestedField && field === 'customer') {
                newOrder.customer = { ...newOrder.customer, [nestedField]: value };
            } else if (field === 'delivery' && nestedField) {
                newOrder.delivery = { ...newOrder.delivery, [nestedField]: value };
            } else {
                (newOrder as any)[field] = value;
            }
            return newOrder;
        });
    };

    const handleAddCharacter = (itemIndex: number) => {
        if (!editForm) return;
        const newChar: LegoCharacterConfig = {
            id: Date.now(),
            x: 50, y: 50, rotation: 0, scale: 1,
        };

        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            newItems[itemIndex] = { 
                ...newItems[itemIndex], 
                characters: [...newItems[itemIndex].characters, newChar] 
            };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder);
        });
    };

    const handleRemoveCharacter = (itemIndex: number, charIndex: number) => {
        if (!editForm) return;

        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const newChars = newItems[itemIndex].characters.filter((_, i) => i !== charIndex);
            newItems[itemIndex] = { ...newItems[itemIndex], characters: newChars };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder);
        });
    };

    const handleCharacterChange = (itemIndex: number, charIndex: number, partType: keyof LegoCharacterConfig, partId: string) => {
        if (!editForm) return;
        
        const selectedPart = products.find(p => p.id === partId);
        
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const newCharacters = [...newItems[itemIndex].characters];
            
            if (partId === "") {
                 newCharacters[charIndex] = { ...newCharacters[charIndex], [partType]: undefined };
            } else if (selectedPart) {
                 newCharacters[charIndex] = { ...newCharacters[charIndex], [partType]: selectedPart };
                 if (partType === 'shirt') newCharacters[charIndex].selectedShirtColor = selectedPart.colors?.[0];
                 if (partType === 'pants') newCharacters[charIndex].selectedPantsColor = selectedPart.colors?.[0];
            }

            newItems[itemIndex] = { ...newItems[itemIndex], characters: newCharacters };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder);
        });
    };

    const handleCharacterColorChange = (itemIndex: number, charIndex: number, partType: 'shirt' | 'pants', colorHex: string) => {
        if (!editForm) return;
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const newCharacters = [...newItems[itemIndex].characters];
            const char = newCharacters[charIndex];
            
            const part = partType === 'shirt' ? char.shirt : char.pants;
            const selectedColor = part?.colors?.find(c => c.hex === colorHex);
            
            if (partType === 'shirt') newCharacters[charIndex] = { ...char, selectedShirtColor: selectedColor };
            if (partType === 'pants') newCharacters[charIndex] = { ...char, selectedPantsColor: selectedColor };

            newItems[itemIndex] = { ...newItems[itemIndex], characters: newCharacters };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder);
        });
    };

    const handleRemoveDraggable = (itemIndex: number, dragIndex: number) => {
        if (!editForm) return;
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const newDraggables = newItems[itemIndex].draggableItems.filter((_, i) => i !== dragIndex);
            newItems[itemIndex] = { ...newItems[itemIndex], draggableItems: newDraggables };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder);
        });
    };

    const handleAddDraggable = (itemIndex: number, part: LegoPart) => {
        if (!editForm) return;
        const newItem: DraggableItem = {
            id: Date.now(),
            partId: part.id,
            type: part.type as 'accessory' | 'pet',
            x: 50, y: 50, rotation: 0, scale: 1
        };

        setEditForm(prev => {
             if (!prev) return null;
             let newOrder = { ...prev };
             const newItems = [...newOrder.items];
             newItems[itemIndex] = { 
                 ...newItems[itemIndex], 
                 draggableItems: [...newItems[itemIndex].draggableItems, newItem] 
             };
             newOrder.items = newItems;
             return updateEditFormWithPrice(newOrder);
        });
        setAddingAccessoryToItemIndex(null);
    };

    const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');
    const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN');

    // FIX: Handle Pack logic with optimistic update and better error handling
    const handleMarkAsPacked = async () => {
        if (!selectedOrder || !currentUser) return;
        
        if (confirm(`Xác nhận bạn (${currentUser.email}) đã đóng gói xong đơn hàng này?`)) {
            
            // 1. OPTIMISTIC UPDATE (Cập nhật UI ngay lập tức)
            const now = new Date().toISOString();
            const updates = { 
                status: 'Chờ chuyển hàng', 
                packedBy: currentUser.email || 'Warehouse',
                packedAt: now
            };
            
            const previousOrder = { ...selectedOrder };
            const updatedOrder = { ...selectedOrder, ...updates };
            
            // Apply to UI immediately
            setSelectedOrder(updatedOrder);
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
            
            // 2. Gửi request lên server
            setLoading(true);
            const res = await updateOrder(selectedOrder.id, updates);
            setLoading(false);

            if (res.success) {
                // Success: Do nothing (UI is already updated)
            } else {
                // Failure: Revert UI
                setSelectedOrder(previousOrder);
                setOrders(prev => prev.map(o => o.id === selectedOrder.id ? previousOrder : o));
                
                // Show specific error
                console.error("Packed update failed:", res.error);
                if (res.error?.code === 'permission-denied') {
                    alert(`Lỗi: Tài khoản ${currentUser.email} không có quyền cập nhật đơn hàng này (Permission Denied). Vui lòng liên hệ Admin.`);
                } else {
                    alert(`Lỗi cập nhật: ${res.error?.message || 'Unknown error'}`);
                }
            }
        }
    };

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);


    const analytics = useMemo(() => {
        let start: Date, end: Date, prevStart: Date, prevEnd: Date;
        let dateLabel = '';

        if (filterType === 'month') {
            dateLabel = `Tháng ${month + 1}/${year}`;
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23, 59, 59, 999);
            prevStart = new Date(year, month - 1, 1);
            prevEnd = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (filterType === 'custom') {
            dateLabel = 'Tùy chỉnh';
            start = customStartDate ? new Date(customStartDate) : new Date(0);
            end = customEndDate ? new Date(customEndDate) : new Date();
            end.setHours(23, 59, 59, 999);
            // Compare with same duration before start date
            const duration = end.getTime() - start.getTime();
            prevEnd = new Date(start.getTime() - 1);
            prevStart = new Date(prevEnd.getTime() - duration);
        } else {
            const now = new Date();
            start = getStartOfDay(now);
            end = getEndOfDay(now);
            prevStart = getStartOfDay(now);
            prevEnd = getEndOfDay(now);

            if (period === 'yesterday') {
                start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1);
                prevStart.setDate(prevStart.getDate() - 2); prevEnd.setDate(prevEnd.getDate() - 2);
                dateLabel = 'Hôm qua';
            } else if (period === '7days') {
                start.setDate(start.getDate() - 7);
                prevStart.setDate(prevStart.getDate() - 14); prevEnd.setDate(prevEnd.getDate() - 7);
                dateLabel = '7 ngày qua';
            } else if (period === '30days') {
                start.setDate(start.getDate() - 30);
                prevStart.setDate(prevStart.getDate() - 60); prevEnd.setDate(prevEnd.getDate() - 30);
                dateLabel = '30 ngày qua';
            } else {
                prevStart.setDate(prevStart.getDate() - 1); prevEnd.setDate(prevEnd.getDate() - 1);
                dateLabel = 'Hôm nay';
            }
        }

        const getOrdersInPeriod = (s: Date, e: Date) => orders.filter(o => {
            const time = o.createdAt || Number(o.id.slice(3)) || 0;
            return time >= s.getTime() && time <= e.getTime();
        });

        const currentOrders = getOrdersInPeriod(start, end);
        const prevOrders = getOrdersInPeriod(prevStart, prevEnd);

        const revenue = currentOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const revenueGrowth = prevRevenue === 0 ? (revenue > 0 ? 100 : 0) : ((revenue - prevRevenue) / prevRevenue) * 100;

        const orderCount = currentOrders.length;
        const prevOrderCount = prevOrders.length;
        const orderGrowth = prevOrderCount === 0 ? (orderCount > 0 ? 100 : 0) : ((orderCount - prevOrderCount) / prevOrderCount) * 100;

        const inventory = { 
            frames: {} as Record<string, number>, 
            hair: {} as Record<string, number>,
            face: {} as Record<string, number>,
            shirt: {} as Record<string, number>,
            pants: {} as Record<string, number>,
            hat: {} as Record<string, number>,
            accessory: {} as Record<string, number>,
            pet: {} as Record<string, number>,
            totalCharms: 0,
        };
        const packerStats: Record<string, number> = {};

        currentOrders.forEach(order => {
            if (order.packedBy) packerStats[order.packedBy] = (packerStats[order.packedBy] || 0) + 1;
            order.items.forEach(item => {
                const frame = FRAME_OPTIONS.find(f => f.id === item.frameId);
                const frameName = frame ? `Khung ${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                
                item.draggableItems.forEach(di => {
                    if (di.type === 'charm') {
                        inventory.totalCharms++;
                    } else {
                        const part = allKnownParts[di.partId];
                        if (part) {
                             if (di.type === 'accessory') inventory.accessory[part.name] = (inventory.accessory[part.name] || 0) + 1;
                             if (di.type === 'pet') inventory.pet[part.name] = (inventory.pet[part.name] || 0) + 1;
                             inventory.totalCharms++;
                        }
                    }
                });

                item.characters.forEach(char => {
                    if (char.hair) inventory.hair[char.hair.name] = (inventory.hair[char.hair.name] || 0) + 1;
                    if (char.face) inventory.face[char.face.name] = (inventory.face[char.face.name] || 0) + 1;
                    if (char.shirt) inventory.shirt[char.shirt.name] = (inventory.shirt[char.shirt.name] || 0) + 1;
                    if (char.pants) inventory.pants[char.pants.name] = (inventory.pants[char.pants.name] || 0) + 1;
                    if (char.hat) inventory.hat[char.hat.name] = (inventory.hat[char.hat.name] || 0) + 1;
                });
            });
        });

        const packers = Object.entries(packerStats).map(([email, count]) => ({ email, count })).sort((a, b) => b.count - a.count);

        return { revenue, revenueGrowth, orderCount, orderGrowth, inventory, packers, dateLabel };
    }, [orders, filterType, period, month, year, customStartDate, customEndDate, allKnownParts]); 

    const filteredProducts = useMemo(() => 
        products.filter(p => (productCategory === 'all' || p.type === productCategory) && p.name.toLowerCase().includes(productSearch.toLowerCase())), 
    [products, productSearch, productCategory]);

    const filteredBackgrounds = useMemo(() => 
        backgrounds.filter(bg => {
            const matchType = bgTypeFilter === 'all' || bg.type === bgTypeFilter;
            const matchCategory = bgCategoryFilter === 'all' || bg.category === bgCategoryFilter;
            const matchSearch = bg.name.toLowerCase().includes(bgSearch.toLowerCase());
            return matchType && matchCategory && matchSearch;
        }),
    [backgrounds, bgTypeFilter, bgCategoryFilter, bgSearch]);
    
    const sortedOrders = useMemo(() => {
        let result = [...orders];
        
        if (filterStatus !== 'all') {
            result = result.filter(o => o.status === filterStatus);
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(o => 
                o.id.toLowerCase().includes(lowerTerm) || 
                o.customer.phone.includes(lowerTerm) ||
                o.customer.name.toLowerCase().includes(lowerTerm)
            );
        }

        if (sortMode === 'urgent') {
            result.sort((a, b) => {
                if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
                const getTargetTime = (o: Order) => {
                    if (o.adminDeadline) return new Date(o.adminDeadline).getTime();
                    if (o.delivery.date) return new Date(o.delivery.date).getTime();
                    return 9999999999999;
                };
                const timeA = getTargetTime(a);
                const timeB = getTargetTime(b);
                if (timeA !== timeB) return timeA - timeB;
                return (a.createdAt || 0) - (b.createdAt || 0);
            });
        } else {
            result.sort((a, b) => ((b.createdAt || 0) - (a.createdAt || 0)));
        }
        return result;
    }, [orders, sortMode, filterStatus, searchTerm]);

    const partsByType = useMemo(() => {
        const types: Record<string, LegoPart[]> = {};
        products.forEach(p => {
            if (!types[p.type]) types[p.type] = [];
            types[p.type].push(p);
        });
        return types;
    }, [products]);

    const getVietQR = (order: Order) => {
        const BANK_ID = '970407'; // Techcombank
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2';
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        const amount = order.amountToPay || order.totalPrice;
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };

    const TopItemsCard = ({ title, data }: { title: string, data: Record<string, number> }) => (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col h-full">
            <h4 className="font-bold text-sm text-gray-700 mb-3 uppercase tracking-wider">{title}</h4>
            {Object.keys(data).length > 0 ? (
                <div className="space-y-2 overflow-y-auto flex-grow max-h-40 custom-scrollbar">
                    {Object.entries(data)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([name, count], idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-gray-400 font-mono w-4 flex-shrink-0">{idx + 1}.</span>
                                    <span className="font-medium text-gray-700 truncate" title={name}>{name}</span>
                                </div>
                                <span className="font-bold w-6 text-right flex-shrink-0">{count}</span>
                            </div>
                        ))
                    }
                </div>
            ) : (
                <div className="text-center py-4 text-gray-300 text-xs italic border border-dashed rounded">
                    Chưa có dữ liệu
                </div>
            )}
        </div>
    );

    if (isAuthChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="text-gray-500 text-sm">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-96 text-center">
                    <h1 className="text-2xl font-bold mb-1 text-gray-900">The Luvin Admin</h1>
                    <p className="text-gray-500 mb-8 text-sm">Vui lòng đăng nhập để tiếp tục</p>
                    <form onSubmit={handleLogin} className="space-y-4 text-left">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                            <input type="email" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mật khẩu</label>
                            <input type="password" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                        </div>
                        {loginError && <p className="text-red-600 text-sm mt-2">{loginError}</p>}
                        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-2.5 rounded hover:bg-black transition-colors mt-4">Đăng nhập</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="text-xl font-bold tracking-tight">The Luvin <span className="font-normal text-gray-400 text-base">| Quản lý</span></div>
                        <nav className="hidden md:flex gap-6">
                             {role === 'admin' && (
                                <button onClick={() => setActiveTab('dashboard')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                    Dashboard
                                </button>
                             )}
                            <button onClick={() => setActiveTab('orders')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'orders' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                Đơn hàng
                            </button>
                            {role === 'admin' && (
                                <>
                                    <button onClick={() => setActiveTab('products')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'products' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                        Sản phẩm
                                    </button>
                                    <button onClick={() => setActiveTab('config')} className={`pb-1 text-sm font-bold border-b-2 transition-all ${activeTab === 'config' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                        Cấu hình
                                    </button>
                                </>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 font-medium hidden sm:block">{currentUser.email}</span>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 text-sm font-medium transition-colors">Đăng xuất</button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto py-8 px-4 sm:px-6">
                
                {/* --- DASHBOARD TAB --- */}
                {activeTab === 'dashboard' && role === 'admin' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">Tổng quan {analytics.dateLabel}</h2>
                            <div className="flex flex-wrap gap-4 items-center justify-end">
                                <div className="flex bg-gray-100 p-1 rounded-md">
                                    <button onClick={() => setFilterType('period')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'period' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Nhanh</button>
                                    <button onClick={() => setFilterType('month')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tháng</button>
                                    <button onClick={() => setFilterType('custom')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'custom' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tùy chỉnh</button>
                                </div>
                                {filterType === 'period' && (
                                    <div className="flex gap-2">
                                        {(['today', 'yesterday', '7days', '30days'] as const).map(t => (
                                            <button key={t} onClick={() => setPeriod(t)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors border ${period === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{t === 'today' ? 'Hôm nay' : t === 'yesterday' ? 'Hôm qua' : t === '7days' ? '7 ngày' : '30 ngày'}</button>
                                        ))}
                                    </div>
                                )} 
                                {filterType === 'month' && (
                                    <div className="flex gap-2 items-center">
                                        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700 focus:ring-0 focus:border-gray-900 outline-none">{Array.from({length: 12}, (_, i) => (<option key={i} value={i}>Tháng {i + 1}</option>))}</select>
                                        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700 focus:ring-0 focus:border-gray-900 outline-none"><option value={2024}>2024</option><option value={2025}>2025</option><option value={2026}>2026</option></select>
                                    </div>
                                )}
                                {filterType === 'custom' && (
                                    <div className="flex gap-2 items-center">
                                        <input type="date" className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                                        <span className="text-gray-400">-</span>
                                        <input type="date" className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doanh thu</p><span className={`text-xs font-bold flex items-center ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.revenueGrowth).toFixed(1)}%</span></div>
                                <p className="text-3xl font-light text-gray-900">{formatCurrency(analytics.revenue)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn hàng</p><span className={`text-xs font-bold flex items-center ${analytics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.orderGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.orderGrowth).toFixed(1)}%</span></div>
                                <p className="text-3xl font-light text-gray-900">{analytics.orderCount}</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tổng Charm</p>
                                <p className="text-3xl font-light text-gray-900">{analytics.inventory.totalCharms}</p>
                            </div>
                             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Hiệu suất kho</p>
                                <div className="flex items-end gap-2"><p className="text-3xl font-light text-gray-900">{analytics.packers.length > 0 ? analytics.packers[0].count : 0}</p><p className="text-sm font-medium text-gray-600 mb-1 truncate w-24">Top 1</p></div>
                            </div>
                        </div>

                        {/* Detailed Breakdown Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <TopItemsCard title="Khung Ảnh" data={analytics.inventory.frames} />
                            <TopItemsCard title="Tóc" data={analytics.inventory.hair} />
                            <TopItemsCard title="Khuôn mặt" data={analytics.inventory.face} />
                            <TopItemsCard title="Áo" data={analytics.inventory.shirt} />
                            <TopItemsCard title="Quần" data={analytics.inventory.pants} />
                            <TopItemsCard title="Mũ" data={analytics.inventory.hat} />
                            <TopItemsCard title="Phụ kiện" data={analytics.inventory.accessory} />
                            <TopItemsCard title="Thú cưng" data={analytics.inventory.pet} />
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {/* Packer Leaderboard */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                                <h3 className="font-bold text-gray-800 mb-4">Bảng Xếp Hạng Đóng Gói</h3>
                                {analytics.packers.length > 0 ? (
                                    <div className="overflow-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-500 border-b">
                                                <tr>
                                                    <th className="py-2 px-3 text-left font-semibold">Hạng</th>
                                                    <th className="py-2 px-3 text-left font-semibold">Nhân viên</th>
                                                    <th className="py-2 px-3 text-right font-semibold">Số đơn</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.packers.map((packer, idx) => (
                                                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                        <td className="py-3 px-3">
                                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-200 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'}`}>
                                                                {idx + 1}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 font-medium text-gray-800">{packer.email}</td>
                                                        <td className="py-3 px-3 text-right font-bold">{packer.count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                        Chưa có dữ liệu đóng gói trong khoảng thời gian này
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ORDERS TAB --- */}
                {activeTab === 'orders' && (
                     <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
                        <div className={`lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2 flex-col">
                                <input 
                                    placeholder="Tìm mã đơn, SĐT, tên..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                                />
                                <div className="flex gap-2 w-full">
                                    <button onClick={() => setSortMode('newest')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'newest' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>Mới nhất</button>
                                    <button onClick={() => setSortMode('urgent')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'urgent' ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-500 hover:text-gray-900'}`}>Cần gấp</button>
                                </div>
                                <div 
                                    className="flex gap-1 overflow-x-auto no-scrollbar pb-1 cursor-grab active:cursor-grabbing"
                                    ref={scrollContainerRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseLeave={handleMouseLeave}
                                    onMouseUp={handleMouseUp}
                                    onMouseMove={handleMouseMove}
                                >
                                    <button onClick={() => setFilterStatus('all')} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>Tất cả</button>
                                    {STATUS_CONFIG.filter(s => !s.isAction).map(status => (
                                        <button key={status.label} onClick={() => setFilterStatus(status.label)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === status.label ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>{status.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                                {sortedOrders.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">Không có đơn hàng nào.</div>
                                ) : sortedOrders.map(order => (
                                    <div key={order.id} onClick={() => { setSelectedOrder(order); setIsEditingOrder(false); }} className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-gray-50' : ''}`}>
                                        <div className="flex justify-between items-start mb-1"><span className={`font-mono font-medium ${order.isUrgent ? 'text-red-600' : 'text-gray-900'}`}>{order.id}</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{order.status}</span></div>
                                        <div className="flex justify-between items-center"><p className="text-sm text-gray-600 truncate max-w-[150px]">{order.customer.name}</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalPrice)}</p></div>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-gray-400">{order.createdAt ? formatDateTime(order.createdAt) : '---'}</p>
                                            {(order.adminDeadline || order.delivery.date) && (
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">{order.adminDeadline ? `DL: ${formatDate(order.adminDeadline)}` : `Giao: ${formatDate(order.delivery.date)}`}</p>
                                                    {order.delivery.date && getCountdownText(order.delivery.date)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`lg:w-2/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                            {selectedOrder ? (
                                <div className="flex flex-col h-full relative">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
                                        <div className="flex items-start gap-2">
                                            <button onClick={() => setSelectedOrder(null)} className="lg:hidden text-gray-500 mr-2">←</button>
                                            <div>
                                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">{selectedOrder.id}{selectedOrder.isUrgent && <span className="text-red-500 text-lg" title="Đơn gấp">🔥</span>}</h2>
                                                <p className="text-sm text-gray-500 mt-1">Đặt lúc: {selectedOrder.createdAt ? formatDateTime(selectedOrder.createdAt) : '---'}</p>
                                                
                                                {/* Show Packed Info if available */}
                                                {selectedOrder.packedBy && (
                                                    <div className="mt-1 p-2 bg-indigo-50 border border-indigo-100 rounded text-xs text-indigo-800">
                                                        <p className="font-bold flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                            Đã đóng gói
                                                        </p>
                                                        <p>Bởi: {selectedOrder.packedBy}</p>
                                                        <p>Lúc: {selectedOrder.packedAt ? formatDateTime(new Date(selectedOrder.packedAt).getTime()) : '---'}</p>
                                                    </div>
                                                )}

                                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                                    <StatusDropdown 
                                                        currentStatus={selectedOrder.status} 
                                                        onStatusChange={(s) => handleUpdate(selectedOrder.id, { status: s })} 
                                                        isAdmin={role === 'admin'}
                                                        onDelete={handleDeleteOrder}
                                                    />
                                                    
                                                    {/* Confirm Packed Button - Visible to Warehouse and Admin for testing */}
                                                    {['Ưu tiên xuất đơn', 'Đang đóng hàng'].includes(selectedOrder.status) && (
                                                        <button 
                                                            onClick={handleMarkAsPacked} 
                                                            disabled={loading}
                                                            className="px-3 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-wait"
                                                        >
                                                            {loading ? (
                                                                <span>Đang xử lý...</span>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                    Xác nhận đóng gói xong
                                                                </>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Quick Confirm for New Orders - Only for Admin */}
                                                    {role === 'admin' && selectedOrder.status === 'Chờ thanh toán' && (
                                                        <button 
                                                            onClick={() => handleUpdate(selectedOrder.id, { status: 'Ưu tiên xuất đơn' })} 
                                                            className="px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                            Xác nhận đơn ngay
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                             <div className="flex gap-2">
                                                {!isEditingOrder ? (
                                                    <button onClick={startEditingOrder} className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200">Sửa</button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={cancelEditingOrder} className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200">Huỷ</button>
                                                        <button onClick={saveOrderChanges} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Lưu</button>
                                                    </div>
                                                )}
                                             </div>
                                             <label className="flex items-center gap-2 cursor-pointer select-none"><span className="text-xs font-medium text-gray-500">Đánh dấu Gấp</span><input type="checkbox" className="accent-red-600 w-4 h-4" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} /></label>
                                        </div>
                                    </div>

                                    <div className="flex-grow overflow-y-auto p-6 space-y-8">
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú nội bộ</label><textarea className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" rows={2} placeholder="Ghi chú cho admin..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} /></div>
                                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deadline Xưởng</label><input type="date" className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" value={adminDeadlineInput} onChange={(e) => setAdminDeadlineInput(e.target.value)} /><div className="mt-2 text-right"><button onClick={handleSaveAdminInfo} className="text-xs font-bold text-white bg-gray-900 px-3 py-1.5 rounded hover:bg-black transition-colors">Lưu Ghi chú</button></div></div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Khách hàng</h3>
                                                <div className="space-y-2 text-sm text-gray-700">
                                                    {isEditingOrder && editForm ? (
                                                        <>
                                                            <div className="flex items-center gap-2"><span className="w-20 text-gray-500">Tên:</span> <input className="border rounded p-1 w-full" value={editForm.customer.name} onChange={e => handleEditFormChange('customer', e.target.value, 'name')} /></div>
                                                            <div className="flex items-center gap-2"><span className="w-20 text-gray-500">SĐT:</span> <input className="border rounded p-1 w-full" value={editForm.customer.phone} onChange={e => handleEditFormChange('customer', e.target.value, 'phone')} /></div>
                                                            <div className="flex items-center gap-2"><span className="w-20 text-gray-500">Email:</span> <input className="border rounded p-1 w-full" value={editForm.customer.email} onChange={e => handleEditFormChange('customer', e.target.value, 'email')} /></div>
                                                            <div className="flex items-start gap-2"><span className="w-20 text-gray-500">Địa chỉ:</span> <textarea className="border rounded p-1 w-full" rows={2} value={editForm.customer.address} onChange={e => handleEditFormChange('customer', e.target.value, 'address')} /></div>
                                                            <div className="flex items-start gap-2 mt-2"><span className="w-20 text-gray-500">Note:</span> <textarea className="border rounded p-1 w-full" rows={2} value={editForm.delivery.notes} onChange={e => handleEditFormChange('delivery', e.target.value, 'notes')} /></div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p><span className="text-gray-500 w-20 inline-block">Tên:</span> {selectedOrder.customer.name}</p>
                                                            <p><span className="text-gray-500 w-20 inline-block">SĐT:</span> {selectedOrder.customer.phone}</p>
                                                            <p><span className="text-gray-500 w-20 inline-block">Email:</span> {selectedOrder.customer.email}</p>
                                                            <p className="flex items-start"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Địa chỉ:</span> <span>{selectedOrder.customer.address}</span></p>
                                                            <p className="flex items-start mt-2"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Note:</span> <span className="italic bg-yellow-50 px-2 py-0.5 rounded text-gray-800">{selectedOrder.delivery.notes || 'Không có'}</span></p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Thanh toán & Vận chuyển</h3>
                                                <div className="space-y-2 text-sm text-gray-700">
                                                    <p><span className="text-gray-500 w-24 inline-block">Phương thức:</span> {selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Toàn bộ'}</p>
                                                    <p><span className="text-gray-500 w-24 inline-block">Vận chuyển:</span> {selectedOrder.shipping.method}</p>
                                                    <div className="border-t border-gray-100 my-2 pt-2">
                                                        {isEditingOrder && editForm ? (
                                                            <>
                                                                <div className="flex items-center gap-2 mb-2"><span className="w-24 text-gray-500">Tổng đơn:</span> <input type="number" className="border rounded p-1 w-32 font-bold" value={editForm.totalPrice} onChange={e => handleEditFormChange('totalPrice', Number(e.target.value))} /></div>
                                                                <div className="flex items-center gap-2"><span className="w-24 text-gray-500">Cần thu:</span> <input type="number" className="border rounded p-1 w-32 font-bold text-red-600" value={editForm.amountToPay} onChange={e => handleEditFormChange('amountToPay', Number(e.target.value))} /></div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p><span className="text-gray-500 w-24 inline-block">Tổng đơn:</span> <span className="font-bold">{formatCurrency(selectedOrder.totalPrice)}</span></p>
                                                                <p><span className="text-gray-500 w-24 inline-block">Cần thu:</span> <span className="font-bold text-red-600">{formatCurrency(selectedOrder.amountToPay)}</span></p>
                                                            </>
                                                        )}
                                                    </div>
                                                    {!isEditingOrder && selectedOrder.amountToPay > 0 && selectedOrder.status !== 'Đã giao hàng' && (
                                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Mã QR Thanh toán (VietQR)</p>
                                                            <img src={getVietQR(selectedOrder)} alt="VietQR" className="w-32 h-32 border rounded-lg" />
                                                            <p className="text-[10px] text-gray-400 mt-1">TCB: 65838666666</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Products Detailed View */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">Chi tiết sản phẩm</h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                {(isEditingOrder && editForm ? editForm.items : selectedOrder.items).map((item, idx) => (
                                                    <div key={idx} className="flex gap-4 border border-gray-100 rounded-lg p-4 items-start bg-white flex-col md:flex-row">
                                                        <div className="w-24 h-24 bg-gray-50 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                            {item.previewImageUrl ? <img src={item.previewImageUrl} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">No img</span>}
                                                        </div>
                                                        <div className="flex-grow w-full">
                                                            {/* Frame & Basic Info */}
                                                            <div className="mb-3 pb-3 border-b border-gray-100">
                                                                <p className="font-bold text-gray-800 mb-1">Khung {item.frameId.toUpperCase()}</p>
                                                                <p className="text-xs text-gray-500">Nền: {item.background.type === 'color' ? item.background.value : 'Hình ảnh'}</p>
                                                            </div>

                                                            {/* Detailed Characters */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                                {item.characters.map((char, charIdx) => (
                                                                    <div key={char.id} className="bg-gray-50 p-2 rounded border border-gray-200 text-xs relative">
                                                                        <p className="font-bold text-gray-700 mb-1">Nhân vật {charIdx + 1}</p>
                                                                        {isEditingOrder && editForm && (
                                                                            <button onClick={() => handleRemoveCharacter(idx, charIdx)} className="absolute top-1 right-1 text-red-500 font-bold">×</button>
                                                                        )}
                                                                        {isEditingOrder && editForm ? (
                                                                            <div className="space-y-1">
                                                                                {(['hair', 'face', 'shirt', 'pants', 'hat'] as const).map(partType => (
                                                                                    <div key={partType} className="flex flex-col">
                                                                                        <div className="flex justify-between items-center">
                                                                                            <span className="text-gray-500 capitalize w-16">{partType}</span>
                                                                                            <select 
                                                                                                className="border rounded p-1 text-xs flex-grow"
                                                                                                value={char[partType]?.id || ''}
                                                                                                onChange={(e) => handleCharacterChange(idx, charIdx, partType, e.target.value)}
                                                                                            >
                                                                                                <option value="">None</option>
                                                                                                {partsByType[partType]?.map(part => (
                                                                                                    <option key={part.id} value={part.id}>{part.name}</option>
                                                                                                ))}
                                                                                            </select>
                                                                                        </div>
                                                                                        {['shirt', 'pants'].includes(partType) && char[partType]?.colors && char[partType]!.colors!.length > 0 && (
                                                                                            <div className="flex gap-1 mt-1 ml-16">
                                                                                                {char[partType]!.colors!.map(c => (
                                                                                                    <button 
                                                                                                        key={c.hex}
                                                                                                        onClick={() => handleCharacterColorChange(idx, charIdx, partType as 'shirt'|'pants', c.hex)}
                                                                                                        className={`w-4 h-4 rounded-full border ${ (partType === 'shirt' ? char.selectedShirtColor?.hex : char.selectedPantsColor?.hex) === c.hex ? 'ring-1 ring-gray-800 scale-110' : '' }`}
                                                                                                        style={{backgroundColor: c.hex}}
                                                                                                        title={c.name}
                                                                                                    />
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <ul className="text-gray-600 space-y-0.5 mt-1">
                                                                                {char.hair && <li>Tóc: {char.hair.name}</li>}
                                                                                {char.face && <li>Mặt: {char.face.name}</li>}
                                                                                {char.shirt && <li>Áo: {char.shirt.name} {char.selectedShirtColor ? `(${char.selectedShirtColor.name})` : ''}</li>}
                                                                                {char.pants && <li>Quần: {char.pants.name} {char.selectedPantsColor ? `(${char.selectedPantsColor.name})` : ''}</li>}
                                                                                {char.hat && <li>Mũ: {char.hat.name}</li>}
                                                                                {char.customPrintPrice && <li className="text-blue-600 font-bold">In yêu cầu: {formatCurrency(char.customPrintPrice)}</li>}
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {isEditingOrder && editForm && (
                                                                    <button onClick={() => handleAddCharacter(idx)} className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors text-sm font-bold">
                                                                        + Thêm NV
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Draggable Items (Pets/Accessories) */}
                                                            {item.draggableItems.length > 0 && (
                                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Phụ kiện & Thú cưng</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {item.draggableItems.map((di, diIdx) => {
                                                                           const part = allKnownParts[di.partId];
                                                                           return (
                                                                                <div key={di.id} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs flex items-center gap-2">
                                                                                    {di.type === 'charm' ? (
                                                                                         <span>Charm (Ảnh)</span>
                                                                                    ) : (
                                                                                        <span>{part?.name || 'Unknown'} {di.selectedColor ? `(${di.selectedColor.name})` : ''}</span>
                                                                                    )}
                                                                                    {isEditingOrder && editForm && (
                                                                                        <button onClick={() => handleRemoveDraggable(idx, diIdx)} className="text-red-500 font-bold hover:text-red-700">×</button>
                                                                                    )}
                                                                                </div>
                                                                           );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                             {isEditingOrder && editForm && (
                                                                <div className="mt-2">
                                                                    <button 
                                                                        onClick={() => setAddingAccessoryToItemIndex(addingAccessoryToItemIndex === idx ? null : idx)}
                                                                        className="text-xs text-blue-600 hover:underline font-semibold"
                                                                    >
                                                                        + Thêm phụ kiện/thú cưng
                                                                    </button>
                                                                    {addingAccessoryToItemIndex === idx && (
                                                                        <div className="mt-2 p-2 bg-gray-50 border rounded grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                                                                            {[...products.filter(p => p.type === 'accessory' || p.type === 'pet')].map(p => (
                                                                                <button key={p.id} onClick={() => handleAddDraggable(idx, p)} className="flex flex-col items-center p-1 bg-white border rounded hover:border-blue-500">
                                                                                    <img src={p.imageUrl} className="w-8 h-8 object-contain" />
                                                                                    <span className="text-[10px] text-gray-500">{p.name}</span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-grow flex items-center justify-center text-gray-400 text-sm">Chọn một đơn hàng để xem chi tiết</div>
                            )}
                        </div>
                     </div>
                )}

                {activeTab === 'products' && (
                    <div className="animate-fade-in">
                        <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4">
                            <button onClick={() => setActiveProductSubTab('parts')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeProductSubTab === 'parts' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Linh kiện LEGO</button>
                            <button onClick={() => setActiveProductSubTab('backgrounds')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeProductSubTab === 'backgrounds' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Hình nền</button>
                        </div>

                        {activeProductSubTab === 'parts' && (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex gap-2">
                                        <input placeholder="Tìm kiếm linh kiện..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="p-2 border rounded-lg text-sm w-64" />
                                        <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="p-2 border rounded-lg text-sm">
                                            <option value="all">Tất cả loại</option>
                                            <option value="hair">Tóc</option>
                                            <option value="face">Mặt</option>
                                            <option value="shirt">Áo</option>
                                            <option value="pants">Quần</option>
                                            <option value="hat">Mũ</option>
                                            <option value="accessory">Phụ kiện</option>
                                            <option value="pet">Thú cưng</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleSeedData} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset Data</button>
                                        <button onClick={() => setIsEditingProduct(true)} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700">+ Thêm linh kiện</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {filteredProducts.map(part => (
                                        <div key={part.id} className="bg-white border rounded-lg p-3 group relative hover:shadow-md transition-all">
                                            <div className="aspect-square bg-gray-50 rounded mb-2 flex items-center justify-center p-2">
                                                <img src={part.imageUrl} className="max-w-full max-h-full object-contain" />
                                            </div>
                                            <h4 className="font-bold text-sm truncate" title={part.name}>{part.name}</h4>
                                            <p className="text-xs text-gray-500">{formatCurrency(part.price)}</p>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="p-1 bg-blue-100 text-blue-600 rounded">✏️</button>
                                                <button onClick={() => handleDeleteProduct(part.id)} className="p-1 bg-red-100 text-red-600 rounded">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeProductSubTab === 'backgrounds' && (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex gap-2">
                                        <input placeholder="Tìm background..." value={bgSearch} onChange={e => setBgSearch(e.target.value)} className="p-2 border rounded-lg text-sm w-64" />
                                        <select value={bgTypeFilter} onChange={(e: any) => setBgTypeFilter(e.target.value)} className="p-2 border rounded-lg text-sm">
                                            <option value="all">Tất cả loại</option>
                                            <option value="square">Vuông</option>
                                            <option value="rectangle">Chữ nhật</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleSeedBackgrounds} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset BG</button>
                                        <button onClick={() => setIsEditingBackground(true)} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700">+ Thêm BG</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {filteredBackgrounds.map(bg => (
                                        <div key={bg.id} className="bg-white border rounded-lg p-3 group relative hover:shadow-md transition-all">
                                            <div className={`aspect-${bg.type === 'square' ? 'square' : '[2/3]'} bg-gray-50 rounded mb-2 flex items-center justify-center overflow-hidden`}>
                                                <img src={bg.url} className="w-full h-full object-cover" />
                                            </div>
                                            <h4 className="font-bold text-sm truncate">{bg.name}</h4>
                                            <p className="text-xs text-gray-500">{bg.category}</p>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button onClick={() => { setEditingBg(bg); setIsEditingBackground(true); }} className="p-1 bg-blue-100 text-blue-600 rounded">✏️</button>
                                                <button onClick={() => handleDeleteBackground(bg.id)} className="p-1 bg-red-100 text-red-600 rounded">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="animate-fade-in">
                        <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4">
                            <button onClick={() => setActiveConfigSubTab('general')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeConfigSubTab === 'general' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Chung</button>
                            <button onClick={() => setActiveConfigSubTab('templates')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeConfigSubTab === 'templates' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Mẫu (Collection)</button>
                            <button onClick={() => setActiveConfigSubTab('feedbacks')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeConfigSubTab === 'feedbacks' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Feedbacks</button>
                        </div>

                        {activeConfigSubTab === 'general' && (
                            <div className="bg-white p-6 rounded-lg border shadow-sm max-w-2xl">
                                <h3 className="text-lg font-bold mb-6">Cấu hình chung</h3>
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
                    </div>
                )}
            </main>

            {/* Modals */}
            {isEditingProduct && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={() => { setIsEditingProduct(false); setEditingPart(null); }} />}
            {isEditingBackground && <BackgroundForm initialData={editingBg} onSave={handleSaveBackground} onCancel={() => { setIsEditingBackground(false); setEditingBg(null); }} />}
            {isEditingTemplate && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={() => { setIsEditingTemplate(false); setEditingTemplate(null); }} />}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
            
            {loading && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                        <span className="font-bold text-sm">Đang xử lý...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
