
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

const formatDateTime = (timestamp: number | string | undefined) => {
    if (!timestamp) return '---';
    return new Date(timestamp).toLocaleString('vi-VN');
};

const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleDateString('vi-VN');
};

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
                if (carrier !== 'OTHER') {
                    await cancelShippingOrder(trackingCode, carrier);
                }
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

    const handleMarkAsPacked = async () => {
        if (!selectedOrder || !currentUser) return;
        const now = new Date().toISOString();
        await handleUpdate(selectedOrder.id, {
            status: 'Chờ chuyển hàng', // or whatever the next status is
            packedBy: currentUser.email || 'unknown',
            packedAt: now
        });
    };

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);

    const partsByType = useMemo(() => {
        const types: Record<string, LegoPart[]> = {};
        products.forEach(p => {
            if (!types[p.type]) types[p.type] = [];
            types[p.type].push(p);
        });
        return types;
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = productCategory === 'all' || p.type === productCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, productSearch, productCategory]);

    const bgCategories = useMemo(() => {
        const cats = new Set(backgrounds.map(b => b.category));
        return ['all', ...Array.from(cats)];
    }, [backgrounds]);

    const filteredBackgrounds = useMemo(() => {
        return backgrounds.filter(bg => {
            const matchesSearch = bg.name.toLowerCase().includes(bgSearch.toLowerCase());
            const matchesType = bgTypeFilter === 'all' || bg.type === bgTypeFilter;
            const matchesCategory = bgCategoryFilter === 'all' || bg.category === bgCategoryFilter;
            return matchesSearch && matchesType && matchesCategory;
        });
    }, [backgrounds, bgSearch, bgTypeFilter, bgCategoryFilter]);

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

    if (isAuthChecking) {
        return <div className="flex h-screen items-center justify-center text-gray-500">Đang kiểm tra đăng nhập...</div>;
    }

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="bg-white p-8 rounded-xl shadow-lg w-96">
                    <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Admin Login</h2>
                    {loginError && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{loginError}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-luvin-pink" 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                            <input 
                                type="password" 
                                value={loginPass} 
                                onChange={e => setLoginPass(e.target.value)} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-luvin-pink" 
                                required 
                            />
                        </div>
                        <button type="submit" className="w-full bg-black text-white font-bold py-2.5 rounded-md hover:bg-gray-800 transition-colors">Đăng nhập</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-100 text-gray-800 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-2xl font-heading text-luvin-pink">Admin Panel</h1>
                    <p className="text-xs text-gray-500 mt-1">Hello, {currentUser.email.split('@')[0]}</p>
                </div>
                <nav className="flex-grow p-4 space-y-2">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-gray-100 text-black' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <span>📊</span> Dashboard
                    </button>
                    <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'orders' ? 'bg-gray-100 text-black' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <span>📦</span> Đơn hàng
                    </button>
                    {role === 'admin' && (
                        <>
                            <button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'products' ? 'bg-gray-100 text-black' : 'text-gray-600 hover:bg-gray-50'}`}>
                                <span>🧩</span> Sản phẩm & Assets
                            </button>
                            <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'config' ? 'bg-gray-100 text-black' : 'text-gray-600 hover:bg-gray-50'}`}>
                                <span>⚙️</span> Cấu hình Store
                            </button>
                        </>
                    )}
                </nav>
                <div className="p-4 border-t border-gray-200">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                        <span>🚪</span> Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow overflow-y-auto p-8">
                
                {/* DASHBOARD VIEW */}
                {activeTab === 'dashboard' && (
                    <div className="max-w-5xl mx-auto animate-fade-in">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold">Tổng quan kinh doanh</h2>
                            
                            {/* Date Filter Controls */}
                            <div className="flex items-center bg-white p-1 rounded-lg border shadow-sm">
                                <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="text-sm border-none focus:ring-0 bg-transparent font-medium text-gray-600 cursor-pointer">
                                    <option value="period">Theo kỳ</option>
                                    <option value="month">Theo tháng</option>
                                    <option value="custom">Tùy chỉnh</option>
                                </select>
                                <div className="w-px h-4 bg-gray-300 mx-2"></div>
                                {filterType === 'period' && (
                                    <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="text-sm border-none focus:ring-0 bg-transparent font-bold text-gray-800 cursor-pointer">
                                        <option value="today">Hôm nay</option>
                                        <option value="yesterday">Hôm qua</option>
                                        <option value="7days">7 ngày qua</option>
                                        <option value="30days">30 ngày qua</option>
                                    </select>
                                )}
                                {filterType === 'month' && (
                                    <div className="flex gap-2">
                                        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="text-sm border-none focus:ring-0 bg-transparent font-bold text-gray-800 cursor-pointer">
                                            {Array.from({length: 12}, (_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
                                        </select>
                                        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="text-sm border-none focus:ring-0 bg-transparent font-bold text-gray-800 cursor-pointer">
                                            {Array.from({length: 5}, (_, i) => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}
                                        </select>
                                    </div>
                                )}
                                {filterType === 'custom' && (
                                    <div className="flex items-center gap-2 px-2">
                                        <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="text-xs border rounded p-1" />
                                        <span className="text-gray-400">-</span>
                                        <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="text-xs border rounded p-1" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <p className="text-sm text-gray-500 font-medium uppercase mb-1">Doanh thu ({analytics.dateLabel})</p>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(analytics.revenue)}</h3>
                                    <span className={`text-sm font-bold mb-1 ${analytics.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {analytics.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(analytics.revenueGrowth).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <p className="text-sm text-gray-500 font-medium uppercase mb-1">Đơn hàng ({analytics.dateLabel})</p>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-gray-900">{analytics.orderCount}</h3>
                                    <span className={`text-sm font-bold mb-1 ${analytics.orderGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {analytics.orderGrowth >= 0 ? '↑' : '↓'} {Math.abs(analytics.orderGrowth).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4 text-gray-800">Top Linh Kiện Bán Chạy</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Khung</h4>
                                        <ul className="space-y-2 text-sm">
                                            {Object.entries(analytics.inventory.frames).sort(([,a], [,b]) => b - a).map(([name, count]) => (
                                                <li key={name} className="flex justify-between border-b border-gray-50 pb-1"><span>{name}</span><span className="font-medium">{count}</span></li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Phụ kiện & Pet</h4>
                                        <ul className="space-y-2 text-sm">
                                            {[...Object.entries(analytics.inventory.accessory), ...Object.entries(analytics.inventory.pet)]
                                                .sort(([,a], [,b]) => b - a).slice(0, 8).map(([name, count]) => (
                                                <li key={name} className="flex justify-between border-b border-gray-50 pb-1"><span>{name}</span><span className="font-medium">{count}</span></li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4 text-gray-800">Hiệu suất nhân viên</h3>
                                <p className="text-xs text-gray-500 mb-3">Dựa trên số đơn đã đóng gói</p>
                                <div className="space-y-3">
                                    {analytics.packers.length > 0 ? analytics.packers.map((packer, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {packer.email[0].toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{packer.email.split('@')[0]}</span>
                                            </div>
                                            <span className="font-bold text-gray-900">{packer.count} đơn</span>
                                        </div>
                                    )) : <p className="text-sm text-gray-400 italic">Chưa có dữ liệu đóng gói.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ORDERS VIEW */}
                {activeTab === 'orders' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Quản lý đơn hàng</h2>
                                <p className="text-sm text-gray-500 mt-1">Danh sách tất cả đơn hàng từ khách.</p>
                            </div>
                            <div className="flex gap-3">
                                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                                    <option value="newest">Mới nhất trước</option>
                                    <option value="urgent">Ưu tiên & Gấp trước</option>
                                </select>
                                <div className="bg-white border border-gray-300 rounded-lg p-1 flex text-sm font-medium">
                                    <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-md transition-colors ${filterStatus === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Tất cả</button>
                                    <button onClick={() => setFilterStatus('Chờ thanh toán')} className={`px-3 py-1.5 rounded-md transition-colors ${filterStatus === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : 'text-gray-600 hover:bg-gray-100'}`}>Chờ thanh toán</button>
                                    <button onClick={() => setFilterStatus('Đã xác nhận')} className={`px-3 py-1.5 rounded-md transition-colors ${filterStatus === 'Đã xác nhận' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'}`}>Đã xác nhận</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                        <th className="p-4">Mã đơn</th>
                                        <th className="p-4">Khách hàng</th>
                                        <th className="p-4">Sản phẩm</th>
                                        <th className="p-4">Tổng tiền</th>
                                        <th className="p-4">Ngày đặt</th>
                                        <th className="p-4">Trạng thái</th>
                                        <th className="p-4 text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-100">
                                    {sortedOrders.map(order => (
                                        <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${order.isUrgent ? 'bg-red-50' : ''}`}>
                                            <td className="p-4 font-bold text-gray-900">
                                                {order.id}
                                                {order.isUrgent && <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-600 text-[10px] uppercase">Gấp</span>}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-gray-900">{order.customer.name}</div>
                                                <div className="text-xs text-gray-500">{order.customer.phone}</div>
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {order.items.length} khung
                                                {order.addGiftBox && <span className="ml-2 text-xs text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded">+ Hộp quà</span>}
                                            </td>
                                            <td className="p-4 font-bold text-gray-900">{formatCurrency(order.totalPrice)}</td>
                                            <td className="p-4 text-gray-500">{formatDateTime(order.createdAt)}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG.find(s => s.label === order.status)?.color || 'bg-gray-100 text-gray-800'}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => setSelectedOrder(order)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md font-medium transition-colors">Chi tiết</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-gray-500">Không có đơn hàng nào.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* PRODUCTS VIEW */}
                {activeTab === 'products' && (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-6 mb-6 border-b border-gray-200 pb-1">
                            <button onClick={() => setActiveProductSubTab('parts')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeProductSubTab === 'parts' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                Linh kiện LEGO
                            </button>
                            <button onClick={() => setActiveProductSubTab('backgrounds')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeProductSubTab === 'backgrounds' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                Hình nền (Backgrounds)
                            </button>
                        </div>

                        {activeProductSubTab === 'parts' && (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-4">
                                        <input 
                                            type="text" 
                                            placeholder="Tìm kiếm sản phẩm..." 
                                            value={productSearch} 
                                            onChange={e => setProductSearch(e.target.value)} 
                                            className="border border-gray-300 rounded-lg px-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                        />
                                        <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none">
                                            <option value="all">Tất cả loại</option>
                                            <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="hat">Mũ</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={handleSeedData} disabled={loading} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium text-sm">
                                            Reset Database
                                        </button>
                                        <button onClick={() => setIsEditingProduct(true)} className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 font-bold text-sm flex items-center gap-2">
                                            <span>+</span> Thêm sản phẩm
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {filteredProducts.map(part => (
                                        <div key={part.id} className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md transition-shadow relative group">
                                            <div className="aspect-square bg-gray-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden p-2">
                                                <img src={part.imageUrl} alt={part.name} className="w-full h-full object-contain" />
                                            </div>
                                            <h3 className="font-bold text-sm text-gray-800 truncate">{part.name}</h3>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-xs text-gray-500 capitalize">{part.type}</span>
                                                <span className="text-xs font-bold">{formatCurrency(part.price)}</span>
                                            </div>
                                            {part.stock !== undefined && (
                                                <div className="text-[10px] mt-1 text-gray-500">Kho: <span className="font-medium">{part.stock}</span></div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="bg-white p-2 rounded-full hover:bg-gray-100 text-blue-600">✏️</button>
                                                <button onClick={() => handleDeleteProduct(part.id)} className="bg-white p-2 rounded-full hover:bg-gray-100 text-red-600">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeProductSubTab === 'backgrounds' && (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-4">
                                        <input 
                                            placeholder="Tìm background..." 
                                            value={bgSearch} 
                                            onChange={e => setBgSearch(e.target.value)} 
                                            className="border border-gray-300 rounded-lg px-4 py-2 w-64 text-sm"
                                        />
                                        <select value={bgTypeFilter} onChange={(e: any) => setBgTypeFilter(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm">
                                            <option value="all">Tất cả loại khung</option>
                                            <option value="square">Vuông</option>
                                            <option value="rectangle">Chữ nhật</option>
                                        </select>
                                        <select value={bgCategoryFilter} onChange={e => setBgCategoryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm">
                                            {bgCategories.map(c => <option key={c} value={c}>{c === 'all' ? 'Tất cả danh mục' : c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={handleSeedBackgrounds} disabled={loading} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium text-sm">
                                            Reset BGs
                                        </button>
                                        <button onClick={() => setIsEditingBackground(true)} className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 font-bold text-sm">
                                            + Thêm Background
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {filteredBackgrounds.map(bg => (
                                        <div key={bg.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group relative">
                                            <div className="aspect-[4/5] bg-gray-100 relative">
                                                <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                                                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm uppercase">{bg.type}</div>
                                            </div>
                                            <div className="p-3">
                                                <h3 className="font-bold text-sm truncate">{bg.name}</h3>
                                                <p className="text-xs text-gray-500">{bg.category}</p>
                                            </div>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button onClick={() => { setEditingBg(bg); setIsEditingBackground(true); }} className="bg-white p-2 rounded-full hover:bg-gray-100 text-blue-600">✏️</button>
                                                <button onClick={() => handleDeleteBackground(bg.id)} className="bg-white p-2 rounded-full hover:bg-gray-100 text-red-600">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* CONFIG VIEW */}
                {activeTab === 'config' && (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-6 mb-6 border-b border-gray-200 pb-1">
                            <button onClick={() => setActiveConfigSubTab('general')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeConfigSubTab === 'general' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                Cấu hình chung
                            </button>
                            <button onClick={() => setActiveConfigSubTab('templates')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeConfigSubTab === 'templates' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                Mẫu bộ sưu tập
                            </button>
                            <button onClick={() => setActiveConfigSubTab('feedbacks')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeConfigSubTab === 'feedbacks' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                Feedbacks
                            </button>
                        </div>

                        {activeConfigSubTab === 'general' && (
                            <div className="max-w-2xl space-y-8">
                                <ConfigImageUpload 
                                    label="Logo Thương Hiệu"
                                    description="Ảnh logo hiển thị ở Header (Khuyên dùng PNG trong suốt)."
                                    currentUrl={storeConfig.logoUrl}
                                    isUploading={uploadingField === 'logoUrl'}
                                    onUpload={(f) => handleConfigUpload(f, 'logoUrl')}
                                />
                                <ConfigImageUpload 
                                    label="Favicon (Icon Tab trình duyệt)"
                                    description="Ảnh icon nhỏ hiển thị trên tab (32x32 hoặc 64x64)."
                                    currentUrl={storeConfig.faviconUrl}
                                    isUploading={uploadingField === 'faviconUrl'}
                                    onUpload={(f) => handleConfigUpload(f, 'faviconUrl')}
                                />
                                <ConfigImageUpload 
                                    label="Hero Banner (Trang chủ)"
                                    description="Ảnh banner lớn đầu tiên khi vào trang chủ."
                                    currentUrl={storeConfig.heroImageUrl}
                                    isUploading={uploadingField === 'heroImageUrl'}
                                    onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')}
                                />
                                <ConfigImageUpload 
                                    label="Inspiration Banner (Giữa trang)"
                                    description="Ảnh nền cho phần Slider sản phẩm nổi bật."
                                    currentUrl={storeConfig.inspireImageUrl}
                                    isUploading={uploadingField === 'inspireImageUrl'}
                                    onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')}
                                />
                            </div>
                        )}

                        {activeConfigSubTab === 'templates' && (
                            <div>
                                <div className="flex justify-end gap-3 mb-4">
                                    <button onClick={handleSeedTemplates} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Reset Mặc định</button>
                                    <button onClick={() => setIsEditingTemplate(true)} className="bg-black text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800 font-bold">+ Thêm Mẫu</button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {templates.map(tpl => (
                                        <div key={tpl.id} className="bg-white p-3 rounded-lg border border-gray-200 group relative">
                                            <img src={tpl.imageUrl} className="w-full aspect-square object-cover rounded mb-2" />
                                            <h4 className="font-bold text-sm">{tpl.name}</h4>
                                            <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button onClick={() => { setEditingTemplate(tpl); setIsEditingTemplate(true); }} className="bg-white p-2 rounded-full text-blue-600">✏️</button>
                                                <button onClick={() => handleDeleteTemplate(tpl.id)} className="bg-white p-2 rounded-full text-red-600">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeConfigSubTab === 'feedbacks' && (
                            <div>
                                <div className="flex justify-end gap-3 mb-4">
                                    <button onClick={handleSeedFeedbacks} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Reset Mặc định</button>
                                    <button onClick={() => setIsEditingFeedback(true)} className="bg-black text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800 font-bold">+ Thêm Feedback</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {feedbacks.map(fb => (
                                        <div key={fb.id} className="bg-white p-4 rounded-lg border border-gray-200 flex gap-4 group relative">
                                            <img src={fb.imageUrl} className="w-16 h-16 rounded object-cover flex-shrink-0" />
                                            <div>
                                                <h4 className="font-bold text-sm">{fb.name}</h4>
                                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">"{fb.text}"</p>
                                            </div>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button onClick={() => { setEditingFeedback(fb); setIsEditingFeedback(true); }} className="text-blue-600 bg-blue-50 p-1 rounded">✏️</button>
                                                <button onClick={() => handleDeleteFeedback(fb.id)} className="text-red-600 bg-red-50 p-1 rounded">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* --- MODAL: ORDER DETAIL --- */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50 animate-slide-in">
                    <div className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-start bg-gray-50">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-bold text-gray-900">Đơn {selectedOrder.id}</h2>
                                    <StatusDropdown 
                                        currentStatus={selectedOrder.status} 
                                        onStatusChange={(s) => handleUpdate(selectedOrder.id, { status: s })} 
                                        onDelete={handleDeleteOrder}
                                        isAdmin={role === 'admin'}
                                    />
                                </div>
                                <p className="text-sm text-gray-500">Đặt lúc: {formatDateTime(selectedOrder.createdAt)}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-700 p-2">✕</button>
                        </div>

                        <div className="p-6 flex-grow space-y-8">
                            {/* Admin Tools */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú nội bộ</label>
                                    <textarea 
                                        value={noteInput} 
                                        onChange={(e) => setNoteInput(e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded text-sm h-20 bg-yellow-50 focus:bg-white transition-colors"
                                        placeholder="Lưu ý cho đơn này..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deadline xử lý</label>
                                    <input 
                                        type="date" 
                                        value={adminDeadlineInput} 
                                        onChange={(e) => setAdminDeadlineInput(e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                    />
                                    <div className="mt-2 flex items-center gap-2">
                                        <label className="flex items-center gap-2 text-sm font-bold text-red-600 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedOrder.isUrgent || false} 
                                                onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked })}
                                                className="rounded text-red-600 focus:ring-red-500"
                                            />
                                            Đơn gấp!
                                        </label>
                                    </div>
                                </div>
                                <div className="col-span-2 flex justify-end">
                                    <button onClick={handleSaveAdminInfo} className="text-xs font-bold text-blue-600 hover:underline">Lưu ghi chú & Deadline</button>
                                </div>
                            </div>

                            {/* Shipping Control - NEW INTEGRATION */}
                            <ShippingControl order={selectedOrder} onUpdateOrder={(u) => handleUpdate(selectedOrder.id, u, false)} />

                            <div className="grid grid-cols-2 gap-8 border-t border-gray-100 pt-6">
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span>👤</span> Khách hàng
                                    </h3>
                                    <div className="space-y-3 text-sm">
                                        <p><span className="text-gray-500 w-24 inline-block">Họ tên:</span> <span className="font-medium">{selectedOrder.customer.name}</span></p>
                                        <p><span className="text-gray-500 w-24 inline-block">SĐT:</span> <span className="font-medium font-mono">{selectedOrder.customer.phone}</span></p>
                                        <p><span className="text-gray-500 w-24 inline-block">Email:</span> <span className="font-medium">{selectedOrder.customer.email}</span></p>
                                        <p><span className="text-gray-500 w-24 inline-block">Địa chỉ:</span> <span className="font-medium">{selectedOrder.customer.address}</span></p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span>🚚</span> Giao hàng
                                    </h3>
                                    <div className="space-y-3 text-sm">
                                        <p><span className="text-gray-500 w-32 inline-block">Ngày muốn nhận:</span> <span className="font-bold text-green-600">{formatDate(selectedOrder.delivery.date)}</span></p>
                                        <p><span className="text-gray-500 w-32 inline-block">ĐVVC:</span> <span>{selectedOrder.shipping.method === 'express' ? 'Hỏa tốc' : selectedOrder.shipping.method === 'bookship' ? 'Tự book ship' : 'Tiêu chuẩn'}</span></p>
                                        <p><span className="text-gray-500 w-32 inline-block">Ghi chú khách:</span> <span className="italic text-gray-600">{selectedOrder.delivery.notes || 'Không có'}</span></p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <span>🛍️</span> Sản phẩm
                                </h3>
                                <div className="space-y-4">
                                    {selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <div className="w-24 h-24 bg-white rounded border p-1 flex-shrink-0">
                                                <img src={item.previewImageUrl} alt="Design" className="w-full h-full object-contain" />
                                            </div>
                                            <div className="flex-grow">
                                                <h4 className="font-bold text-sm">Khung {item.frameId} - {item.characters.length} nhân vật</h4>
                                                <p className="text-xs text-gray-500 mt-1">Nền: {item.background.type === 'color' ? item.background.value : 'Ảnh upload/mẫu'}</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {item.characters.map((char, cIdx) => (
                                                        <span key={cIdx} className="text-[10px] bg-white px-2 py-1 rounded border text-gray-600">
                                                            NV{cIdx + 1}: {char.hair?.name}, {char.shirt?.name}...
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-6 bg-gray-50 -mx-6 px-6 py-6 mt-4">
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-gray-500">Tạm tính</span>
                                    <span className="font-medium">{formatCurrency(selectedOrder.totalPrice - selectedOrder.shipping.fee - (selectedOrder.addGiftBox ? 30000 : 0))}</span>
                                </div>
                                {selectedOrder.addGiftBox && (
                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-gray-500">Hộp quà</span>
                                        <span className="font-medium">{formatCurrency(30000)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-sm mb-4">
                                    <span className="text-gray-500">Phí vận chuyển</span>
                                    <span className="font-medium">{formatCurrency(selectedOrder.shipping.fee)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xl font-bold text-gray-900 pt-4 border-t border-gray-200">
                                    <span>Tổng cộng</span>
                                    <span>{formatCurrency(selectedOrder.totalPrice)}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm text-gray-500">Cần thanh toán ({selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Full'})</span>
                                    <span className="text-lg font-bold text-red-600">{formatCurrency(selectedOrder.amountToPay)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0 flex justify-between items-center">
                            {/* Warehouse Actions */}
                            <div>
                                {role === 'warehouse' && selectedOrder.status === 'Đang đóng hàng' && (
                                    <button onClick={handleMarkAsPacked} className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700">
                                        ✓ Xác nhận đã đóng gói
                                    </button>
                                )}
                                {selectedOrder.packedBy && (
                                    <p className="text-xs text-green-600 font-medium">
                                        Đóng gói bởi: {selectedOrder.packedBy.split('@')[0]} lúc {formatDateTime(selectedOrder.packedAt!)}
                                    </p>
                                )}
                            </div>
                            {/* Standard Actions */}
                            <div className="flex gap-3">
                                <button className="px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50">In đơn hàng</button>
                                <button onClick={() => setSelectedOrder(null)} className="px-6 py-2 bg-gray-900 text-white rounded font-bold hover:bg-black">Đóng</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS FOR FORMS */}
            {isEditingProduct && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={() => { setIsEditingProduct(false); setEditingPart(null); }} />}
            {isEditingBackground && <BackgroundForm initialData={editingBg} onSave={handleSaveBackground} onCancel={() => { setIsEditingBackground(false); setEditingBg(null); }} />}
            {isEditingTemplate && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={() => { setIsEditingTemplate(false); setEditingTemplate(null); }} />}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};

export default AdminPage;
