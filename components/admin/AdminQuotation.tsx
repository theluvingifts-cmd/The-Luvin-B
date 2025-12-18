
import React, { useState, useMemo, useRef } from 'react';
import { LegoPart, FrameOption, QuoteItem, QuotationData } from '../../types';
import { StoreConfig } from '../../services/configService';
import { formatCurrency } from '../../utils/pricing';

interface AdminQuotationProps {
    products: LegoPart[];
    frames: FrameOption[];
    config: StoreConfig;
}

export const AdminQuotation: React.FC<AdminQuotationProps> = ({ products, frames, config }) => {
    const [quote, setQuote] = useState<QuotationData>({
        customerName: '',
        companyName: '',
        address: '',
        phone: '',
        date: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [],
        taxPercent: 0,
        shippingFee: 0,
        discountPercent: 0,
        note: '1. Giá trên áp dụng cho đơn hàng sản xuất đồng loạt theo mẫu chốt.\n2. Hỗ trợ in Logo doanh nghiệp và thông điệp riêng lên nền tranh miễn phí.\n3. Thời gian hoàn thiện dự kiến: 7-10 ngày làm việc.\n4. Miễn phí giao hàng trong nội thành Hà Nội cho đơn hàng trên 10 triệu đồng.'
    });

    const [searchTerm, setSearchTerm] = useState('');
    const previewRef = useRef<HTMLDivElement>(null);

    // Gợi ý các gói B2B phổ biến
    const quickPackages = [
        { name: 'Khung 15x15 + 1 Nhân vật', price: 230000, type: 'frame' as const },
        { name: 'Khung 15x15 + 2 Nhân vật', price: 280000, type: 'frame' as const },
        { name: 'Khung 23x23 + 2 Nhân vật', price: 320000, type: 'frame' as const },
        { name: 'Combo 1 Charm (Phụ kiện tự chọn)', price: 15000, type: 'part' as const },
        { name: 'Phí thiết kế & In Logo B2B', price: 0, type: 'other' as const }
    ];

    const selectableItems = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        const f = frames.filter(i => i.name.toLowerCase().includes(lowerSearch)).map(i => ({ ...i, type: 'frame' as const }));
        const p = products.filter(i => i.name.toLowerCase().includes(lowerSearch)).map(i => ({ ...i, type: 'part' as const }));
        return [...f, ...p];
    }, [searchTerm, frames, products]);

    const addItem = (item: any) => {
        const newItem: QuoteItem = {
            id: `${item.id || 'custom'}_${Date.now()}`,
            name: item.name,
            type: item.type || 'other',
            quantity: 1,
            unitPrice: item.price || 0,
            total: item.price || 0,
            imageUrl: item.imageUrl
        };
        setQuote(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    const removeItem = (id: string) => {
        setQuote(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
    };

    const updateItemQty = (id: string, qty: number) => {
        setQuote(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty), total: Math.max(1, qty) * i.unitPrice } : i)
        }));
    };

    const updateItemPrice = (id: string, price: number) => {
        setQuote(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, unitPrice: price, total: i.quantity * price } : i)
        }));
    };

    const totals = useMemo(() => {
        const subtotal = quote.items.reduce((sum, i) => sum + i.total, 0);
        const discount = subtotal * (quote.discountPercent / 100);
        const tax = (subtotal - discount) * (quote.taxPercent / 100);
        const total = subtotal - discount + tax + quote.shippingFee;
        return { subtotal, discount, tax, total };
    }, [quote]);

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in print:bg-white print:p-0">
            {/* 🛠 LEFT: Control Panel */}
            <div className="lg:w-80 xl:w-96 flex-shrink-0 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-6 print:hidden overflow-y-auto max-h-[85vh] sticky top-24 custom-scrollbar">
                <div className="flex items-center justify-between border-b pb-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-xl">💼</span> Báo giá dự án
                    </h3>
                </div>
                
                {/* 1. Quick Add Packages */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Thêm nhanh gói B2B</label>
                    <div className="grid grid-cols-1 gap-2">
                        {quickPackages.map((pkg, idx) => (
                            <button 
                                key={idx}
                                onClick={() => addItem(pkg)}
                                className="text-left p-2.5 bg-gray-50 hover:bg-pink-50 border border-gray-200 hover:border-primary rounded-xl transition-all flex justify-between items-center group"
                            >
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-700 group-hover:text-primary">{pkg.name}</span>
                                    <span className="text-[10px] text-gray-400">{formatCurrency(pkg.price)}</span>
                                </div>
                                <span className="text-lg opacity-0 group-hover:opacity-100 text-primary">+</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Customer Info */}
                <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Thông tin đối tác</label>
                    <input className="w-full p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-pink-200 outline-none" placeholder="Tên khách hàng đại diện" value={quote.customerName} onChange={e => setQuote({...quote, customerName: e.target.value})} />
                    <input className="w-full p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-pink-200 outline-none" placeholder="Tên công ty" value={quote.companyName} onChange={e => setQuote({...quote, companyName: e.target.value})} />
                    <input className="w-full p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-pink-200 outline-none" placeholder="Số điện thoại" value={quote.phone} onChange={e => setQuote({...quote, phone: e.target.value})} />
                </div>

                {/* 3. Items Selection */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Chọn lẻ linh kiện ({selectableItems.length})</label>
                    <input className="w-full p-2 border rounded-xl text-xs bg-gray-50" placeholder="Tìm tên linh kiện..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <div className="max-h-32 overflow-y-auto border rounded-xl divide-y custom-scrollbar text-xs">
                        {selectableItems.slice(0, 10).map(item => (
                            <div key={item.id} className="p-2 flex justify-between items-center hover:bg-gray-50">
                                <span className="truncate max-w-[150px]">{item.name}</span>
                                <button onClick={() => addItem(item)} className="text-blue-600 font-bold">+ Thêm</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Selected List */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Các hạng mục đã chọn ({quote.items.length})</label>
                    <div className="space-y-2">
                        {quote.items.map(item => (
                            <div key={item.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                    <span className="font-bold text-[11px] leading-tight flex-grow">{item.name}</span>
                                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">×</button>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-16">
                                        <label className="text-[8px] text-gray-400 uppercase font-bold">Số lượng</label>
                                        <input type="number" className="w-full p-1.5 border rounded-lg text-xs font-bold" value={item.quantity} onChange={e => updateItemQty(item.id, Number(e.target.value))} />
                                    </div>
                                    <div className="flex-grow">
                                        <label className="text-[8px] text-gray-400 uppercase font-bold">Đơn giá</label>
                                        <input type="number" className="w-full p-1.5 border rounded-lg text-xs font-bold text-blue-600" value={item.unitPrice} onChange={e => updateItemPrice(item.id, Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Summary & Print */}
                <div className="pt-4 border-t space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">Giảm giá (%)</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm" value={quote.discountPercent} onChange={e => setQuote({...quote, discountPercent: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">VAT (%)</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm" value={quote.taxPercent} onChange={e => setQuote({...quote, taxPercent: Number(e.target.value)})} />
                        </div>
                    </div>
                    <button onClick={() => window.print()} className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl hover:brightness-95 shadow-lg shadow-pink-100 transition-all flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        XUẤT BẢN BÁO GIÁ
                    </button>
                </div>
            </div>

            {/* 📄 RIGHT: A4 Live Preview */}
            <div className="flex-grow flex justify-center bg-gray-100 p-8 min-h-screen overflow-auto print:p-0 print:bg-white print:w-full">
                <div 
                    ref={previewRef}
                    className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[20mm] flex flex-col font-sans text-gray-800 print:shadow-none print:w-full print:min-h-0 relative"
                >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-12 border-b border-gray-100 pb-8">
                        <div className="space-y-4">
                            {config.logoUrl ? (
                                <img src={config.logoUrl} className="h-10 w-auto object-contain" alt="The Luvin Logo" />
                            ) : (
                                <h2 className="text-xl font-bold font-heading text-primary uppercase">THE LUVIN</h2>
                            )}
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                                <p className="font-bold text-gray-700">Cửa hàng quà tặng The Luvin</p>
                                <p>{config.address || 'Đông Anh, Hà Nội'}</p>
                                <p>Hotline: {config.hotline || '0964 393 115'}</p>
                                <p>Website: theluvin.vn</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2 uppercase tracking-tight">Báo Giá</h1>
                            <div className="text-[11px] text-gray-600">
                                <p>Số phiếu: #BQ{Date.now().toString().slice(-6)}</p>
                                <p>Ngày lập: {new Date(quote.date).toLocaleDateString('vi-VN')}</p>
                                <p>Có giá trị đến: {new Date(quote.validUntil).toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Partner Section */}
                    <div className="mb-10 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] mb-2">Kính gửi đối tác</p>
                        <p className="text-lg font-bold text-gray-900">{quote.customerName || 'Quý khách hàng'}</p>
                        <p className="text-sm text-gray-600 font-medium">{quote.companyName || '---'}</p>
                        <div className="flex gap-4 mt-3 text-xs text-gray-500 font-medium">
                            {quote.phone && <p>📞 {quote.phone}</p>}
                            {quote.address && <p>📍 {quote.address}</p>}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-grow">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-y border-gray-200 bg-gray-50/50">
                                    <th className="py-4 px-2 w-10 text-center text-[10px] font-bold uppercase text-gray-400">STT</th>
                                    <th className="py-4 px-2 text-[10px] font-bold uppercase text-gray-400">Hạng mục sản phẩm & Dịch vụ</th>
                                    <th className="py-4 px-2 w-16 text-center text-[10px] font-bold uppercase text-gray-400">SL</th>
                                    <th className="py-4 px-2 w-32 text-right text-[10px] font-bold uppercase text-gray-400">Đơn giá</th>
                                    <th className="py-4 px-2 w-32 text-right text-[10px] font-bold uppercase text-gray-400">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {quote.items.length > 0 ? quote.items.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="py-5 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                                        <td className="py-5 px-2">
                                            <p className="font-bold text-sm text-gray-900">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 italic">Hạng mục: {item.type === 'frame' ? 'Trọn gói thiết kế' : 'Linh kiện/Dịch vụ'}</p>
                                        </td>
                                        <td className="py-5 px-2 text-center font-bold text-sm text-gray-700">{item.quantity}</td>
                                        <td className="py-5 px-2 text-right text-sm text-gray-600">{formatCurrency(item.unitPrice)}</td>
                                        <td className="py-5 px-2 text-right font-bold text-sm text-gray-900">{formatCurrency(item.total)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-gray-300 italic text-sm">Chưa có hạng mục nào được chọn.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Footer */}
                    <div className="mt-12 pt-8 border-t-2 border-gray-50 flex flex-col md:flex-row justify-between gap-12">
                        <div className="flex-1 space-y-4">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Ghi chú & Điều khoản thanh toán</p>
                            <div className="text-[11px] text-gray-500 leading-relaxed italic whitespace-pre-wrap font-medium">
                                {quote.note}
                            </div>
                        </div>

                        <div className="w-full md:w-72 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-3">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Giá trị hàng hóa:</span>
                                <span className="font-bold">{formatCurrency(totals.subtotal)}</span>
                            </div>
                            {quote.discountPercent > 0 && (
                                <div className="flex justify-between text-xs text-green-600 font-bold">
                                    <span>Chiết khấu B2B ({quote.discountPercent}%):</span>
                                    <span>-{formatCurrency(totals.discount)}</span>
                                </div>
                            )}
                            {quote.taxPercent > 0 && (
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Thuế VAT ({quote.taxPercent}%):</span>
                                    <span className="font-bold">{formatCurrency(totals.tax)}</span>
                                </div>
                            )}
                            <div className="border-t border-gray-200 pt-3 mt-1 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-900 uppercase">Tổng cộng:</span>
                                <span className="text-xl font-heading font-bold text-primary">{formatCurrency(totals.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="mt-16 grid grid-cols-2 text-center text-xs pb-10">
                        <div className="space-y-20">
                            <p className="font-bold uppercase tracking-widest text-gray-400">Đại diện đối tác</p>
                            <p className="text-gray-300 italic">(Ký và ghi rõ họ tên)</p>
                        </div>
                        <div className="space-y-20">
                            <p className="font-bold uppercase tracking-widest text-primary">Đại diện The Luvin</p>
                            <div className="space-y-1">
                                <p className="font-bold text-sm text-gray-900">Ngo Trọng Dương</p>
                                <p className="text-gray-400 italic">Quản lý cửa hàng</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto text-center text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em] pb-4">
                        The Luvin • Quà tặng LEGO độc bản • theluvin.vn
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    header, nav, .print\\:hidden { display: none !important; }
                    body { background: white !important; margin: 0 !important; }
                    .print\\:bg-white { background: white !important; }
                    .print\\:p-0 { padding: 0 !important; }
                    .print\\:shadow-none { shadow: none !important; }
                    main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
                    @page { size: A4; margin: 0; }
                }
            `}</style>
        </div>
    );
};
