
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
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [],
        taxPercent: 0,
        shippingFee: 0,
        discountPercent: 0,
        note: '1. Giá trên đã bao gồm chi phí thiết kế và phụ kiện LEGO đi kèm.\n2. Miễn phí in logo doanh nghiệp lên nền tranh cho đơn hàng từ 20 sản phẩm.\n3. Thời gian hoàn thiện: 3-5 ngày làm việc kể từ khi chốt mẫu thiết kế.\n4. Đơn hàng được bảo hành keo dán vĩnh viễn.'
    });

    const [searchTerm, setSearchTerm] = useState('');
    const previewRef = useRef<HTMLDivElement>(null);

    const selectableItems = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        const f = frames.filter(i => i.name.toLowerCase().includes(lowerSearch)).map(i => ({ ...i, type: 'frame' as const }));
        const p = products.filter(i => i.name.toLowerCase().includes(lowerSearch)).map(i => ({ ...i, type: 'part' as const }));
        return [...f, ...p];
    }, [searchTerm, frames, products]);

    const addItem = (item: any) => {
        const newItem: QuoteItem = {
            id: `${item.id}_${Date.now()}`,
            name: item.name,
            type: item.type === 'frame' ? 'frame' : 'part',
            quantity: 1,
            unitPrice: item.price,
            total: item.price,
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

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in print:bg-white print:p-0 min-h-screen">
            {/* 🛠 LEFT: Control Panel */}
            <div className="lg:w-80 xl:w-96 flex-shrink-0 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-6 print:hidden overflow-y-auto max-h-[85vh] sticky top-24 custom-scrollbar">
                <div className="flex items-center gap-2 border-b pb-3 mb-2">
                    <span className="text-xl">📄</span>
                    <h3 className="text-lg font-bold text-gray-800">Cài đặt báo giá</h3>
                </div>
                
                {/* Customer Section */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Khách hàng mục tiêu</label>
                    <input className="w-full p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-pink-200 outline-none transition-all" placeholder="Tên khách hàng" value={quote.customerName} onChange={e => setQuote({...quote, customerName: e.target.value})} />
                    <input className="w-full p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-pink-200 outline-none transition-all" placeholder="Tên công ty / Tổ chức" value={quote.companyName} onChange={e => setQuote({...quote, companyName: e.target.value})} />
                    <input className="w-full p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-pink-200 outline-none transition-all" placeholder="Số điện thoại" value={quote.phone} onChange={e => setQuote({...quote, phone: e.target.value})} />
                </div>

                {/* Product Search */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Chọn sản phẩm từ kho</label>
                    <div className="relative">
                        <input className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm bg-gray-50 focus:bg-white transition-all outline-none" placeholder="Tìm sản phẩm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="max-h-40 overflow-y-auto border rounded-xl divide-y custom-scrollbar bg-gray-50/50">
                        {selectableItems.slice(0, 8).map(item => (
                            <div key={item.id} className="p-2 flex justify-between items-center hover:bg-white transition-colors group">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className={`text-[8px] p-1 rounded-md font-bold uppercase flex-shrink-0 ${item.type === 'frame' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                        {item.type === 'frame' ? 'Khung' : 'Part'}
                                    </span>
                                    <span className="text-xs font-medium truncate">{item.name}</span>
                                </div>
                                <button onClick={() => addItem(item)} className="text-[10px] bg-gray-900 text-white px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold">+ Thêm</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected List */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Danh sách báo giá ({quote.items.length})</label>
                    <div className="space-y-2">
                        {quote.items.map(item => (
                            <div key={item.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-xs truncate max-w-[80%]">{item.name}</span>
                                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-20">
                                        <label className="text-[9px] text-gray-400 uppercase font-bold">Số lượng</label>
                                        <input type="number" className="w-full p-1.5 border rounded-lg text-xs font-bold" value={item.quantity} onChange={e => updateItemQty(item.id, Number(e.target.value))} />
                                    </div>
                                    <div className="flex-grow">
                                        <label className="text-[9px] text-gray-400 uppercase font-bold">Đơn giá dự án</label>
                                        <input type="number" className="w-full p-1.5 border rounded-lg text-xs font-bold text-blue-600" value={item.unitPrice} onChange={e => updateItemPrice(item.id, Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Adjustments */}
                <div className="space-y-3 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">Chiết khấu (%)</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm bg-green-50/50" value={quote.discountPercent} onChange={e => setQuote({...quote, discountPercent: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">Thuế VAT (%)</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm" value={quote.taxPercent} onChange={e => setQuote({...quote, taxPercent: Number(e.target.value)})} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500">Phí vận chuyển dự kiến</label>
                        <input type="number" className="w-full p-2 border rounded-lg text-sm" value={quote.shippingFee} onChange={e => setQuote({...quote, shippingFee: Number(e.target.value)})} />
                    </div>
                    <textarea className="w-full p-2.5 border rounded-xl text-xs bg-gray-50 h-24 italic" placeholder="Ghi chú & Điều khoản..." value={quote.note} onChange={e => setQuote({...quote, note: e.target.value})} />
                </div>

                <button onClick={handlePrint} className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl hover:brightness-95 shadow-lg shadow-pink-100 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    XUẤT FILE BÁO GIÁ
                </button>
            </div>

            {/* 📄 RIGHT: A4 Live Preview */}
            <div className="flex-grow flex justify-center bg-gray-100 p-8 min-h-screen overflow-auto print:p-0 print:bg-white print:w-full">
                <div 
                    ref={previewRef}
                    className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] md:p-[20mm] flex flex-col font-sans text-gray-800 print:shadow-none print:w-full print:min-h-0 relative"
                >
                    {/* Header Section - Modern & Spaced */}
                    <div className="flex justify-between items-start mb-12 border-b border-gray-100 pb-8">
                        {/* Top Left: Logo smaller & elegant */}
                        <div className="space-y-4">
                            {config.logoUrl ? (
                                <img src={config.logoUrl} className="h-10 w-auto object-contain" alt="The Luvin Logo" />
                            ) : (
                                <h2 className="text-xl font-bold font-heading text-primary tracking-tight uppercase">THE LUVIN</h2>
                            )}
                            <div className="text-[10px] leading-relaxed text-gray-500 uppercase tracking-widest font-medium">
                                <p className="font-bold text-gray-700">Cửa hàng quà tặng The Luvin</p>
                                <p>{config.address || 'Khu 6, Thư Lâm, Đông Anh, Hà Nội'}</p>
                                <p>Hotline: {config.hotline || '0964 393 115'}</p>
                                <p>Website: theluvin.vn</p>
                            </div>
                        </div>

                        {/* Top Right: Quote Meta */}
                        <div className="text-right">
                            <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2 uppercase tracking-tighter">Báo Giá</h1>
                            <div className="text-[11px] space-y-1 text-gray-600 font-medium">
                                <p><span className="text-gray-400">Số phiếu:</span> #BQ{Date.now().toString().slice(-6)}</p>
                                <p><span className="text-gray-400">Ngày lập:</span> {new Date(quote.date).toLocaleDateString('vi-VN')}</p>
                                <p><span className="text-gray-400">Hiệu lực đến:</span> {new Date(quote.validUntil).toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Customer Info Section */}
                    <div className="mb-10 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 grid grid-cols-1 gap-4">
                        <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Gửi đến khách hàng</p>
                        <div>
                            <p className="text-lg font-bold text-gray-900">{quote.customerName || 'Quý khách hàng'}</p>
                            {quote.companyName && <p className="text-sm text-gray-600 font-medium">{quote.companyName}</p>}
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                {quote.address && <p>📍 {quote.address}</p>}
                                {quote.phone && <p>📞 {quote.phone}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="flex-grow">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-y border-gray-200">
                                    <th className="py-4 px-2 w-10 text-center text-[10px] font-bold uppercase text-gray-400">STT</th>
                                    <th className="py-4 px-2 text-[10px] font-bold uppercase text-gray-400">Sản phẩm / Mô tả chi tiết</th>
                                    <th className="py-4 px-2 w-20 text-center text-[10px] font-bold uppercase text-gray-400">SL</th>
                                    <th className="py-4 px-2 w-32 text-right text-[10px] font-bold uppercase text-gray-400">Đơn giá</th>
                                    <th className="py-4 px-2 w-32 text-right text-[10px] font-bold uppercase text-gray-400">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {quote.items.length > 0 ? quote.items.map((item, idx) => (
                                    <tr key={item.id} className="group">
                                        <td className="py-5 px-2 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="py-5 px-2">
                                            <p className="font-bold text-sm text-gray-900 mb-0.5">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 italic">Mã tham chiếu: TL-{item.id.split('_')[0]}</p>
                                        </td>
                                        <td className="py-5 px-2 text-center font-bold text-sm">{item.quantity}</td>
                                        <td className="py-5 px-2 text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                                        <td className="py-5 px-2 text-right font-bold text-sm text-gray-900">{formatCurrency(item.total)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-2 text-gray-300">
                                                <span className="text-4xl">🛒</span>
                                                <p className="italic text-sm">Vui lòng thêm sản phẩm vào danh sách báo giá</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Footer */}
                    <div className="mt-12 pt-8 border-t-2 border-gray-900/5 flex flex-col md:flex-row justify-between items-start gap-12">
                        {/* Terms */}
                        <div className="flex-1 space-y-3">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Ghi chú & Điều khoản</p>
                            <div className="text-[11px] text-gray-500 leading-relaxed italic whitespace-pre-wrap font-medium">
                                {quote.note}
                            </div>
                        </div>

                        {/* Totals Table */}
                        <div className="w-full md:w-72 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400 font-medium">Tạm tính:</span>
                                <span className="font-bold text-gray-700">{formatCurrency(totals.subtotal)}</span>
                            </div>
                            {quote.discountPercent > 0 && (
                                <div className="flex justify-between text-xs text-green-600">
                                    <span className="font-medium">Chiết khấu ưu đãi ({quote.discountPercent}%):</span>
                                    <span className="font-bold">-{formatCurrency(totals.discount)}</span>
                                </div>
                            )}
                            {quote.taxPercent > 0 && (
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span className="font-medium">Thuế giá trị gia tăng ({quote.taxPercent}%):</span>
                                    <span className="font-bold">{formatCurrency(totals.tax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400 font-medium">Phí giao hàng:</span>
                                <span className="font-bold text-gray-700">{quote.shippingFee > 0 ? formatCurrency(quote.shippingFee) : 'Miễn phí'}</span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 mt-1 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-900 uppercase tracking-tighter">Tổng thanh toán:</span>
                                <span className="text-xl font-heading font-bold text-primary">{formatCurrency(totals.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Signature Area */}
                    <div className="mt-16 grid grid-cols-2 text-center text-xs">
                        <div className="space-y-20">
                            <p className="font-bold uppercase tracking-widest text-gray-400 text-[10px]">Xác nhận từ khách hàng</p>
                            <p className="text-gray-300 italic">(Ký và ghi rõ họ tên)</p>
                        </div>
                        <div className="space-y-20">
                            <p className="font-bold uppercase tracking-widest text-primary text-[10px]">Đại diện The Luvin</p>
                            <div className="space-y-1">
                                <p className="font-bold text-sm text-gray-900">Trọng Dương</p>
                                <p className="text-gray-400 italic">Quản lý cửa hàng</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-12 text-center text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em]">
                        The Luvin • Quà tặng LEGO độc bản • theluvin.vn
                    </div>
                </div>
            </div>

            {/* Print Settings CSS */}
            <style>{`
                @media print {
                    header, nav, .print\\:hidden, #cart-icon-desktop, #cart-icon-mobile { display: none !important; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; }
                    .print\\:bg-white { background: white !important; }
                    .print\\:p-0 { padding: 0 !important; }
                    .print\\:shadow-none { shadow: none !important; }
                    main { padding: 0 !important; margin: 0 !important; max-width: none !important; width: 100% !important; }
                    @page { size: A4; margin: 0; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #fce7f3; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f9a8d4; }
            `}</style>
        </div>
    );
};
