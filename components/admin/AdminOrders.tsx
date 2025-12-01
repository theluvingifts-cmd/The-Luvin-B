
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, LegoPart, FrameOption, LegoCharacterConfig, DraggableItem, FrameConfig } from '../../types';
import { updateOrder, deleteOrder, countPartsInOrder } from '../../services/orderService';
import { adjustStock } from '../../services/productService';
import { calculateOrderTotal, formatCurrency } from '../../utils/pricing';
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

interface AdminOrdersProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    products: LegoPart[];
    frames: FrameOption[];
    currentUser: any;
    role: 'admin' | 'warehouse' | null;
    onRefreshProducts: () => void;
}

type OrderTab = 'active' | 'history';

export const AdminOrders: React.FC<AdminOrdersProps> = ({ orders, setOrders, products, frames, currentUser, role, onRefreshProducts }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    // Filtering & Tabs
    const [orderTab, setOrderTab] = useState<OrderTab>('active');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [orderSearch, setOrderSearch] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [addingAccessoryToItemIndex, setAddingAccessoryToItemIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Manual Payment Edit State
    const [tempPaidAmount, setTempPaidAmount] = useState<number | string>(0);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const canCancelOrder = role === 'admin';
    const canDeleteOrder = role === 'admin';

    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
            setAdminDeadlineInput(selectedOrder.adminDeadline || '');
            // Initialize paid amount based on total - amountToPay
            setTempPaidAmount(selectedOrder.totalPrice - selectedOrder.amountToPay);
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
                o.customer.phone.includes(searchLower)
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
        const success = await updateOrder(orderId, updates); 
        if (success) { 
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); 
            if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); 
            if (showMsg) alert("Đã cập nhật!"); 
        } else {
            alert("Lỗi: Không thể cập nhật đơn hàng.");
        }
    };

    const handleUpdatePaidAmount = async () => {
        if (!selectedOrder) return;
        const paid = typeof tempPaidAmount === 'string' ? parseInt(tempPaidAmount) : tempPaidAmount;
        if (isNaN(paid)) {
            alert("Số tiền không hợp lệ");
            return;
        }
        // Calculate new remaining amount (amountToPay)
        const newRemaining = Math.max(0, selectedOrder.totalPrice - paid);
        
        await handleUpdate(selectedOrder.id, { amountToPay: newRemaining });
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
            }
        }
    };

    const handlePrintOrder = () => {
        if (!selectedOrder) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        // Calculate subtotal for breakdown
        const shippingFee = selectedOrder.shipping.fee || 0;
        const boxFee = selectedOrder.addGiftBox ? 30000 : 0;
        const discount = selectedOrder.discountAmount || 0;
        const itemTotal = selectedOrder.totalPrice - shippingFee - boxFee + discount;

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
                    .item-table { w-full; width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .item-table th, .item-table td { border: 1px solid #000; padding: 8px; text-align: left; }
                    .item-table th { background: #f0f0f0; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; font-style: italic; }
                    .price-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                    @media print {
                        @page { margin: 0.5cm; }
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="title">THE LUVIN - PHIẾU GIAO HÀNG</h1>
                    <p class="subtitle">Hotline: 0964 393 115 - Facebook: The Luvin</p>
                </div>
                <div class="info-grid">
                    <div class="box">
                        <span class="box-title">Người nhận</span>
                        <p><strong>${selectedOrder.customer.name}</strong></p>
                        <p>${selectedOrder.customer.phone}</p>
                        <p>${selectedOrder.customer.address}</p>
                        <p style="margin-top: 5px; font-style: italic;">Ghi chú: ${selectedOrder.delivery.notes || 'Không'}</p>
                    </div>
                    <div class="box">
                        <span class="box-title">Thông tin thanh toán</span>
                        <div class="price-row"><span>Tiền hàng:</span> <span>${formatCurrency(itemTotal)}</span></div>
                        <div class="price-row"><span>Phí ship:</span> <span>${formatCurrency(shippingFee)}</span></div>
                        ${selectedOrder.addGiftBox ? `<div class="price-row"><span>Hộp quà:</span> <span>${formatCurrency(boxFee)}</span></div>` : ''}
                        ${discount > 0 ? `<div class="price-row"><span>Giảm giá:</span> <span>-${formatCurrency(discount)}</span></div>` : ''}
                        <div class="price-row" style="border-top: 1px dashed #ccc; padding-top: 4px; font-weight: bold;"><span>Tổng đơn:</span> <span>${formatCurrency(selectedOrder.totalPrice)}</span></div>
                        <div class="price-row"><span>Đã thanh toán:</span> <span>${formatCurrency(selectedOrder.totalPrice - selectedOrder.amountToPay)}</span></div>
                        <div class="price-row" style="margin-top: 8px; font-size: 16px; font-weight: bold;"><span>CẦN THU (COD):</span> <span>${formatCurrency(selectedOrder.amountToPay)}</span></div>
                    </div>
                </div>
                <table class="item-table">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Tên sản phẩm</th>
                            <th>Chi tiết</th>
                            <th>SL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedOrder.items.map((item, idx) => `
                            <tr>
                                <td style="text-align: center">${idx + 1}</td>
                                <td><strong>Khung LEGO ${item.frameId.toUpperCase()}</strong></td>
                                <td style="font-size: 12px;">
                                    ${item.characters.map((char, cIdx) => `
                                        <div>NV${cIdx + 1}: ${char.hair?.name || '-'}, ${char.face?.name || '-'}, ${char.shirt?.name || '-'}, ${char.pants?.name || '-'}</div>
                                    `).join('')}
                                    ${item.draggableItems.length > 0 ? `<div style="margin-top: 4px; color: #555;">+ ${item.draggableItems.length} phụ kiện/thú cưng</div>` : ''}
                                </td>
                                <td style="text-align: center">1</td>
                            </tr>
                        `).join('')}
                        ${selectedOrder.addGiftBox ? `
                            <tr>
                                <td style="text-align: center">${selectedOrder.items.length + 1}</td>
                                <td>Hộp quà cao cấp</td>
                                <td>Thiệp + Rơm + Nơ</td>
                                <td style="text-align: center">1</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Cảm ơn quý khách đã tin tưởng The Luvin!</p>
                    <p>Vui lòng quay video khi mở hàng để được hỗ trợ đổi trả tốt nhất.</p>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };

    // VISUAL TRANSFORM HANDLERS & EDITING LOGIC (Keep same as before, simplified for brevity here)
    const handleVisualTransform = (itemIndex: number, itemId: string, newTransform: any) => {
        if (!editForm) return;
        const [type, ...rest] = itemId.split('-');
        const rawId = rest.join('-');
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const currentItem = { ...newItems[itemIndex] };
            if (type === 'text') {
                const idToUpdate = parseInt(rawId);
                currentItem.texts = currentItem.texts.map(t => t.id === idToUpdate ? { ...t, ...newTransform } : t);
            } else {
                const idToUpdate = parseInt(rawId);
                if (type === 'character') currentItem.characters = currentItem.characters.map(c => c.id === idToUpdate ? { ...c, ...newTransform } : c);
                else if (type === 'item') currentItem.draggableItems = currentItem.draggableItems.map(i => i.id === idToUpdate ? { ...i, ...newTransform } : i);
            }
            newItems[itemIndex] = currentItem;
            newOrder.items = newItems;
            return newOrder;
        });
    };

    const startEditingOrder = () => { if (selectedOrder) { setEditForm(JSON.parse(JSON.stringify(selectedOrder))); setIsEditingOrder(true); } };
    const cancelEditingOrder = () => { setEditForm(null); setIsEditingOrder(false); setAddingAccessoryToItemIndex(null); setEditingItemId(null); };
    const saveOrderChanges = async () => {
        if (!editForm || !selectedOrder) return;
        setIsLoading(true);
        const oldParts = countPartsInOrder(selectedOrder.items);
        const newParts = countPartsInOrder(editForm.items);
        const stockAdjustments: Record<string, number> = {};
        Object.keys(oldParts).forEach(partId => { const diff = (oldParts[partId] || 0) - (newParts[partId] || 0); if (diff !== 0) stockAdjustments[partId] = diff; });
        Object.keys(newParts).forEach(partId => { if (!oldParts[partId]) stockAdjustments[partId] = -(newParts[partId]); });
        if (Object.keys(stockAdjustments).length > 0) { await adjustStock(stockAdjustments); onRefreshProducts(); }
        await handleUpdate(selectedOrder.id, editForm, false);
        setIsEditingOrder(false); setEditForm(null); setEditingItemId(null); setIsLoading(false); alert("Đã lưu thay đổi!");
    };

    // FORM HELPERS
    const updateEditFormWithPrice = (newOrder: Order) => {
        const { totalPrice, amountToPay } = calculateOrderTotal(newOrder, products, frames);
        const discount = newOrder.discountAmount || 0;
        const finalPrice = Math.max(0, totalPrice - discount);
        const finalAmountToPay = newOrder.payment.method === 'deposit' ? Math.round(finalPrice * 0.7) : finalPrice;
        return { ...newOrder, totalPrice: finalPrice, amountToPay: finalAmountToPay };
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
            } else if (nestedField && field === 'customer') newOrder.customer = { ...newOrder.customer, [nestedField]: value };
            else if (field === 'delivery' && nestedField) newOrder.delivery = { ...newOrder.delivery, [nestedField]: value };
            else (newOrder as any)[field] = value;
            return newOrder;
        });
    };
    
    // Character and Item Handlers (Simplified)
    const handleAddCharacter = (itemIndex: number) => {
        if (!editForm) return;
        const newChar: LegoCharacterConfig = { id: Date.now(), x: 50, y: 50, rotation: 0, scale: 1 };
        setEditForm(prev => prev ? updateEditFormWithPrice({...prev, items: prev.items.map((it, i) => i === itemIndex ? {...it, characters: [...it.characters, newChar]} : it)}) : null);
    };
    const handleRemoveCharacter = (itemIndex: number, charIndex: number) => {
        if (!editForm) return;
        setEditForm(prev => prev ? updateEditFormWithPrice({...prev, items: prev.items.map((it, i) => i === itemIndex ? {...it, characters: it.characters.filter((_, ci) => ci !== charIndex)} : it)}) : null);
    };
    const handleCharacterChange = (itemIndex: number, charIndex: number, partType: keyof LegoCharacterConfig, partId: string) => {
        if (!editForm) return;
        const selectedPart = products.find(p => p.id === partId);
        setEditForm(prev => {
            if (!prev) return null;
            const newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const newChars = [...newItems[itemIndex].characters];
            if (partId === "") newChars[charIndex] = { ...newChars[charIndex], [partType]: undefined };
            else if (selectedPart) {
                 newChars[charIndex] = { ...newChars[charIndex], [partType]: selectedPart };
                 if (partType === 'shirt') newChars[charIndex].selectedShirtColor = selectedPart.colors?.[0];
                 if (partType === 'pants') newChars[charIndex].selectedPantsColor = selectedPart.colors?.[0];
            }
            newItems[itemIndex] = { ...newItems[itemIndex], characters: newChars };
            newOrder.items = newItems;
            return updateEditFormWithPrice(newOrder);
        });
    };
    const handleRemoveDraggable = (itemIndex: number, dragIndex: number) => {
        if (!editForm) return;
        setEditForm(prev => prev ? updateEditFormWithPrice({...prev, items: prev.items.map((it, i) => i === itemIndex ? {...it, draggableItems: it.draggableItems.filter((_, di) => di !== dragIndex)} : it)}) : null);
    };
    const handleAddDraggable = (itemIndex: number, part: LegoPart) => {
        if (!editForm) return;
        const newItem: DraggableItem = { id: Date.now(), partId: part.id, type: part.type as any, x: 50, y: 50, rotation: 0, scale: 1 };
        setEditForm(prev => prev ? updateEditFormWithPrice({...prev, items: prev.items.map((it, i) => i === itemIndex ? {...it, draggableItems: [...it.draggableItems, newItem]} : it)}) : null);
        setAddingAccessoryToItemIndex(null);
    };

    const isOrderPacked = selectedOrder ? ['Chờ chuyển hàng', 'Gửi hàng đi', 'Đã giao hàng'].includes(selectedOrder.status) : false;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] animate-fade-in relative">
            {isLoading && <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]"><div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div><span className="font-bold text-sm">Đang xử lý...</span></div></div>}
            
            {/* Left Panel: Order List */}
            <div className={`lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden absolute inset-0 lg:static z-10 ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2 flex-col">
                    <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                        <button onClick={() => setOrderTab('active')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Đang xử lý ({orders.filter(o => !['Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'].includes(o.status)).length})</button>
                        <button onClick={() => setOrderTab('history')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Lịch sử ({orders.filter(o => ['Đã giao hàng', 'Huỷ đơn'].includes(o.status)).length})</button>
                    </div>
                    <div className="relative w-full mt-2">
                        <input type="text" placeholder="Tìm mã đơn hoặc SĐT..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-gray-900 outline-none" />
                        <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 cursor-grab active:cursor-grabbing mt-1" ref={scrollContainerRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
                        <button onClick={() => setFilterStatus('all')} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>Tất cả</button>
                        {STATUS_CONFIG.filter(s => !s.isAction).filter(s => orderTab === 'active' ? !['Đã giao hàng', 'Huỷ đơn'].includes(s.label) : ['Đã giao hàng', 'Huỷ đơn'].includes(s.label)).map(status => (
                            <button key={status.label} onClick={() => setFilterStatus(status.label)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === status.label ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>{status.label}</button>
                        ))}
                    </div>
                </div>

                <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                    {paginatedOrders.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">Không có đơn hàng nào.</div> : paginatedOrders.map(order => (
                        <div key={order.id} onClick={() => { setSelectedOrder(order); setIsEditingOrder(false); }} className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-gray-50' : ''}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-mono font-medium ${order.isUrgent ? 'text-red-600' : 'text-gray-900'}`}>{order.id}{order.paymentProofUrl && order.status === 'Chờ thanh toán' && <span className="ml-2 text-green-600 font-bold text-xs">📸</span>}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{order.status}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-gray-600 truncate max-w-[150px]">{order.customer.name}</p>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalPrice)}</p>
                                    <p className="text-[10px] text-gray-500">(Ship: {formatCurrency(order.shipping.fee)})</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-gray-400">{order.createdAt ? formatDateTime(order.createdAt) : '---'}</p>
                                {(order.adminDeadline || order.delivery.date) && <div className="text-right"><p className="text-xs text-gray-500">{order.adminDeadline ? `DL: ${formatDate(order.adminDeadline)}` : `Giao: ${formatDate(order.delivery.date)}`}</p>{order.delivery.date && getCountdownText(order.delivery.date)}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Order Detail */}
            <div className={`lg:w-2/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden absolute inset-0 lg:static z-20 ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                {selectedOrder ? (
                    <div className="flex flex-col h-full relative">
                        {/* Detail Header */}
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-start bg-white sticky top-0 z-30 shadow-sm">
                            <div className="flex items-start gap-2 w-full">
                                <button onClick={() => setSelectedOrder(null)} className="lg:hidden text-gray-600 mr-2 p-2 -ml-2 hover:bg-gray-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg></button>
                                <div className="flex-grow">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                                        <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">{selectedOrder.id}{selectedOrder.isUrgent && <span className="text-red-500 text-lg" title="Đơn gấp">🔥</span>}</h2>
                                        <div className="mt-1 sm:mt-0"><StatusDropdown currentStatus={selectedOrder.status} onStatusChange={(status) => handleUpdate(selectedOrder.id, { status })} onDelete={handleDeleteOrder} canCancel={canCancelOrder} canDelete={canDeleteOrder} /></div>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-1">Đặt lúc: {selectedOrder.createdAt ? formatDateTime(selectedOrder.createdAt) : '---'}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
                                 <div className="flex gap-2">
                                     <button onClick={handlePrintOrder} className="bg-gray-100 text-gray-700 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex items-center gap-1" title="In phiếu đóng gói"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg><span className="hidden sm:inline">In phiếu</span></button>
                                     {role === 'warehouse' && (selectedOrder.status === 'Đang đóng hàng' || selectedOrder.status === 'Ưu tiên xuất đơn' || selectedOrder.status === 'Chờ thanh toán' || selectedOrder.status === 'Đã xác nhận') && <button onClick={handleMarkAsPacked} className="bg-indigo-600 text-white p-2 sm:px-4 sm:py-2 rounded-lg font-bold text-sm shadow hover:bg-indigo-700 transition-colors flex items-center gap-2"><span>✅</span> <span className="hidden sm:inline">Xong</span></button>}
                                 </div>
                                 <div className="flex gap-2 mt-1">
                                    {!isEditingOrder ? <button onClick={startEditingOrder} disabled={isOrderPacked} className={`text-xs font-bold px-3 py-1.5 rounded whitespace-nowrap ${isOrderPacked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} title={isOrderPacked ? 'Không thể sửa đơn đã đóng/giao' : ''}>{isOrderPacked ? 'Đã khoá' : 'Sửa chi tiết'}</button> : <div className="flex gap-2"><button onClick={cancelEditingOrder} className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200">Huỷ</button><button onClick={saveOrderChanges} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Lưu</button></div>}
                                 </div>
                                 <label className="flex items-center gap-2 cursor-pointer select-none"><span className="text-xs font-medium text-gray-500">Gấp</span><input type="checkbox" className="accent-red-600 w-4 h-4" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} /></label>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
                            {/* Payment Proof */}
                            {selectedOrder.paymentProofUrl && <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm"><h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2"><span>📸</span> Ảnh xác nhận chuyển khoản</h4><div className="flex flex-col sm:flex-row items-start gap-4"><div className="h-32 w-auto border rounded-lg bg-white overflow-hidden cursor-pointer relative group" onClick={() => setZoomedImageUrl(selectedOrder.paymentProofUrl || null)}><img src={selectedOrder.paymentProofUrl} className="h-full w-full object-contain" /><div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ZoomIcon className="text-white w-6 h-6" /></div></div><div className="text-sm text-gray-600"><p>Thời gian gửi: {selectedOrder.paymentProofUploadedAt ? formatDateTime(new Date(selectedOrder.paymentProofUploadedAt).getTime()) : '---'}</p>{selectedOrder.status === 'Chờ thanh toán' && <button onClick={() => handleUpdate(selectedOrder.id, { status: 'Đã xác nhận' })} className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm">Xác nhận thanh toán ngay</button>}</div></div></div>}

                            {/* Info Grid */}
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
                                            </>
                                        ) : (
                                            <>
                                                <p><span className="text-gray-500 w-20 inline-block">Tên:</span> {selectedOrder.customer.name}</p>
                                                <p><span className="text-gray-500 w-20 inline-block">SĐT:</span> {selectedOrder.customer.phone}</p>
                                                <p className="flex items-start"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Địa chỉ:</span> <span>{selectedOrder.customer.address}</span></p>
                                                <p className="flex items-start mt-2"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Note:</span> <span className="italic bg-yellow-50 px-2 py-0.5 rounded text-gray-800">{selectedOrder.delivery.notes || 'Không có'}</span></p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Thanh toán & Vận chuyển</h3>
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <p><span className="text-gray-500 w-28 inline-block">Phương thức:</span> {selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Toàn bộ'}</p>
                                        <p><span className="text-gray-500 w-28 inline-block">Vận chuyển:</span> {selectedOrder.shipping.method}</p>
                                        
                                        <div className="border-t border-gray-100 my-2 pt-2 bg-gray-50 p-3 rounded-lg">
                                            {isEditingOrder && editForm ? (
                                                <>
                                                    <div className="flex items-center gap-2 mb-2"><span className="w-28 text-gray-500">Tổng đơn:</span> <input type="number" className="border rounded p-1 w-32 font-bold" value={editForm.totalPrice} onChange={e => handleEditFormChange('totalPrice', Number(e.target.value))} /></div>
                                                    <div className="flex items-center gap-2"><span className="w-28 text-gray-500">Cần thu:</span> <input type="number" className="border rounded p-1 w-32 font-bold text-red-600" value={editForm.amountToPay} onChange={e => handleEditFormChange('amountToPay', Number(e.target.value))} /></div>
                                                </>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Tổng tiền hàng:</span>
                                                        <span>{formatCurrency(selectedOrder.totalPrice - selectedOrder.shipping.fee - (selectedOrder.addGiftBox ? 30000 : 0) + (selectedOrder.discountAmount || 0))}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Phí Ship:</span>
                                                        <span>{formatCurrency(selectedOrder.shipping.fee)}</span>
                                                    </div>
                                                    {selectedOrder.addGiftBox && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Hộp quà:</span>
                                                            <span>{formatCurrency(30000)}</span>
                                                        </div>
                                                    )}
                                                    {selectedOrder.discountAmount && (
                                                        <div className="flex justify-between text-green-600">
                                                            <span>Giảm giá:</span>
                                                            <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                                                        </div>
                                                    )}
                                                    <div className="border-t border-gray-300 my-1"></div>
                                                    <div className="flex justify-between font-bold text-base">
                                                        <span>TỔNG ĐƠN:</span>
                                                        <span>{formatCurrency(selectedOrder.totalPrice)}</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed border-gray-300">
                                                        <span className="text-gray-600">Đã thanh toán / Cọc:</span>
                                                        <div className="flex items-center gap-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-24 text-right p-1 border rounded text-sm"
                                                                value={tempPaidAmount}
                                                                onChange={(e) => setTempPaidAmount(e.target.value)}
                                                                onBlur={handleUpdatePaidAmount}
                                                                placeholder="Nhập số..."
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between font-bold text-lg text-red-600 mt-1">
                                                        <span>CÒN LẠI (COD):</span>
                                                        <span>{formatCurrency(selectedOrder.amountToPay)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {!isEditingOrder && selectedOrder.amountToPay > 0 && selectedOrder.status !== 'Đã giao hàng' && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">QR Code</p>
                                                    <img src={getVietQR(selectedOrder)} alt="VietQR" className="w-24 h-24 border rounded-lg" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Product List... (Kept similar to previous logic) */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">Chi tiết sản phẩm</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {(isEditingOrder && editForm ? editForm.items : selectedOrder.items).map((item, idx) => (
                                        <div key={idx} className="flex gap-4 border border-gray-100 rounded-lg p-4 items-start bg-white flex-col md:flex-row">
                                            {/* (Existing Product Item Render Logic - Simplified for brevity in this specific update block) */}
                                            <div className="w-24 h-24 bg-gray-50 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center relative group cursor-pointer" onClick={() => !isEditingOrder && item.previewImageUrl && setZoomedImageUrl(item.previewImageUrl)}>
                                                {item.previewImageUrl ? <img src={item.previewImageUrl} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">No img</span>}
                                            </div>
                                            <div className="flex-grow w-full">
                                                <p className="font-bold text-gray-800 mb-1">Khung {item.frameId.toUpperCase()}</p>
                                                <p className="text-xs text-gray-500 mb-2">Nền: {item.background.type === 'color' ? item.background.value : 'Hình ảnh'}</p>
                                                <ul className="text-xs text-gray-600 space-y-1">
                                                    {item.characters.map((char, cIdx) => (
                                                        <li key={cIdx}>
                                                            <strong>NV {cIdx + 1}:</strong> {char.hair?.name}, {char.face?.name}, {char.shirt?.name}, {char.pants?.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                                {item.draggableItems.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {item.draggableItems.map((di, diIdx) => (
                                                            <span key={diIdx} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                                {di.type === 'charm' ? 'Charm' : allKnownParts[di.partId]?.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : <div className="flex-grow flex items-center justify-center text-gray-400 text-sm">Chọn một đơn hàng để xem chi tiết</div>}
            </div>

            {zoomedImageUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setZoomedImageUrl(null)}>
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    <img src={zoomedImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};
