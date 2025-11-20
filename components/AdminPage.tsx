
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

    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'backgrounds'>('dashboard');

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

    // Background Filters
    const [bgCategoryFilter, setBgCategoryFilter] = useState('all');
    const [bgTypeFilter, setBgTypeFilter] = useState('all');

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
    const handleSeedBackgrounds = async () => { 
        if (confirm("Thao tác này sẽ thêm các background mẫu vào danh sách. Tiếp tục?")) { 
            setLoading(true); 
            await seedBackgrounds(); 
            setLoading(false); 
            fetchBackgrounds(); 
        } 
    };
    
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
    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
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
            charms: {} as Record<string, number>, // Changed to Record for specific counts
            totalCharms: 0,
            parts: { hair: 0, face: 0, shirt: 0, pants: 0, hat: 0 } 
        };
        const packerStats: Record<string, number> = {};

        currentOrders.forEach(order => {
            if (order.packedBy) packerStats[order.packedBy] = (packerStats[order.packedBy] || 0) + 1;
            order.items.forEach(item => {
                // FIX: Use Frame Name instead of ID, handle case insensitivity
                const frame = FRAME_OPTIONS.find(f => f.id === item.frameId.toLowerCase());
                const frameName = frame ? `${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                
                item.draggableItems.forEach(di => {
                    // Logic mới để đếm chi tiết Charm
                    let itemName = '';
                    if (di.type === 'charm') {
                        itemName = 'Charm Upload (Ảnh)';
                        inventory.totalCharms++;
                    } else {
                        // Tìm tên sản phẩm từ danh sách products HOẶC fallback constants
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
    }, [orders, filterTime, allKnownParts]); // Add allKnownParts dependency

    const filteredProducts = useMemo(() => products.filter(p => (productCategory === 'all' || p.type === productCategory) && p.name.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch, productCategory]);
    
    const sortedOrders = useMemo(() => {
        let result = [...orders];
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
    }, [orders, sortMode]);

    // --- DROPDOWN DATA FOR EDIT ---
    const partsByType = useMemo(() => {
        const types: Record<string, LegoPart[]> = {};
        products.forEach(p => {
            if (!types[p.type]) types[p.type] = [];
            types[p.type].push(p);
        });
        return types;
    }, [products]);

    // New Filter Logic for Backgrounds
    const filteredBackgrounds = useMemo(() => {
        return backgrounds.filter(bg => {
            const matchCat = bgCategoryFilter === 'all' || bg.category === bgCategoryFilter;
            const matchType = bgTypeFilter === 'all' || bg.type === bgTypeFilter;
            return matchCat && matchType;
        });
    }, [backgrounds, bgCategoryFilter, bgTypeFilter]);

    const uniqueBgCategories = useMemo(() => {
        const cats = new Set(backgrounds.map(b => b.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [backgrounds]);

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

                {/* ORDERS TAB */}
                {activeTab === 'orders' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Danh sách đơn hàng</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setSortMode('newest')} className={`px-3 py-1.5 text-sm rounded border ${sortMode === 'newest' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600'}`}>Mới nhất</button>
                                <button onClick={() => setSortMode('urgent')} className={`px-3 py-1.5 text-sm rounded border ${sortMode === 'urgent' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600'}`}>Gấp / Deadline</button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {sortedOrders.map(order => (
                                <div key={order.id} onClick={() => setSelectedOrder(order)} className={`bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${selectedOrder?.id === order.id ? 'ring-2 ring-gray-900 border-transparent' : 'border-gray-200'} ${order.isUrgent ? 'bg-red-50' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg">{order.id}</span>
                                                {order.isUrgent && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold">GẤP</span>}
                                            </div>
                                            <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                                        </div>
                                        <StatusDropdown 
                                            currentStatus={order.status} 
                                            onStatusChange={(s) => handleUpdate(order.id, { status: s }, false)}
                                            isAdmin={role === 'admin'}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-gray-500">Khách hàng</p>
                                            <p className="font-medium">{order.customer.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Tổng tiền</p>
                                            <p className="font-bold text-gray-900">{formatCurrency(order.totalPrice)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Thanh toán</p>
                                            <p className={`${order.amountToPay < order.totalPrice ? 'text-orange-600' : 'text-green-600'} font-medium`}>{order.payment.method === 'deposit' ? 'Cọc 70%' : 'Full'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Giao hàng</p>
                                            <p className="font-medium">{order.delivery.date}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {sortedOrders.length === 0 && <p className="text-center text-gray-500 py-10">Không có đơn hàng nào.</p>}
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
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Quản lý Background</h2>
                                <p className="text-xs text-gray-500 mt-1">Quản lý hình nền cho khung ảnh</p>
                            </div>
                             
                             <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                                <select 
                                    value={bgTypeFilter} 
                                    onChange={e => setBgTypeFilter(e.target.value)} 
                                    className="p-2 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-gray-200 outline-none"
                                >
                                    <option value="all">Tất cả loại khung</option>
                                    <option value="square">Vuông (15x15, 23x23)</option>
                                    <option value="rectangle">Chữ nhật (A5)</option>
                                </select>
                                
                                <select 
                                    value={bgCategoryFilter} 
                                    onChange={e => setBgCategoryFilter(e.target.value)} 
                                    className="p-2 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-gray-200 outline-none"
                                >
                                    <option value="all">Tất cả danh mục</option>
                                    {uniqueBgCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>

                                <div className="flex gap-2 ml-auto">
                                    <button onClick={handleSeedBackgrounds} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 whitespace-nowrap">
                                        ↻ Đồng bộ từ Code
                                    </button>
                                    <button onClick={() => { setEditingBg(null); setIsEditingBackground(true); }} className="px-3 py-2 text-sm font-bold text-white bg-gray-900 rounded hover:bg-black whitespace-nowrap">
                                        + Thêm BG
                                    </button>
                                </div>
                            </div>
                        </div>

                        {backgrounds.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl mb-4">🖼️</div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Chưa có dữ liệu Background</h3>
                                <p className="text-gray-500 mb-6 text-center max-w-md">Danh sách hiện đang trống. Bạn có thể thêm thủ công hoặc nhập các mẫu có sẵn từ mã nguồn.</p>
                                <button 
                                    onClick={handleSeedBackgrounds} 
                                    disabled={loading}
                                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg transition-transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none flex items-center gap-2"
                                >
                                    {loading ? 'Đang xử lý...' : '📥 Nhập mẫu có sẵn từ Code'}
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {filteredBackgrounds.map(bg => (
                                    <div key={bg.id} className="bg-white border border-gray-200 rounded-lg p-2 group relative flex flex-col h-full hover:shadow-md transition-shadow">
                                        <div className="relative aspect-[4/5] bg-gray-100 rounded overflow-hidden mb-2">
                                            <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                                            <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                {bg.type === 'square' ? 'Vuông' : 'A5'}
                                            </span>
                                        </div>
                                        <div className="text-center mt-auto">
                                            <p className="font-bold text-xs sm:text-sm truncate text-gray-800" title={bg.name}>{bg.name}</p>
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                                                {bg.category}
                                            </span>
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg backdrop-blur-[1px]">
                                            <button onClick={() => { setEditingBg(bg); setIsEditingBackground(true); }} className="bg-white text-gray-900 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-sm transition-transform hover:scale-110" title="Sửa">✏️</button>
                                            <button onClick={() => handleDeleteBackground(bg.id)} className="bg-white text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 shadow-sm transition-transform hover:scale-110" title="Xóa">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
            
            {selectedOrder && (
                <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
                     <div className="absolute inset-0 bg-black/30 pointer-events-auto" onClick={() => setSelectedOrder(null)}></div>
                     <div className="w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto pointer-events-auto p-6 animate-slide-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{selectedOrder.id}</h2>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-900 text-2xl">&times;</button>
                        </div>

                        <div className="space-y-6">
                             {/* ADMIN ACTIONS */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold uppercase text-gray-500">Admin Notes</span>
                                    {role === 'admin' && <button onClick={handleDeleteOrder} className="text-xs text-red-600 hover:underline">Xoá đơn</button>}
                                </div>
                                <textarea className="w-full p-2 border rounded text-sm mb-2" placeholder="Ghi chú nội bộ..." value={noteInput} onChange={e => setNoteInput(e.target.value)} />
                                <input type="date" className="w-full p-2 border rounded text-sm mb-2" value={adminDeadlineInput} onChange={e => setAdminDeadlineInput(e.target.value)} />
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={selectedOrder.isUrgent || false} onChange={e => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked })} />
                                        Đơn gấp
                                    </label>
                                    <button onClick={handleSaveAdminInfo} className="px-3 py-1 bg-gray-800 text-white text-xs rounded">Lưu</button>
                                </div>
                            </div>

                             {/* CUSTOMER INFO */}
                            <div>
                                <h3 className="font-bold text-gray-800 border-b pb-1 mb-2">Khách hàng</h3>
                                <p className="text-sm"><span className="text-gray-500">Tên:</span> {selectedOrder.customer.name}</p>
                                <p className="text-sm"><span className="text-gray-500">SĐT:</span> {selectedOrder.customer.phone}</p>
                                <p className="text-sm"><span className="text-gray-500">Đ/C:</span> {selectedOrder.customer.address}</p>
                                <p className="text-sm"><span className="text-gray-500">Email:</span> {selectedOrder.customer.email}</p>
                            </div>

                             {/* ITEMS */}
                             <div>
                                <h3 className="font-bold text-gray-800 border-b pb-1 mb-2">Sản phẩm ({selectedOrder.items.length})</h3>
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 mb-3">
                                        <div className="w-16 h-16 bg-gray-100 rounded border overflow-hidden">
                                            {item.previewImageUrl && <img src={item.previewImageUrl} className="w-full h-full object-contain" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Khung {item.frameId}</p>
                                            <p className="text-xs text-gray-500">{item.characters.length} nhân vật</p>
                                        </div>
                                    </div>
                                ))}
                             </div>

                              {/* PAYMENT */}
                             <div>
                                <h3 className="font-bold text-gray-800 border-b pb-1 mb-2">Thanh toán</h3>
                                <p className="text-sm flex justify-between"><span>Tổng tiền:</span> <span className="font-bold">{formatCurrency(selectedOrder.totalPrice)}</span></p>
                                <p className="text-sm flex justify-between text-red-600"><span>Cần thu:</span> <span className="font-bold">{formatCurrency(selectedOrder.amountToPay)}</span></p>
                                <div className="mt-2 text-center">
                                    <a href={getVietQR(selectedOrder)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Xem mã QR Thanh toán</a>
                                </div>
                             </div>

                             {/* WAREHOUSE */}
                             <button onClick={handleMarkAsPacked} className="w-full py-3 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">
                                Xác nhận đã đóng gói
                             </button>
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
