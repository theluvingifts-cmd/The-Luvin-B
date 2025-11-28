
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, LegoPart, FrameOption, LegoCharacterConfig, DraggableItem } from '../../types';
import { updateOrder, deleteOrder, countPartsInOrder } from '../../services/orderService';
import { adjustStock } from '../../services/productService';
import { calculateOrderTotal, formatCurrency } from '../../utils/pricing';
import { StatusDropdown } from './shared/StatusDropdown';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';

// CONSTANTS
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

export const AdminOrders: React.FC<AdminOrdersProps> = ({ orders, setOrders, products, frames, currentUser, role, onRefreshProducts }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);
    
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [orderSearch, setOrderSearch] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [addingAccessoryToItemIndex, setAddingAccessoryToItemIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

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

    const sortedOrders = useMemo(() => {
        let result = [...orders];

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
    }, [orders, sortMode, filterStatus, orderSearch]);

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
            alert("Lỗi: Không thể cập nhật đơn hàng. Vui lòng kiểm tra lại kết nối hoặc quyền truy cập.");
        }
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (!canDeleteOrder) {
            alert("Bạn không có quyền xóa đơn hàng.");
            return;
        }
        if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XOÁ VĨNH VIỄN đơn hàng ${selectedOrder.id} không? Hành động này không thể hoàn tác.`)) {
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
            const success = await updateOrder(selectedOrder.id, { 
                status: 'Chờ chuyển hàng', 
                packedBy: currentUser.email,
                packedAt: now
            });

            if (success) {
                setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: 'Chờ chuyển hàng', packedBy: currentUser.email, packedAt: now } : o));
                setSelectedOrder(prev => prev ? { ...prev, status: 'Chờ chuyển hàng', packedBy: currentUser.email, packedAt: now } : null);
                alert("Đã xác nhận đóng gói thành công!");
            } else {
                alert("LỖI: Không thể cập nhật trạng thái đơn hàng.\n\nNguyên nhân: Tài khoản của bạn chưa được cấp quyền 'write' trong Firebase Rules.");
            }
        }
    };

    // --- EDITING LOGIC ---
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
        
        setIsLoading(true);

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
            onRefreshProducts();
        }

        await handleUpdate(selectedOrder.id, editForm, false);
        setIsEditingOrder(false);
        setEditForm(null);
        setIsLoading(false);
        alert("Đã lưu thay đổi!");
    };

    const updateEditFormWithPrice = (newOrder: Order) => {
        const { totalPrice, amountToPay } = calculateOrderTotal(newOrder, products, frames);
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
            newItems[itemIndex] = { ...newItems[itemIndex], characters: [...newItems[itemIndex].characters, newChar] };
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

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] animate-fade-in">
            {isLoading && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                        <span className="font-bold text-sm">Đang xử lý...</span>
                    </div>
                </div>
            )}
            <div className={`lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2 flex-col">
                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder="Tìm mã đơn hoặc SĐT..."
                            value={orderSearch}
                            onChange={(e) => setOrderSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
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
                                <button onClick={() => setSelectedOrder(null)} className="lg:hidden text-gray-500 mr-2 p-1 hover:bg-gray-100 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                    </svg>
                                </button>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">{selectedOrder.id}{selectedOrder.isUrgent && <span className="text-red-500 text-lg" title="Đơn gấp">🔥</span>}</h2>
                                        <StatusDropdown 
                                            currentStatus={selectedOrder.status}
                                            onStatusChange={(status) => handleUpdate(selectedOrder.id, { status })}
                                            onDelete={handleDeleteOrder}
                                            canCancel={canCancelOrder}
                                            canDelete={canDeleteOrder}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">Đặt lúc: {selectedOrder.createdAt ? formatDateTime(selectedOrder.createdAt) : '---'}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                 {role === 'warehouse' && (selectedOrder.status === 'Đang đóng hàng' || selectedOrder.status === 'Ưu tiên xuất đơn' || selectedOrder.status === 'Chờ thanh toán' || selectedOrder.status === 'Đã xác nhận') && (
                                    <button 
                                        onClick={handleMarkAsPacked}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                    >
                                        <span>✅</span> <span className="hidden sm:inline">Xác nhận đã đóng gói</span><span className="sm:hidden">Đóng gói</span>
                                    </button>
                                 )}

                                 <div className="flex gap-2 mt-2">
                                    {!isEditingOrder ? (
                                        <button onClick={startEditingOrder} className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200">Sửa chi tiết</button>
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
                            {selectedOrder.packedAt && (
                                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl">🎁</div>
                                        <div>
                                            <p className="text-sm font-bold text-purple-900">Đã đóng gói xong</p>
                                            <p className="text-xs text-purple-700">Nhân viên: <span className="font-semibold">{selectedOrder.packedBy || 'N/A'}</span></p>
                                        </div>
                                    </div>
                                    <div className="text-right pl-12 sm:pl-0">
                                        <p className="text-[10px] text-purple-500 uppercase font-bold tracking-wider">Thời gian hoàn thành</p>
                                        <p className="text-sm font-mono text-purple-900 font-bold">{formatDateTime(new Date(selectedOrder.packedAt).getTime())}</p>
                                    </div>
                                </div>
                            )}

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

                            <div>
                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">Chi tiết sản phẩm</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {(isEditingOrder && editForm ? editForm.items : selectedOrder.items).map((item, idx) => (
                                        <div key={idx} className="flex gap-4 border border-gray-100 rounded-lg p-4 items-start bg-white flex-col md:flex-row">
                                            <div className="w-24 h-24 bg-gray-50 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                {item.previewImageUrl ? <img src={item.previewImageUrl} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">No img</span>}
                                            </div>
                                            <div className="flex-grow w-full">
                                                <div className="mb-3 pb-3 border-b border-gray-100">
                                                    <p className="font-bold text-gray-800 mb-1">Khung {item.frameId.toUpperCase()}</p>
                                                    <p className="text-xs text-gray-500">Nền: {item.background.type === 'color' ? item.background.value : 'Hình ảnh'}</p>
                                                </div>

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
    );
};
