
import React, { useState, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, Order, Voucher } from '../types';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { FRAME_OPTIONS, GENERAL_ASSETS } from '../constants';
import { ZoomIcon } from '../components/ZoomIcon';
import { validateVoucher, incrementVoucherUsage } from '../services/voucherService';
import { getOrdersByPhone, getOrderById } from '../services/orderService'; 
import { getStoreConfig, StoreConfig } from '../services/configService';
import { trackFunnelStep } from '../services/analyticsService';

// Danh sách tỉnh thành phổ biến làm fallback nếu API lỗi
const POPULAR_PROVINCES = [
    { name: 'Hà Nội', code: 1 },
    { name: 'Hồ Chí Minh', code: 79 },
    { name: 'Đà Nẵng', code: 48 },
    { name: 'Cần Thơ', code: 92 },
    { name: 'Hải Phòng', code: 31 }
];

interface CheckoutPageProps {
  cartItems: FrameConfig[];
  allParts: Record<string, LegoPart>;
  onPlaceOrder: (order: Omit<Order, 'status' | 'createdAt'>) => Promise<void>;
  onZoomImage: (url: string) => void;
  initialOrder?: Order | null;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ cartItems, allParts, onPlaceOrder, onZoomImage, initialOrder }) => {
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
  
  const [isApiError, setIsApiError] = useState(false);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);

  const [shippingOption, setShippingOption] = useState<'standard' | 'express' | 'bookship'>('standard');
  const [addGiftBox, setAddGiftBox] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'full'>('deposit');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  
  // State cho Popup thông báo lỗi
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);

  // Voucher State
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  
  // Auto-fill & Loyalty State
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isLoyalCustomer, setIsLoyalCustomer] = useState(false);

  const GIFT_BOX_PRICE = 30000;
  const SHIPPING_FEES = { standard: 25000, express: 45000, bookship: 0 };
  const EARLY_BIRD_THRESHOLD = 20; 
  const EARLY_BIRD_DISCOUNT_PERCENT = 0.05; 
  const LOYALTY_DISCOUNT_PERCENT = 0.05; 

  useEffect(() => {
    getStoreConfig().then(cfg => setStoreConfig(cfg));
    if (!initialOrder) trackFunnelStep('checkout_start');
  }, []);

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

  useEffect(() => {
    setIsLoadingProvinces(true);
    fetch('https://provinces.open-api.vn/api/p/')
      .then(res => {
          if (!res.ok) throw new Error("Failed to fetch provinces");
          return res.json();
      })
      .then(data => {
          setProvinces(data);
          setIsApiError(false);
      })
      .catch(err => {
          console.error("Province fetch error:", err);
          setIsApiError(true);
          setProvinces(POPULAR_PROVINCES); 
      })
      .finally(() => setIsLoadingProvinces(false));
  }, []);

  useEffect(() => {
    if (selectedProvince && !isApiError) {
      fetch(`https://provinces.open-api.vn/api/p/${selectedProvince}?depth=2`)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch districts");
            return res.json();
        })
        .then(data => setDistricts(data.districts))
        .catch(err => {
            console.error("District fetch error:", err);
        });
      setSelectedDistrict('');
      setWards([]);
      setSelectedWard('');
    } else {
      setDistricts([]);
      setWards([]);
    }
  }, [selectedProvince, isApiError]);

  useEffect(() => {
    if (selectedDistrict && !isApiError) {
      fetch(`https://provinces.open-api.vn/api/d/${selectedDistrict}?depth=2`)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch wards");
            return res.json();
        })
        .then(data => setWards(data.wards))
        .catch(err => console.error("Ward fetch error:", err));
      setSelectedWard('');
    } else {
      setWards([]);
    }
  }, [selectedDistrict, isApiError]);


  const subtotal = useMemo(() => cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1), 0), [cartItems, allParts]);
  
  let calculatedShippingFee = SHIPPING_FEES[shippingOption];
  const isFreeShippingEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
  
  if (shippingOption === 'standard' && isFreeShippingEligible) {
      calculatedShippingFee = 0;
  }
  
  const shippingFee = calculatedShippingFee;
  const giftBoxFee = (!storeConfig?.giftBoxOutOfStock && addGiftBox) ? GIFT_BOX_PRICE : 0;
  
  const daysDifference = useMemo(() => {
      if (!deliveryDate) return 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const delivery = new Date(deliveryDate);
      delivery.setHours(0, 0, 0, 0);
      return Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [deliveryDate]);

  const isEarlyBird = daysDifference >= EARLY_BIRD_THRESHOLD;
  const earlyBirdDiscountAmount = isEarlyBird ? Math.round(subtotal * EARLY_BIRD_DISCOUNT_PERCENT) : 0;
  const loyaltyDiscountAmount = isLoyalCustomer ? Math.round(subtotal * LOYALTY_DISCOUNT_PERCENT) : 0;

  let voucherDiscountAmount = 0;
  if (appliedVoucher) {
      if (appliedVoucher.type === 'percent') {
          voucherDiscountAmount = Math.round(subtotal * (appliedVoucher.value / 100));
      } else {
          voucherDiscountAmount = appliedVoucher.value;
      }
      if (voucherDiscountAmount > subtotal) voucherDiscountAmount = subtotal;
  }

  const totalDiscount = earlyBirdDiscountAmount + voucherDiscountAmount + loyaltyDiscountAmount;
  const totalPrice = Math.max(0, subtotal + shippingFee + giftBoxFee - totalDiscount);
  const amountToPay = paymentMethod === 'deposit' ? Math.round(totalPrice * 0.7) : totalPrice;

  const isNonHanoiProvince = useMemo(() => {
      const p = provinces.find(p => p.code === parseInt(selectedProvince));
      return p && p.name !== 'Thành phố Hà Nội' && p.name !== 'Hà Nội';
  }, [selectedProvince, provinces]);

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

  const handlePhoneBlur = async () => {
      setIsLoyalCustomer(false); 
      if (phone.length >= 10 && !initialOrder) {
          setIsCheckingPhone(true);
          try {
              const history = await getOrdersByPhone(phone);
              if (history && history.length > 0) {
                  const lastOrder = history[0];
                  const hasConfirmedOrder = history.some(order => !['Chờ thanh toán', 'Huỷ đơn', 'Xoá đơn'].includes(order.status));
                  if (hasConfirmedOrder) setIsLoyalCustomer(true);
                  if (!name) setName(lastOrder.customer.name);
                  if (!email && lastOrder.customer.email) setEmail(lastOrder.customer.email);
                  if (!street && lastOrder.customer.address) setStreet(lastOrder.customer.address);
              }
          } catch (e) {
              console.error("Autofill error", e);
          } finally {
              setIsCheckingPhone(false);
          }
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; 
    setSubmissionError(''); 

    // Logic Validation Popup theo yêu cầu bố
    const errors: string[] = [];
    if (!name.trim()) errors.push("Họ và tên người nhận");
    if (!phone.trim()) errors.push("Số điện thoại liên hệ");
    if (!email.trim()) errors.push("Email nhận thông báo");
    if (!selectedProvince) errors.push("Tỉnh/Thành phố");
    if (!selectedDistrict) errors.push("Quận/Huyện");
    if (!selectedWard) errors.push("Phường/Xã");
    if (!street.trim()) errors.push("Địa chỉ nhà, tên đường");
    if (!deliveryDate) errors.push("Ngày bạn muốn nhận hàng");

    if (errors.length > 0) {
        setMissingFields(errors);
        setShowErrorModal(true);
        return;
    }

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
        setPhoneError("Số điện thoại phải có đúng 10 số và bắt đầu bằng số 0");
        return;
    }

    setIsSubmitting(true);

    const provinceName = provinces.find(p => p.code === parseInt(selectedProvince))?.name || (isApiError ? selectedProvince : '');
    const districtName = districts.find(d => d.code === parseInt(selectedDistrict))?.name || (isApiError ? selectedDistrict : '');
    const wardName = wards.find(w => w.code === parseInt(selectedWard))?.name || (isApiError ? selectedWard : '');
    
    let fullAddress = street;
    if (provinceName && !isApiError) {
        fullAddress = [street, wardName, districtName, provinceName].filter(Boolean).join(', ');
    }

    const orderId = initialOrder ? initialOrder.id : `#TL${Date.now().toString().slice(-6)}`;
    let autoTags = '';
    if (isEarlyBird) autoTags += '[ƯU ĐÃI ĐẶT SỚM 5%] ';
    if (isLoyalCustomer) autoTags += '[KHÁCH QUEN 5%] ';
    if (appliedVoucher) autoTags += `[VOUCHER: ${appliedVoucher.code}] `;
    const finalNotes = autoTags + notes;

    try {
        await onPlaceOrder({
          id: orderId,
          customer: { name, phone, email, address: fullAddress },
          delivery: { date: deliveryDate, notes: finalNotes },
          items: cartItems,
          addGiftBox: !storeConfig?.giftBoxOutOfStock && addGiftBox,
          shipping: { method: shippingOption, fee: shippingFee },
          payment: { method: paymentMethod },
          totalPrice,
          amountToPay,
          discountCode: appliedVoucher?.code || (isLoyalCustomer ? 'LOYALTY' : undefined),
          discountAmount: totalDiscount
        });
        if (!initialOrder) trackFunnelStep('order_complete');
        if (appliedVoucher) await incrementVoucherUsage(appliedVoucher.code);
    } catch (error: any) {
        setIsSubmitting(false);
        setSubmissionError(error.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  if (cartItems.length === 0) {
      return <div className="text-center py-20">Giỏ hàng của bạn đang trống.</div>
  }

  return (
    <div className="bg-white">
      <form onSubmit={handleSubmit} className="container mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            {initialOrder ? 'Cập nhật đơn hàng' : 'Thông tin thanh toán'}
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg border shadow-sm" id="shipping-info-section">
              <h2 className="font-bold text-xl text-gray-800 mb-6 pb-2 border-b border-gray-200">Thông tin giao hàng</h2>
              
              <div className="mb-6 border-b border-gray-200 pb-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">1. Người nhận</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        type="tel" 
                        placeholder="Số điện thoại" 
                        value={phone} 
                        onChange={e => { setPhone(e.target.value); setPhoneError(''); if(e.target.value.length < 10) setIsLoyalCustomer(false); }} 
                        onBlur={handlePhoneBlur}
                        className={`w-full p-3 border ${phoneError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none`} 
                      />
                      {isCheckingPhone && <span className="absolute right-3 top-3.5 text-xs text-gray-400 animate-pulse">Kiểm tra...</span>}
                      {isLoyalCustomer && !isCheckingPhone && (
                          <div className="absolute right-2 top-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm border border-blue-200 animate-fade-in">
                              <span>💎</span> Khách quen
                          </div>
                      )}
                      {phoneError && <p className="text-red-500 text-xs mt-1 ml-1">{phoneError}</p>}
                    </div>
                    <input type="text" placeholder="Họ và tên" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" />
                    <input type="email" placeholder="Email nhận thông báo đơn" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" />
                  </div>
              </div>

              <div className="mb-6 border-b border-gray-200 pb-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">2. Địa chỉ & Vận chuyển</h3>
                  <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none">
                                <option value="">{isLoadingProvinces ? 'Đang tải...' : 'Tỉnh/Thành phố'}</option>
                                {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                            </select>
                            <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" disabled={!selectedProvince}>
                                <option value="">Quận/Huyện</option>
                                {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                            </select>
                            <select value={selectedWard} onChange={e => setSelectedWard(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink outline-none" disabled={!selectedDistrict}>
                                <option value="">Phường/Xã</option>
                                {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                            </select>
                        </div>
                        <input type="text" placeholder="Số nhà, tên đường" value={street} onChange={e => setStreet(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Ngày nhận hàng mong muốn</label>
                                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" min={new Date().toISOString().split("T")[0]} />
                                {isEarlyBird && <p className="text-xs text-green-600 font-bold mt-1 animate-pulse">✓ Giảm 5% ưu đãi đặt sớm</p>}
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm mb-2 text-gray-700">Phương thức vận chuyển</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                        <input type="radio" name="shipping" value="standard" checked={shippingOption === 'standard'} onChange={() => setShippingOption('standard')} className="h-4 w-4 text-luvin-pink"/>
                                        <div className="ml-2 flex-grow text-sm">Ship thường (3-5 ngày)</div>
                                        {isFreeShippingEligible ? <span className="text-sm font-bold text-green-600">Free</span> : <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.standard)}</span>}
                                    </label>
                                    <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                        <input type="radio" name="shipping" value="express" checked={shippingOption === 'express'} onChange={() => setShippingOption('express')} className="h-4 w-4 text-luvin-pink"/>
                                        <div className="ml-2 flex-grow text-sm">Ship hỏa tốc (1-2 ngày)</div>
                                        <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.express)}</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                  </div>
              </div>

              <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">3. Ghi chú đơn hàng</h3>
                  <textarea placeholder="Ví dụ: Giao giờ hành chính..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none"></textarea>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-gray-50 p-4 rounded-lg border sticky top-24">
              <h2 className="font-bold text-lg mb-4 border-b pb-2">Tóm tắt đơn hàng</h2>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                        <span className="font-medium">Khung tùy chỉnh x{item.quantity || 1}</span>
                        <span className="font-semibold">{formatCurrency(calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1))}</span>
                    </div>
                ))}
              </div>
              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span>Phí vận chuyển</span><span>{shippingFee === 0 ? 'Miễn phí' : formatCurrency(shippingFee)}</span></div>
                {totalDiscount > 0 && <div className="flex justify-between text-green-600 font-bold"><span>Giảm giá</span><span>-{formatCurrency(totalDiscount)}</span></div>}
                <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>Tổng cộng</span><span>{formatCurrency(totalPrice)}</span></div>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-3">Phương thức thanh toán</h3>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 cursor-pointer">
                    <input type="radio" name="payment" value="deposit" checked={paymentMethod === 'deposit'} onChange={() => setPaymentMethod('deposit')} className="h-4 w-4 text-luvin-pink" />
                    <span className="ml-2 text-sm font-medium">Chuyển khoản cọc 70%</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 cursor-pointer">
                    <input type="radio" name="payment" value="full" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} className="h-4 w-4 text-luvin-pink" />
                    <span className="ml-2 text-sm font-medium">Chuyển khoản toàn bộ</span>
                  </label>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full mt-6 bg-luvin-pink text-gray-800 font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 shadow-lg">
                {isSubmitting ? 'ĐANG XỬ LÝ...' : 'ĐẶT HÀNG NGAY'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* MODAL THÔNG BÁO LỖI (BỔ SUNG THEO YÊU CẦU CỦA BỐ) */}
      {showErrorModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in-up border-2 border-orange-100">
                  <div className="bg-orange-50 p-6 text-center border-b border-orange-100">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm mx-auto mb-4 border border-orange-200 animate-bounce-small">
                          ⚠️
                      </div>
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Thiếu thông tin</h3>
                      <p className="text-xs text-orange-700 font-bold mt-1 uppercase opacity-80">Vui lòng hoàn thiện các mục sau:</p>
                  </div>
                  
                  <div className="p-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                      <div className="space-y-3">
                          {missingFields.map((field, idx) => (
                              <div key={idx} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 group hover:border-orange-200 transition-all">
                                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">!</div>
                                  <span className="text-sm font-bold text-gray-700">{field}</span>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-6 bg-gray-50 border-t border-gray-100">
                      <button 
                        onClick={() => {
                            setShowErrorModal(false);
                            document.getElementById('shipping-info-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95 uppercase tracking-widest text-xs"
                      >
                          Quay lại điền tiếp
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
