
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds } from '../services/backgroundService';
import { uploadToCloudinary } from '../services/uploadService'; // Import hàm upload
import { updateStoreConfig, getStoreConfig } from '../services/configService'; // Import config service
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem, PresetBackground, OutfitColor } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../constants';

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
        setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
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

// --- COMPONENT: FORM BACKGROUND (MODAL) ---
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

// --- ADMIN PAGE ---
const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [backgrounds, setBackgrounds] = useState<PresetBackground[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Mobile menu
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Edit Mode State
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);
    const [addingAccessoryToItemIndex, setAddingAccessoryToItemIndex] = useState<number | null>(null);

    // Role Check
    const role = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        const ADMIN_EMAILS = ['jinbduong@gmail.com']; 
        if (ADMIN_EMAILS.includes(currentUser.email) || currentUser.email.includes('admin')) {
            return 'admin';
        }
        return 'warehouse';
    }, [currentUser]);

    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'backgrounds' | 'settings'>('dashboard');

    // Time Filters
    const [filterType, setFilterType] = useState<'period' | 'month'>('period');
    const [period, setPeriod] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');
    const [month, setMonth] = useState<number>(new Date().getMonth()); // 0-11
    const [year, setYear] = useState<number>(new Date().getFullYear());

    // Inputs & Search for PRODUCTS
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');

    // Inputs & Search for BACKGROUNDS
    const [isEditingBackground, setIsEditingBackground] = useState(false);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [bgSearch, setBgSearch] = useState('');
    const [bgTypeFilter, setBgTypeFilter] = useState<'all' | 'square' | 'rectangle'>('all');
    const [bgCategoryFilter, setBgCategoryFilter] = useState<string>('all');

    // Order Details Inputs
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Configuration State
    const [configLogo, setConfigLogo] = useState<string>('');
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchOrders();
                fetchProducts();
                fetchBackgrounds();
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
    const fetchConfig = async () => {
        const cfg = await getStoreConfig();
        if (cfg && cfg.logoUrl) setConfigLogo(cfg.logoUrl);
    }
    
    const handleSeedData = async () => { if (confirm("Thao tác này sẽ reset database về mặc định. Tiếp tục?")) { setLoading(true); await seedDatabase(); setLoading(false); fetchProducts(); } };
    const handleSeedBackgrounds = async () => { if (confirm("Reset backgrounds về mặc định?")) { setLoading(true); await seedBackgrounds(); setLoading(false); fetchBackgrounds(); } };
    
    const handleSaveProduct = async (part: LegoPart) => { setIsEditingProduct(false); if (editingPart) await updatePart(part.id, part); else await addPart(part); fetchProducts(); setEditingPart(null); };
    const handleDeleteProduct = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deletePart(id); fetchProducts(); } };
    
    const handleSaveBackground = async (bg: PresetBackground) => { setIsEditingBackground(false); if (editingBg) await updateBackground(bg.id, bg); else await addBackground(bg); fetchBackgrounds(); setEditingBg(null); };
    const handleDeleteBackground = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteBackground(id); fetchBackgrounds(); } };

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

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploadingLogo(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setConfigLogo(url);
                    await updateStoreConfig({ logoUrl: url });
                    alert("Đã cập nhật logo thành công!");
                } else {
                    alert("Lỗi upload logo.");
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload logo.");
            } finally {
                setIsUploadingLogo(false);
            }
        }
    };

    // DRAG SCROLL IMPLEMENTATION
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
        const walk = (x - startX) * 1.5; // Scroll speed multiplier
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };


    // --- PRICE CALCULATION LOGIC ---
    const calculateOrderPrice = (order: Order, allParts: LegoPart[]) => {
        let subtotal = 0;
        const partLookup = allParts.reduce((acc, p) => ({...acc, [p.id]: p}), {} as Record<string, LegoPart>);

        order.items.forEach(item => {
            const frame = FRAME_OPTIONS.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
            subtotal += frame.price;
            
            // Characters
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

            // Accessories/Pets
            item.draggableItems.forEach(di => {
                if (di.type !== 'charm' && partLookup[di.partId]) {
                     subtotal += partLookup[di.partId].price;
                }
            });
        });

        const giftBoxFee = order.addGiftBox ? 30000 : 0;
        const shippingFee = order.shipping.fee || 0;
        const totalPrice = subtotal + giftBoxFee + shippingFee;
        
        // Recalculate amount to pay based on payment method
        let amountToPay = totalPrice;
        if (order.payment.method === 'deposit') {
            amountToPay = Math.round(totalPrice * 0.7);
        }

        return { totalPrice, amountToPay };
    };

    // --- EDIT ORDER LOGIC EXTENDED ---
    const startEditingOrder = () => {
        if (!selectedOrder) return;
        setEditForm(JSON.parse(JSON.stringify(selectedOrder))); // Deep copy to avoid ref issues
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
                 newOrder = updateEditFormWithPrice(newOrder); // Recalculate price
            } else if (nestedField && field === 'customer') {
                newOrder.customer = { ...newOrder.customer, [nestedField]: value };
            } else if (field === 'delivery' && nestedField) {
                newOrder.delivery = { ...newOrder.delivery, [nestedField]: value };
            } else {
                // Direct field update (e.g., manual price override)
                (newOrder as any)[field] = value;
            }
            return newOrder;
        });
    };

    const handleAddCharacter = (itemIndex: number) => {
        if (!editForm) return;
        
        // Default empty character
        const newChar: LegoCharacterConfig = {
            id: Date.now(),
            x: 50, y: 50, rotation: 0, scale: 1,
            // Default parts will be undefined, allowing selection via dropdowns
        };

        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            // Append new char
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
            // Filter out char
            const newChars = newItems[itemIndex].characters.filter((_, i) => i !== charIndex);
            newItems[itemIndex] = { ...newItems[itemIndex], characters: newChars };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder);
        });
    };

    const handleCharacterChange = (itemIndex: number, charIndex: number, partType: keyof LegoCharacterConfig, partId: string) => {
        if (!editForm) return;
        
        const selectedPart = products.find(p => p.id === partId);
        // Allow selecting "None" (empty string)
        
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const newCharacters = [...newItems[itemIndex].characters];
            
            if (partId === "") {
                 newCharacters[charIndex] = { ...newCharacters[charIndex], [partType]: undefined };
            } else if (selectedPart) {
                 newCharacters[charIndex] = { ...newCharacters[charIndex], [partType]: selectedPart };
                 // Reset color if changing part
                 if (partType === 'shirt') newCharacters[charIndex].selectedShirtColor = selectedPart.colors?.[0];
                 if (partType === 'pants') newCharacters[charIndex].selectedPantsColor = selectedPart.colors?.[0];
            }

            newItems[itemIndex] = { ...newItems[itemIndex], characters: newCharacters };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder); // Recalculate price
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
            return updateEditFormWithPrice(newOrder); // Recalculate price
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
             return updateEditFormWithPrice(newOrder); // Recalculate price
        });
        setAddingAccessoryToItemIndex(null);
    };

    // --- DISPLAY HELPERS ---
    const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');
    const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN');

    // --- WAREHOUSE ACTION ---
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

    // NEW: Combine fetched products with static fallback parts to ensure names always resolve
    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; // DB parts override default if ID matches
    }, [products]);


    // --- ANALYTICS LOGIC (Enhanced for specific Charms) ---
    const analytics = useMemo(() => {
        let start: Date, end: Date, prevStart: Date, prevEnd: Date;
        let dateLabel = '';

        if (filterType === 'month') {
            dateLabel = `Tháng ${month + 1}/${year}`;
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23, 59, 59, 999);
            
            // Previous month for comparison
            prevStart = new Date(year, month - 1, 1);
            prevEnd = new Date(year, month, 0, 23, 59, 59, 999);
        } else {
            // Period mode
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
            charms: {} as Record<string, number>, 
            totalCharms: 0,
            parts: { hair: 0, face: 0, shirt: 0, pants: 0, hat: 0 } 
        };
        const packerStats: Record<string, number> = {};

        currentOrders.forEach(order => {
            if (order.packedBy) packerStats[order.packedBy] = (packerStats[order.packedBy] || 0) + 1;
            order.items.forEach(item => {
                const frame = FRAME_OPTIONS.find(f => f.id === item.frameId);
                const frameName = frame ? `Khung ${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                
                item.draggableItems.forEach(di => {
                    let itemName = '';
                    if (di.type === 'charm') {
                        itemName = 'Charm Upload (Ảnh)';
                        inventory.totalCharms++;
                    } else {
                        const part = allKnownParts[di.partId];
                        if (part) {
                             itemName = `${part.name} (${part.type})`;
                             if (di.type === 'accessory' || di.type === 'pet') inventory.totalCharms++;
                        } else {
                            itemName = `Unknown Item (${di.partId})`;
                        }
                    }
                    
                    if (itemName) {
                        inventory.charms[itemName] = (inventory.charms[itemName] || 0) + 1;
                    }
                });

                item.characters.forEach(char => {
                    if (char.hair) inventory.parts.hair++;
                    if (char.face) inventory.parts.face++;
                    if (char.shirt) inventory.parts.shirt++;
                    if (char.pants) inventory.parts.pants++;
                    if (char.hat) inventory.parts.hat++;
                });
            });
        });

        const packers = Object.entries(packerStats).map(([email, count]) => ({ email, count })).sort((a, b) => b.count - a.count);

        return { revenue, revenueGrowth, orderCount, orderGrowth, inventory, packers, dateLabel };
    }, [orders, filterType, period, month, year, allKnownParts]); 

    // --- FILTERING LOGIC ---
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
        // FILTER BY STATUS
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

    // --- DROPDOWN DATA FOR EDIT ---
    const partsByType = useMemo(() => {
        const types: Record<string, LegoPart[]> = {};
        products.forEach(p => {
            if (!types[p.type]) types[p.type] = [];
            types[p.type].push(p);
        });
        return types;
    }, [products]);

    // Generate VietQR Link
    const getVietQR = (order: Order) => {
        const BANK_ID = '970407'; // Techcombank ID (970407) or ShortName (TCB)
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2'; // or 'compact'
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        const amount = order.amountToPay || order.totalPrice;
        
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };


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
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <button className="md:hidden text-gray-700" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                        </button>
                        <div className="text-xl font-bold tracking-tight">The Luvin <span className="font-normal text-gray-400">| {role === 'admin' ? 'Quản lý' : 'Kho vận'}</span></div>
                        <nav className="hidden md:flex gap-1">
                             <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Dashboard</button>
                            <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Đơn hàng</button>
                            {role === 'admin' && (
                                <>
                                    <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Sản phẩm</button>
                                    <button onClick={() => setActiveTab('backgrounds')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'backgrounds' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Hình nền</button>
                                    <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Cấu hình</button>
                                </>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 font-medium hidden sm:block">{currentUser.email}</span>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 text-sm font-medium transition-colors">Đăng xuất</button>
                    </div>
                </div>
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-2 shadow-lg">
                        <button onClick={() => {setActiveTab('dashboard'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Dashboard</button>
                        <button onClick={() => {setActiveTab('orders'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Đơn hàng</button>
                        {role === 'admin' && (
                            <>
                                <button onClick={() => {setActiveTab('products'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Sản phẩm</button>
                                <button onClick={() => {setActiveTab('backgrounds'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Hình nền</button>
                                <button onClick={() => {setActiveTab('settings'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Cấu hình</button>
                            </>
                        )}
                    </div>
                )}
            </header>

            <main className="max-w-[1600px] mx-auto py-8 px-4 sm:px-6">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex flex-col sm:flex-row justify-end items-center space-y-2 sm:space-y-0 sm:space-x-4 bg-white p-3 rounded-lg border shadow-sm w-fit ml-auto">
                            {/* Filter Type Toggle */}
                            <div className="flex bg-gray-100 p-1 rounded-md">
                                <button 
                                    onClick={() => setFilterType('period')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'period' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Nhanh
                                </button>
                                <button 
                                    onClick={() => setFilterType('month')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Tháng
                                </button>
                            </div>

                            {filterType === 'period' ? (
                                <div className="flex gap-2">
                                    {(['today', 'yesterday', '7days', '30days'] as const).map(t => (
                                        <button key={t} onClick={() => setPeriod(t)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors border ${period === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{t === 'today' ? 'Hôm nay' : t === 'yesterday' ? 'Hôm qua' : t === '7days' ? '7 ngày' : '30 ngày'}</button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex gap-2 items-center">
                                    <select 
                                        value={month} 
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                        className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700 focus:ring-0 focus:border-gray-900 outline-none"
                                    >
                                        {Array.from({length: 12}, (_, i) => (
                                            <option key={i} value={i}>Tháng {i + 1}</option>
                                        ))}
                                    </select>
                                    <select 
                                        value={year} 
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700 focus:ring-0 focus:border-gray-900 outline-none"
                                    >
                                        <option value={2024}>2024</option>
                                        <option value={2025}>2025</option>
                                        <option value={2026}>2026</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {role === 'admin' && (
                                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doanh thu</p><span className={`text-xs font-bold flex items-center ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.revenueGrowth).toFixed(1)}%</span></div>
                                    <p className="text-3xl font-light text-gray-900">{formatCurrency(analytics.revenue)}</p>
                                    <p className="text-xs text-gray-400 mt-2">So với kỳ trước</p>
                                </div>
                            )}
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn hàng</p><span className={`text-xs font-bold flex items-center ${analytics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.orderGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.orderGrowth).toFixed(1)}%</span></div>
                                <p className="text-3xl font-light text-gray-900">{analytics.orderCount}</p>
                                <p className="text-xs text-gray-400 mt-2">So với kỳ trước</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tổng Charm</p>
                                <p className="text-3xl font-light text-gray-900">{analytics.inventory.totalCharms}</p>
                                <p className="text-xs text-gray-400 mt-2">Trong {analytics.dateLabel.toLowerCase()}</p>
                            </div>
                             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Hiệu suất đóng gói</p>
                                <div className="flex items-end gap-2"><p className="text-3xl font-light text-gray-900">{analytics.packers.length > 0 ? analytics.packers[0].count : 0}</p><p className="text-sm font-medium text-gray-600 mb-1 truncate w-24">{analytics.packers.length > 0 ? analytics.packers[0].email.split('@')[0] : 'N/A'}</p></div>
                                <p className="text-xs text-gray-400 mt-2">Top 1 nhân viên kho</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-800">Chi tiết vật tư tiêu hao ({analytics.dateLabel})</h3></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="px-4 py-3">Loại</th><th className="px-4 py-3 text-right">Số lượng</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {Object.entries(analytics.inventory.frames).map(([frameId, count]) => (<tr key={frameId}><td className="px-4 py-3 font-medium text-gray-700">{frameId}</td><td className="px-4 py-3 text-right font-mono">{count}</td></tr>))}
                                            
                                            {/* Display Specific Charms */}
                                            {Object.entries(analytics.inventory.charms).map(([charmName, count]) => (
                                                <tr key={charmName} className="bg-blue-50/30">
                                                    <td className="px-4 py-3 text-gray-600 text-xs pl-8">• {charmName}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{count}</td>
                                                </tr>
                                            ))}

                                            {Object.entries(analytics.inventory.parts).map(([partType, count]) => (<tr key={partType}><td className="px-4 py-3 font-medium text-gray-500 capitalize">Lego: {partType}</td><td className="px-4 py-3 text-right font-mono">{count}</td></tr>))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-fit">
                                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-800">BXH Đóng gói</h3></div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="px-4 py-3">Nhân viên</th><th className="px-4 py-3 text-right">SL Đơn</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {analytics.packers.length > 0 ? analytics.packers.map((p, i) => (<tr key={p.email}><td className="px-4 py-3 flex items-center gap-2"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200'}`}>{i + 1}</span><span className="truncate w-32" title={p.email}>{p.email.split('@')[0]}</span></td><td className="px-4 py-3 text-right font-bold">{p.count}</td></tr>)) : (<tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">Chưa có dữ liệu</td></tr>)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'orders' && (
                     <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
                        <div className={`lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2 flex-col">
                                <div className="flex gap-2 w-full">
                                    <button onClick={() => setSortMode('newest')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'newest' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>Mới nhất</button>
                                    <button onClick={() => setSortMode('urgent')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'urgent' ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-500 hover:text-gray-900'}`}>Cần gấp</button>
                                </div>
                                {/* Added Drag to Scroll Ref and Events */}
                                <div 
                                    className="flex gap-1 overflow-x-auto no-scrollbar pb-1 cursor-grab active:cursor-grabbing"
                                    ref={scrollContainerRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseLeave={handleMouseLeave}
                                    onMouseUp={handleMouseUp}
                                    onMouseMove={handleMouseMove}
                                >
                                    <button 
                                        onClick={() => setFilterStatus('all')}
                                        className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}
                                    >
                                        Tất cả
                                    </button>
                                    {STATUS_CONFIG.filter(s => !s.isAction).map(status => (
                                        <button
                                            key={status.label}
                                            onClick={() => setFilterStatus(status.label)}
                                            className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === status.label ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}
                                        >
                                            {status.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                                {sortedOrders.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        Không có đơn hàng nào.
                                    </div>
                                ) : sortedOrders.map(order => (
                                    <div key={order.id} onClick={() => { setSelectedOrder(order); setIsEditingOrder(false); }} className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-gray-50' : ''}`}>
                                        <div className="flex justify-between items-start mb-1"><span className={`font-mono font-medium ${order.isUrgent ? 'text-red-600' : 'text-gray-900'}`}>{order.id}</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{order.status}</span></div>
                                        <div className="flex justify-between items-center"><p className="text-sm text-gray-600 truncate max-w-[150px]">{order.customer.name}</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalPrice)}</p></div>
                                        <div className="flex justify-between items-center mt-1"><p className="text-xs text-gray-400">{order.createdAt ? formatDateTime(order.createdAt) : '---'}</p>{(order.adminDeadline || order.delivery.date) && (<p className="text-xs text-gray-500">{order.adminDeadline ? `DL: ${formatDate(order.adminDeadline)}` : `Giao: ${formatDate(order.delivery.date)}`}</p>)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`lg:w-2/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                            {selectedOrder ? (
                                <div className="flex flex-col h-full">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
                                        <div className="flex items-start gap-2">
                                            <button onClick={() => setSelectedOrder(null)} className="lg:hidden text-gray-500 mr-2">←</button>
                                            <div>
                                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">{selectedOrder.id}{selectedOrder.isUrgent && <span className="text-red-500 text-lg" title="Đơn gấp">🔥</span>}</h2>
                                                <p className="text-sm text-gray-500 mt-1">Đặt lúc: {selectedOrder.createdAt ? formatDateTime(selectedOrder.createdAt) : '---'}</p>
                                                {selectedOrder.packedBy && (<p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1"><span>✓</span>Đã đóng gói bởi {selectedOrder.packedBy} lúc {selectedOrder.packedAt ? new Date(selectedOrder.packedAt).toLocaleTimeString('vi-VN') : ''}</p>)}
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
                                                    {/* QR Code Payment */}
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
                                                                {isEditingOrder && editForm ? (
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="font-bold text-gray-800 text-sm">Khung:</span>
                                                                        <select className="border rounded p-1 text-sm" value={item.frameId} onChange={e => handleEditFormChange('items', e.target.value, 'frameId', idx)}>
                                                                            {FRAME_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                ) : (
                                                                    <p className="font-bold text-gray-800 mb-1">Khung {item.frameId.toUpperCase()}</p>
                                                                )}
                                                                <p className="text-xs text-gray-500">Nền: {item.background.type === 'color' ? item.background.value : 'Hình ảnh'}</p>
                                                            </div>

                                                            {/* Detailed Characters */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                                {item.characters.map((char, charIdx) => (
                                                                    <div key={char.id} className="bg-gray-50 p-2 rounded border border-gray-200 text-xs relative">
                                                                        <p className="font-bold text-gray-700 mb-1">Nhân vật {charIdx + 1}</p>
                                                                        {isEditingOrder && editForm && (
                                                                            <button 
                                                                                onClick={() => handleRemoveCharacter(idx, charIdx)} 
                                                                                className="absolute top-1 right-1 text-red-500 hover:text-red-700 font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-100"
                                                                                title="Xóa nhân vật"
                                                                            >
                                                                                &times;
                                                                            </button>
                                                                        )}
                                                                        {isEditingOrder && editForm ? (
                                                                            <div className="space-y-1">
                                                                                {(['hair', 'face', 'shirt', 'pants', 'hat'] as const).map(partType => (
                                                                                    <div key={partType} className="flex justify-between items-center">
                                                                                        <span className="capitalize w-10 text-gray-500">{partType === 'hair' ? 'Tóc' : partType === 'face' ? 'Mặt' : partType === 'shirt' ? 'Áo' : partType === 'pants' ? 'Quần' : 'Mũ'}</span>
                                                                                        <select 
                                                                                            className="border rounded p-0.5 w-28 text-[10px]" 
                                                                                            value={char[partType]?.id || ''}
                                                                                            onChange={(e) => handleCharacterChange(idx, charIdx, partType, e.target.value)}
                                                                                        >
                                                                                            <option value="">Không</option>
                                                                                            {partsByType[partType]?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                                        </select>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <ul className="space-y-0.5 text-gray-600">
                                                                                <li>Tóc: {char.hair?.name || '-'}</li>
                                                                                <li>Mặt: {char.face?.name || '-'}</li>
                                                                                <li>Áo: {char.shirt?.name || '-'} {char.selectedShirtColor ? `(${char.selectedShirtColor.name})` : ''}</li>
                                                                                <li>Quần: {char.pants?.name || '-'} {char.selectedPantsColor ? `(${char.selectedPantsColor.name})` : ''}</li>
                                                                                <li>Mũ: {char.hat?.name || '-'}</li>
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {isEditingOrder && editForm && (
                                                                    <div className="flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded h-full min-h-[100px]">
                                                                        <button 
                                                                            onClick={() => handleAddCharacter(idx)}
                                                                            className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-2 rounded hover:bg-blue-100"
                                                                        >
                                                                            + Thêm nhân vật
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Draggable Items (Accessories/Pets) */}
                                                            <div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <p className="text-xs font-bold text-gray-600">Phụ kiện & Thú cưng</p>
                                                                    {isEditingOrder && (
                                                                        <button onClick={() => setAddingAccessoryToItemIndex(addingAccessoryToItemIndex === idx ? null : idx)} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold hover:bg-blue-100">+ Thêm</button>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* Add Accessory UI */}
                                                                {isEditingOrder && addingAccessoryToItemIndex === idx && (
                                                                    <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-100">
                                                                        <p className="text-[10px] font-bold text-blue-800 mb-1">Chọn vật phẩm thêm:</p>
                                                                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                                                            {[...(partsByType.accessory || []), ...(partsByType.pet || [])].map(part => (
                                                                                <button 
                                                                                    key={part.id} 
                                                                                    onClick={() => handleAddDraggable(idx, part)}
                                                                                    className="text-[10px] border bg-white px-1 rounded hover:border-blue-500"
                                                                                >
                                                                                    {part.name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="flex flex-wrap gap-1">
                                                                    {item.draggableItems.length > 0 ? item.draggableItems.map((di, diIdx) => {
                                                                        const part = products.find(p => p.id === di.partId);
                                                                        return (
                                                                            <span key={di.id} className="bg-gray-100 px-2 py-1 rounded text-xs border flex items-center gap-1">
                                                                                {di.type === 'charm' ? 'Charm (Ảnh)' : (part?.name || 'Unknown')}
                                                                                {isEditingOrder && (
                                                                                    <button onClick={() => handleRemoveDraggable(idx, diIdx)} className="text-red-500 hover:bg-red-100 rounded-full w-4 h-4 flex items-center justify-center font-bold">×</button>
                                                                                )}
                                                                            </span>
                                                                        );
                                                                    }) : <span className="text-xs text-gray-400 italic">Không có</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2 justify-end items-center">
                                        {role === 'warehouse' && !selectedOrder.packedBy && selectedOrder.status !== 'Đã giao hàng' && (
                                            <button onClick={handleMarkAsPacked} className="mr-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-md transition-colors flex items-center gap-2"><span>✓</span>Xác nhận đã đóng gói</button>
                                        )}
                                        <StatusDropdown currentStatus={selectedOrder.status} onStatusChange={(st) => handleUpdate(selectedOrder.id, { status: st })} onDelete={handleDeleteOrder} isAdmin={role === 'admin'} />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2"><span className="text-4xl opacity-20">📦</span><span>Chọn đơn hàng để xem chi tiết</span></div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'products' && role === 'admin' && (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-140px)] animate-fade-in">
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2"><h2 className="text-lg font-bold text-gray-900">Kho Sản phẩm</h2><span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">{products.length}</span></div>
                            <div className="flex flex-grow md:flex-grow-0 gap-3 w-full md:w-auto">
                                <input type="text" placeholder="Tìm kiếm..." className="p-2 border border-gray-300 rounded text-sm w-full md:w-64 focus:border-gray-900 focus:ring-0 outline-none" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                                <select className="p-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:ring-0 outline-none" value={productCategory} onChange={e => setProductCategory(e.target.value)}><option value="all">Tất cả danh mục</option><option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option></select>
                                <button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-black whitespace-nowrap shadow-sm">Thêm mới</button>
                            </div>
                        </div>
                        <div className="flex-grow overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm"><tr><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">Hình ảnh</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Tên sản phẩm</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Loại</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Giá</th><th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Thao tác</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.length > 0 ? filteredProducts.map(part => (<tr key={part.id} className="hover:bg-gray-50 transition-colors group"><td className="p-3 border-b border-gray-100"><div className="w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden"><img src={part.imageUrl} alt="" className="w-full h-full object-contain" /></div></td><td className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900">{part.name}</td><td className="p-3 border-b border-gray-100 text-sm text-gray-500 capitalize">{part.type}</td><td className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900">{formatCurrency(part.price)}</td><td className="p-3 border-b border-gray-100 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">Sửa</button><button onClick={() => handleDeleteProduct(part.id)} className="text-xs font-bold text-red-600 hover:underline bg-red-50 px-2 py-1 rounded">Xóa</button></div></td></tr>)) : (
                                        products.length > 0 ? (<tr><td colSpan={5} className="p-10 text-center text-gray-400 text-sm">Không tìm thấy sản phẩm nào.</td></tr>) :
                                        (<tr>
                                            <td colSpan={5} className="p-12 text-center">
                                                <div className="flex flex-col items-center justify-center text-gray-400">
                                                     <span className="text-4xl mb-2">🧩</span>
                                                     <p className="text-sm mb-4">Kho sản phẩm đang trống.</p>
                                                     <button onClick={handleSeedData} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors">
                                                         Đồng bộ dữ liệu mẫu
                                                     </button>
                                                </div>
                                            </td>
                                        </tr>)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'backgrounds' && role === 'admin' && (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-140px)] animate-fade-in">
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2"><h2 className="text-lg font-bold text-gray-900">Quản lý Hình nền</h2><span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">{backgrounds.length}</span></div>
                            <div className="flex flex-grow md:flex-grow-0 gap-3 w-full md:w-auto">
                                <input 
                                    type="text" 
                                    placeholder="Tìm kiếm..." 
                                    className="p-2 border border-gray-300 rounded text-sm w-full md:w-48 focus:border-gray-900 focus:ring-0 outline-none" 
                                    value={bgSearch} 
                                    onChange={e => setBgSearch(e.target.value)} 
                                />
                                <select 
                                    className="p-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:ring-0 outline-none"
                                    value={bgTypeFilter}
                                    onChange={e => setBgTypeFilter(e.target.value as any)}
                                >
                                    <option value="all">Tất cả kích thước</option>
                                    <option value="square">Vuông (15x15 / 23x23)</option>
                                    <option value="rectangle">Chữ nhật (A5)</option>
                                </select>
                                <select 
                                    className="p-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:ring-0 outline-none max-w-[150px]"
                                    value={bgCategoryFilter}
                                    onChange={e => setBgCategoryFilter(e.target.value)}
                                >
                                    <option value="all">Tất cả dịp</option>
                                    {bgCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <button onClick={() => { setEditingBg(null); setIsEditingBackground(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-black whitespace-nowrap shadow-sm">Thêm mới</button>
                            </div>
                        </div>
                        <div className="flex-grow overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">Hình ảnh</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Tên</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Loại</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Danh mục</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredBackgrounds.length > 0 ? filteredBackgrounds.map(bg => (
                                        <tr key={bg.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="p-3 border-b border-gray-100">
                                                <div className="w-16 h-20 bg-gray-100 rounded overflow-hidden border border-gray-200">
                                                    <img src={bg.url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            </td>
                                            <td className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900">{bg.name}</td>
                                            <td className="p-3 border-b border-gray-100 text-sm text-gray-500 capitalize">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${bg.type === 'square' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                                    {bg.type === 'square' ? 'Vuông' : 'Chữ nhật'}
                                                </span>
                                            </td>
                                            <td className="p-3 border-b border-gray-100 text-sm text-gray-500">{bg.category}</td>
                                            <td className="p-3 border-b border-gray-100 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingBg(bg); setIsEditingBackground(true); }} className="text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">Sửa</button>
                                                    <button onClick={() => handleDeleteBackground(bg.id)} className="text-xs font-bold text-red-600 hover:underline bg-red-50 px-2 py-1 rounded">Xóa</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        backgrounds.length > 0 ? (<tr><td colSpan={5} className="p-10 text-center text-gray-400 text-sm">Không tìm thấy hình nền nào.</td></tr>) :
                                        (<tr>
                                            <td colSpan={5} className="p-12 text-center">
                                                <div className="flex flex-col items-center justify-center text-gray-400">
                                                     <span className="text-4xl mb-2">🖼️</span>
                                                     <p className="text-sm mb-4">Chưa có hình nền nào trong Database.</p>
                                                     <button onClick={handleSeedBackgrounds} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors">
                                                         Đồng bộ hình nền mẫu
                                                     </button>
                                                </div>
                                            </td>
                                        </tr>)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && role === 'admin' && (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm max-w-2xl mx-auto animate-fade-in p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">Cấu hình Website</h2>
                        
                        <div className="space-y-6">
                            {/* Logo Upload Section */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Logo & Favicon</label>
                                <p className="text-xs text-gray-500 mb-4">Hình ảnh này sẽ được sử dụng làm Logo trên đầu trang và Favicon của trình duyệt.</p>
                                
                                <div className="flex items-start gap-6">
                                    <div className="flex-shrink-0 w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden relative">
                                        {configLogo ? (
                                            <img src={configLogo} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                                        ) : (
                                            <span className="text-xs text-gray-400">Chưa có logo</span>
                                        )}
                                        {isUploadingLogo && (
                                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                <span className="text-xs font-bold text-blue-600 animate-pulse">Uploading...</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-grow">
                                        <div className="relative">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleLogoUpload}
                                                className="hidden" 
                                                id="logo-upload"
                                                disabled={isUploadingLogo}
                                            />
                                            <label 
                                                htmlFor="logo-upload"
                                                className={`inline-block px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${isUploadingLogo ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black'}`}
                                            >
                                                {isUploadingLogo ? 'Đang xử lý...' : 'Tải ảnh mới'}
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">Khuyên dùng ảnh PNG nền trong suốt.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isEditingProduct && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={() => setIsEditingProduct(false)} />}
                {isEditingBackground && <BackgroundForm initialData={editingBg} onSave={handleSaveBackground} onCancel={() => setIsEditingBackground(false)} />}
                {loading && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50"><div className="text-gray-900 font-bold">Đang xử lý...</div></div>}
            </main>
        </div>
    );
};

export default AdminPage;
