
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder, countPartsInOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase, adjustStock } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds } from '../services/backgroundService';
import { getAllTemplates, addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../services/templateService';
import { getAllFeedbacks, addFeedback, updateFeedback, deleteFeedback, seedFeedbacks } from '../services/feedbackService';
import { uploadToCloudinary } from '../services/uploadService'; 
import { updateStoreConfig, getStoreConfig, StoreConfig } from '../services/configService';
import { createVTPOrder, createSPXOrder, cancelShippingOrder } from '../services/shippingService'; // Import Shipping Service
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
                <div className="absolute bottom-full mb-2 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                    <div className="p-1">
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

// --- COMPONENT: ShippingControl (Mới) ---
const ShippingControl: React.FC<{ 
    order: Order;
    onUpdateOrder: (updates: Partial<Order>) => void;
}> = ({ order, onUpdateOrder }) => {
    const [weight, setWeight] = useState(500); // Default 500g
    const [dimL, setDimL] = useState(25);
    const [dimW, setDimW] = useState(25);
    const [dimH, setDimH] = useState(10);
    const [isCreating, setIsCreating] = useState(false);

    // Nếu đã có vận đơn
    if (order.shippingDetails) {
        const { carrier, trackingCode, status, fee } = order.shippingDetails;
        const trackingLink = carrier === 'VTP' 
            ? `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/hanh-trinh-don-van-chuyen?code=${trackingCode}`
            : `https://spx.vn/track?id=${trackingCode}`; // SPX link giả định

        const handleCancelShip = async () => {
            if(confirm("Bạn chắc chắn muốn huỷ vận đơn này?")) {
                setIsCreating(true);
                await cancelShippingOrder(trackingCode, carrier);
                onUpdateOrder({ shippingDetails: undefined }); // Xóa thông tin ship
                setIsCreating(false);
            }
        }

        return (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-800">{carrier}</span>
                        <span className="bg-white px-2 py-0.5 rounded border text-xs font-mono">{trackingCode}</span>
                    </div>
                    <span className="text-xs font-bold text-green-600">{status}</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                    <p>Phí vận chuyển: {formatCurrency(fee)}</p>
                    <p>Thu hộ (COD): {formatCurrency(order.shippingDetails.codAmount)}</p>
                </div>
                <div className="mt-3 flex gap-2">
                    <a href={trackingLink} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-blue-700 flex-grow text-center">
                        Theo dõi / In đơn
                    </a>
                    <button onClick={handleCancelShip} disabled={isCreating} className="bg-white border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded hover:bg-red-50">
                        {isCreating ? '...' : 'Huỷ'}
                    </button>
                </div>
            </div>
        );
    }

    const handleCreateOrder = async (carrier: 'VTP' | 'SPX') => {
        setIsCreating(true);
        try {
            const res = carrier === 'VTP' 
                ? await createVTPOrder(order, weight, dimL, dimW, dimH)
                : await createSPXOrder(order, weight, dimL, dimW, dimH);
            
            if (res.success && res.data) {
                onUpdateOrder({ 
                    shippingDetails: res.data,
                    status: 'Gửi hàng đi' // Tự động update trạng thái đơn
                });
            } else {
                alert(`Lỗi tạo đơn: ${res.error}`);
            }
        } catch (e) {
            alert("Lỗi kết nối");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Tạo vận đơn (Logistics)</h4>
            
            {/* Kích thước kiện hàng */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">TL (g)</label>
                    <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs text-center font-medium" />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Dài</label>
                    <input type="number" value={dimL} onChange={e => setDimL(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs text-center" />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Rộng</label>
                    <input type="number" value={dimW} onChange={e => setDimW(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs text-center" />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Cao</label>
                    <input type="number" value={dimH} onChange={e => setDimH(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs text-center" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => handleCreateOrder('VTP')} 
                    disabled={isCreating}
                    className="flex items-center justify-center gap-2 bg-red-600 text-white py-2 px-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                    {isCreating ? '...' : <><span className="font-bold text-xs">Viettel Post</span></>}
                </button>
                <button 
                    onClick={() => handleCreateOrder('SPX')} 
                    disabled={isCreating}
                    className="flex items-center justify-center gap-2 bg-orange-500 text-white py-2 px-2 rounded hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                    {isCreating ? '...' : <><span className="font-bold text-xs">Shopee Xpress</span></>}
                </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center italic">
                *Tự động cập nhật trạng thái "Gửi hàng đi" khi tạo thành công.
            </p>
        </div>
    );
};

// --- COMPONENT: FORM SẢN PHẨM (MODAL) ---
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
    const [newColor, setNewColor] = useState<OutfitColor>({ name: '', hex: '#000000', price: 0, imageUrl: '' });
    const [isUploadingColorImg, setIsUploadingColorImg] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'stock') {
            // If value is empty string, set stock to undefined (unlimited)
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

    // Color Management Handlers
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

    const addColor = () => {
        if (!newColor.name || !newColor.imageUrl) {
            alert("Vui lòng nhập tên màu và tải ảnh cho màu đó.");
            return;
        }
        setColors([...colors, newColor]);
        setNewColor({ name: '', hex: '#000000', price: 0, imageUrl: '' }); // Reset
    };

    const removeColor = (index: number) => {
        setColors(colors.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        // Include colors in the saved data
        onSave({ ...formData, colors: colors });
    };

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
                        
                        {/* Main Image Upload */}
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

                    {/* --- COLOR VARIANTS SECTION --- */}
                    {(formData.type === 'shirt' || formData.type === 'pants') && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                            <h4 className="font-bold text-sm text-gray-800 mb-3">Biến thể màu sắc (Tùy chọn)</h4>
                            
                            {/* List of existing colors */}
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
                                        <button onClick={() => removeColor(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                                {colors.length === 0 && <p className="text-xs text-gray-400 italic">Chưa có màu nào được thêm.</p>}
                            </div>

                            {/* Add new color inputs */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <p className="text-xs font-bold text-blue-800 mb-2">Thêm màu mới</p>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <input 
                                        placeholder="Tên màu (VD: Đỏ)" 
                                        className="p-1.5 text-xs border rounded"
                                        value={newColor.name}
                                        onChange={e => setNewColor({...newColor, name: e.target.value})}
                                    />
                                    <input 
                                        type="number"
                                        placeholder="Giá thêm (VNĐ)" 
                                        className="p-1.5 text-xs border rounded"
                                        value={newColor.price}
                                        onChange={e => setNewColor({...newColor, price: Number(e.target.value)})}
                                    />
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Mã màu:</span>
                                        <input 
                                            type="color" 
                                            className="w-8 h-8 border rounded cursor-pointer"
                                            value={newColor.hex}
                                            onChange={e => setNewColor({...newColor, hex: e.target.value})}
                                        />
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleColorFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            disabled={isUploadingColorImg}
                                        />
                                        <button className={`w-full p-1.5 text-xs border rounded bg-white text-left truncate ${isUploadingColorImg ? 'text-gray-400' : ''}`}>
                                            {isUploadingColorImg ? 'Đang tải...' : newColor.imageUrl ? 'Đã chọn ảnh ✓' : 'Tải ảnh màu...'}
                                        </button>
                                    </div>
                                </div>
                                <button 
                                    onClick={addColor} 
                                    disabled={isUploadingColorImg}
                                    className="w-full bg-blue-600 text-white text-xs font-bold py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    + Thêm biến thể
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

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => { const success = await updateOrder(orderId, updates); if (success) { setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); if (showMsg) alert("Đã cập nhật!"); } };
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
        // Calculate differences between old and new order state to adjust stock
        const oldParts = countPartsInOrder(selectedOrder.items);
        const newParts = countPartsInOrder(editForm.items);
        
        const stockAdjustments: Record<string, number> = {};
        
        // Find parts that were in old order (might be removed or reduced)
        // If removed from order -> Add back to stock (+1)
        Object.keys(oldParts).forEach(partId => {
            const oldQty = oldParts[partId] || 0;
            const newQty = newParts[partId] || 0;
            const diff = oldQty - newQty;
            if (diff !== 0) stockAdjustments[partId] = diff;
        });

        // Find parts that are new in the order (might be added)
        // If added to order -> Subtract from stock (-1)
        Object.keys(newParts).forEach(partId => {
            if (!oldParts[partId]) {
                // Completely new part, adjust by negative quantity
                stockAdjustments[partId] = -(newParts[partId]);
            }
        });

        // Apply stock adjustments if there are any changes
        if (Object.keys(stockAdjustments).length > 0) {
            await adjustStock(stockAdjustments);
            // Refresh product list to show updated stock in UI
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

    const handleMarkAsPacked = async () => {
        if (!selectedOrder || !currentUser) return;
        if (confirm(`Xác nhận bạn (${currentUser.email}) đã đóng gói đơn này?`)) {
            const now = new Date().toISOString();
            await handleUpdate(selectedOrder.id, { 
                status: 'Chờ chuyển hàng', 
                packedBy: currentUser.email,
                packedAt: now
            });
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

    const bgCategories = useMemo(() => {
        return ['all', ...Array.from(new Set(backgrounds.map(bg => bg.category)))];
    }, [backgrounds]);

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

        if (sortMode === 'urgent') {
            result.sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                if (a.adminDeadline && !b.adminDeadline) return -1;
                if (!a.adminDeadline && b.adminDeadline) return 1;
                return 0;
            });
        } else {
            result.sort((a, b) => ((b.createdAt || 0) - (a.createdAt || 0)));
        }
        return result;
    }, [orders, sortMode, filterStatus]);

    const partsByType = useMemo(() => {
        const types: Record<string, LegoPart[]> = {};
        products.forEach(p =>