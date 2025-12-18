
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
    // State cho Configurator
    const [selFrameId, setSelFrameId] = useState('sm'); // Mặc định 15x15
    const [selNVCount, setSelNVCount] = useState(1);
    
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
        note: '1. Đơn giá trên áp dụng cho số lượng sản xuất đồng loạt theo mẫu thiết kế đã duyệt.\n2. Miễn phí thiết kế và in Logo doanh nghiệp cho đơn hàng từ 20 khung.\n3. Thời gian hoàn thiện: 7-10 ngày làm việc kể từ ngày tạm ứng và chốt mẫu.\n4. Bảo hành keo dán vĩnh viễn và hỗ trợ thay thế linh kiện lỗi do sản xuất.'
    });

    const previewRef = useRef<HTMLDivElement>(null);

    // Logic tính giá B2B tạm tính (Bạn có thể sửa tỉ lệ này)
    // Giá = Giá khung cơ bản + (Số NV * 50,000đ)
    const currentConfigPrice = useMemo(() => {
        const frame = frames.find(f => f.id === selFrameId);
        const baseFramePrice = frame ? frame.price : 210000;
        // Giả sử giá NV trong B2B là 50k/người (đã bao gồm linh kiện trung bình)
        return baseFramePrice + (selNVCount * 50000);
    }, [selFrameId, selNVCount, frames]);

    const addConfiguredItem = () => {
        const frame = frames.find(f => f.id === selFrameId);
        const itemName = `Khung ${frame?.name || selFrameId} + ${selNVCount} Nhân vật LEGO`;
        
        const newItem: QuoteItem = {
            id: `b2b_frame_${Date.now()}`,
            name: itemName,
            type: 'frame',
            quantity: 1,
            unitPrice: currentConfigPrice,
            total: currentConfigPrice
        };
        setQuote(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    const addCharmPackage = (tier: 'normal' | 'vip') => {
        const isVip = tier === 'vip';
        const newItem: QuoteItem = {
            id: `charm_${tier}_${Date.now()}`,
            name: isVip ? 'Gói Charm / Phụ kiện VIP (Tự chọn cao cấp)' : 'Gói Charm / Phụ kiện Thường (Tự chọn)',
            type: 'part',
            quantity: 1,
            unitPrice: isVip ? 20000 : 10000,
            total: isVip ? 20000 : 10000
        };
        setQuote(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    const updateItemName = (id: string, name: string) => {
        setQuote(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, name } : i)
        }));
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
                <div className="flex items-center gap-2 border-b pb-3 mb-2">
                    <span className="text-xl">📊</span>
                    <h3 className="text-lg font-bold text-gray-800">Cấu hình báo giá</h3>
                </div>
                
                {/* 1. Main Product Configurator */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Bước 1: Chọn sản phẩm chính</label>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="text-[11px] text-gray-500 mb-1 block">Dòng khung</label>
                            <select 
                                value={selFrameId} 
                                onChange={(e) => setSelFrameId(e.target.value)}
                                className="w-full p-2.5 border rounded-xl text-sm bg-white outline-none focus:ring-1 focus:ring-primary"
                            >
                                {frames.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({f.frameWidthCm}x{f.frameHeightCm}cm)</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] text-gray-500 mb-1 block">Số lượng nhân vật</label>
                            <select 
                                value={selNVCount} 
                                onChange={(e) => setSelNVCount(parseInt(e.target.value))}
                                className="w-full p-2.5 border rounded-xl text-sm bg-white outline-none focus:ring-1 focus:ring-primary"
                            >
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <option key={n} value={n}>{n} Nhân vật</option>
                                ))}
                            </select>
                        </div>

                        <div className="pt-2">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs text-gray-400">Đơn giá dự kiến:</span>
                                <span className="text-sm font-bold text-primary">{formatCurrency(currentConfigPrice)}</span>
                            </div>
                            <button 
                                onClick={addConfiguredItem}
                                className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-black transition-all active:scale-95 shadow-sm"
                            >
                                + THÊM VÀO BÁO GIÁ
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Charm Packages */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Bước 2: Gói phụ kiện (Charm)</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => addCharmPackage('normal')}
                            className="p-3 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-center group"
                        >
                            <span className="block text-lg mb-1">🎀</span>
                            <span className="block text-[11px] font-bold text-gray-700">Gói Thường</span>
                            <span className="block text-[10px] text-blue-600 font-bold">10.000đ</span>
                        </button>
                        <button 
                            onClick={() => addCharmPackage('vip')}
                            className="p-3 border border-gray-200 rounded-xl hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
                        >
                            <span className="block text-lg mb-1">👑</span>
                            <span className="block text-[11px] font-bold text-gray-700">Gói VIP</span>
                            <span className="block text-[10px] text-yellow-600 font-bold">20.000đ</span>
                        </button>
                    </div>
                </div>

                {/* 3. Partner Info */}
                <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Bước 3: Thông tin đối tác</label>
                    <input className="w-full p-2.5 border rounded-xl text-sm outline-none focus:border-primary" placeholder="Tên khách hàng" value={quote.customerName} onChange={e => setQuote({...quote, customerName: e.target.value})} />
                    <input className="w-full p-2.5 border rounded-xl text-sm outline-none focus:border-primary" placeholder="Tên công ty" value={quote.companyName} onChange={e => setQuote({...quote, companyName: e.target.value})} />
                </div>

                {/* Selected List - Improved Editability */}
                <div className="space-y-3 pt-4 border-t">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Danh sách báo giá ({quote.items.length})</label>
                    <div className="space-y-2">
                        {quote.items.map(item => (
                            <div key={item.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm space-y-2 group relative">
                                <button 
                                    onClick={() => removeItem(item.id)} 
                                    className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >×</button>
                                
                                <textarea 
                                    className="w-full font-bold text-[11px] text-gray-800 bg-transparent border-none focus:ring-0 resize-none p-0 leading-tight"
                                    value={item.name}
                                    rows={2}
                                    onChange={(e) => updateItemName(item.id, e.target.value)}
                                />
                                
                                <div className="flex gap-2">
                                    <div className="w-16">
                                        <label className="text-[8px] text-gray-400 uppercase font-bold">Số lượng</label>
                                        <input type="number" className="w-full p-1 border rounded text-xs" value={item.quantity} onChange={e => updateItemQty(item.id, Number(e.target.value))} />
                                    </div>
                                    <div className="flex-grow">
                                        <label className="text-[8px] text-gray-400 uppercase font-bold">Đơn giá</label>
                                        <input type="number" className="w-full p-1 border rounded text-xs text-blue-600 font-bold" value={item.unitPrice} onChange={e => updateItemPrice(item.id, Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Global Adjustments */}
                <div className="pt-4 border-t space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">Giảm giá (%)</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm" value={quote.discountPercent} onChange={e => setQuote({...quote, discountPercent: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">Thuế VAT (%)</label>
                            <input type="number" className="w-full p-2 border rounded-lg text-sm" value={quote.taxPercent} onChange={e => setQuote({...quote, taxPercent: Number(e.target.value)})} />
                        </div>
                    </div>
                    <textarea className="w-full p-2.5 border rounded-xl text-[11px] h-20 bg-gray-50 italic" value={quote.note} onChange={e => setQuote({...quote, note: e.target.value})} />
                </div>

                <button onClick={() => window.print()} className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl hover:brightness-95 shadow-lg shadow-pink-100 transition-all flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    XUẤT BẢN BÁO GIÁ
                </button>
            </div>

            {/* 📄 RIGHT: A4 Live Preview (Style remained elegant) */}
            <div className="flex-grow flex justify-center bg-gray-100 p-8 min-h-screen overflow-auto print:p-0 print:bg-white print:w-full">
                <div 
                    ref={previewRef}
                    className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] md:p-[20mm] flex flex-col font-sans text-gray-800 print:shadow-none print:w-full print:min-h-0 relative"
                >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-12 border-b border-gray-100 pb-8">
                        <div className="space-y-4">
                            {config.logoUrl ? (
                                <img src={config.logoUrl} className="h-10 w-auto object-contain" alt="The Luvin Logo" />
                            ) : (
                                <h2 className="text-xl font-bold font-heading text-primary uppercase">THE LUVIN</h2>
                            )}
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-medium leading-relaxed">
                                <p className="font-bold text-gray-700">Cửa hàng quà tặng The Luvin</p>
                                <p>{config.address || 'Đông Anh, Hà Nội'}</p>
                                <p>Hotline: {config.hotline || '0964 393 115'}</p>
                                <p>Website: theluvin.vn</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h1 className="text-4xl font-heading font-bold text-gray-900 mb-2 uppercase tracking-tight">Báo Giá</h1>
                            <div className="text-[11px] text-gray-600 font-medium">
                                <p><span className="text-gray-400">Mã đơn dự kiến:</span> #BQ{Date.now().toString().slice(-6)}</p>
                                <p><span className="text-gray-400">Ngày lập:</span> {new Date(quote.date).toLocaleDateString('vi-VN')}</p>
                                <p><span className="text-gray-400">Ngày hết hạn:</span> {new Date(quote.validUntil).toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Customer */}
                    <div className="mb-10 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] mb-2">Kính gửi Quý đối tác</p>
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
                                    <th className="py-4 px-2 text-[10px] font-bold uppercase text-gray-400">Hạng mục sản phẩm / Dịch vụ</th>
                                    <th className="py-4 px-2 w-16 text-center text-[10px] font-bold uppercase text-gray-400">SL</th>
                                    <th className="py-4 px-2 w-32 text-right text-[10px] font-bold uppercase text-gray-400">Đơn giá</th>
                                    <th className="py-4 px-2 w-32 text-right text-[10px] font-bold uppercase text-gray-400">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {quote.items.length > 0 ? quote.items.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="py-5 px-2 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="py-5 px-2">
                                            <p className="font-bold text-sm text-gray-900 leading-tight">{item.name}</p>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-tighter mt-1">Cấu hình B2B chuẩn The Luvin</p>
                                        </td>
                                        <td className="py-5 px-2 text-center font-bold text-sm text-gray-700">{item.quantity}</td>
                                        <td className="py-5 px-2 text-right text-sm text-gray-600">{formatCurrency(item.unitPrice)}</td>
                                        <td className="py-5 px-2 text-right font-bold text-sm text-gray-900">{formatCurrency(item.total)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center text-gray-300 italic text-sm">Vui lòng thiết lập cấu hình ở bảng bên trái.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="mt-12 pt-8 border-t-2 border-gray-50 flex flex-col md:flex-row justify-between items-start gap-12">
                        <div className="flex-1 space-y-4">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Ghi chú & Điều khoản</p>
                            <div className="text-[11px] text-gray-500 leading-relaxed italic whitespace-pre-wrap font-medium">
                                {quote.note}
                            </div>
                        </div>

                        <div className="w-full md:w-72 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-3">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Tạm tính:</span>
                                <span className="font-bold text-gray-700">{formatCurrency(totals.subtotal)}</span>
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

                    <div className="mt-16 grid grid-cols-2 text-center text-xs">
                        <div className="space-y-20">
                            <p className="font-bold uppercase tracking-widest text-gray-400">Đại diện Quý đối tác</p>
                            <p className="text-gray-300 italic">(Ký và ghi rõ họ tên)</p>
                        </div>
                        <div className="space-y-20">
                            <p className="font-bold uppercase tracking-widest text-primary">Đại diện The Luvin</p>
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

            <style>{`
                @media print {
                    header, nav, .print\\:hidden, #cart-icon-desktop, #cart-icon-mobile { display: none !important; }
                    body { background: white !important; margin: 0 !important; }
                    .print\\:bg-white { background: white !important; }
                    .print\\:p-0 { padding: 0 !important; }
                    .print\\:shadow-none { shadow: none !important; }
                    main { padding: 0 !important; margin: 0 !important; max-width: none !important; width: 100% !important; }
                    @page { size: A4; margin: 0; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #fce7f3; border-radius: 10px; }
            `}</style>
        </div>
    );
};
