
import React, { useState, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, Order, Voucher } from '../types';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { FRAME_OPTIONS, GENERAL_ASSETS } from '../constants';
import { ZoomIcon } from '../components/ZoomIcon';
import { validateVoucher, incrementVoucherUsage } from '../services/voucherService';
import { StoreConfig } from '../services/configService';

interface CheckoutPageProps {
  cartItems: FrameConfig[];
  allParts: Record<string, LegoPart>;
  onPlaceOrder: (order: Omit<Order, 'status' | 'createdAt'>) => Promise<void>;
  onZoomImage: (url: string) => void;
  initialOrder?: Order | null;
  storeConfig?: StoreConfig; // NEW: Receive config
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ cartItems, allParts, onPlaceOrder, onZoomImage, initialOrder, storeConfig }) => {
  // ... (State logic same)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  
  const [provinces, setProvinces] = useState<{ name: string; code: number }[]>([]);
  const [districts, setDistricts] = useState<{ name: string; code: number }[]>([]);
  const [wards, setWards] = useState<{ name: string; code: number }[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedWard, setSelectedWard] = useState('');

  const [shippingOption, setShippingOption] = useState<'standard' | 'express' | 'bookship'>('standard');
  const [addGiftBox, setAddGiftBox] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'full'>('deposit');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [submissionError, setSubmissionError] = useState('');

  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);

  // Dynamic Gift Box Config
  const giftBoxConfig = storeConfig?.giftBox || { enabled: true, price: 30000, stock: 100 };
  const GIFT_BOX_PRICE = giftBoxConfig.price;
  const isGiftBoxAvailable = giftBoxConfig.enabled && giftBoxConfig.stock > 0;

  const SHIPPING_FEES = { standard: 25000, express: 45000, bookship: 0 };
  const EARLY_BIRD_THRESHOLD = 20; 
  const EARLY_BIRD_DISCOUNT_PERCENT = 0.05; 

  // ... (Effects for pre-fill and address same)
  useEffect(() => {
      if (initialOrder) {
          setName(initialOrder.customer.name);
          setPhone(initialOrder.customer.phone);
          setEmail(initialOrder.customer.email);
          setStreet(initialOrder.customer.address); 
          setDeliveryDate(initialOrder.delivery.date);
          setNotes(initialOrder.delivery.notes);
          setShippingOption(initialOrder.shipping.method);
          setAddGiftBox(initialOrder.addGiftBox);
          setPaymentMethod(initialOrder.payment.method);
      }
  }, [initialOrder]);

  useEffect(() => { fetch('https://provinces.open-api.vn/api/p/').then(res => res.json()).then(data => setProvinces(data)); }, []);
  useEffect(() => { if (selectedProvince) { fetch(`https://provinces.open-api.vn/api/p/${selectedProvince}?depth=2`).then(res => res.json()).then(data => setDistricts(data.districts)); setSelectedDistrict(''); setWards([]); setSelectedWard(''); } else { setDistricts([]); setWards([]); } }, [selectedProvince]);
  useEffect(() => { if (selectedDistrict) { fetch(`https://provinces.open-api.vn/api/d/${selectedDistrict}?depth=2`).then(res => res.json()).then(data => setWards(data.wards)); setSelectedWard(''); } else { setWards([]); } }, [selectedDistrict]);

  const subtotal = useMemo(() => cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1), 0), [cartItems, allParts]);
  
  let calculatedShippingFee = SHIPPING_FEES[shippingOption];
  const isFreeShippingEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
  if (shippingOption === 'standard' && isFreeShippingEligible) calculatedShippingFee = 0;
  
  const shippingFee = calculatedShippingFee;
  // If gift box not available, force addGiftBox to false
  const effectiveGiftBox = isGiftBoxAvailable && addGiftBox;
  const giftBoxFee = effectiveGiftBox ? GIFT_BOX_PRICE : 0;
  
  // ... (Discount logic same)
  const daysDifference = useMemo(() => {
      if (!deliveryDate) return 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const delivery = new Date(deliveryDate); delivery.setHours(0, 0, 0, 0);
      return Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [deliveryDate]);
  const isEarlyBird = daysDifference >= EARLY_BIRD_THRESHOLD;
  const earlyBirdDiscountAmount = isEarlyBird ? Math.round(subtotal * EARLY_BIRD_DISCOUNT_PERCENT) : 0;
  let voucherDiscountAmount = 0;
  if (appliedVoucher) {
      if (appliedVoucher.type === 'percent') voucherDiscountAmount = Math.round(subtotal * (appliedVoucher.value / 100));
      else voucherDiscountAmount = appliedVoucher.value;
      if (voucherDiscountAmount > subtotal) voucherDiscountAmount = subtotal;
  }
  const totalDiscount = earlyBirdDiscountAmount + voucherDiscountAmount;
  const totalPrice = Math.max(0, subtotal + shippingFee + giftBoxFee - totalDiscount);
  const amountToPay = paymentMethod === 'deposit' ? Math.round(totalPrice * 0.7) : totalPrice;

  // ... (Handlers same)
  const handleApplyVoucher = async () => {
      if (!voucherCode.trim()) return;
      setIsCheckingVoucher(true);
      setVoucherError('');
      
      const result = await validateVoucher(voucherCode, subtotal);
      
      if (result.isValid && result.voucher) {
          setAppliedVoucher(result.voucher);
          setVoucherError('');
      } else {
          setAppliedVoucher(null);
          setVoucherError(result.message || 'Mã không hợp lệ');
      }
      setIsCheckingVoucher(false);
  };

  const handleRemoveVoucher = () => {
      setAppliedVoucher(null);
      setVoucherCode('');
      setVoucherError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; 
    setSubmissionError(''); 
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) { setPhoneError("Số điện thoại phải có đúng 10 số và bắt đầu bằng số 0"); return; }
    if (!deliveryDate) { alert("Vui lòng chọn ngày nhận hàng mong muốn."); return; }

    setIsSubmitting(true);
    const provinceName = provinces.find(p => p.code === parseInt(selectedProvince))?.name || '';
    const districtName = districts.find(d => d.code === parseInt(selectedDistrict))?.name || '';
    const wardName = wards.find(w => w.code === parseInt(selectedWard))?.name || '';
    let fullAddress = street;
    if (provinceName) fullAddress = [street, wardName, districtName, provinceName].filter(Boolean).join(', ');

    const orderId = initialOrder ? initialOrder.id : `#TL${Date.now().toString().slice(-6)}`;
    const finalNotes = (isEarlyBird ? `[ƯU ĐÃI ĐẶT SỚM 5%] ` : '') + (appliedVoucher ? `[VOUCHER: ${appliedVoucher.code}] ` : '') + notes;

    try {
        await onPlaceOrder({
          id: orderId,
          customer: { name, phone, email, address: fullAddress },
          delivery: { date: deliveryDate, notes: finalNotes },
          items: cartItems,
          addGiftBox: effectiveGiftBox,
          shipping: { method: shippingOption, fee: shippingFee },
          payment: { method: paymentMethod },
          totalPrice,
          amountToPay,
          discountCode: appliedVoucher?.code,
          discountAmount: totalDiscount
        });
        if (appliedVoucher) await incrementVoucherUsage(appliedVoucher.code);
    } catch (error: any) {
        console.error("Order submission error:", error);
        setIsSubmitting(false);
        setSubmissionError(error.message || "Đã có lỗi xảy ra.");
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  };

  if (cartItems.length === 0) return <div className="text-center py-20">Giỏ hàng của bạn đang trống.</div>;

  return (
    <div className="bg-white">
      <form onSubmit={handleSubmit} className="container mx-auto px-4 sm:px-6 py-8">
        {/* ... (Header) ... */}
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">{initialOrder ? 'Cập nhật đơn hàng' : 'Thông tin thanh toán'}</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 space-y-6">
            
            {/* ... (Address Form) ... */}
            <div className="bg-gray-50 p-6 rounded-lg border shadow-sm">
                <h2 className="font-bold text-xl text-gray-800 mb-6 pb-2 border-b border-gray-200">Thông tin giao hàng</h2>
                <div className="mb-6 border-b border-gray-200 pb-6">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">1. Người nhận</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="Họ và tên" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-luvin-pink" required />
                        <div><input type="tel" placeholder="Số điện thoại" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(''); }} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-luvin-pink" required />{phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}</div>
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg md:col-span-2 outline-none focus:ring-2 focus:ring-luvin-pink" required />
                    </div>
                </div>
                {/* ... Address Selects ... */}
                <div className="mb-6 border-b border-gray-200 pb-6">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">2. Địa chỉ & Vận chuyển</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none"><option value="">Tỉnh/Thành phố</option>{provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</select>
                            <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" disabled={!selectedProvince}><option value="">Quận/Huyện</option>{districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}</select>
                            <select value={selectedWard} onChange={e => setSelectedWard(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg md:col-span-2 outline-none" disabled={!selectedDistrict}><option value="">Phường/Xã</option>{wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}</select>
                        </div>
                        <input type="text" placeholder="Số nhà, tên đường..." value={street} onChange={e => setStreet(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" required />
                        {/* Shipping Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="text-sm font-semibold text-gray-700 block mb-1">Ngày nhận hàng</label><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none" required min={new Date().toISOString().split("T")[0]} />{isEarlyBird && <p className="text-xs text-green-600 font-bold mt-1">✓ Đặt trước {daysDifference} ngày: Giảm 5%</p>}</div>
                            <div><h3 className="font-semibold text-sm mb-2 text-gray-700">Vận chuyển</h3><div className="space-y-2">
                                <label className="flex items-center p-2 border rounded-lg cursor-pointer hover:bg-pink-50 has-[:checked]:bg-pink-50"><input type="radio" name="shipping" value="standard" checked={shippingOption === 'standard'} onChange={() => setShippingOption('standard')} className="h-4 w-4 accent-luvin-pink"/><span className="ml-2 text-sm flex-grow">Giao thường</span>{isFreeShippingEligible ? <span className="text-green-600 font-bold text-sm">Miễn phí</span> : <span className="font-bold text-sm">{formatCurrency(SHIPPING_FEES.standard)}</span>}</label>
                                <label className="flex items-center p-2 border rounded-lg cursor-pointer hover:bg-pink-50 has-[:checked]:bg-pink-50"><input type="radio" name="shipping" value="express" checked={shippingOption === 'express'} onChange={() => setShippingOption('express')} className="h-4 w-4 accent-luvin-pink"/><span className="ml-2 text-sm flex-grow">Giao nhanh</span><span className="font-bold text-sm">{formatCurrency(SHIPPING_FEES.express)}</span></label>
                            </div></div>
                        </div>
                    </div>
                </div>
                <div><h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">3. Ghi chú</h3><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-3 border border-gray-300 rounded-lg outline-none"></textarea></div>
            </div>

            {/* Gift Box Section */}
            {isGiftBoxAvailable ? (
                <div className="bg-gray-50 p-4 rounded-lg border">
                     <label className="flex items-center p-3 rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 border">
                        <img src={GENERAL_ASSETS.giftbox} alt="Gift Box" className="w-12 h-12 object-contain mr-4"/>
                        <div className="flex-grow">
                            <span className="font-semibold text-gray-800">Thêm hộp quà</span>
                            <p className="text-xs text-gray-500">Hộp quà cao cấp & thiệp viết tay.</p>
                        </div>
                        <span className="font-bold text-luvin-pink mr-4">+{formatCurrency(GIFT_BOX_PRICE)}</span>
                        <input type="checkbox" checked={addGiftBox} onChange={e => setAddGiftBox(e.target.checked)} className="h-5 w-5 rounded accent-luvin-pink"/>
                    </label>
                </div>
            ) : (
                <div className="bg-gray-100 p-4 rounded-lg border text-center text-gray-500 text-sm">
                    ⚠️ Hộp quà tạm thời hết hàng.
                </div>
            )}
          </div>

          <div className="lg:col-span-5">
            {/* ... (Summary & Totals) ... */}
            <div className="bg-gray-50 p-4 rounded-lg border sticky top-24">
                {/* ... Cart Items List ... */}
                <h2 className="font-bold text-lg mb-4 border-b pb-2">Đơn hàng của bạn</h2>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">{cartItems.map((item, index) => { const {totalPrice} = calculatePrice(item, allParts, FRAME_OPTIONS); return (<div key={index} className="flex justify-between text-sm"><span>Khung x{item.quantity||1}</span><span>{formatCurrency(totalPrice * (item.quantity||1))}</span></div>) })}</div>
                
                <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(subtotal)}</span></div>
                    {effectiveGiftBox && <div className="flex justify-between"><span>Hộp quà</span><span>{formatCurrency(giftBoxFee)}</span></div>}
                    <div className="flex justify-between"><span>Phí vận chuyển</span><span>{isFreeShippingEligible && shippingOption === 'standard' ? 'Miễn phí' : formatCurrency(shippingFee)}</span></div>
                    {isEarlyBird && <div className="flex justify-between text-green-700 font-bold"><span>Ưu đãi đặt sớm</span><span>-{formatCurrency(earlyBirdDiscountAmount)}</span></div>}
                    {appliedVoucher && <div className="flex justify-between text-blue-600 font-bold"><span>Voucher ({appliedVoucher.code})</span><span>-{formatCurrency(voucherDiscountAmount)}</span></div>}
                </div>
                
                {/* Voucher Input */}
                <div className="mt-4 pt-2 border-t border-dashed">
                    <div className="flex gap-2">
                        <input type="text" placeholder="Mã giảm giá" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} disabled={!!appliedVoucher} className="flex-grow p-2 border rounded-lg text-sm uppercase" />
                        {appliedVoucher ? (<button type="button" onClick={handleRemoveVoucher} className="bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-200">Xóa</button>) : (<button type="button" onClick={handleApplyVoucher} disabled={isCheckingVoucher || !voucherCode} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50">{isCheckingVoucher ? '...' : 'Áp dụng'}</button>)}
                    </div>
                    {voucherError && <p className="text-xs text-red-500 mt-1">{voucherError}</p>}
                    {appliedVoucher && <p className="text-xs text-green-600 mt-1">Đã áp dụng: {appliedVoucher.code}</p>}
                </div>

                <div className="border-t mt-4 pt-4 flex justify-between font-bold text-lg"><span>Tổng cộng</span><span>{formatCurrency(totalPrice)}</span></div>
                <div className="border-t mt-2 pt-2 flex justify-between font-bold text-lg text-luvin-pink"><span>Cần thanh toán</span><span>{formatCurrency(amountToPay)}</span></div>
                
                <div className="border-t mt-4 pt-4"><h3 className="font-semibold mb-2">Phương thức thanh toán</h3><div className="space-y-2"><label className="flex items-center p-3 border rounded-lg bg-white cursor-pointer hover:bg-pink-50"><input type="radio" name="payment" value="deposit" checked={paymentMethod === 'deposit'} onChange={() => setPaymentMethod('deposit')} className="h-4 w-4 accent-luvin-pink"/><span className="ml-2 text-sm">Chuyển khoản cọc 70%</span></label><label className="flex items-center p-3 border rounded-lg bg-white cursor-pointer hover:bg-pink-50"><input type="radio" name="payment" value="full" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} className="h-4 w-4 accent-luvin-pink"/><span className="ml-2 text-sm">Chuyển khoản toàn bộ</span></label></div></div>

                <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50">{isSubmitting ? 'Đang xử lý...' : 'ĐẶT HÀNG'}</button>
                {submissionError && <p className="text-red-500 text-sm mt-2 text-center">{submissionError}</p>}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
