
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
        note: 'Báo giá đã bao gồm phí đóng gói tiêu chuẩn. Hỗ trợ in logo doanh nghiệp miễn phí cho đơn hàng từ 20 sản phẩm.'
    });

    const [searchTerm, setSearchTerm] = useState('');
    const previewRef = useRef<HTMLDivElement>(null);

    // Filtered items from DB to select
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
        <div className="flex flex-col lg:flex-row gap-8 animate-fade-in print:bg-white print:p-0">
            {/* Control Panel */}
            <div className="lg:w-1/3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6 print:hidden overflow-y-auto max-h-[85vh] custom-scrollbar">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2">Tạo Báo Giá B2B</h3>
                
                {/* Customer Info */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Khách hàng</p>
                    <input className="w-full p-2 border rounded text-sm" placeholder="Tên khách hàng" value={quote.customerName} onChange={e => setQuote({...quote, customerName: e.target.value})} />
                    <input className="w-full p-2 border rounded text-sm" placeholder="Tên công ty (nếu có)" value={quote.companyName} onChange={e => setQuote({...quote, companyName: e.target.value})} />
                    <input className="w-full p-2 border rounded text-sm" placeholder="Địa chỉ" value={quote.address} onChange={e => setQuote({...quote, address: e.target.value})} />
                    <input className="w-full p-2 border rounded text-sm" placeholder="Số điện thoại" value={quote.phone} onChange={e => setQuote({...quote, phone: e.target.value})} />
                </div>

                {/* Add Items */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chọn sản phẩm</p>
                    <input className="w-full p-2 border rounded text-sm mb-2" placeholder="Tìm sản phẩm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <div className="max-h-48 overflow-y-auto border rounded divide-y custom-scrollbar">
                        {selectableItems.slice(0, 10).map(item => (
                            <div key={item.id} className="p-2 flex justify-between items-center hover:bg-gray-50 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1 rounded font-bold uppercase ${item.type === 'frame' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                        {item.type === 'frame' ? 'K' : 'L'}
                                    </span>
                                    <span className="font-medium">{item.name}</span>
                                </div>
                                <button onClick={() => addItem(item)} className="text-blue-600 font-bold hover:underline">Thêm</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quote Items List */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sản phẩm đã chọn ({quote.items.length})</p>
                    <div className="space-y-2">
                        {quote.items.map(item => (
                            <div key={item.id} className="p-3 bg-gray-50 rounded border flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-xs truncate w-40">{item.name}</span>
                                    <button onClick={() => removeItem(item.id)} className="text-red-500 font-bold text-xs">Xóa</button>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400">SL</label>
                                        <input type="number" className="w-full p-1 border rounded text-xs" value={item.quantity} onChange={e => updateItemQty(item.id, Number(e.target.value))} />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="text-[10px] text-gray-400">Đơn giá (Sửa nếu cần)</label>
                                        <input type="number" className="w-full p-1 border rounded text-xs font-bold" value={item.unitPrice} onChange={e => updateItemPrice(item.id, Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Final Adjustments */}
                <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500">Giảm giá (%)</label>
                            <input type="number" className="w-full p-2 border rounded text-sm" value={quote.discountPercent} onChange={e => setQuote({...quote, discountPercent: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">VAT (%)</label>
                            <input type="number" className="w-full p-2 border rounded text-sm" value={quote.taxPercent} onChange={e => setQuote({...quote, taxPercent: Number(e.target.value)})} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500">Phí vận chuyển (VNĐ)</label>
                            <input type="number" className="w-full p-2 border rounded text-sm" value={quote.shippingFee} onChange={e => setQuote({...quote, shippingFee: Number(e.target.value)})} />
                        </div>
                    </div>
                    <button onClick={handlePrint} className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        In Báo Giá / Xuất PDF
                    </button>
                </div>
            </div>

            {/* A4 Preview (8.27in x 11.69in ratio) */}
            <div className="lg:w-2/3 flex justify-center bg-gray-200 p-8 min-h-screen overflow-auto print:p-0 print:bg-white print:w-full">
                <div 
                    ref={previewRef}
                    className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[20mm] flex flex-col font-sans text-gray-800 print:shadow-none print:w-full print:min-h-0"
                >
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-gray-900 pb-8 mb-8">
                        <div className="flex gap-4 items-center">
                            {config.logoUrl && <img src={config.logoUrl} className="h-16 w-auto object-contain" alt="Logo" />}
                            <div>
                                <h2 className="text-2xl font-bold font-heading text-primary">THE LUVIN</h2>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Thương hiệu quà tặng độc bản</p>
                            </div>
                        </div>
                        <div className="text-right text-xs space-y-1">
                            <p className="font-bold uppercase text-sm">Bảng Báo Giá</p>
                            <p>Số: #BQ{Date.now().toString().slice(-6)}</p>
                            <p>Ngày: {new Date(quote.date).toLocaleDateString('vi-VN')}</p>
                            <p>Hiệu lực đến: {new Date(quote.validUntil).toLocaleDateString('vi-VN')}</p>
                        </div>
                    </div>

                    {/* Customer Info Section */}
                    <div className="grid grid-cols-2 gap-10 mb-10">
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Đơn vị báo giá</p>
                            <div className="text-xs space-y-1">
                                <p className="font-bold text-sm">Cửa hàng quà tặng The Luvin</p>
                                <p>Địa chỉ: {config.address || 'Hà Nội, Việt Nam'}</p>
                                <p>Hotline: {config.hotline || '0964 393 115'}</p>
                                <p>Website: theluvin.com</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Khách hàng</p>
                            <div className="text-xs space-y-1">
                                <p className="font-bold text-sm">{quote.customerName || 'Quý khách hàng'}</p>
                                {quote.companyName && <p>{quote.companyName}</p>}
                                {quote.address && <p>{quote.address}</p>}
                                {quote.phone && <p>{quote.phone}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="flex-grow">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y border-gray-300">
                                    <th className="py-3 px-2 w-10 text-center font-bold">STT</th>
                                    <th className="py-3 px-2 font-bold">SẢN PHẨM / CHI TIẾT</th>
                                    <th className="py-3 px-2 w-20 text-center font-bold">SL</th>
                                    <th className="py-3 px-2 w-32 text-right font-bold">ĐƠN GIÁ</th>
                                    <th className="py-3 px-2 w-32 text-right font-bold">THÀNH TIỀN</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {quote.items.length > 0 ? quote.items.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="py-4 px-2 text-center text-gray-400">{idx + 1}</td>
                                        <td className="py-4 px-2">
                                            <p className="font-bold text-sm text-gray-900">{item.name}</p>
                                            <p className="text-[10px] text-gray-500 italic">Mã sản phẩm: {item.id.split('_')[0]}</p>
                                        </td>
                                        <td className="py-4 px-2 text-center font-medium">{item.quantity}</td>
                                        <td className="py-4 px-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                        <td className="py-4 px-2 text-right font-bold">{formatCurrency(item.total)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-gray-300 italic">Chưa có sản phẩm nào trong danh sách</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Totals */}
                    <div className="mt-8 flex justify-between items-start gap-12">
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Ghi chú & Điều khoản</p>
                            <p className="text-[11px] text-gray-600 leading-relaxed italic whitespace-pre-wrap">{quote.note}</p>
                        </div>
                        <div className="w-64 space-y-2 border-t border-gray-100 pt-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Tạm tính:</span>
                                <span>{formatCurrency(totals.subtotal)}</span>
                            </div>
                            {quote.discountPercent > 0 && (
                                <div className="flex justify-between text-xs text-green-600">
                                    <span>Chiết khấu ({quote.discountPercent}%):</span>
                                    <span>-{formatCurrency(totals.discount)}</span>
                                </div>
                            )}
                            {quote.taxPercent > 0 && (
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>VAT ({quote.taxPercent}%):</span>
                                    <span>{formatCurrency(totals.tax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Vận chuyển:</span>
                                <span>{formatCurrency(quote.shippingFee)}</span>
                            </div>
                            <div className="flex justify-between text-base font-bold border-t border-gray-900 pt-2 mt-2">
                                <span className="text-gray-900">TỔNG CỘNG:</span>
                                <span className="text-primary">{formatCurrency(totals.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Signature */}
                    <div className="mt-16 grid grid-cols-2 text-center text-xs">
                        <div>
                            <p className="font-bold mb-16 uppercase">Đại diện khách hàng</p>
                            <p className="text-gray-300 italic">(Ký và ghi rõ họ tên)</p>
                        </div>
                        <div>
                            <p className="font-bold mb-16 uppercase">Đại diện The Luvin</p>
                            <p className="font-bold">Trong Duong</p>
                            <p className="text-gray-500 italic">Quản lý cửa hàng</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-10 text-center text-[10px] text-gray-400 border-t border-gray-50">
                        The Luvin - Quà tặng LEGO độc bản. Cảm ơn quý khách đã tin tưởng!
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    header, .print\\:hidden { display: none !important; }
                    body { background: white !important; margin: 0; padding: 0; }
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
