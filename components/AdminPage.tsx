
// components/AdminPage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrders, updateOrder, deleteOrder, uploadOrderImageFile } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase, uploadProductImage } from '../services/productService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig, LegoCharacterConfig, DraggableItem } from '../types';
import { FRAME_OPTIONS } from '../constants';

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            const downloadURL = await uploadProductImage(file);
            if (downloadURL) {
                setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
            } else {
                alert("Upload ảnh thất bại. Vui lòng kiểm tra kết nối hoặc thử lại.");
            }
            setIsUploading(false);
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
                        
                        {/* --- PHẦN HÌNH ĐƯỢC CẬP NHẬT ĐỂ HỖ TRỢ UPLOAD --- */}
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh</label>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 px-3 rounded border border-gray-300 transition-colors disabled:opacity-50"
                                    >
                                        {isUploading ? 'Đang tải lên...' : '📂 Tải ảnh lên'}
                                    </button>
                                    <span className="text-xs text-gray-400">hoặc</span>
                                    <input 
                                        name="imageUrl" 
                                        value={formData.imageUrl} 
                                        onChange={handleChange} 
                                        className="flex-grow p-2 border border-gray-300 rounded bg-gray-50 focus:bg-white outline-none text-xs" 
                                        placeholder="Dán link ảnh..." 
                                    />
                                </div>
                                
                                {formData.imageUrl && (
                                    <div className="relative w-full h-32 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden group">
                                        <img src={formData.imageUrl} alt="Preview" className="h-full object-contain" />
                                        <button 
                                            onClick={() => setFormData(prev => ({...prev, imageUrl: ''}))}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                                        >
                                            ×
                                        </button>
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
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">Hủy bỏ</button>
                    <button onClick={() => onSave(formData)} disabled={isUploading} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded transition-colors shadow-sm disabled:opacity-50">
                        {isUploading ? 'Đang xử lý...' : 'Lưu thay đổi'}
                    </button>
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
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Mobile menu
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Edit Mode State
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);
    const [addingAccessoryToItemIndex, setAddingAccessoryToItemIndex] = useState<number | null>(null);
    
    // Upload Order Image Logic
    const orderImageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);


    // Role Check
    const role = useMemo(() => {
        if (!currentUser || !currentUser.email) return null;
        const ADMIN_EMAILS = ['jinbduong@gmail.com']; 
        if (ADMIN_EMAILS.includes(currentUser.email) || currentUser.email.includes('admin')) {
            return 'admin';
        }
        return 'warehouse';
    }, [currentUser]);

    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products'>('dashboard');

    // Time Filters
    const [filterTime, setFilterTime] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');

    // Inputs & Search
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchOrders();
                fetchProducts();
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
    const handleSeedData = async () => { if (confirm("Thao tác này sẽ reset database về mặc định. Tiếp tục?")) { setLoading(true); await seedDatabase(); setLoading(false); fetchProducts(); } };
    const handleSaveProduct = async (part: LegoPart) => { setIsEditingProduct(false); if (editingPart) await updatePart(part.id, part); else await addPart(part); fetchProducts(); setEditingPart(null); };
    const handleDeleteProduct = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deletePart(id); fetchProducts(); } };
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

    // --- NEW: Upload Final Image Logic ---
    const handleOrderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && editForm && uploadingItemIndex !== null) {
            setLoading(true);
            const file = e.target.files[0];
            const downloadURL = await uploadOrderImageFile(file, editForm.id, uploadingItemIndex);
            
            if (downloadURL) {
                setEditForm(prev => {
                    if (!prev) return null;
                    const newItems = [...prev.items];
                    newItems[uploadingItemIndex] = { ...newItems[uploadingItemIndex], previewImageUrl: downloadURL };
                    return { ...prev, items: newItems };
                });
            } else {
                alert('Upload ảnh thất bại');
            }
            setLoading(false);
            setUploadingItemIndex(null);
            if (orderImageInputRef.current) orderImageInputRef.current.value = '';
        }
    };

    const triggerOrderImageUpload = (index: number) => {
        setUploadingItemIndex(index);
        orderImageInputRef.current?.click();
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

    // --- ANALYTICS LOGIC (Simplified) ---
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

        const inventory = { frames: {} as Record<string, number>, charms: 0, parts: { hair: 0, face: 0, shirt: 0, pants: 0, hat: 0, accessory: 0, pet: 0 } };
        const packerStats: Record<string, number> = {};

        currentOrders.forEach(order => {
            if (order.packedBy) packerStats[order.packedBy] = (packerStats[order.packedBy] || 0) + 1;
            order.items.forEach(item => {
                inventory.frames[item.frameId] = (inventory.frames[item.frameId] || 0) + 1;
                item.draggableItems.forEach(di => {
                    if (di.type === 'charm') inventory.charms++;
                    else if (inventory.parts[di.type] !== undefined) inventory.parts[di.type as keyof typeof inventory.parts]++;
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
    }, [orders, filterTime]);

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
                                <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Sản phẩm</button>
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
                        {role === 'admin' && <button onClick={() => {setActiveTab('products'); setIsMobileMenuOpen(false)}} className="block w-full text-left px-4 py-2 rounded hover:bg-gray-50 font-medium">Sản phẩm</button>}
                    </div>
                )}
            </header>

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
                {/* --- DASHBOARD TAB --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        <div className="flex justify-end">
                            <div className="inline-flex bg-white rounded-lg border border-gray-200 p-1">
                                {['today', 'yesterday', '7days', '30days'].map((t) => (
                                    <button key={t} onClick={() => setFilterTime(t as any)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterTime === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                                        {t === 'today' ? 'Hôm nay' : t === 'yesterday' ? 'Hôm qua' : t === '7days' ? '7 ngày' : '30 ngày'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-medium text-gray-500">Doanh thu ({analytics.dateLabel})</h3>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-gray-900">{formatCurrency(analytics.revenue)}</span>
                                    <span className={`text-xs font-medium ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {analytics.revenueGrowth > 0 ? '+' : ''}{analytics.revenueGrowth.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-medium text-gray-500">Đơn hàng mới</h3>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-gray-900">{analytics.orderCount}</span>
                                    <span className={`text-xs font-medium ${analytics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {analytics.orderGrowth > 0 ? '+' : ''}{analytics.orderGrowth.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-medium text-gray-500">Cần chuẩn bị (Part)</h3>
                                <div className="mt-2 space-y-1">
                                    <div className="flex justify-between text-sm"><span>Tóc:</span> <span className="font-bold">{analytics.inventory.parts.hair}</span></div>
                                    <div className="flex justify-between text-sm"><span>Mặt:</span> <span className="font-bold">{analytics.inventory.parts.face}</span></div>
                                    <div className="flex justify-between text-sm"><span>Phụ kiện:</span> <span className="font-bold">{analytics.inventory.parts.accessory}</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold text-lg mb-4">Hiệu suất nhân viên</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                            <tr><th className="px-4 py-3">Nhân viên</th><th className="px-4 py-3 text-right">Đơn đóng gói</th></tr>
                                        </thead>
                                        <tbody>
                                            {analytics.packers.map((p, i) => (
                                                <tr key={i} className="border-b last:border-0">
                                                    <td className="px-4 py-3 font-medium">{p.email}</td>
                                                    <td className="px-4 py-3 text-right">{p.count}</td>
                                                </tr>
                                            ))}
                                            {analytics.packers.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500">Chưa có dữ liệu</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold text-lg mb-4">Khung bán chạy</h3>
                                <div className="space-y-3">
                                    {Object.entries(analytics.inventory.frames).map(([id, count]) => {
                                        const frame = FRAME_OPTIONS.find(f => f.id === id);
                                        const percentage = Math.round((count / analytics.orderCount) * 100) || 0;
                                        return (
                                            <div key={id}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span>{frame?.name || id}</span>
                                                    <span className="font-bold">{count}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div className="bg-gray-900 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                     {Object.keys(analytics.inventory.frames).length === 0 && <p className="text-center text-gray-500 py-8">Chưa có dữ liệu</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ORDERS TAB --- */}
                {activeTab === 'orders' && (
                    <div className="flex flex-col h-[calc(100vh-120px)]">
                        {/* Toolbar */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex gap-2">
                                <button onClick={() => setSortMode('newest')} className={`px-3 py-1.5 text-sm rounded-md border ${sortMode === 'newest' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}>Mới nhất</button>
                                <button onClick={() => setSortMode('urgent')} className={`px-3 py-1.5 text-sm rounded-md border ${sortMode === 'urgent' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-700 border-gray-300'}`}>Gấp/Deadline</button>
                            </div>
                            <div className="text-sm text-gray-500">Tổng: <strong>{sortedOrders.length}</strong> đơn</div>
                        </div>

                        <div className="flex gap-6 h-full overflow-hidden">
                            {/* Left: Order List */}
                            <div className="w-1/3 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                                    {sortedOrders.map(order => {
                                        const isSelected = selectedOrder?.id === order.id;
                                        const isDeadlineNear = order.adminDeadline && new Date(order.adminDeadline).getTime() - Date.now() < 86400000 * 2; // < 2 days
                                        return (
                                            <div 
                                                key={order.id} 
                                                onClick={() => {setSelectedOrder(order); setIsEditingOrder(false);}}
                                                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-gray-900">{order.id}</span>
                                                    <span className="text-xs text-gray-500">{formatDate(new Date(order.createdAt).toISOString())}</span>
                                                </div>
                                                <div className="flex justify-between items-center mb-2">
                                                     <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG.find(s => s.label === order.status)?.color || 'bg-gray-100'}`}>{order.status}</span>
                                                     <span className="font-medium text-sm">{formatCurrency(order.totalPrice)}</span>
                                                </div>
                                                <div className="text-xs text-gray-600 truncate">{order.customer.name} - {order.customer.phone}</div>
                                                
                                                <div className="mt-2 flex gap-1 flex-wrap">
                                                    {order.isUrgent && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-bold">GẤP</span>}
                                                    {order.adminDeadline && <span className={`px-1.5 py-0.5 text-[10px] rounded border ${isDeadlineNear ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>DL: {new Date(order.adminDeadline).toLocaleDateString('vi-VN')}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: Order Detail */}
                            <div className="w-2/3 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                                {selectedOrder ? (
                                    isEditingOrder && editForm ? (
                                        // --- EDIT MODE ---
                                        <div className="flex flex-col h-full">
                                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                                <h2 className="font-bold text-xl">Chỉnh sửa đơn hàng {editForm.id}</h2>
                                                <div className="flex gap-2">
                                                    <button onClick={cancelEditingOrder} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50">Hủy</button>
                                                    <button onClick={saveOrderChanges} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">{loading ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                                                </div>
                                            </div>
                                            <div className="p-6 overflow-y-auto flex-grow space-y-6">
                                                {/* Customer Edit */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên khách</label>
                                                        <input className="w-full p-2 border rounded" value={editForm.customer.name} onChange={e => handleEditFormChange('name', e.target.value, 'customer')} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SĐT</label>
                                                        <input className="w-full p-2 border rounded" value={editForm.customer.phone} onChange={e => handleEditFormChange('phone', e.target.value, 'customer')} />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Địa chỉ</label>
                                                        <input className="w-full p-2 border rounded" value={editForm.customer.address} onChange={e => handleEditFormChange('address', e.target.value, 'customer')} />
                                                    </div>
                                                </div>

                                                {/* Items Edit */}
                                                <div>
                                                    <h3 className="font-bold text-gray-800 mb-2">Sản phẩm</h3>
                                                    {editForm.items.map((item, idx) => (
                                                        <div key={idx} className="border rounded-lg p-4 mb-4 bg-gray-50">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="font-bold text-sm">Khung #{idx + 1}</h4>
                                                                {/* Nút Upload ảnh thay thế */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-500">Ảnh thiết kế:</span>
                                                                    <button 
                                                                        onClick={() => triggerOrderImageUpload(idx)}
                                                                        className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 flex items-center gap-1"
                                                                    >
                                                                        📷 Upload ảnh thật
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Hidden Input for Upload */}
                                                            <input 
                                                                type="file" 
                                                                ref={orderImageInputRef} 
                                                                className="hidden" 
                                                                accept="image/*"
                                                                onChange={handleOrderImageUpload}
                                                            />

                                                            <div className="flex gap-6">
                                                                {/* Image Preview Area */}
                                                                <div className="w-32 h-32 bg-white border rounded flex items-center justify-center overflow-hidden relative group">
                                                                    {item.previewImageUrl ? (
                                                                        <img src={item.previewImageUrl} className="w-full h-full object-contain" />
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">No Image</span>
                                                                    )}
                                                                    {loading && uploadingItemIndex === idx && (
                                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs">Uploading...</div>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="flex-grow space-y-3">
                                                                    <div>
                                                                         <label className="block text-xs font-bold text-gray-500 mb-1">Loại khung</label>
                                                                         <select className="w-full p-2 border rounded text-sm" value={item.frameId} onChange={(e) => handleEditFormChange('', e.target.value, 'frameId', idx)}>
                                                                             {FRAME_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                                         </select>
                                                                    </div>
                                                                    
                                                                    <div>
                                                                        <label className="block text-xs font-bold text-gray-500 mb-1">Nhân vật ({item.characters.length})</label>
                                                                        {item.characters.map((char, cIdx) => (
                                                                            <div key={char.id} className="flex gap-2 mb-2 items-center">
                                                                                <span className="text-xs font-bold w-8">NV{cIdx+1}</span>
                                                                                <select className="text-xs border rounded p-1 w-20" value={char.hair?.id || ''} onChange={(e) => handleCharacterChange(idx, cIdx, 'hair', e.target.value)}>
                                                                                    <option value="">-Tóc-</option>
                                                                                    {partsByType['hair']?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                                </select>
                                                                                <select className="text-xs border rounded p-1 w-20" value={char.shirt?.id || ''} onChange={(e) => handleCharacterChange(idx, cIdx, 'shirt', e.target.value)}>
                                                                                    <option value="">-Áo-</option>
                                                                                    {partsByType['shirt']?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                                </select>
                                                                                <select className="text-xs border rounded p-1 w-20" value={char.pants?.id || ''} onChange={(e) => handleCharacterChange(idx, cIdx, 'pants', e.target.value)}>
                                                                                    <option value="">-Quần-</option>
                                                                                    {partsByType['pants']?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                                </select>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // --- VIEW MODE ---
                                        <div className="flex flex-col h-full">
                                            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h2 className="text-2xl font-bold text-gray-900">{selectedOrder.id}</h2>
                                                        {selectedOrder.isUrgent && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">GẤP</span>}
                                                    </div>
                                                    <p className="text-sm text-gray-500">Đặt lúc: {formatDateTime(selectedOrder.createdAt || parseInt(selectedOrder.id.slice(3)))}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <StatusDropdown 
                                                        currentStatus={selectedOrder.status} 
                                                        onStatusChange={(s) => handleUpdate(selectedOrder.id, { status: s })}
                                                        onDelete={handleDeleteOrder}
                                                        isAdmin={role === 'admin'}
                                                    />
                                                    {role === 'admin' && (
                                                        <button onClick={startEditingOrder} className="text-sm text-blue-600 font-semibold hover:underline">Chỉnh sửa đơn</button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-grow overflow-y-auto p-6">
                                                {/* Admin Controls */}
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                                    <h3 className="text-sm font-bold text-yellow-800 mb-3 uppercase tracking-wide">Ghi chú nội bộ (Admin/Kho)</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <textarea 
                                                            placeholder="Ghi chú cho đơn này..." 
                                                            className="w-full p-2 text-sm border border-yellow-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                                            rows={2}
                                                            value={noteInput}
                                                            onChange={e => setNoteInput(e.target.value)}
                                                        ></textarea>
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm text-yellow-800 whitespace-nowrap">Deadline:</span>
                                                                <input 
                                                                    type="date" 
                                                                    className="w-full p-1.5 text-sm border border-yellow-300 rounded"
                                                                    value={adminDeadlineInput}
                                                                    onChange={e => setAdminDeadlineInput(e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    type="checkbox" 
                                                                    id="urgentCheck"
                                                                    checked={selectedOrder.isUrgent || false}
                                                                    onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked })}
                                                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                                                />
                                                                <label htmlFor="urgentCheck" className="text-sm font-bold text-red-700">Đánh dấu đơn GẤP</label>
                                                            </div>
                                                            <button onClick={handleSaveAdminInfo} className="mt-auto bg-yellow-600 text-white text-sm font-bold py-1.5 rounded hover:bg-yellow-700 transition-colors">Lưu ghi chú</button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Order Items */}
                                                <div className="space-y-6">
                                                    {selectedOrder.items.map((item, index) => (
                                                        <div key={index} className="flex gap-6 pb-6 border-b border-gray-100 last:border-0">
                                                            <div className="w-40 h-40 bg-gray-100 rounded-lg border flex-shrink-0 overflow-hidden">
                                                                 {item.previewImageUrl ? (
                                                                    <a href={item.previewImageUrl} target="_blank" rel="noopener noreferrer">
                                                                        <img src={item.previewImageUrl} alt="Preview" className="w-full h-full object-contain hover:scale-105 transition-transform" />
                                                                    </a>
                                                                 ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Preview</div>
                                                                 )}
                                                            </div>
                                                            <div className="flex-grow">
                                                                <h3 className="font-bold text-gray-900">Khung {FRAME_OPTIONS.find(f => f.id === item.frameId)?.name}</h3>
                                                                <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                                    <p><strong>Số nhân vật:</strong> {item.characters.length}</p>
                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                        {item.characters.map((char, i) => (
                                                                            <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs border">
                                                                                NV{i+1}: {char.shirt?.name || 'Áo?'}, {char.hair?.name || 'Tóc?'}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    {item.draggableItems.length > 0 && (
                                                                        <p className="mt-1"><strong>Phụ kiện:</strong> {item.draggableItems.map(d => products.find(p => p.id === d.partId)?.name).join(', ')}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {/* Info Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-100">
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 mb-3">Thông tin khách hàng</h4>
                                                        <div className="space-y-2 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                                                            <p><span className="font-semibold">Tên:</span> {selectedOrder.customer.name}</p>
                                                            <p><span className="font-semibold">SĐT:</span> {selectedOrder.customer.phone}</p>
                                                            <p><span className="font-semibold">Email:</span> {selectedOrder.customer.email}</p>
                                                            <p><span className="font-semibold">Địa chỉ:</span> {selectedOrder.customer.address}</p>
                                                            <p className="text-red-600"><span className="font-semibold text-gray-600">Ghi chú khách:</span> {selectedOrder.delivery.notes || 'Không có'}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 mb-3">Thanh toán & Vận chuyển</h4>
                                                        <div className="space-y-2 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                                                            <div className="flex justify-between"><span>Tổng tiền:</span> <span className="font-bold text-gray-900">{formatCurrency(selectedOrder.totalPrice)}</span></div>
                                                            <div className="flex justify-between"><span>Cọc/Thanh toán:</span> <span className="font-bold text-blue-600">{formatCurrency(selectedOrder.amountToPay)} ({selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Full'})</span></div>
                                                            <div className="flex justify-between"><span>Còn lại:</span> <span className="font-bold text-red-600">{formatCurrency(selectedOrder.totalPrice - selectedOrder.amountToPay)}</span></div>
                                                            <div className="border-t border-gray-200 my-2 pt-2">
                                                                <p><strong>Ship:</strong> {selectedOrder.shipping.method === 'bookship' ? 'Book ngoài' : selectedOrder.shipping.method === 'express' ? 'Nhanh' : 'Thường'}</p>
                                                                <p><strong>Ngày nhận mong muốn:</strong> {new Date(selectedOrder.delivery.date).toLocaleDateString('vi-VN')}</p>
                                                            </div>
                                                            
                                                            {/* QR Code Toggle */}
                                                            <div className="pt-2 mt-2 border-t border-gray-200">
                                                                <details className="group">
                                                                    <summary className="cursor-pointer text-xs font-bold text-blue-600 hover:underline">Xem mã QR thanh toán</summary>
                                                                    <div className="mt-2 flex justify-center bg-white p-2 rounded border">
                                                                        <img src={getVietQR(selectedOrder)} alt="VietQR" className="w-32 h-32" />
                                                                    </div>
                                                                </details>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Warehouse Info */}
                                                {selectedOrder.packedBy && (
                                                    <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800 flex items-center gap-2">
                                                        <span>✅ Đã đóng gói bởi <strong>{selectedOrder.packedBy}</strong> lúc {formatDateTime(new Date(selectedOrder.packedAt!).getTime())}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Footer Actions */}
                                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                                                {/* Warehouse Action */}
                                                {role === 'warehouse' && selectedOrder.status === 'Đang đóng hàng' && !selectedOrder.packedBy ? (
                                                    <button onClick={handleMarkAsPacked} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow hover:bg-indigo-700">Xác nhận đã đóng gói</button>
                                                ) : (
                                                    <div className="text-xs text-gray-400 italic">Mã đơn: {selectedOrder.id}</div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd"/></svg>
                                        <p>Chọn một đơn hàng để xem chi tiết</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PRODUCTS TAB --- */}
                {activeTab === 'products' && role === 'admin' && (
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                            <div className="flex gap-4 w-full sm:w-auto">
                                <div className="relative flex-grow sm:flex-grow-0">
                                    <input 
                                        type="text" 
                                        placeholder="Tìm kiếm phụ kiện..." 
                                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                    />
                                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                </div>
                                <select 
                                    className="p-2 border border-gray-300 rounded-lg focus:outline-none"
                                    value={productCategory}
                                    onChange={e => setProductCategory(e.target.value)}
                                >
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
                                <button onClick={handleSeedData} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Reset Default Data</button>
                                <button onClick={() => {setEditingPart(null); setIsEditingProduct(true);}} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black text-sm font-bold shadow-lg shadow-gray-200">+ Thêm mới</button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-20">Đang tải...</div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                                        <tr>
                                            <th className="px-6 py-4 w-20">Ảnh</th>
                                            <th className="px-6 py-4">Tên</th>
                                            <th className="px-6 py-4">Loại</th>
                                            <th className="px-6 py-4 text-right">Giá</th>
                                            <th className="px-6 py-4 text-center w-32">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {filteredProducts.map(part => (
                                            <tr key={part.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="w-10 h-10 rounded bg-gray-100 border flex items-center justify-center overflow-hidden">
                                                        <img src={part.imageUrl} alt="" className="w-full h-full object-contain" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 font-medium text-gray-900">{part.name}</td>
                                                <td className="px-6 py-3">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 border">{part.type}</span>
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono">{formatCurrency(part.price)}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => {setEditingPart(part); setIsEditingProduct(true);}} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                                                        <button onClick={() => handleDeleteProduct(part.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredProducts.length === 0 && <div className="text-center py-12 text-gray-500">Không tìm thấy sản phẩm nào</div>}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Product Edit Modal */}
            {isEditingProduct && (
                <ProductForm 
                    initialData={editingPart} 
                    onSave={handleSaveProduct} 
                    onCancel={() => { setIsEditingProduct(false); setEditingPart(null); }} 
                />
            )}
        </div>
    );
};

export default AdminPage;
