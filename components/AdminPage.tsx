
// components/AdminPage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { getAllBackgrounds, addBackground, updateBackground, deleteBackground, seedBackgrounds } from '../services/backgroundService';
import { uploadToCloudinary } from '../services/uploadService'; // Import hàm upload
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem, PresetBackground } from '../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../constants';

// --- CONSTANTS & HELPERS ---

const CHARACTER_BASE_PRICE = 10000;

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
    direction?: 'up' | 'down'; // Control drop direction
}> = ({ currentStatus, onStatusChange, onDelete, isAdmin, direction = 'down' }) => {
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
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm ${currentConfig.color} bg-white border-gray-200 hover:bg-gray-50 whitespace-nowrap`}
            >
                <span>{currentConfig.icon}</span>
                <span>{currentStatus}</span>
                <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <div className={`absolute ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} right-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-[60] overflow-hidden animate-fade-in`}>
                    <div className="p-1 max-h-60 overflow-y-auto">
                        {STATUS_CONFIG.map((status) => {
                            if (status.isAction && !isAdmin) return null;
                            return (
                                <button
                                    key={status.label}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsOpen(false);
                                        if (status.isAction && status.label === 'Xoá đơn' && onDelete) {
                                            onDelete();
                                        } else {
                                            onStatusChange(status.label);
                                        }
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-3 hover:bg-gray-50 transition-colors ${status.label === currentStatus ? 'bg-blue-50 text-blue-600' : 'text-gray-700'} ${status.isAction ? 'text-red-600 hover:bg-red-50' : ''}`}
                                >
                                    <span className="w-5 h-5 flex items-center justify-center bg-gray-100 rounded-md text-[10px]">{status.icon}</span>
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
        id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1
    });
    const [isUploading, setIsUploading] = useState(false);

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
                    alert("Lỗi: Không thể tải ảnh lên Cloudinary. Vui lòng kiểm tra lại 'Cloud Name' và 'Upload Preset' đã chính xác chưa.");
                }
            } catch (error) {
                console.error(error);
                alert("Đã xảy ra lỗi khi tải ảnh.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto border border-gray-100">
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá (VNĐ)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" />
                        </div>
                        
                        {/* --- PHẦN UPLOAD ẢNH --- */}
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                            
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    disabled={isUploading}
                                />
                                
                                {isUploading ? (
                                    <div className="flex flex-col items-center justify-center py-4">
                                        <span className="text-xs text-gray-500">Đang tải ảnh lên...</span>
                                    </div>
                                ) : formData.imageUrl ? (
                                    <div className="relative flex items-center justify-center">
                                        <img src={formData.imageUrl} alt="Preview" className="max-h-32 object-contain rounded shadow-sm" />
                                    </div>
                                ) : (
                                    <div className="py-4 text-gray-400">
                                        <span className="text-xs">Bấm để chọn ảnh từ máy</span>
                                    </div>
                                )}
                            </div>
                            <input name="imageUrl" value={formData.imageUrl} readOnly className="w-full mt-2 p-1.5 border-none text-gray-400 bg-transparent text-[10px] focus:ring-0 text-center" placeholder="URL ảnh sẽ hiện ở đây sau khi upload" />
                        </div>
                        {/* --- HẾT PHẦN UPLOAD ẢNH --- */}

                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng (cm)</label>
                             <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                         <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao (cm)</label>
                             <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">Hủy bỏ</button>
                    <button onClick={() => onSave(formData)} disabled={isUploading} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded transition-colors shadow-sm disabled:opacity-50">Lưu thay đổi</button>
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

    // Role Check
    const role = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        const ADMIN_EMAILS = ['jinbduong@gmail.com']; 
        if (ADMIN_EMAILS.includes(currentUser.email) || currentUser.email.includes('admin')) {
            return 'admin';
        }
        return 'warehouse';
    }, [currentUser]);

    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'backgrounds'>('orders'); // Default to orders for convenience

    // Time Filters
    const [filterTime, setFilterTime] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');

    // Inputs & Search
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [isEditingBackground, setIsEditingBackground] = useState(false);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');
    const [orderSearch, setOrderSearch] = useState(''); // New order search

    // Editable order details state
    const [editCustomerName, setEditCustomerName] = useState('');
    const [editCustomerPhone, setEditCustomerPhone] = useState('');
    const [editCustomerEmail, setEditCustomerEmail] = useState('');
    const [editCustomerAddress, setEditCustomerAddress] = useState('');
    const [editOrderNotes, setEditOrderNotes] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchOrders();
                fetchProducts();
                fetchBackgrounds();
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
            // Sync editable fields
            setEditCustomerName(selectedOrder.customer.name);
            setEditCustomerPhone(selectedOrder.customer.phone);
            setEditCustomerEmail(selectedOrder.customer.email);
            setEditCustomerAddress(selectedOrder.customer.address);
            setEditOrderNotes(selectedOrder.delivery.notes);
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
    
    const handleSeedData = async () => { if (confirm("Thao tác này sẽ reset database về mặc định. Tiếp tục?")) { setLoading(true); await seedDatabase(); setLoading(false); fetchProducts(); } };
    const handleSeedBackgrounds = async () => { if (confirm("Reset backgrounds về mặc định?")) { setLoading(true); await seedBackgrounds(); setLoading(false); fetchBackgrounds(); } };
    
    const handleSaveProduct = async (part: LegoPart) => { setIsEditingProduct(false); if (editingPart) await updatePart(part.id, part); else await addPart(part); fetchProducts(); setEditingPart(null); };
    const handleDeleteProduct = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deletePart(id); fetchProducts(); } };
    
    const handleSaveBackground = async (bg: PresetBackground) => { setIsEditingBackground(false); if (editingBg) await updateBackground(bg.id, bg); else await addBackground(bg); fetchBackgrounds(); setEditingBg(null); };
    const handleDeleteBackground = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteBackground(id); fetchBackgrounds(); } };

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => { const success = await updateOrder(orderId, updates); if (success) { setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); if (showMsg) alert("Đã cập nhật!"); } };
    
    // Save extended admin info (Internal Note + Customer Edit)
    const handleSaveAdminInfo = async () => { 
        if (selectedOrder) { 
            await handleUpdate(selectedOrder.id, { 
                internalNotes: noteInput, 
                adminDeadline: adminDeadlineInput,
                customer: {
                    ...selectedOrder.customer,
                    name: editCustomerName,
                    phone: editCustomerPhone,
                    email: editCustomerEmail,
                    address: editCustomerAddress
                },
                delivery: {
                    ...selectedOrder.delivery,
                    notes: editOrderNotes
                }
            }, true); 
        } 
    };
    
    const handleDeleteOrder = async (orderId?: string) => {
        const id = orderId || selectedOrder?.id;
        if (!id) return;
        if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XOÁ VĨNH VIỄN đơn hàng ${id} không? Hành động này không thể hoàn tác.`)) {
            setLoading(true);
            await deleteOrder(id);
            setOrders(prev => prev.filter(o => o.id !== id));
            if (selectedOrder?.id === id) setSelectedOrder(null);
            setLoading(false);
            alert('Đã xoá đơn hàng.');
        }
    };

    // --- DISPLAY HELPERS ---
    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatDate = (dateString: string | number) => {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '---' : date.toLocaleDateString('vi-VN');
    };
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

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);


    const analytics = useMemo(() => {
        const now = new Date();
        let start = getStartOfDay(now);
        let end = getEndOfDay(now);
        let prevStart = getStartOfDay(now);
        let prevEnd = getEndOfDay(now);

        if (filterTime === 'yesterday') {
            start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1);
            prevStart.setDate(prevStart.getDate() - 2); prevEnd.setDate(prevEnd.getDate() - 2);
        } else if (filterTime === '7days') {
            start.setDate(start.getDate() - 7);
            prevStart.setDate(prevStart.getDate() - 14); prevEnd.setDate(prevEnd.getDate() - 7);
        } else if (filterTime === '30days') {
            start.setDate(start.getDate() - 30);
            prevStart.setDate(prevStart.getDate() - 60); prevEnd.setDate(prevEnd.getDate() - 30);
        } else {
            prevStart.setDate(prevStart.getDate() - 1); prevEnd.setDate(prevEnd.getDate() - 1);
        }

        const getOrdersInPeriod = (s: Date, e: Date) => orders.filter(o => {
            const time = o.createdAt || Number(o.id.slice(3)) || 0;
            return time >= s.getTime() && time <= e.getTime();
        });

        const currentOrders = getOrdersInPeriod(start, end);
        const prevOrders = getOrdersInPeriod(prevStart, prevEnd);

        const revenue = currentOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const revenueGrowth = prevRevenue === 0 ? 100 : ((revenue - prevRevenue) / prevRevenue) * 100;

        const orderCount = currentOrders.length;
        const prevOrderCount = prevOrders.length;
        const orderGrowth = prevOrderCount === 0 ? 100 : ((orderCount - prevOrderCount) / prevOrderCount) * 100;

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
                const frame = FRAME_OPTIONS.find(f => f.id === item.frameId.toLowerCase());
                const frameName = frame ? `${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                
                item.draggableItems.forEach(di => {
                    let itemName = '';
                    if (di.type === 'charm') {
                        itemName = 'Charm Upload (Ảnh)';
                        inventory.totalCharms++;
                    } else {
                        const part = allKnownParts[di.partId];
                        if (part) {
                             itemName = `${part.name}`;
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

        return { revenue, revenueGrowth, orderCount, orderGrowth, inventory, packers, dateLabel: filterTime === 'today' ? 'Hôm nay' : filterTime === 'yesterday' ? 'Hôm qua' : filterTime === '7days' ? '7 ngày qua' : '30 ngày qua' };
    }, [orders, filterTime, allKnownParts]);

    const filteredProducts = useMemo(() => products.filter(p => (productCategory === 'all' || p.type === productCategory) && p.name.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch, productCategory]);
    
    const sortedOrders = useMemo(() => {
        let result = [...orders];
        if (sortMode === 'urgent') {
            result.filter(o => o.isUrgent || o.adminDeadline).sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                if (a.adminDeadline && !b.adminDeadline) return -1;
                if (!a.adminDeadline && b.adminDeadline) return 1;
                return 0;
            });
        } else {
            result.sort((a, b) => ((b.createdAt || 0) - (a.createdAt || 0)));
        }
        if (orderSearch) {
            result = result.filter(o => o.id.toLowerCase().includes(orderSearch.toLowerCase()) || o.customer.name.toLowerCase().includes(orderSearch.toLowerCase()));
        }
        return result;
    }, [orders, sortMode, orderSearch]);

    const getVietQR = (order: Order) => {
        const BANK_ID = '970407'; 
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2'; 
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

    // CONDITIONAL RENDER FOR ORDERS TAB (SPLIT VIEW)
    if (activeTab === 'orders') {
        return (
            <div className="h-screen flex flex-col bg-white font-sans text-gray-900 overflow-hidden">
                 {/* HEADER */}
                <header className="bg-white border-b border-gray-200 flex-shrink-0">
                    <div className="px-4 h-16 flex justify-between items-center">
                         <div className="flex items-center gap-8">
                            <div className="text-xl font-bold tracking-tight">The Luvin <span className="font-normal text-gray-400">| Quản lý</span></div>
                            <nav className="hidden md:flex gap-1">
                                 <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-900`}>Dashboard</button>
                                <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors bg-gray-100 text-gray-900`}>Đơn hàng</button>
                                {role === 'admin' && (
                                    <>
                                        <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-900`}>Sản phẩm</button>
                                        <button onClick={() => setActiveTab('backgrounds')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-900`}>Hình nền</button>
                                    </>
                                )}
                            </nav>
                        </div>
                        <div className="flex items-center gap-4">
                             <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 text-sm font-medium transition-colors">Đăng xuất</button>
                        </div>
                    </div>
                </header>

                {/* SPLIT VIEW CONTAINER */}
                <div className="flex-grow flex overflow-hidden">
                    {/* LEFT SIDEBAR: ORDER LIST */}
                    <div className="w-1/3 md:w-1/4 border-r border-gray-200 bg-white flex flex-col min-w-[300px]">
                         <div className="p-4 border-b border-gray-100 space-y-3">
                             <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                 <button 
                                    onClick={() => setSortMode('newest')} 
                                    className={`flex-1 py-2 text-xs font-bold text-center ${sortMode === 'newest' ? 'bg-white text-gray-900 shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Mới nhất
                                </button>
                                <button 
                                    onClick={() => setSortMode('urgent')} 
                                    className={`flex-1 py-2 text-xs font-bold text-center ${sortMode === 'urgent' ? 'bg-white text-red-600 shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Cần gấp
                                </button>
                             </div>
                             <input 
                                type="text" 
                                placeholder="Tìm mã đơn, tên khách..." 
                                className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-gray-400"
                                value={orderSearch}
                                onChange={(e) => setOrderSearch(e.target.value)}
                             />
                         </div>
                         <div className="flex-grow overflow-y-auto">
                             {sortedOrders.map(order => {
                                 const statusConfig = STATUS_CONFIG.find(s => s.label === order.status) || STATUS_CONFIG[0];
                                 return (
                                    <div 
                                        key={order.id} 
                                        onClick={() => setSelectedOrder(order)}
                                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-blue-50 hover:bg-blue-50 ring-1 ring-inset ring-blue-200' : ''} ${order.isUrgent ? 'bg-red-50 hover:bg-red-100' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-gray-800 text-sm">{order.id}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConfig.color}`}>{order.status}</span>
                                        </div>
                                        <div className="text-xs font-semibold text-gray-700 mb-1 truncate">{order.customer.name}</div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-[10px] text-gray-400 flex flex-col">
                                                <span>{new Date(order.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}</span>
                                                <span>{new Date(order.createdAt).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                {order.delivery.date && <span className="text-[10px] text-gray-500 mb-0.5">Giao: {new Date(order.delivery.date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}</span>}
                                                <span className="font-bold text-sm text-gray-900">{formatCurrency(order.totalPrice)}</span>
                                            </div>
                                        </div>
                                    </div>
                                 )
                             })}
                             {sortedOrders.length === 0 && (
                                 <div className="p-8 text-center text-gray-400 text-xs">Không tìm thấy đơn hàng</div>
                             )}
                         </div>
                    </div>

                    {/* RIGHT MAIN: ORDER DETAIL */}
                    <div className="flex-grow bg-gray-50 overflow-y-auto">
                        {!selectedOrder ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                                <p className="text-sm font-medium">Chọn đơn hàng để xem chi tiết</p>
                            </div>
                        ) : (
                            <div className="p-6 max-w-5xl mx-auto space-y-6">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-bold text-gray-900">{selectedOrder.id}</h2>
                                            {selectedOrder.isUrgent && <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">GẤP</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Đặt lúc: {formatDateTime(selectedOrder.createdAt)}</p>
                                        {selectedOrder.packedBy && <p className="text-xs text-green-600 mt-0.5">✓ Đã đóng gói bởi {selectedOrder.packedBy} lúc {new Date(selectedOrder.packedAt!).toLocaleTimeString('vi-VN')}</p>}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                         <StatusDropdown 
                                            currentStatus={selectedOrder.status} 
                                            onStatusChange={(s) => handleUpdate(selectedOrder.id, { status: s })}
                                            isAdmin={role === 'admin'}
                                            onDelete={() => handleDeleteOrder(selectedOrder.id)}
                                            direction="down"
                                        />
                                        <button onClick={handleSaveAdminInfo} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition-colors shadow-sm">Lưu Ghi chú</button>
                                    </div>
                                </div>

                                {/* Internal Note & Deadline */}
                                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ghi chú nội bộ</label>
                                        <textarea 
                                            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white" 
                                            rows={3}
                                            placeholder="Ghi chú cho admin/kho..."
                                            value={noteInput}
                                            onChange={(e) => setNoteInput(e.target.value)}
                                        />
                                        <div className="mt-2 flex items-center gap-2">
                                            <input type="checkbox" id="urgentCheck" checked={selectedOrder.isUrgent || false} onChange={e => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} className="rounded text-red-600 focus:ring-red-500" />
                                            <label htmlFor="urgentCheck" className="text-xs font-bold text-red-600 cursor-pointer">Đánh dấu đơn GẤP</label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Deadline xưởng</label>
                                        <input 
                                            type="date" 
                                            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white"
                                            value={adminDeadlineInput}
                                            onChange={(e) => setAdminDeadlineInput(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Customer & Shipping Info */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Customer */}
                                    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-800 uppercase mb-4 border-b pb-2">Khách hàng</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="grid grid-cols-3 items-center gap-2">
                                                <span className="text-gray-500">Tên:</span>
                                                <input className="col-span-2 p-1.5 border border-gray-200 rounded focus:border-blue-500 outline-none w-full" value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-2">
                                                <span className="text-gray-500">SĐT:</span>
                                                <input className="col-span-2 p-1.5 border border-gray-200 rounded focus:border-blue-500 outline-none w-full" value={editCustomerPhone} onChange={e => setEditCustomerPhone(e.target.value)} />
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-2">
                                                <span className="text-gray-500">Email:</span>
                                                <input className="col-span-2 p-1.5 border border-gray-200 rounded focus:border-blue-500 outline-none w-full" value={editCustomerEmail} onChange={e => setEditCustomerEmail(e.target.value)} />
                                            </div>
                                            <div className="grid grid-cols-3 items-start gap-2">
                                                <span className="text-gray-500 mt-1.5">Địa chỉ:</span>
                                                <textarea className="col-span-2 p-1.5 border border-gray-200 rounded focus:border-blue-500 outline-none w-full resize-none" rows={2} value={editCustomerAddress} onChange={e => setEditCustomerAddress(e.target.value)} />
                                            </div>
                                             <div className="grid grid-cols-3 items-start gap-2">
                                                <span className="text-gray-500 mt-1.5">Note:</span>
                                                <textarea className="col-span-2 p-1.5 border border-gray-200 rounded focus:border-blue-500 outline-none w-full resize-none bg-yellow-50" rows={2} value={editOrderNotes} onChange={e => setEditOrderNotes(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment & Shipping */}
                                    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-800 uppercase mb-4 border-b pb-2">Thanh toán & Vận chuyển</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between"><span className="text-gray-500">Phương thức:</span> <span className="font-medium">{selectedOrder.payment.method === 'full' ? 'Toàn bộ' : 'Cọc 70%'}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500">Vận chuyển:</span> <span className="font-medium capitalize">{selectedOrder.shipping.method}</span></div>
                                            <div className="border-t border-dashed my-2"></div>
                                            <div className="flex justify-between"><span className="text-gray-500">Tổng đơn:</span> <span className="font-bold text-lg text-gray-900">{formatCurrency(selectedOrder.totalPrice)}</span></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Cần thu:</span> 
                                                <span className="font-bold text-red-600 text-lg">{formatCurrency(selectedOrder.amountToPay)}</span>
                                            </div>
                                            
                                            <div className="mt-4 pt-4 border-t flex justify-center">
                                                <div className="text-center">
                                                    <span className="text-xs text-gray-400 mb-2 block uppercase font-bold">Mã QR thanh toán (VIETQR)</span>
                                                    <img src={getVietQR(selectedOrder)} alt="QR" className="w-24 h-24 border rounded p-1 mx-auto" />
                                                    <div className="text-[10px] text-gray-500 mt-1">{selectedOrder.id.replace('#', '')}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Products */}
                                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm mb-20">
                                    <h3 className="text-sm font-bold text-gray-800 uppercase mb-4 border-b pb-2">Chi tiết sản phẩm</h3>
                                    <div className="space-y-6">
                                        {selectedOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-4 items-start">
                                                <div className="w-24 h-24 bg-gray-100 rounded-lg border overflow-hidden flex-shrink-0">
                                                    {item.previewImageUrl ? (
                                                        <a href={item.previewImageUrl} target="_blank" rel="noreferrer">
                                                             <img src={item.previewImageUrl} className="w-full h-full object-contain" alt="Preview" />
                                                        </a>
                                                    ) : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No IMG</div>}
                                                </div>
                                                <div className="flex-grow">
                                                    <h4 className="font-bold text-gray-900">Khung: {FRAME_OPTIONS.find(f => f.id === item.frameId)?.name || item.frameId}</h4>
                                                    <p className="text-xs text-gray-500 mb-2">Nền: {item.background.type === 'color' ? item.background.value : 'Ảnh'}</p>
                                                    
                                                    <div className="space-y-2">
                                                        {item.characters.map((char, cIdx) => (
                                                            <div key={cIdx} className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                                <span className="font-semibold text-gray-700">Nhân vật {cIdx + 1}</span>
                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
                                                                    {char.hair && <p>Tóc: {char.hair.name}</p>}
                                                                    {char.face && <p>Mặt: {char.face.name}</p>}
                                                                    {char.shirt && <p>Áo: {char.shirt.name} {char.selectedShirtColor ? `(${char.selectedShirtColor.name})` : ''}</p>}
                                                                    {char.pants && <p>Quần: {char.pants.name} {char.selectedPantsColor ? `(${char.selectedPantsColor.name})` : ''}</p>}
                                                                    {char.hat && <p>Mũ: {char.hat.name}</p>}
                                                                    {char.customPrintPrice ? <p className="text-blue-600 font-bold">In yêu cầu: {formatCurrency(char.customPrintPrice)}</p> : null}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {item.draggableItems.length > 0 && (
                                                            <div className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                                <span className="font-semibold text-gray-700">Phụ kiện & Thú cưng</span>
                                                                <div className="flex flex-wrap gap-2 mt-1">
                                                                    {item.draggableItems.map((di, dIdx) => {
                                                                         const part = allKnownParts[di.partId];
                                                                         const name = di.type === 'charm' ? 'Charm ảnh' : (part?.name || di.partId);
                                                                         return <span key={dIdx} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">{name}</span>
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {item.texts.length > 0 && (
                                                            <div className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                                                <span className="font-semibold text-gray-700">Chữ</span>
                                                                <div className="flex flex-col gap-1 mt-1">
                                                                    {item.texts.map((t, tIdx) => (
                                                                        <p key={tIdx} className="text-xs italic text-gray-600">"{t.content}" - Font: {t.font}</p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sticky Footer Actions */}
                                <div className="sticky bottom-4 bg-white p-4 rounded-xl border border-gray-200 shadow-lg flex justify-between items-center z-10">
                                     <StatusDropdown 
                                        currentStatus={selectedOrder.status} 
                                        onStatusChange={(s) => handleUpdate(selectedOrder.id, { status: s })}
                                        isAdmin={role === 'admin'}
                                        onDelete={() => handleDeleteOrder(selectedOrder.id)}
                                        direction="up"
                                    />
                                     {role === 'warehouse' || role === 'admin' ? (
                                         <button onClick={handleMarkAsPacked} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-2">
                                             <span>📦</span> Xác nhận đóng gói
                                         </button>
                                     ) : null}
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // DEFAULT RETURN FOR OTHER TABS (DASHBOARD, PRODUCTS, BACKGROUNDS)
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
                            <button onClick={() => setActiveTab('orders')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-500 hover:text-gray-900">Đơn hàng</button>
                            {role === 'admin' && (
                                <>
                                    <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Sản phẩm</button>
                                    <button onClick={() => setActiveTab('backgrounds')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'backgrounds' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Hình nền</button>
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
                            </>
                        )}
                    </div>
                )}
            </header>

            <main className="max-w-[1600px] mx-auto py-8 px-4 sm:px-6">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-end space-x-2">
                            {(['today', 'yesterday', '7days', '30days'] as const).map(t => (
                                <button key={t} onClick={() => setFilterTime(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${filterTime === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>{t === 'today' ? 'Hôm nay' : t === 'yesterday' ? 'Hôm qua' : t === '7days' ? '7 ngày qua' : '30 ngày qua'}</button>
                            ))}
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
                                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-800">Chi tiết vật tư tiêu hao</h3></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="px-4 py-3">Loại</th><th className="px-4 py-3 text-right">Số lượng</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {Object.entries(analytics.inventory.frames).map(([frameName, count]) => (<tr key={frameName}><td className="px-4 py-3 font-medium text-gray-700">{frameName}</td><td className="px-4 py-3 text-right font-mono">{count}</td></tr>))}
                                            
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
                                        {analytics.packers.length > 0 ? analytics.packers.map((p, i) => (
                                            <tr key={p.email}>
                                                <td className="px-4 py-3 font-medium text-gray-700 flex items-center gap-2">
                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</span>
                                                    {p.email.split('@')[0]}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">{p.count}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500 text-xs italic">Chưa có dữ liệu đóng gói</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* PRODUCTS TAB */}
                {activeTab === 'products' && role === 'admin' && (
                     <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <input 
                                    value={productSearch} 
                                    onChange={(e) => setProductSearch(e.target.value)} 
                                    placeholder="Tìm kiếm sản phẩm..." 
                                    className="p-2 border border-gray-300 rounded w-full sm:w-64"
                                />
                                <select 
                                    value={productCategory} 
                                    onChange={(e) => setProductCategory(e.target.value)} 
                                    className="p-2 border border-gray-300 rounded"
                                >
                                    <option value="all">Tất cả</option>
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
                                <button onClick={handleSeedData} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset Data</button>
                                <button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 rounded hover:bg-black">+ Thêm SP</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                            {filteredProducts.map(part => (
                                <div key={part.id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-2 group relative">
                                    <div className="aspect-square bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                                        <img src={part.imageUrl} alt={part.name} className="w-full h-full object-contain" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm truncate">{part.name}</h4>
                                        <p className="text-xs text-gray-500 capitalize">{part.type} - {formatCurrency(part.price)}</p>
                                    </div>
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                                        <button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="bg-white text-gray-900 p-2 rounded-full hover:bg-gray-100">✏️</button>
                                        <button onClick={() => handleDeleteProduct(part.id)} className="bg-white text-red-600 p-2 rounded-full hover:bg-red-50">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                )}

                {/* BACKGROUNDS TAB */}
                {activeTab === 'backgrounds' && role === 'admin' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Quản lý Background</h2>
                             <div className="flex gap-2">
                                <button onClick={handleSeedBackgrounds} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset BG</button>
                                <button onClick={() => { setEditingBg(null); setIsEditingBackground(true); }} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 rounded hover:bg-black">+ Thêm BG</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                            {backgrounds.map(bg => (
                                <div key={bg.id} className="bg-white border border-gray-200 rounded-lg p-2 group relative">
                                    <div className="aspect-[4/5] bg-gray-50 rounded overflow-hidden mb-2">
                                        <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-sm truncate">{bg.name}</p>
                                        <p className="text-xs text-gray-500">{bg.category}</p>
                                    </div>
                                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                                        <button onClick={() => { setEditingBg(bg); setIsEditingBackground(true); }} className="bg-white text-gray-900 p-2 rounded-full hover:bg-gray-100">✏️</button>
                                        <button onClick={() => handleDeleteBackground(bg.id)} className="bg-white text-red-600 p-2 rounded-full hover:bg-red-50">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
            
            {/* MODALS */}
            {isEditingProduct && (
                <ProductForm 
                    initialData={editingPart} 
                    onSave={handleSaveProduct} 
                    onCancel={() => { setIsEditingProduct(false); setEditingPart(null); }} 
                />
            )}
            
            {isEditingBackground && (
                <BackgroundForm 
                    initialData={editingBg} 
                    onSave={handleSaveBackground} 
                    onCancel={() => { setIsEditingBackground(false); setEditingBg(null); }} 
                />
            )}
        </div>
    );
};

export default AdminPage;
