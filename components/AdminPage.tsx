
// components/AdminPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getAllOrders, updateOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart } from '../types';

// --- COMPONENT: FORM SẢN PHẨM (MODAL) ---
const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
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
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">URL Hình ảnh</label>
                            <div className="flex gap-3">
                                <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="flex-grow p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" placeholder="https://..." />
                                {formData.imageUrl && <div className="w-10 h-10 border rounded bg-gray-100 flex-shrink-0 overflow-hidden"><img src={formData.imageUrl} alt="" className="w-full h-full object-contain" /></div>}
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
                    <button onClick={() => onSave(formData)} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded transition-colors shadow-sm">Lưu thay đổi</button>
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
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products'>('dashboard');
    
    // Stats Filters
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(thirtyDaysAgo); 
    const [endDate, setEndDate] = useState(today); 

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
    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');

    // Stats Logic
    const stats = useMemo(() => {
        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();

        const filteredOrders = orders.filter(order => {
            if (!order.id) return false; 
            const orderTimestamp = Number(order.id.slice(-13, -6)) * 1000; 
            if (orderTimestamp) {
                 return orderTimestamp >= startTimestamp && orderTimestamp <= endTimestamp;
            }
            return true; 
        });

        const totalRevenue = filteredOrders.reduce((acc, order) => acc + order.totalPrice, 0);
        const totalOrders = filteredOrders.length;
        const urgentOrders = filteredOrders.filter(o => o.isUrgent).length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        return { totalRevenue, totalOrders, urgentOrders, avgOrderValue };
    }, [orders, startDate, endDate]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = productCategory === 'all' || p.type === productCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, productSearch, productCategory]);

    const sortedOrders = useMemo(() => {
        let result = [...orders];
        if (sortMode === 'urgent') {
            result.sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                if (a.adminDeadline && !b.adminDeadline) return -1;
                if (!a.adminDeadline && b.adminDeadline) return 1;
                if (a.adminDeadline && b.adminDeadline) return new Date(a.adminDeadline).getTime() - new Date(b.adminDeadline).getTime();
                return 0;
            });
        } else {
            result.sort((a, b) => (a.id < b.id ? 1 : -1));
        }
        return result;
    }, [orders, sortMode]);

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-96 text-center">
                    <h1 className="text-2xl font-bold mb-1 text-gray-900">The Luvin Admin</h1>
                    <p className="text-gray-500 mb-8 text-sm">Vui lòng đăng nhập để tiếp tục</p>
                    <form onSubmit={handleLogin} className="space-y-4 text-left">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                            <input type="email" className="w-full p-2.5 border border-gray-300 rounded focus:border-gray-900 focus:ring-0 outline-none transition-colors bg-gray-50 focus:bg-white" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mật khẩu</label>
                            <input type="password" className="w-full p-2.5 border border-gray-300 rounded focus:border-gray-900 focus:ring-0 outline-none transition-colors bg-gray-50 focus:bg-white" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
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
            {/* Top Navigation */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="text-xl font-bold tracking-tight">The Luvin <span className="font-normal text-gray-400">| Admin</span></div>
                        <nav className="hidden md:flex gap-1">
                            {['dashboard', 'orders', 'products'].map(tab => (
                                <button 
                                    key={tab} 
                                    onClick={() => setActiveTab(tab as any)} 
                                    className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 font-medium hidden sm:block">{currentUser.email}</span>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 text-sm font-medium transition-colors">Đăng xuất</button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto py-8 px-4 sm:px-6">
                {/* --- DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                             <div>
                                <h2 className="text-lg font-bold text-gray-900">Tổng quan kinh doanh</h2>
                                <p className="text-sm text-gray-500">Số liệu thống kê theo thời gian thực</p>
                             </div>
                             <div className="flex items-center gap-3">
                                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-500" />
                                 <span className="text-gray-400 text-sm">to</span>
                                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-500" />
                             </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Doanh thu</p>
                                <p className="text-3xl font-light text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tổng đơn hàng</p>
                                <p className="text-3xl font-light text-gray-900">{stats.totalOrders}</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Giá trị trung bình</p>
                                <p className="text-3xl font-light text-gray-900">{formatCurrency(stats.avgOrderValue)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Đơn cần gấp</p>
                                <p className="text-3xl font-light text-red-600">{stats.urgentOrders}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ORDERS --- */}
                {activeTab === 'orders' && (
                     <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
                        {/* Order List Sidebar */}
                        <div className="lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2">
                                <button onClick={() => setSortMode('newest')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'newest' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>Mới nhất</button>
                                <button onClick={() => setSortMode('urgent')} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${sortMode === 'urgent' ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-500 hover:text-gray-900'}`}>Cần gấp</button>
                            </div>
                            <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                                {sortedOrders.map(order => (
                                    <div 
                                        key={order.id} 
                                        onClick={() => setSelectedOrder(order)} 
                                        className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-gray-50' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-mono font-medium ${order.isUrgent ? 'text-red-600' : 'text-gray-900'}`}>
                                                {order.id}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                                order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : 
                                                order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                             <p className="text-sm text-gray-600 truncate max-w-[150px]">{order.customer.name}</p>
                                             <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalPrice)}</p>
                                        </div>
                                        {(order.adminDeadline || order.delivery.date) && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                {order.adminDeadline ? `DL: ${formatDate(order.adminDeadline)}` : `Giao: ${formatDate(order.delivery.date)}`}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Detail View */}
                        <div className="lg:w-2/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                            {selectedOrder ? (
                                <div className="flex flex-col h-full">
                                    {/* Header Detail */}
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                                {selectedOrder.id}
                                                {selectedOrder.isUrgent && <span className="text-red-500 text-lg" title="Đơn gấp">🔥</span>}
                                            </h2>
                                            <p className="text-sm text-gray-500 mt-1">Đặt ngày {new Date(Number(selectedOrder.id.slice(3)) || Date.now()).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <span className="text-xs font-medium text-gray-500">Đánh dấu Gấp</span>
                                                <input type="checkbox" className="accent-red-600 w-4 h-4" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex-grow overflow-y-auto p-6 space-y-8">
                                        {/* Admin Notes Section */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú nội bộ</label>
                                                <textarea 
                                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" 
                                                    rows={2}
                                                    placeholder="Ghi chú cho admin..." 
                                                    value={noteInput} 
                                                    onChange={(e) => setNoteInput(e.target.value)} 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deadline Xưởng (Admin)</label>
                                                <input 
                                                    type="date" 
                                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" 
                                                    value={adminDeadlineInput} 
                                                    onChange={(e) => setAdminDeadlineInput(e.target.value)} 
                                                />
                                                <div className="mt-2 text-right">
                                                     <button onClick={handleSaveAdminInfo} className="text-xs font-bold text-white bg-gray-900 px-3 py-1.5 rounded hover:bg-black transition-colors">Lưu Ghi chú</button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Columns */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Khách hàng</h3>
                                                <div className="space-y-2 text-sm text-gray-700">
                                                    <p><span className="text-gray-500 w-20 inline-block">Tên:</span> {selectedOrder.customer.name}</p>
                                                    <p><span className="text-gray-500 w-20 inline-block">SĐT:</span> {selectedOrder.customer.phone}</p>
                                                    <p><span className="text-gray-500 w-20 inline-block">Email:</span> {selectedOrder.customer.email}</p>
                                                    <p className="flex items-start"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Địa chỉ:</span> <span>{selectedOrder.customer.address}</span></p>
                                                    <p className="flex items-start mt-2"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Note:</span> <span className="italic bg-yellow-50 px-2 py-0.5 rounded text-gray-800">{selectedOrder.delivery.notes || 'Không có'}</span></p>
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Thanh toán & Vận chuyển</h3>
                                                <div className="space-y-2 text-sm text-gray-700">
                                                    <p><span className="text-gray-500 w-24 inline-block">Phương thức:</span> {selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Toàn bộ'}</p>
                                                    <p><span className="text-gray-500 w-24 inline-block">Vận chuyển:</span> {selectedOrder.shipping.method}</p>
                                                    <div className="border-t border-gray-100 my-2 pt-2">
                                                        <p><span className="text-gray-500 w-24 inline-block">Tổng đơn:</span> <span className="font-bold">{formatCurrency(selectedOrder.totalPrice)}</span></p>
                                                        <p><span className="text-gray-500 w-24 inline-block">Cần thu:</span> <span className="font-bold text-red-600">{formatCurrency(selectedOrder.amountToPay)}</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Products */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">Chi tiết sản phẩm</h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                {selectedOrder.items.map((item, idx) => (
                                                    <div key={idx} className="flex gap-4 border border-gray-100 rounded-lg p-4 items-start bg-white">
                                                        <div className="w-24 h-24 bg-gray-50 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                            {item.previewImageUrl ? <img src={item.previewImageUrl} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">No img</span>}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-800 mb-1">Khung {item.frameId.toUpperCase()}</p>
                                                            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                                                                <li>{item.characters.length} nhân vật</li>
                                                                <li>Nền: {item.background.type}</li>
                                                                {/* Liệt kê nhanh các phụ kiện nếu cần */}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2 justify-end">
                                        {['Chờ thanh toán', 'Đã xác nhận', 'Đang xử lý', 'Đang giao hàng', 'Đã giao hàng', 'Hủy đơn'].map(st => (
                                            <button 
                                                key={st} 
                                                onClick={() => handleUpdate(selectedOrder.id, { status: st })} 
                                                className={`px-4 py-2 text-xs font-medium rounded-md border transition-all ${
                                                    selectedOrder.status === st 
                                                    ? 'bg-gray-900 text-white border-gray-900' 
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                    <span>Chọn đơn hàng để xem chi tiết</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- PRODUCTS --- */}
                {activeTab === 'products' && (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-140px)] animate-fade-in">
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-gray-900">Kho Sản phẩm</h2>
                                <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">{products.length}</span>
                            </div>
                            <div className="flex flex-grow md:flex-grow-0 gap-3 w-full md:w-auto">
                                <input 
                                    type="text" 
                                    placeholder="Tìm kiếm..." 
                                    className="p-2 border border-gray-300 rounded text-sm w-full md:w-64 focus:border-gray-900 focus:ring-0 outline-none" 
                                    value={productSearch} 
                                    onChange={e => setProductSearch(e.target.value)} 
                                />
                                <select 
                                    className="p-2 border border-gray-300 rounded text-sm focus:border-gray-900 focus:ring-0 outline-none" 
                                    value={productCategory} 
                                    onChange={e => setProductCategory(e.target.value)}
                                >
                                    <option value="all">Tất cả danh mục</option>
                                    <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option>
                                </select>
                                <button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-black whitespace-nowrap shadow-sm">Thêm mới</button>
                            </div>
                        </div>
                        
                        <div className="flex-grow overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">Hình ảnh</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Tên sản phẩm</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Loại</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Giá</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.length > 0 ? filteredProducts.map(part => (
                                        <tr key={part.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="p-3 border-b border-gray-100">
                                                <div className="w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                                                    <img src={part.imageUrl} alt="" className="w-full h-full object-contain" />
                                                </div>
                                            </td>
                                            <td className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900">{part.name}</td>
                                            <td className="p-3 border-b border-gray-100 text-sm text-gray-500 capitalize">{part.type}</td>
                                            <td className="p-3 border-b border-gray-100 text-sm font-medium text-gray-900">{formatCurrency(part.price)}</td>
                                            <td className="p-3 border-b border-gray-100 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">Sửa</button>
                                                    <button onClick={() => handleDeleteProduct(part.id)} className="text-xs font-bold text-red-600 hover:underline bg-red-50 px-2 py-1 rounded">Xóa</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center text-gray-400 text-sm">Không tìm thấy sản phẩm nào.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                         {products.length === 0 && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center">
                                <button onClick={handleSeedData} className="text-xs text-gray-500 underline hover:text-gray-900">Database trống? Bấm để đồng bộ dữ liệu mẫu</button>
                            </div>
                         )}
                    </div>
                )}

                {isEditingProduct && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={() => setIsEditingProduct(false)} />}
                {loading && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50"><div className="text-gray-900 font-bold">Đang xử lý...</div></div>}
            </main>
        </div>
    );
};

export default AdminPage;
