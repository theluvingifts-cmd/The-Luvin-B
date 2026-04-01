
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, LegoPart, FrameOption, LegoCharacterConfig, DraggableItem, FrameConfig, FormField, PresetBackground, CollectionTemplate } from '../../types';
import { updateOrder, deleteOrder, countPartsInOrder, createOrder } from '../../services/orderService';
import { uploadToCloudinary } from '../../services/uploadService';
import { adjustStock } from '../../services/productService';
import { calculatePrice, formatCurrency } from '../../utils/pricing';
import { StatusDropdown } from './shared/StatusDropdown';
import { FRAME_OPTIONS, LEGO_PARTS, INITIAL_FRAME_CONFIG } from '../../constants';
import { ZoomIcon } from '../ZoomIcon';
import FramePreview from '../FramePreview';

const STATUS_CONFIG = [
    { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800', icon: '🕒' },
    { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800', icon: '🛡️' }, 
    { label: 'Chưa thiết kế', color: 'bg-cyan-100 text-cyan-800', icon: '📐' },
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

interface QuickOrderModalProps {
    onClose: () => void;
    onSave: (order: any) => void;
    frames: FrameOption[];
}

const QuickOrderModal: React.FC<QuickOrderModalProps> = ({ onClose, onSave, frames }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [ward, setWard] = useState('');
    const [district, setDistrict] = useState('');
    const [province, setProvince] = useState('');
    const [selectedFrameId, setSelectedFrameId] = useState(frames[0]?.id || 'lg');
    const [qty, setQty] = useState(1);
    const [priceOverride, setPriceOverride] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleQuickSave = async () => {
        if (!name || !phone) return alert("Vui lòng nhập tên và SĐT");
        setIsSaving(true);
        const frame = frames.find(f => f.id === selectedFrameId) || frames[0];
        const finalUnitPrice = priceOverride !== '' ? priceOverride : frame.price;
        const totalPrice = finalUnitPrice * qty;
        
        const orderId = `#TL${Date.now().toString().slice(-6)}`;
        const orderData = {
            id: orderId,
            customer: { name, phone, address, ward, district, province, email: '' },
            delivery: { date: new Date().toISOString().split('T')[0], notes: `[ĐƠN TẠO NHANH] ${notes}` },
            items: [
                {
                    ...INITIAL_FRAME_CONFIG,
                    frameId: selectedFrameId,
                    quantity: qty,
                    characters: []
                }
            ],
            addGiftBox: false,
            shipping: { method: 'standard', fee: 0 },
            payment: { method: 'full' },
            totalPrice: totalPrice,
            amountToPay: totalPrice,
            status: 'Chưa thiết kế'
        };

        onSave(orderData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="bg-gray-900 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold">⚡ TẠO ĐƠN NHANH</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Khách hàng</label>
                            <input placeholder="Họ và tên" className="w-full p-2.5 border rounded-lg text-sm" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <input placeholder="Số điện thoại" className="w-full p-2.5 border rounded-lg text-sm" value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <input placeholder="Địa chỉ cụ thể (Số nhà, tên đường...)" className="w-full p-2.5 border rounded-lg text-sm" value={address} onChange={e => setAddress(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 col-span-2">
                            <input placeholder="Phường/Xã" className="w-full p-2.5 border rounded-lg text-xs" value={ward} onChange={e => setWard(e.target.value)} />
                            <input placeholder="Quận/Huyện" className="w-full p-2.5 border rounded-lg text-xs" value={district} onChange={e => setDistrict(e.target.value)} />
                            <input placeholder="Tỉnh/Thành" className="w-full p-2.5 border rounded-lg text-xs" value={province} onChange={e => setProvince(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Sản phẩm</label>
                        <div className="grid grid-cols-2 gap-2">
                            <select className="p-2.5 border rounded-lg text-sm" value={selectedFrameId} onChange={e => setSelectedFrameId(e.target.value)}>
                                {frames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <input type="number" placeholder="SL" className="p-2.5 border rounded-lg text-sm" value={qty} onChange={e => setQty(Number(e.target.value))} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Giá bán (Ghi đè nếu cần)</label>
                        <input type="number" placeholder="Mặc định theo khung" className="w-full p-2.5 border rounded-lg text-sm font-bold text-blue-600" value={priceOverride} onChange={e => setPriceOverride(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <textarea placeholder="Ghi chú thêm..." className="w-full p-2.5 border rounded-lg text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div className="p-4 bg-gray-50 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl">Hủy</button>
                    <button onClick={handleQuickSave} disabled={isSaving} className="flex-2 bg-blue-600 text-white py-2.5 px-8 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50">
                        {isSaving ? 'Đang tạo...' : 'Tạo đơn ngay'}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface AdminOrdersProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    products: LegoPart[];
    frames: FrameOption[];
    backgrounds: PresetBackground[];
    templates: CollectionTemplate[];
    currentUser: any;
    role: 'admin' | 'warehouse' | null;
    onRefreshProducts: () => void;
}

type OrderTab = 'active' | 'history';

export const AdminOrders: React.FC<AdminOrdersProps> = ({ orders, setOrders, products, frames, backgrounds, templates, currentUser, role, onRefreshProducts }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editForm, setEditForm] = useState<Order | null>(null);
    const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
    
    const [amountPaidInput, setAmountPaidInput] = useState(0);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    const [orderTab, setOrderTab] = useState<OrderTab>('active');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [orderSearch, setOrderSearch] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('urgent');
    const [showOnlyCod, setShowOnlyCod] = useState(false); // --- BỔ SUNG: BỘ LỌC COD ---
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

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

    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
            setAdminDeadlineInput(selectedOrder.adminDeadline || '');
        }
    }, [selectedOrder]);

    useEffect(() => {
        setCurrentPage(1);
    }, [orderTab, filterStatus, orderSearch, itemsPerPage, showOnlyCod]);

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

        // --- BỔ SUNG: LOGIC LỌC COD ---
        if (showOnlyCod) {
            result = result.filter(o => (o.totalPrice - (o.amountPaid || 0)) > 0);
        }

        if (orderSearch.trim()) {
            const searchLower = orderSearch.trim().toLowerCase();
            result = result.filter(o => {
                // 1. Tìm trong thông tin cơ bản
                const matchesBasic = o.id.toLowerCase().includes(searchLower) || 
                    o.customer.phone.includes(searchLower) ||
                    (o.customer.name && o.customer.name.toLowerCase().includes(searchLower));
                
                if (matchesBasic) return true;

                // 2. Tìm trong form khách nhập (customFormData) và nội dung chữ (texts)
                return o.items.some(item => {
                    // Kiểm tra customFormData
                    const matchesForm = item.customFormData && Object.values(item.customFormData).some(val => 
                        typeof val === 'string' && val.toLowerCase().includes(searchLower)
                    );
                    if (matchesForm) return true;

                    // Kiểm tra nội dung chữ (texts)
                    const matchesTexts = item.texts && item.texts.some(t => 
                        t.content.toLowerCase().includes(searchLower)
                    );
                    return matchesTexts;
                });
            });
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
    }, [orders, orderTab, sortMode, filterStatus, orderSearch, showOnlyCod]);

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
        if (updates.status === 'Đã xác nhận') {
            const currentOrder = orders.find(o => o.id === orderId);
            if (currentOrder && (!currentOrder.amountPaid || currentOrder.amountPaid === 0)) {
                const expectedPayment = currentOrder.payment.method === 'deposit'
                    ? Math.round(currentOrder.totalPrice * 0.7)
                    : currentOrder.totalPrice;
                updates.amountPaid = expectedPayment;
                updates.amountToPay = currentOrder.totalPrice - expectedPayment;
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

    const handleQuickOrderSave = async (orderData: any) => {
        const res = await createOrder(orderData);
        if (res.success && res.data) {
            setOrders(prev => [res.data as Order, ...prev]);
            setShowQuickOrderModal(false);
            alert("Đã tạo đơn hàng thành công!");
        } else {
            alert("Lỗi khi tạo đơn: " + (res.error?.message || "Không rõ"));
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
                    .item-table { w-full; width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .item-table th, .item-table td { border: 1px solid #000; padding: 8px; text-align: left; }
                    .item-table th { background: #f0f0f0; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; font-style: italic; }
                    @media print { @page { margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                <div class="header"><h1 class="title">THE LUVIN - PHIẾU GIAO HÀNG</h1><p class="subtitle">Hotline: 0964 393 115 - 0345 126 019 - Facebook: The Luvin</p></div>
                <div class="info-grid">
                    <div class="box"><span class="box-title">Người nhận</span><p><strong>${selectedOrder.customer.name}</strong></p><p>${selectedOrder.customer.phone}</p><p>${[selectedOrder.customer.address, selectedOrder.customer.ward, selectedOrder.customer.district, selectedOrder.customer.province].filter(Boolean).join(', ')}</p><p style="margin-top: 5px; font-style: italic;">Ghi chú: ${selectedOrder.delivery.notes || 'Không'}</p></div>
                    <div class="box"><span class="box-title">Thông tin đơn hàng</span><p>Mã đơn: <strong>${selectedOrder.id}</strong></p><p>Ngày đặt: ${new Date(selectedOrder.createdAt).toLocaleDateString('vi-VN')}</p><p>Thanh toán: ${selectedOrder.payment.method === 'deposit' ? 'Chuyển khoản cọc' : 'Chuyển khoản toàn bộ'}</p><p>Thu hộ (COD): <strong>${formatCurrency(selectedOrder.totalPrice - (selectedOrder.amountPaid || 0), 'admin')}</strong></p>${selectedOrder.discountAmount ? `<p>Giảm giá: -${formatCurrency(selectedOrder.discountAmount, 'admin')}</p>` : ''}${selectedOrder.trackingCode ? `<p>Mã vận đơn: <strong>${selectedOrder.trackingCode}</strong></p>` : ''}</div>
                </div>
                <table class="item-table">
                    <thead><tr><th>STT</th><th>Tên sản phẩm</th><th>Chi tiết</th><th>SL</th></tr></thead>
                    <tbody>
                        ${selectedOrder.items.map((item, idx) => {
                            const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
                            const frameName = frame ? frame.name : item.frameId;
                            return `<tr><td style="text-align: center">${idx + 1}</td><td><strong>Khung LEGO ${frameName}</strong></td><td style="font-size: 12px;">${item.characters.map((char, cIdx) => `<div>NV${cIdx + 1}: ${char.hair?.name || '-'}, ${char.face?.name || '-'}, ${char.shirt?.name || '-'}, ${char.pants?.name || '-'}</div>`).join('')}${item.draggableItems.length > 0 ? `<div style="margin-top: 4px; color: #555;">+ ${item.draggableItems.length} phụ kiện/thú cưng</div>` : ''}</td><td style="text-align: center">1</td></tr>`;
                        }).join('')}
                        ${selectedOrder.addGiftBox ? `<tr><td style="text-align: center">${selectedOrder.items.length + 1}</td><td>Hộp quà cao cấp</td><td>Thiệp + Rơm + Nơ</td><td style="text-align: center">1</td></tr>` : ''}
                    </tbody>
                </table>
                <div class="footer"><p>Cảm ơn quý khách đã tin tưởng The Luvin!</p><p>Vui lòng quay video khi mở hàng để được hỗ trợ đổi trả tốt nhất.</p></div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };

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
                if (type === 'character') {
                    currentItem.characters = currentItem.characters.map(c => c.id === idToUpdate ? { ...c, ...newTransform } : c);
                } else if (type === 'item') {
                    currentItem.draggableItems = currentItem.draggableItems.map(i => i.id === idToUpdate ? { ...i, ...newTransform } : i);
                } else if (type === 'shape') {
                    currentItem.shapes = (currentItem.shapes || []).map(s => s.id === idToUpdate ? { ...s, ...newTransform } : s);
                }
            }
            newItems[itemIndex] = currentItem;
            newOrder.items = newItems;
            return newOrder;
        });
    };

    const startEditingOrder = () => {
        if (!selectedOrder) return;
        const form = JSON.parse(JSON.stringify(selectedOrder));
        setEditForm(form);
        setAmountPaidInput(form.amountPaid || 0); 
        setIsEditingOrder(true);
    };

    const cancelEditingOrder = () => {
        setEditForm(null);
        setIsEditingOrder(false);
        setAddingAccessoryToItemIndex(null);
        setEditingItemId(null);
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
            if (!oldParts[partId]) stockAdjustments[partId] = -(newParts[partId]);
        });
        if (Object.keys(stockAdjustments).length > 0) {
            await adjustStock(stockAdjustments);
            onRefreshProducts();
        }
        const finalTotalPrice = editForm.totalPrice; 
        const finalAmountPaid = amountPaidInput;
        const finalAmountToPay = Math.max(0, finalTotalPrice - finalAmountPaid);
        const finalOrder = { ...editForm, amountPaid: finalAmountPaid, amountToPay: finalAmountToPay };
        await handleUpdate(selectedOrder.id, finalOrder, false);
        setIsEditingOrder(false);
        setEditForm(null);
        setEditingItemId(null);
        setIsLoading(false);
        alert("Đã lưu thay đổi!");
    };

    const calculateOrderPriceDetails = (orderItems: FrameConfig[]) => {
        let subtotal = 0;
        const partLookup = allKnownParts;
        orderItems.forEach(item => {
            const { totalPrice } = calculatePrice(item, partLookup, frames, templates);
            subtotal += totalPrice * (item.quantity || 1);
        });
        return subtotal;
    }

    const updateEditFormWithPrice = (newOrder: Order) => {
        const subtotal = calculateOrderPriceDetails(newOrder.items);
        const totalQuantity = newOrder.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const giftBoxFee = newOrder.addGiftBox ? 30000 * totalQuantity : 0;
        const shippingFee = newOrder.shipping.fee || 0;
        const discount = newOrder.discountAmount || 0;
        const finalPrice = Math.max(0, subtotal + giftBoxFee + shippingFee - discount);
        return { ...newOrder, totalPrice: finalPrice };
    };

    const handleEditFormChange = (field: string, value: any, nestedField?: string, itemIndex?: number) => {
        if (!editForm) return;
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            if (itemIndex !== undefined) {
                 const newItems = [...newOrder.items];
                 if (field === 'background') {
                     newItems[itemIndex] = { ...newItems[itemIndex], background: value };
                 } else if (nestedField === 'frameId') {
                     newItems[itemIndex] = { ...newItems[itemIndex], frameId: value };
                 }
                 newOrder.items = newItems;
                 newOrder = updateEditFormWithPrice(newOrder); 
            } else if (nestedField && field === 'customer') {
                newOrder.customer = { ...newOrder.customer, [nestedField]: value };
            } else if (field === 'delivery' && nestedField) {
                newOrder.delivery = { ...newOrder.delivery, [nestedField]: value };
            } else if (field === 'shipping' && nestedField === 'fee') {
                newOrder.shipping = { ...newOrder.shipping, fee: Number(value) };
                newOrder = updateEditFormWithPrice(newOrder);
            } else if (field === 'addGiftBox') {
                newOrder.addGiftBox = value;
                newOrder = updateEditFormWithPrice(newOrder);
            } else if (field === 'discountAmount') {
                newOrder.discountAmount = Number(value);
                newOrder = updateEditFormWithPrice(newOrder);
            } else {
                (newOrder as any)[field] = value;
            }
            return newOrder;
        });
    };

    const handleAddCharacter = (itemIndex: number) => {
        if (!editForm) return;
        const newChar: LegoCharacterConfig = { id: Date.now(), x: 50, y: 50, rotation: 0, scale: 1 };
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

    // --- HÀM XÓA SẢN PHẨM TRONG ĐƠN (QUAN TRỌNG) ---
    const handleRemoveProductFromOrder = (itemIndex: number) => {
        if (!editForm) return;
        if (editForm.items.length <= 1) {
            alert("Đơn hàng phải có ít nhất 1 sản phẩm. Nếu khách muốn hủy toàn bộ đơn, vui lòng chuyển trạng thái sang 'Huỷ đơn'.");
            return;
        }
        
        if (confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi đơn hàng? Hệ thống sẽ tính lại tổng tiền ngay lập tức.")) {
            setEditForm(prev => {
                if (!prev) return null;
                const newItems = prev.items.filter((_, idx) => idx !== itemIndex);
                const newOrder = { ...prev, items: newItems };
                return updateEditFormWithPrice(newOrder);
            });
            alert("Đã xóa sản phẩm khỏi danh sách nháp.");
        }
    };

    const handleCharacterChange = (itemIndex: number, charIndex: number, partType: keyof LegoCharacterConfig, partId: string) => {
        if (!editForm) return;
        const selectedPart = products.find(p => p.id === partId);
        setEditForm(prev => {
            if (!prev) return null;
            let newOrder = { ...prev };
            const newItems = [...newOrder.items];
            const currentItem = newItems[itemIndex];
            const newCharacters = [...currentItem.characters];
            if (partId === "") {
                 newCharacters[charIndex] = { ...newCharacters[charIndex], [partType]: undefined };
            } else if (selectedPart) {
                 newCharacters[charIndex] = { ...newCharacters[charIndex], [partType]: selectedPart };
                 if (partType === 'shirt') newCharacters[charIndex].selectedShirtColor = selectedPart.colors?.[0];
                 if (partType === 'pants') newCharacters[charIndex].selectedPantsColor = selectedPart.colors?.[0];
            }
            newItems[itemIndex] = { ...currentItem, characters: newCharacters };
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
        const newItem: DraggableItem = { id: Date.now(), partId: part.id, type: part.type as 'accessory' | 'pet', x: 50, y: 50, rotation: 0, scale: 1 };
        setEditForm(prev => {
             if (!prev) return null;
             let newOrder = { ...prev };
             const newItems = [...newOrder.items];
             newItems[itemIndex] = { ...newItems[itemIndex], draggableItems: [...newItems[itemIndex].draggableItems, newItem] };
             newOrder.items = newItems;
             return updateEditFormWithPrice(newOrder);
        });
        setAddingAccessoryToItemIndex(null);
    };

    const isOrderPacked = selectedOrder ? ['Chờ chuyển hàng', 'Gửi hàng đi', 'Đã giao hàng'].includes(selectedOrder.status) : false;

    const BillingBreakdown = () => {
        const order = isEditingOrder && editForm ? editForm : selectedOrder;
        if (!order) return null;
        
        const subtotal = calculateOrderPriceDetails(order.items);
        const totalQuantity = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const giftBoxFee = order.addGiftBox ? 30000 * totalQuantity : 0;
        const shippingFee = order.shipping.fee || 0;
        const discount = order.discountAmount || 0;
        const totalPrice = order.totalPrice; 
        const amountPaid = isEditingOrder ? amountPaidInput : (order.amountPaid || 0);
        const remaining = Math.max(0, totalPrice - amountPaid);

        return (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mt-6">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider flex justify-between items-center">
                    <span>Chi tiết thanh toán</span>
                    {order.addGiftBox && <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded text-[10px] font-bold">CÓ HỘP QUÀ ({totalQuantity})</span>}
                </h3>
                <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between"><span className="text-gray-500">Tiền hàng:</span><span className="font-medium">{formatCurrency(subtotal, 'admin')}</span></div>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2"><span className="text-gray-500">Hộp quà ({totalQuantity}):</span>{isEditingOrder && (<input type="checkbox" checked={order.addGiftBox} onChange={(e) => handleEditFormChange('addGiftBox', e.target.checked)} className="w-4 h-4 accent-pink-600"/>)}</div>
                        <span className={`font-medium ${order.addGiftBox ? 'text-gray-900' : 'text-gray-400'}`}>{formatCurrency(giftBoxFee, 'admin')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Phí vận chuyển:</span>
                        {isEditingOrder ? (<input type="number" className="border rounded p-1 w-24 text-right font-medium text-sm" value={shippingFee} onChange={(e) => handleEditFormChange('shipping', Number(e.target.value), 'fee')}/>) : (<span className="font-medium">{formatCurrency(shippingFee, 'admin')}</span>)}
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Giảm giá:</span>
                        {isEditingOrder ? (<input type="number" className="border rounded p-1 w-24 text-right font-medium text-sm text-green-600" value={discount} onChange={(e) => handleEditFormChange('discountAmount', Number(e.target.value))}/>) : (<span className="font-medium text-green-600">-{formatCurrency(discount, 'admin')}</span>)}
                    </div>
                    <div className="border-t border-gray-100 my-2"></div>
                    <div className="flex justify-between items-center text-base"><span className="font-bold text-gray-800">Tổng giá trị đơn:</span><span className="font-bold text-gray-900">{formatCurrency(totalPrice, 'admin')}</span></div>
                    <div className="flex justify-between items-center bg-green-50 p-2 rounded -mx-2">
                        <span className="text-green-700 font-medium">Đã thanh toán:</span>
                        {isEditingOrder ? (<input type="number" className="border border-green-300 rounded p-1 w-28 text-right font-bold text-green-700 bg-white" value={amountPaidInput} onChange={(e) => setAmountPaidInput(Number(e.target.value))}/>) : (<span className="font-bold text-green-700">{formatCurrency(amountPaid, 'admin')}</span>)}
                    </div>
                    <div className="flex justify-between items-center bg-red-50 p-2 rounded -mx-2"><span className="text-red-700 font-medium">Còn lại (COD):</span><span className="font-bold text-red-700 text-lg">{formatCurrency(remaining, 'admin')}</span></div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] animate-fade-in relative">
            {isLoading && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]"><div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div><span className="font-bold text-sm">Đang xử lý...</span></div></div>
            )}

            {showQuickOrderModal && (
                <QuickOrderModal 
                    onClose={() => setShowQuickOrderModal(false)} 
                    onSave={handleQuickOrderSave} 
                    frames={frames}
                />
            )}
            
            <div className={`lg:w-1/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden absolute inset-0 lg:static z-10 ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-2 flex-col">
                    <div className="flex gap-2">
                        <div className="flex flex-1 gap-2 p-1 bg-gray-200 rounded-lg">
                            <button onClick={() => setOrderTab('active')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Đang xử lý ({orders.filter(o => !['Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'].includes(o.status)).length})</button>
                            <button onClick={() => setOrderTab('history')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Lịch sử ({orders.filter(o => ['Đã giao hàng', 'Huỷ đơn'].includes(o.status)).length})</button>
                        </div>
                        <button 
                            onClick={() => setShowQuickOrderModal(true)} 
                            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 shadow-sm transition-all"
                            title="Tạo đơn nhanh (Khách nhắn tin/gọi điện)"
                        >
                            <span className="text-sm font-bold">⚡ Tạo đơn</span>
                        </button>
                    </div>
                    <div className="relative w-full mt-2">
                        <input 
                            type="text" 
                            placeholder="Tìm mã đơn, SĐT hoặc Tên khách..." 
                            value={orderSearch} 
                            onChange={(e) => setOrderSearch(e.target.value)} 
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-gray-900 outline-none" 
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    
                    <div className="flex gap-2 w-full mt-1">
                        <button onClick={() => setSortMode('newest')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${sortMode === 'newest' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Mới nhất</button>
                        <button onClick={() => setSortMode('urgent')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${sortMode === 'urgent' ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-500 hover:text-gray-700'}`}>Cần gấp</button>
                        {/* --- BỔ SUNG: NÚT LỌC COD --- */}
                        <button onClick={() => setShowOnlyCod(!showOnlyCod)} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1 ${showOnlyCod ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-700'}`}>
                            <span>💰</span> {showOnlyCod ? 'Chỉ đơn COD' : 'Tất cả COD'}
                        </button>
                    </div>

                    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 cursor-grab active:cursor-grabbing mt-1" ref={scrollContainerRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
                        <button onClick={() => setFilterStatus('all')} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>Tất cả</button>
                        {STATUS_CONFIG.filter(s => !s.isAction).filter(s => orderTab === 'active' ? !['Đã giao hàng', 'Huỷ đơn'].includes(s.label) : ['Đã giao hàng', 'Huỷ đơn'].includes(s.label)).map(status => (
                            <button key={status.label} onClick={() => setFilterStatus(status.label)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors select-none ${filterStatus === status.label ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>{status.label}</button>
                        ))}
                    </div>
                </div>
                <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                    {paginatedOrders.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">Không có đơn hàng nào.</div> : paginatedOrders.map(order => {
                        const remaining = order.totalPrice - (order.amountPaid || 0);
                        return (
                            <div 
                                key={order.id} 
                                onClick={() => { setSelectedOrder(order); setIsEditingOrder(false); }} 
                                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 border-l-4 ${selectedOrder?.id === order.id ? 'bg-gray-50' : 'bg-white'} ${order.addGiftBox ? 'border-pink-300' : 'border-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-mono font-medium ${order.isUrgent ? 'text-red-600' : 'text-gray-900'}`}>{order.id} {order.paymentProofUrl && order.status === 'Chờ thanh toán' && <span className="ml-2 text-green-600 font-bold text-xs">📸</span>}</span>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' : order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{order.status}</span>
                                        {/* --- HIỂN THỊ COD NGAY TRONG LIST --- */}
                                        {remaining > 0 && order.status !== 'Huỷ đơn' && (
                                            <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-100">
                                                COD: {formatCurrency(remaining, 'admin')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <p className="text-sm text-gray-600 truncate max-w-[120px]">{order.customer.name}</p>
                                        {order.addGiftBox && (
                                            <span className="flex-shrink-0 text-pink-500 text-sm" title="Đơn có gói quà">🎁</span>
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalPrice, 'admin')}</p>
                                </div>
                                <div className="flex justify-between items-center mt-1"><p className="text-xs text-gray-400">{order.createdAt ? formatDateTime(order.createdAt) : '---'}</p>{(order.adminDeadline || order.delivery.date) && (<div className="text-right"><p className="text-xs text-gray-500">{order.adminDeadline ? `DL: ${formatDate(order.adminDeadline)}` : `Giao: ${formatDate(order.delivery.date)}`}</p>{order.delivery.date && getCountdownText(order.delivery.date)}</div>)}</div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Hiển thị:</span><select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-white border border-gray-300 rounded text-xs p-1 focus:outline-none"><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></div>
                    <div className="flex items-center gap-1"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-100 disabled:opacity-50">&lt;</button><span className="text-xs font-medium px-2">Trang {currentPage} / {totalPages || 1}</span><button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-100 disabled:opacity-50">&gt;</button></div>
                </div>
            </div>

            <div className={`lg:w-2/3 w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden absolute inset-0 lg:static z-20 ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
                {selectedOrder ? (
                    <div className="flex flex-col h-full relative">
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-start bg-white sticky top-0 z-30 shadow-sm">
                            <div className="flex items-start gap-2 w-full">
                                <button onClick={() => setSelectedOrder(null)} className="lg:hidden text-gray-600 mr-2 p-2 -ml-2 hover:bg-gray-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg></button>
                                <div className="flex-grow">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1"><h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">{selectedOrder.id}{selectedOrder.isUrgent && <span className="text-red-500 text-lg" title="Đơn gấp">🔥</span>}</h2><div className="mt-1 sm:mt-0"><StatusDropdown currentStatus={selectedOrder.status} onStatusChange={(status) => handleUpdate(selectedOrder.id, { status })} onDelete={handleDeleteOrder} canCancel={canCancelOrder} canDelete={canDeleteOrder} /></div></div>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-1">Đặt lúc: {selectedOrder.createdAt ? formatDateTime(selectedOrder.createdAt) : '---'}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
                                 <div className="flex gap-2">
                                     <button onClick={handlePrintOrder} className="bg-gray-100 text-gray-700 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex items-center gap-1" title="In phiếu đóng gói"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg><span className="hidden sm:inline">In phiếu</span></button>
                                     {role === 'warehouse' && (selectedOrder.status === 'Đang đóng hàng' || selectedOrder.status === 'Ưu tiên xuất đơn' || selectedOrder.status === 'Chờ thanh toán' || selectedOrder.status === 'Đã xác nhận') && (<button onClick={handleMarkAsPacked} className="bg-indigo-600 text-white p-2 sm:px-4 sm:py-2 rounded-lg font-bold text-sm shadow hover:bg-indigo-700 transition-colors flex items-center gap-2"><span>✅</span> <span className="hidden sm:inline">Xong</span></button>)}
                                 </div>
                                 <div className="flex gap-2 mt-1">
                                    {!isEditingOrder ? (<button onClick={startEditingOrder} disabled={isOrderPacked} className={`text-xs font-bold px-3 py-1.5 rounded whitespace-nowrap ${isOrderPacked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{isOrderPacked ? 'Đã khoá' : 'Sửa chi tiết'}</button>) : (<div className="flex gap-2"><button onClick={cancelEditingOrder} className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200">Huỷ</button><button onClick={saveOrderChanges} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Lưu</button></div>)}
                                 </div>
                                 <label className="flex items-center gap-2 cursor-pointer select-none"><span className="text-xs font-medium text-gray-500">Gấp</span><input type="checkbox" className="accent-red-600 w-4 h-4" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} /></label>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
                            {selectedOrder.paymentProofUrl && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                                    <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2"><span>📸</span> Ảnh xác nhận chuyển khoản</h4>
                                    <div className="flex flex-col sm:flex-row items-start gap-4">
                                        <div className="h-32 w-auto border rounded-lg bg-white overflow-hidden cursor-pointer relative group" onClick={() => setZoomedImageUrl(selectedOrder.paymentProofUrl || null)}><img src={selectedOrder.paymentProofUrl} alt="Payment Proof" className="h-full w-full object-contain" /><div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ZoomIcon className="text-white w-6 h-6" /></div></div>
                                        <div className="text-sm text-gray-600">
                                            <p>Thời gian gửi: {selectedOrder.paymentProofUploadedAt ? formatDateTime(new Date(selectedOrder.paymentProofUploadedAt).getTime()) : '---'}</p>
                                            {selectedOrder.status === 'Chờ thanh toán' && (<button onClick={handleConfirmPayment} className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm">Xác nhận thanh toán ngay</button>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {selectedOrder.packedAt && (<div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shadow-sm"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl">🎁</div><div><p className="text-sm font-bold text-purple-900">Đã đóng gói xong</p><p className="text-xs text-purple-700">Nhân viên: <span className="font-semibold">{selectedOrder.packedBy || 'N/A'}</span></p></div></div><div className="text-right pl-12 sm:pl-0"><p className="text-[10px] text-purple-500 uppercase font-bold tracking-wider">Thời gian hoàn thành</p><p className="text-sm font-mono text-purple-900 font-bold">{formatDateTime(new Date(selectedOrder.packedAt).getTime())}</p></div></div>)}
                            
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú nội bộ</label><textarea className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" rows={2} placeholder="Ghi chú cho admin..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deadline Xưởng</label><input type="date" className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-gray-900 focus:ring-0 outline-none" value={adminDeadlineInput} onChange={(e) => setAdminDeadlineInput(e.target.value)} /><div className="mt-2 text-right"><button onClick={handleSaveAdminInfo} className="text-xs font-bold text-white bg-gray-900 px-3 py-1.5 rounded hover:bg-black transition-colors">Lưu Ghi chú</button></div></div></div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div><h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3 uppercase tracking-wider">Khách hàng</h3><div className="space-y-2 text-sm text-gray-700">{isEditingOrder && editForm ? (<><div className="flex items-center gap-2"><span className="w-20 text-gray-500">Tên:</span> <input className="border rounded p-1 w-full" value={editForm.customer.name} onChange={e => handleEditFormChange('customer', e.target.value, 'name')} /></div><div className="flex items-center gap-2"><span className="w-20 text-gray-500">SĐT:</span> <input className="border rounded p-1 w-full" value={editForm.customer.phone} onChange={e => handleEditFormChange('customer', e.target.value, 'phone')} /></div><div className="flex items-center gap-2"><span className="w-20 text-gray-500">Email:</span> <input className="border rounded p-1 w-full" value={editForm.customer.email} onChange={e => handleEditFormChange('customer', e.target.value, 'email')} /></div>
                                        <div className="flex items-center gap-2"><span className="w-20 text-gray-500">Demo:</span> <input className="border rounded p-1 w-full placeholder-gray-400 text-xs" value={editForm.customer.demoContact || ''} onChange={e => handleEditFormChange('customer', e.target.value, 'demoContact')} placeholder="SĐT/Zalo gửi demo..." /></div>
                                        <div className="flex items-center gap-2"><span className="w-20 text-gray-500">Liên hệ:</span> <input className="border rounded p-1 w-full placeholder-gray-400 text-xs" value={editForm.customer.socialLink || ''} onChange={e => handleEditFormChange('customer', e.target.value, 'socialLink')} placeholder="Link Facebook/Zalo..." /></div>
                                        <div className="flex items-start gap-2"><span className="w-20 text-gray-500">Địa chỉ:</span> <textarea className="border rounded p-1 w-full" rows={2} value={editForm.customer.address} onChange={e => handleEditFormChange('customer', e.target.value, 'address')} /></div>
                                        <div className="grid grid-cols-3 gap-2 ml-20">
                                            <input className="border rounded p-1 text-xs" placeholder="Phường/Xã" value={editForm.customer.ward || ''} onChange={e => handleEditFormChange('customer', e.target.value, 'ward')} />
                                            <input className="border rounded p-1 text-xs" placeholder="Quận/Huyện" value={editForm.customer.district || ''} onChange={e => handleEditFormChange('customer', e.target.value, 'district')} />
                                            <input className="border rounded p-1 text-xs" placeholder="Tỉnh/Thành" value={editForm.customer.province || ''} onChange={e => handleEditFormChange('customer', e.target.value, 'province')} />
                                        </div>
                                        <div className="flex items-start gap-2 mt-2"><span className="w-20 text-gray-500">Note:</span> <textarea className="border rounded p-1 w-full" rows={2} value={editForm.delivery.notes} onChange={e => handleEditFormChange('delivery', e.target.value, 'notes')} /></div></>) : (<><p className="flex items-center gap-2"><span className="text-gray-500 w-20 inline-block">Tên:</span> <span className="font-bold">{selectedOrder.customer.name}</span> {selectedOrder.addGiftBox && <span className="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1">🎁 Gói quà</span>}</p><p><span className="text-gray-500 w-20 inline-block">SĐT:</span> {selectedOrder.customer.phone}</p>
                                        <p><span className="text-gray-500 w-20 inline-block">Email:</span> {selectedOrder.customer.email}</p>
                                        {selectedOrder.customer.demoContact && (<p className="flex items-center"><span className="text-gray-500 w-20 inline-block">Demo:</span><span className="font-bold text-luvin-pink">{selectedOrder.customer.demoContact}</span></p>)}
                                        {selectedOrder.customer.socialLink && (<p className="flex items-center"><span className="text-gray-500 w-20 inline-block">Liên hệ:</span><a href={selectedOrder.customer.socialLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded">Mở liên kết ↗</a></p>)}
                                        <p className="flex items-start"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Địa chỉ:</span> <span>{[selectedOrder.customer.address, selectedOrder.customer.ward, selectedOrder.customer.district, selectedOrder.customer.province].filter(Boolean).join(', ')}</span></p>
                                        <p className="flex items-start mt-2"><span className="text-gray-500 w-20 inline-block flex-shrink-0">Note:</span> <span className="italic bg-yellow-50 px-2 py-0.5 rounded text-gray-800">{selectedOrder.delivery.notes || 'Không có'}</span></p></>)}</div></div>
                                
                                <div className="flex flex-col">
                                    <BillingBreakdown />
                                    {!isEditingOrder && (selectedOrder.totalPrice - (selectedOrder.amountPaid || 0)) > 0 && selectedOrder.status !== 'Đã giao hàng' && (
                                        <div className="mt-4 pt-4 border-t border-gray-100"><p className="text-xs font-bold text-gray-500 uppercase mb-2">Mã QR Thanh toán (VietQR)</p><img src={getVietQR(selectedOrder)} alt="QR" className="w-32 h-32 border rounded-lg" /><p className="text-[10px] text-gray-400 mt-1">TCB: 65838666666</p></div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4"><h3 className="text-sm font-bold text-orange-800 mb-2 uppercase tracking-wider flex items-center gap-2">🚚 Thông tin vận chuyển</h3><div className="flex flex-col sm:flex-row gap-4"><div className="flex-1"><p className="text-sm text-gray-600">Phương thức: <span className="font-bold text-gray-900">{selectedOrder.shipping.method}</span></p><p className="text-sm text-gray-600 mt-1">Phí vận chuyển: <span className="font-medium">{formatCurrency(selectedOrder.shipping.fee, 'admin')}</span></p></div><div className="flex-1 border-t sm:border-t-0 sm:border-l border-orange-200 pt-2 sm:pt-0 sm:pl-4">{isEditingOrder && editForm ? (<div><label className="block text-xs font-bold text-orange-700 mb-1">Mã Vận Đơn (Tracking Code)</label><input className="w-full p-2 border border-orange-300 rounded text-sm uppercase font-mono" value={editForm.trackingCode || ''} onChange={(e) => handleEditFormChange('trackingCode', e.target.value.toUpperCase())} placeholder="VD: SPEVN..." /></div>) : (<div><span className="text-xs font-bold text-gray-500 uppercase block mb-1">Mã Vận Đơn</span>{selectedOrder.trackingCode ? (<span className="text-lg font-mono font-bold text-orange-700 bg-white px-2 py-1 rounded border border-orange-200 inline-block select-all">{selectedOrder.trackingCode}</span>) : (<span className="text-sm text-gray-400 italic">Chưa có mã vận đơn</span>)}</div>)}</div></div></div>

                            <div>
                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">Chi tiết sản phẩm</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {(isEditingOrder && editForm ? editForm.items : selectedOrder.items).map((item, idx) => {
                                        const { totalPrice: itemTotal, priceBreakdown } = calculatePrice(item, allKnownParts, frames);
                                        
                                        const formFieldImages = (item.formFields || [])
                                            .filter(f => f.type === 'image' && item.customFormData?.[f.id])
                                            .map(f => ({ url: item.customFormData![f.id], type: `Ảnh Form (${f.label})` }));

                                        const customerAssets = [
                                            ...(item.background.type === 'upload' ? [{ url: item.background.value, type: 'Ảnh nền' }] : []),
                                            ...item.draggableItems.filter(di => di.type === 'charm').map(di => ({ url: di.partId, type: 'Sticker' })),
                                            ...formFieldImages
                                        ];

                                        return (
                                        <div key={idx} className="flex flex-col gap-4 border border-gray-100 rounded-lg p-4 bg-white shadow-sm relative group">
                                            {/* NÚT XÓA SẢN PHẨM (KHI ĐANG SỬA) */}
                                            {isEditingOrder && editForm && (
                                                <button 
                                                    onClick={() => handleRemoveProductFromOrder(idx)}
                                                    className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-all z-40 border-2 border-white"
                                                    title="Xóa sản phẩm này khỏi đơn hàng"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}

                                            {isEditingOrder && editForm && (<div className="w-full bg-gray-50 p-2 rounded border border-dashed border-gray-300"><p className="text-xs font-bold text-gray-500 mb-2 uppercase">Chỉnh sửa vị trí (Kéo thả)</p><div className="w-full h-[400px] flex items-center justify-center bg-gray-200 rounded relative overflow-hidden"><FramePreview config={item} containerWidth={400} onItemTransform={(id, transform) => handleVisualTransform(idx, id, transform)} onItemRemove={() => {}} onTextUpdate={() => {}} selectedItemId={editingItemId} setSelectedItemId={setEditingItemId} isInteractive={true} setIsEditingText={() => {}} allParts={allKnownParts} onItemUpdate={() => {}} onCharacterUpdate={() => {}} /></div></div>)}

                                            <div className="flex gap-4 items-start flex-col md:flex-row">
                                                <div className="w-24 h-24 bg-gray-50 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center relative group cursor-pointer" onClick={() => !isEditingOrder && item.previewImageUrl && setZoomedImageUrl(item.previewImageUrl)}>
                                                    {item.previewImageUrl ? (<><img src={item.previewImageUrl} className="max-w-full max-h-full object-contain" />{!isEditingOrder && (<div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ZoomIcon className="text-white w-6 h-6" /></div>)}</>) : <span className="text-xs text-gray-400">No img</span>}
                                                </div>
                                                <div className="flex-grow w-full">
                                                    <div className="mb-3 pb-3 border-b border-gray-100 flex justify-between items-start">
                                                        <div>
                                                            {isEditingOrder && editForm ? (
                                                                <div className="flex flex-col gap-2 mb-3">
                                                                    <div className="flex gap-2 items-center"><span className="font-bold text-gray-800 text-sm">Khung:</span><select className="border rounded p-1 text-sm bg-gray-50" value={item.frameId} onChange={(e) => handleEditFormChange('frameId', e.target.value, 'frameId', idx)}>{frames.map(f => (<option key={f.id} value={f.id}>{f.name} - {formatCurrency(f.price, 'admin')}</option>))}</select></div>
                                                                    
                                                                    <div className="p-2 bg-gray-50 rounded border border-dashed border-gray-300">
                                                                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Thay đổi nền</p>
                                                                        <div className="flex gap-2 items-center">
                                                                            <select 
                                                                                className="text-xs border rounded p-1"
                                                                                value={item.background.type}
                                                                                onChange={(e) => handleEditFormChange('background', { ...item.background, type: e.target.value as any }, undefined, idx)}
                                                                            >
                                                                                <option value="color">Màu sắc</option>
                                                                                <option value="image">Hình ảnh (URL)</option>
                                                                                <option value="upload">Ảnh tải lên</option>
                                                                                <option value="preset">Mẫu có sẵn</option>
                                                                            </select>
                                                                            {item.background.type === 'color' ? (
                                                                                <input 
                                                                                    type="color"
                                                                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                                                                                    value={item.background.value.startsWith('#') ? item.background.value : '#ffffff'}
                                                                                    onChange={(e) => handleEditFormChange('background', { ...item.background, value: e.target.value }, undefined, idx)}
                                                                                />
                                                                            ) : item.background.type === 'preset' ? (
                                                                                <select
                                                                                    className="flex-grow text-xs border rounded p-1"
                                                                                    value={item.background.value}
                                                                                    onChange={(e) => handleEditFormChange('background', { ...item.background, value: e.target.value }, undefined, idx)}
                                                                                >
                                                                                    <option value="">Chọn mẫu nền...</option>
                                                                                    {backgrounds.map(bg => (
                                                                                        <option key={bg.id} value={bg.url}>{bg.name}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : (
                                                                                <input 
                                                                                    type="text"
                                                                                    className="flex-grow text-xs border rounded p-1"
                                                                                    placeholder="Nhập URL hình ảnh..."
                                                                                    value={item.background.value}
                                                                                    onChange={(e) => handleEditFormChange('background', { ...item.background, value: e.target.value }, undefined, idx)}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        {item.background.type === 'upload' && (
                                                                            <div className="mt-2">
                                                                                <input 
                                                                                    type="file" 
                                                                                    accept="image/*"
                                                                                    className="text-[10px]"
                                                                                    onChange={async (e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        if (file) {
                                                                                            try {
                                                                                                setIsLoading(true);
                                                                                                const url = await uploadToCloudinary(file);
                                                                                                if (url) {
                                                                                                    handleEditFormChange('background', { ...item.background, value: url }, undefined, idx);
                                                                                                }
                                                                                            } catch (error) {
                                                                                                alert("Lỗi tải ảnh lên!");
                                                                                            } finally {
                                                                                                setIsLoading(false);
                                                                                            }
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="font-bold text-gray-800 mb-1">Khung {(frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId))?.name || item.frameId}</p>
                                                                    <p className="text-xs text-gray-500">Nền: {item.background.type === 'color' ? item.background.value : 'Hình ảnh'}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="text-right text-xs">
                                                            {priceBreakdown.map((pb, pbIdx) => (
                                                                <div key={pbIdx} className="flex justify-end gap-2">
                                                                    <span className="text-gray-500">{pb.label}:</span>
                                                                    <div className="flex flex-col items-end">
                                                                        {pb.originalValue !== undefined && pb.originalValue > pb.value && (
                                                                            <span className="text-gray-400 line-through text-[9px]">{formatCurrency(pb.originalValue, 'admin')}</span>
                                                                        )}
                                                                        <span className="font-medium text-gray-900">{formatCurrency(pb.value, 'admin')}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <div className="border-t mt-1 pt-1 font-bold text-gray-900">
                                                                Tổng: {formatCurrency(itemTotal * (item.quantity || 1), 'admin')}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {customerAssets.length > 0 && (
                                                        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                            <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                                <span>📂</span> Tài nguyên khách gửi ({customerAssets.length})
                                                            </h4>
                                                            <div className="flex flex-wrap gap-3">
                                                                {customerAssets.map((asset, aIdx) => (
                                                                    <div key={aIdx} className="flex items-center gap-2 bg-white p-1.5 pr-3 rounded-lg border border-blue-200 shadow-sm">
                                                                        <div className="w-10 h-10 bg-gray-100 rounded border overflow-hidden cursor-pointer" onClick={() => setZoomedImageUrl(asset.url)}>
                                                                            <img src={asset.url} alt="customer resource" className="w-full h-full object-cover" />
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[9px] font-bold text-gray-500 uppercase">{asset.type}</span>
                                                                            <button 
                                                                                onClick={() => downloadImage(asset.url, `TL_${selectedOrder.id}_Item${idx+1}_${asset.type}.png`)}
                                                                                className="text-[10px] text-blue-600 font-bold hover:underline text-left"
                                                                            >
                                                                                Tải về
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {item.customFormData && Object.keys(item.customFormData).length > 0 && (
                                                        <div className="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                                            <h4 className="text-[10px] font-black text-orange-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                <span>📝</span> Thông tin in ấn (Form khách nhập)
                                                            </h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                                                {(item.formFields || []).map((field: FormField) => {
                                                                    const val = item.customFormData?.[field.id];
                                                                    if (!val) return null;
                                                                    return (
                                                                        <div key={field.id} className="border-b border-orange-100 pb-2">
                                                                            <span className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">{field.label}</span>
                                                                            {field.type === 'image' ? (
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <div className="w-8 h-8 rounded border border-orange-200 bg-white overflow-hidden cursor-pointer" onClick={() => setZoomedImageUrl(val)}>
                                                                                        <img src={val} alt="form data" className="w-full h-full object-cover" />
                                                                                    </div>
                                                                                    <span className="text-[10px] text-gray-500 italic">Ảnh in thêm</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-sm font-bold text-gray-800 break-words">{val}</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                        {item.characters.map((char, charIdx) => (
                                                            <div key={char.id} className="bg-gray-50 p-2 rounded border border-gray-200 text-xs relative">
                                                                <p className="font-bold text-gray-700 mb-1">Nhân vật {charIdx + 1}</p>
                                                                {isEditingOrder && editForm && (<button onClick={() => handleRemoveCharacter(idx, charIdx)} className="absolute top-1 right-1 text-red-500 font-bold">×</button>)}
                                                                {isEditingOrder && editForm ? (
                                                                    <div className="space-y-1">{(['hair', 'face', 'shirt', 'pants', 'hat'] as const).map(partType => (<div key={partType} className="flex flex-col"><div className="flex justify-between items-center"><span className="text-gray-500 capitalize w-16">{partType}</span><select className="border rounded p-1 text-xs flex-grow" value={char[partType]?.id || ''} onChange={(e) => handleCharacterChange(idx, charIdx, partType, e.target.value)}><option value="">None</option>{partsByType[partType]?.map(part => (<option key={part.id} value={part.id}>{part.name}</option>))}</select></div>{['shirt', 'pants'].includes(partType) && char[partType]?.colors && char[partType]!.colors!.length > 0 && (<div className="flex gap-1 mt-1 ml-16">{char[partType]!.colors!.map(c => (<button key={c.hex} onClick={() => handleCharacterColorChange(idx, charIdx, partType as 'shirt'|'pants', c.hex)} className={`w-4 h-4 rounded-full border ${ (partType === 'shirt' ? char.selectedShirtColor?.hex : char.selectedPantsColor?.hex) === c.hex ? 'ring-1 ring-gray-800 scale-110' : '' }`} style={{backgroundColor: c.hex}} title={c.name} />))}</div>)}</div>))}</div>
                                                                ) : (
                                                                    <ul className="text-gray-600 space-y-0.5 mt-1">{char.hair && <li>Tóc: {char.hair.name}</li>}{char.face && <li>Mặt: {char.face.name}</li>}{char.shirt && <li>Áo: {char.shirt.name} {char.selectedShirtColor ? `(${char.selectedShirtColor.name})` : ''}</li>}{char.pants && <li>Quần: {char.pants.name} {char.selectedPantsColor ? `(${char.selectedPantsColor.name})` : ''}</li>}{char.hat && <li>Mũ: {char.hat.name}</li>}{char.customPrintPrice && <li className="text-blue-600 font-bold">In yêu cầu: {formatCurrency(char.customPrintPrice, 'admin')}</li>}</ul>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {isEditingOrder && editForm && (<button onClick={() => handleAddCharacter(idx)} className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors text-sm font-bold">+ Thêm NV</button>)}
                                                    </div>
                                                    {item.draggableItems.length > 0 && (<div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs font-bold text-gray-500 uppercase mb-2">Phụ kiện & Thú cưng</p><div className="flex flex-wrap gap-2">{item.draggableItems.map((di, diIdx) => { const part = allKnownParts[di.partId]; return (<div key={di.id} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs flex items-center gap-2">{di.type === 'charm' ? (<span>Charm (Ảnh)</span>) : (<span>{part?.name || 'Unknown'} {di.selectedColor ? `(${di.selectedColor.name})` : ''}</span>)}{isEditingOrder && editForm && (<button onClick={() => handleRemoveDraggable(idx, diIdx)} className="text-red-500 font-bold hover:text-red-700">×</button>)}</div>); })}</div></div>)}
                                                    {isEditingOrder && editForm && (<div className="mt-2"><button onClick={() => setAddingAccessoryToItemIndex(addingAccessoryToItemIndex === idx ? null : idx)} className="text-xs text-blue-600 hover:underline font-semibold">+ Thêm phụ kiện/thú cưng</button>{addingAccessoryToItemIndex === idx && (<div className="mt-2 p-2 bg-gray-50 border rounded grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">{[...products.filter(p => p.type === 'accessory' || p.type === 'pet')].map(p => (<button key={p.id} onClick={() => handleAddDraggable(idx, p)} className="flex flex-col items-center p-1 bg-white border rounded hover:border-blue-500"><img src={p.imageUrl} className="w-8 h-8 object-contain" /><span className="text-[10px] text-gray-500">{p.name}</span></button>))}</div>)}</div>)}
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-gray-400 text-sm">Chọn một đơn hàng để xem chi tiết</div>
                )}
            </div>

            {zoomedImageUrl && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setZoomedImageUrl(null)}><button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg></button><img src={zoomedImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} /></div>)}
        </div>
    );
};
