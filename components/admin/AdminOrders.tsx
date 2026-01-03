
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, LegoPart, FrameOption, LegoCharacterConfig, DraggableItem, FrameConfig } from '../../types';
import { updateOrder, deleteOrder, countPartsInOrder } from '../../services/orderService';
import { adjustStock } from '../../services/productService';
import { calculatePrice, formatCurrency } from '../../utils/pricing';
import { StatusDropdown } from './shared/StatusDropdown';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';
import { ZoomIcon } from '../ZoomIcon';
import FramePreview from '../FramePreview';

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

const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');
const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN');

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

const getVietQR = (order: Order) => {
    const BANK_ID = '970407'; 
    const ACCOUNT_NO = '65838666666';
    const TEMPLATE = 'compact2';
    const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
    const amount = order.amountToPay || order.totalPrice;
    return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
};

const downloadImage = async (url: string, filename: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(url, '_blank');
    }
};

interface AdminOrdersProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    products: LegoPart[];
    frames: FrameOption[];
    currentUser: any;
    role: 'admin' | 'warehouse' | null;
    onRefreshProducts: () => void;
}

export const AdminOrders: React.FC<AdminOrdersProps> = ({ orders, setOrders, products, frames, currentUser, role, onRefreshProducts }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);
    const [amountPaidInput, setAmountPaidInput] = useState(0);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [orderTab, setOrderTab] = useState<'active' | 'history'>('active');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [orderSearch, setOrderSearch] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [addingAccessoryToItemIndex, setAddingAccessoryToItemIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const canCancelOrder = role === 'admin';
    const canDeleteOrder = role === 'admin';

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
            setAdminDeadlineInput(selectedOrder.adminDeadline || '');
        }
    }, [selectedOrder]);

    useEffect(() => {
        setCurrentPage(1);
    }, [orderTab, filterStatus, orderSearch, itemsPerPage]);

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

    const filteredOrders = useMemo(() => {
        let result = [...orders];
        if (orderTab === 'active') {
            result = result.filter(o => !['Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'].includes(o.status));
        } else {
            result = result.filter(o => ['Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'].includes(o.status));
        }
        if (orderSearch.trim()) {
            const searchLower = orderSearch.trim().toLowerCase();
            result = result.filter(o => 
                o.id.toLowerCase().includes(searchLower) || 
                o.customer.phone.includes(searchLower) ||
                (o.customer.name && o.customer.name.toLowerCase().includes(searchLower))
            );
        }
        if (filterStatus !== 'all') {
            result = result.filter(o => o.status === filterStatus);
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
    }, [orders, orderTab, sortMode, filterStatus, orderSearch]);

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
    };

    const handleMouseLeave = () => { setIsDragging(false); };
    const handleMouseUp = () => { setIsDragging(false); };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 1.5; 
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => {
        const docRef = orders.find(o => o.id === orderId);
        if (updates.status === 'Đã xác nhận' && docRef) {
            if (!docRef.amountPaid || docRef.amountPaid === 0) {
                const expectedPayment = docRef.payment.method === 'deposit'
                    ? Math.round(docRef.totalPrice * 0.7)
                    : docRef.totalPrice;
                updates.amountPaid = expectedPayment;
                updates.amountToPay = docRef.totalPrice - expectedPayment;
            }
        }
        const success = await updateOrder(orderId, updates); 
        if (success) { 
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); 
            if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); 
            if (showMsg) alert("Đã cập nhật!"); 
        } else {
            alert("Lỗi: Không thể cập nhật đơn hàng.");
        }
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (!canDeleteOrder) { alert("Bạn không có quyền xóa đơn hàng."); return; }
        if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XOÁ VĨNH VIỄN đơn hàng ${selectedOrder.id} không?`)) {
            setIsLoading(true);
            await deleteOrder(selectedOrder.id);
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            setSelectedOrder(null);
            setIsLoading(false);
            alert('Đã xoá đơn hàng.');
        }
    };

    const handleSaveAdminInfo = () => { if (selectedOrder) { handleUpdate(selectedOrder.id, { internalNotes: noteInput, adminDeadline: adminDeadlineInput }); } };

    const handleMarkAsPacked = async () => {
        if (!selectedOrder || !currentUser) return;
        if (confirm(`Xác nhận bạn (${currentUser.email}) đã đóng gói đơn này?`)) {
            const now = new Date().toISOString();
            const success = await updateOrder(selectedOrder.id, { status: 'Chờ chuyển hàng', packedBy: currentUser.email, packedAt: now });
            if (success) {
                setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: 'Chờ chuyển hàng', packedBy: currentUser.email, packedAt: now } : o));
                setSelectedOrder(prev => prev ? { ...prev, status: 'Chờ chuyển hàng', packedBy: currentUser.email, packedAt: now } : null);
                alert("Đã xác nhận đóng gói thành công!");
            } else {
                alert("LỖI: Không thể cập nhật trạng thái đơn hàng.");
            }
        }
    };

    const handleConfirmPayment = async () => {
        if (!selectedOrder) return;
        const expectedPayment = selectedOrder.payment.method === 'deposit' ? Math.round(selectedOrder.totalPrice * 0.7) : selectedOrder.totalPrice;
        await handleUpdate(selectedOrder.id, { status: 'Đã xác nhận', amountPaid: expectedPayment, amountToPay: selectedOrder.totalPrice - expectedPayment }, true);
    };

    const handlePrintOrder = () => {
        if (!selectedOrder) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Phiếu Giao Hàng - ${selectedOrder.id}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; color: #000; font-size: 14px; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .title { font-size: 24px; font-weight: bold; margin: 0; }
                    .subtitle { font-size: 14px; margin-top: 5px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                    .box { border: 1px solid #000; padding: 15px; border-radius: 4px; }
                    .box-title { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; display: block; font-size: 12px; }
                    .item-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .item-table th, .item-table td { border: 1px solid #000; padding: 8px; text-align: left; }
                    .item-table th { background: #f0f0f0; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="header"><h1 class="title">THE LUVIN - PHIẾU GIAO HÀNG</h1><p class="subtitle">Hotline: 0964 393 115</p></div>
                <div class="info-grid">
                    <div class="box"><span class="box-title">Người nhận</span><p><strong>${selectedOrder.customer.name}</strong></p><p>${selectedOrder.customer.phone}</p><p>${selectedOrder.customer.address}</p><p>Ghi chú: ${selectedOrder.delivery.notes || 'Không'}</p></div>
                    <div class="box"><span class="box-title">Đơn hàng</span><p>Mã: <strong>${selectedOrder.id}</strong></p><p>Ngày: ${new Date(selectedOrder.createdAt).toLocaleDateString('vi-VN')}</p><p>Thu COD: <strong>${formatCurrency(selectedOrder.totalPrice - (selectedOrder.amountPaid || 0), 'admin')}</strong></p></div>
                </div>
                <table class="item-table">
                    <thead><tr><th>STT</th><th>Sản phẩm</th><th>Chi tiết / Custom Info</th><th>SL</th></tr></thead>
                    <tbody>
                        ${selectedOrder.items.map((item, idx) => {
                            const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
                            const customInfo = item.customFormData ? Object.entries(item.customFormData).map(([k, v]) => `<div>- ${k}: ${v.startsWith('data:') ? '[Ảnh đính kèm]' : v}</div>`).join('') : 'Không có thông tin thêm';
                            return `<tr><td style="text-align: center">${idx + 1}</td><td><strong>Khung LEGO ${frame?.name || item.frameId}</strong></td><td style="font-size: 11px;">${item.characters.map((c,ci)=>`NV${ci+1}: ${c.hair?.name||'-'}`).join(', ')} <br/> <strong>Custom Info:</strong> ${customInfo}</td><td style="text-align: center">${item.quantity || 1}</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <div class="footer"><p>Cảm ơn quý khách!</p></div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };

    const handleVisualTransform = (itemIndex: number, itemId: string, newTransform: any) => {
        if (!editForm) return;
        const [type, idStr] = itemId.split('-');
        const rawId = parseInt(idStr);
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const currentItem = { ...newItems[itemIndex] };
            if (type === 'text') currentItem.texts = currentItem.texts.map(t => t.id === rawId ? { ...t, ...newTransform } : t);
            else if (type === 'character') currentItem.characters = currentItem.characters.map(c => c.id === rawId ? { ...c, ...newTransform } : c);
            else if (type === 'item') currentItem.draggableItems = currentItem.draggableItems.map(i => i.id === rawId ? { ...i, ...newTransform } : i);
            else if (type === 'shape') currentItem.shapes = (currentItem.shapes || []).map(s => s.id === rawId ? { ...s, ...newTransform } : s);
            newItems[itemIndex] = currentItem;
            newOrder.items = newItems;
            return newOrder;
        });
    };

    const startEditingOrder = () => { if (selectedOrder) { setEditForm(JSON.parse(JSON.stringify(selectedOrder))); setAmountPaidInput(selectedOrder.amountPaid || 0); setIsEditingOrder(true); } };
    const cancelEditingOrder = () => { setEditForm(null); setIsEditingOrder(false); setEditingItemId(null); };

    const saveOrderChanges = async () => {
        if (!editForm || !selectedOrder) return;
        setIsLoading(true);
        const finalTotalPrice = editForm.totalPrice; 
        const finalAmountPaid = amountPaidInput;
        const finalAmountToPay = Math.max(0, finalTotalPrice - finalAmountPaid);
        const finalOrder = { ...editForm, amountPaid: finalAmountPaid, amountToPay: finalAmountToPay };
        await handleUpdate(selectedOrder.id, finalOrder, false);
        setIsEditingOrder(false); setEditForm(null); setIsLoading(false);
    };

    const handleEditFormChange = (field: string, value: any, nestedField?: string) => {
        if (!editForm) return;
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            if (nestedField && field === 'customer') newOrder.customer = { ...newOrder.customer, [nestedField]: value };
            else if (field === 'delivery' && nestedField) newOrder.delivery = { ...newOrder.delivery, [nestedField]: value };
            else (newOrder as any)[field] = value;
            return newOrder;
        });
    };

    const isOrderPacked = selectedOrder ? ['Chờ chuyển hàng', 'Gửi hàng đi', 'Đã giao hàng'].includes(selectedOrder.status) : false;

    return (
        <div className="flex h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] animate-fade-in relative">
            <div className={`lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden absolute inset-0 lg:static z-10 ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2 flex-col">
                    <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                        <button onClick={() => setOrderTab('active')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Đang xử lý</button>
                        <button onClick={() => setOrderTab('history')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Lịch sử</button>
                    </div>
                    <input type="text" placeholder="Tìm kiếm..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                    {paginatedOrders.map(order => (
                        <div key={order.id} onClick={() => { setSelectedOrder(order); setIsEditingOrder(false); }} className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-gray-50' : ''}`}>
                            <p className="font-mono font-bold text-sm">{order.id} {order.isUrgent && '🔥'}</p>
                            <p className="text-sm text-gray-600 truncate">{order.customer.name} - {order.customer.phone}</p>
                            <div className="flex justify-between mt-1 items-center">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100`}>{order.status}</span>
                                <span className="text-xs font-bold">{formatCurrency(order.totalPrice, 'admin')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={`lg:w-2/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden absolute inset-0 lg:static z-20 ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                {selectedOrder ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-white sticky top-0 z-30 shadow-sm">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedOrder(null)} className="lg:hidden p-2 hover:bg-gray-100 rounded-full">←</button>
                                <h2 className="text-lg sm:text-2xl font-bold">{selectedOrder.id}</h2>
                                <StatusDropdown currentStatus={selectedOrder.status} onStatusChange={(status) => handleUpdate(selectedOrder.id, { status })} onDelete={handleDeleteOrder} canCancel={canCancelOrder} canDelete={canDeleteOrder} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handlePrintOrder} className="bg-gray-100 px-3 py-1.5 rounded text-sm font-bold">In phiếu</button>
                                {!isEditingOrder ? <button onClick={startEditingOrder} className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-bold">Sửa</button> : <button onClick={saveOrderChanges} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold">Lưu</button>}
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <h3 className="font-bold text-sm uppercase mb-3 text-gray-500">Người nhận</h3>
                                    <p className="font-bold text-gray-900">{selectedOrder.customer.name}</p>
                                    <p className="text-sm text-gray-600">{selectedOrder.customer.phone}</p>
                                    <p className="text-sm text-gray-600">{selectedOrder.customer.address}</p>
                                    <p className="text-xs italic mt-2 text-pink-600">Note: {selectedOrder.delivery.notes || 'Không'}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <h3 className="font-bold text-sm uppercase mb-3 text-gray-500">Thanh toán</h3>
                                    <div className="flex justify-between text-sm"><span>Tổng đơn:</span><span className="font-bold">{formatCurrency(selectedOrder.totalPrice, 'admin')}</span></div>
                                    <div className="flex justify-between text-sm text-green-600"><span>Đã thanh toán:</span><span className="font-bold">{formatCurrency(selectedOrder.amountPaid || 0, 'admin')}</span></div>
                                    <div className="flex justify-between text-lg font-bold text-red-600 border-t mt-2 pt-2"><span>Thu COD:</span><span>{formatCurrency(selectedOrder.totalPrice - (selectedOrder.amountPaid || 0), 'admin')}</span></div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase text-gray-500 border-b pb-2">Sản phẩm chi tiết</h3>
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} className="border rounded-xl p-4 bg-white shadow-sm space-y-4">
                                        <div className="flex gap-4">
                                            <img src={item.previewImageUrl} className="w-24 h-24 object-contain bg-gray-50 rounded border" onClick={() => item.previewImageUrl && setZoomedImageUrl(item.previewImageUrl)} />
                                            <div className="flex-grow">
                                                <p className="font-bold text-gray-900">Khung LEGO {item.frameId.toUpperCase()} x{item.quantity || 1}</p>
                                                <p className="text-xs text-gray-500">Màu khung: {item.frameColor} | Nền: {item.background.type}</p>
                                                
                                                {/* HIỂN THỊ THÔNG TIN KHÁCH ĐIỀN (STEP 2) - CỰC KỲ QUAN TRỌNG */}
                                                {item.customFormData && Object.keys(item.customFormData).length > 0 && (
                                                    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                            <span>📝</span> Thông tin khách điền (Step 2)
                                                        </p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                            {Object.entries(item.customFormData).map(([key, value]) => {
                                                                if (!value) return null;
                                                                const isImage = value.startsWith('data:image') || value.startsWith('http');
                                                                return (
                                                                    <div key={key} className="flex flex-col border-b border-blue-100/50 pb-1">
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">{key}</span>
                                                                        {isImage ? (
                                                                            <div className="mt-1 relative w-16 h-16 group cursor-zoom-in" onClick={() => setZoomedImageUrl(value)}>
                                                                                <img src={value} className="w-full h-full object-cover rounded border border-blue-200" alt="custom" />
                                                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded"><ZoomIcon className="text-white w-4 h-4" /></div>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-sm font-bold text-blue-900 break-words">{value}</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                            {item.characters.map((c, ci) => (
                                                <div key={ci} className="text-[11px] bg-gray-50 p-2 rounded border">
                                                    <p className="font-bold mb-1">Nhân vật ${ci+1}</p>
                                                    <p>Tóc: {c.hair?.name || '-'} | Áo: {c.shirt?.name || '-'} (${c.selectedShirtColor?.name || ''})</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-gray-400">Chọn đơn hàng để xem</div>
                )}
            </div>

            {zoomedImageUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImageUrl(null)}>
                    <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain" />
                </div>
            )}
        </div>
    );
};
