import React, { useState, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, Order, Voucher } from '../types';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { FRAME_OPTIONS, GENERAL_ASSETS } from '../constants';
import { ZoomIcon } from '../components/ZoomIcon';
import { validateVoucher, incrementVoucherUsage } from '../services/voucherService';
import { getOrdersByPhone } from '../services/orderService'; 

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
          setProvinces(POPULAR_PROVINCES); // Sử dụng danh sách dự phòng
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
            // Nếu lỗi API khi đã chọn tỉnh, cho phép nhập text
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
  const giftBoxFee = addGiftBox ? GIFT_BOX_PRICE : 0;
  
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
                  setIsLoyalCustomer(true);
                  if (!name) setName(lastOrder.customer.name);
                  if (!email && lastOrder.customer.email) setEmail(lastOrder.customer.email);
                  if (!street && lastOrder.customer.address) {
                      setStreet(lastOrder.customer.address);
                      // Khi autofill, ưu tiên dùng địa chỉ thô
                  }
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

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
        setPhoneError("Số điện thoại phải có đúng 10 số và bắt đầu bằng số 0");
        return;
    }

    if (!deliveryDate) {
        alert("Vui lòng chọn ngày nhận hàng mong muốn.");
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
          addGiftBox,
          shipping: { method: shippingOption, fee: shippingFee },
          payment: { method: paymentMethod },
          totalPrice,
          amountToPay,
          discountCode: appliedVoucher?.code || (isLoyalCustomer ? 'LOYALTY' : undefined),
          discountAmount: totalDiscount
        });

        if (appliedVoucher) {
            await incrementVoucherUsage(appliedVoucher.code);
        }

    } catch (error: any) {
        console.error("Order submission error:", error);
        setIsSubmitting(false);
        const message = error.message || "Đã có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hotline.";
        setSubmissionError(message);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
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
        {initialOrder && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 text-center text-sm">
                Bạn đang chỉnh sửa đơn hàng <strong>{initialOrder.id}</strong>. Sau khi cập nhật, thông tin cũ sẽ bị thay thế.
            </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 space-y-6">
            
            <div className="bg-gray-50 p-6 rounded-lg border shadow-sm">
              <h2 className="font-bold text-xl text-gray-800 mb-6 pb-2 border-b border-gray-200">Thông tin giao hàng</h2>
              
              <div className="mb-6 border-b border-gray-200 pb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">1. Người nhận</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        type="tel" 
                        placeholder="Số điện thoại" 
                        value={phone} 
                        onChange={e => { setPhone(e.target.value); setPhoneError(''); if(e.target.value.length < 10) setIsLoyalCustomer(false); }} 
                        onBlur={handlePhoneBlur}
                        className={`w-full p-3 border ${phoneError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none`} 
                        required 
                      />
                      {isCheckingPhone && <span className="absolute right-3 top-3.5 text-xs text-gray-400 animate-pulse">Đang kiểm tra...</span>}
                      {isLoyalCustomer && !isCheckingPhone && (
                          <div className="absolute right-2 top-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm border border-blue-200 animate-fade-in">
                              <span>💎</span> Khách quen
                          </div>
                      )}
                      {phoneError && <p className="text-red-500 text-xs mt-1 ml-1">{phoneError}</p>}
                    </div>
                    <input type="text" placeholder="Họ và tên" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" required />
                    <input type="email" placeholder="Email (Nhận thông báo đơn hàng)" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" required />
                  </div>
              </div>

              <div className="mb-6 border-b border-gray-200 pb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">2. Địa chỉ & Vận chuyển</h3>
                    {isApiError && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold animate-pulse">
                            ⚠️ API Địa chỉ đang bảo trì - Vui lòng nhập thủ công
                        </span>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                     {!isApiError ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select 
                                value={selectedProvince} 
                                onChange={e => setSelectedProvince(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none"
                                required={!isApiError}
                            >
                                <option value="">{isLoadingProvinces ? 'Đang tải...' : 'Tỉnh/Thành phố'}</option>
                                {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                            </select>
                            <select 
                                value={selectedDistrict} 
                                onChange={e => setSelectedDistrict(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                disabled={!selectedProvince}
                                required={!isApiError}
                            >
                                <option value="">Quận/Huyện</option>
                                {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                            </select>
                            <select 
                                value={selectedWard} 
                                onChange={e => setSelectedWard(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                disabled={!selectedDistrict}
                                required={!isApiError}
                            >
                                <option value="">Phường/Xã</option>
                                {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                            </select>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <input 
                                type="text" 
                                placeholder="Tỉnh / Thành phố" 
                                value={selectedProvince} 
                                onChange={e => setSelectedProvince(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                required 
                            />
                            <input 
                                type="text" 
                                placeholder="Quận / Huyện" 
                                value={selectedDistrict} 
                                onChange={e => setSelectedDistrict(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                required 
                            />
                            <input 
                                type="text" 
                                placeholder="Phường / Xã" 
                                value={selectedWard} 
                                onChange={e => setSelectedWard(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                required 
                            />
                        </div>
                     )}

                     <input type="text" placeholder="Số nhà, tên đường" value={street} onChange={e => setStreet(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" required />
                     
                     {isApiError && (
                         <button 
                            type="button" 
                            onClick={() => { setIsApiError(false); setProvinces([]); window.location.reload(); }}
                            className="text-[10px] text-blue-600 hover:underline"
                        >
                            Thử tải lại danh sách tự động?
                        </button>
                     )}

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-semibold text-gray-700 block mb-1">Ngày nhận hàng mong muốn</label>
                          <input 
                            type="date" 
                            value={deliveryDate} 
                            onChange={e => setDeliveryDate(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" 
                            required 
                            min={new Date().toISOString().split("T")[0]} 
                          />
                          {isEarlyBird ? (
                              <p className="text-xs text-green-600 font-bold mt-1 animate-pulse">
                                  ✓ Đặt trước {daysDifference} ngày: Giảm 5%
                              </p>
                          ) : (
                              <p className="text-xs text-gray-500 mt-1">
                                  Mẹo: Đặt trước 20 ngày để được giảm ngay 5.
                              </p>
                          )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm mb-2 text-gray-700">Phương thức vận chuyển</h3>
                            <div className="space-y-2">
                                <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="standard" checked={shippingOption === 'standard'} onChange={() => setShippingOption('standard')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <span className="ml-2 text-sm flex-grow text-gray-700">Giao hàng thường</span>
                                    {isFreeShippingEligible ? (
                                        <div className="text-right">
                                            <span className="text-xs text-gray-400 line-through mr-1">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                            <span className="text-sm font-bold text-green-600">Free</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                    )}
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="express" checked={shippingOption === 'express'} onChange={() => setShippingOption('express')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <span className="ml-2 text-sm flex-grow text-gray-700">Hỏa tốc (Nội thành)</span>
                                     <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.express)}</span>
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="bookship" checked={shippingOption === 'bookship'} onChange={() => setShippingOption('bookship')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <span className="ml-2 text-sm flex-grow text-gray-700">Tự book ship / Qua lấy</span>
                                     <span className="text-sm font-bold text-gray-800">0₫</span>
                                </label>
                            </div>
                        </div>
                     </div>
                  </div>
              </div>

              <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">3. Ghi chú đơn hàng</h3>
                  <textarea placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none"></textarea>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border">
                 <label className="flex items-center p-3 rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 border">
                    <img src={GENERAL_ASSETS.giftbox} alt="Gift Box" className="w-12 h-12 object-contain mr-4"/>
                    <div className="flex-grow">
                        <span className="font-semibold text-gray-800">Thêm hộp quà</span>
                        <p className="text-xs text-gray-500">Hộp quà cao cấp, rơm & thiệp viết tay.</p>
                    </div>
                    <span className="font-bold text-luvin-pink mr-4">+{formatCurrency(GIFT_BOX_PRICE)}</span>
                    <input type="checkbox" checked={addGiftBox} onChange={e => setAddGiftBox(e.target.checked)} className="h-5 w-5 rounded text-luvin-pink focus:ring-luvin-pink"/>
                </label>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-gray-50 p-4 rounded-lg border sticky top-24">
                
              <div className="mb-4 pb-4 border-b border-gray-200">
                 {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                    <div className="bg-green-100 text-green-800 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
                        <span>🎉</span>
                        <span>Chúc mừng! Bạn được Miễn phí giao hàng thường.</span>
                    </div>
                ) : (
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">Tiến độ Freeship</span>
                            <span className="font-bold text-gray-900">{Math.round((subtotal/FREE_SHIPPING_THRESHOLD)*100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-luvin-pink transition-all duration-500" style={{width: `${(subtotal/FREE_SHIPPING_THRESHOLD)*100}%`}}></div>
                        </div>
                        <p className="text-xs text-gray-500 text-right">Mua thêm <span className="font-bold text-gray-900">{formatCurrency(FREE_SHIPPING_THRESHOLD - subtotal)}</span> để được Freeship</p>
                    </div>
                )}
              </div>

              <h2 className="font-bold text-lg mb-4 border-b pb-2">Đơn hàng của bạn</h2>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {cartItems.map((item, index) => {
                  const { totalPrice } = calculatePrice(item, allParts, FRAME_OPTIONS);
                  const quantity = item.quantity || 1;
                  
                  return (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 object-contain bg-white border rounded cursor-pointer group relative" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)}>
                            {item.previewImageUrl ? (
                                <>
                                    <img src={item.previewImageUrl} className="w-full h-full object-contain" alt="preview" />
                                    <div className="absolute bottom-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        <div 
                                            className="bg-black/40 hover:bg-black/60 text-white p-1 rounded-full cursor-pointer pointer-events-auto scale-50"
                                            onClick={(e) => { e.stopPropagation(); onZoomImage(item.previewImageUrl!); }}
                                            title="Zoom"
                                        >
                                            <ZoomIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[8px]">No Img</div>
                            )}
                        </div>
                        <div>
                            <span className="font-medium">Khung tùy chỉnh</span>
                            {quantity > 1 && <span className="ml-1 text-xs font-bold text-gray-400">x{quantity}</span>}
                        </div>
                      </div>
                      <span className="font-semibold">{formatCurrency(totalPrice * quantity)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(subtotal)}</span></div>
                {addGiftBox && <div className="flex justify-between"><span>Hộp quà</span><span>{formatCurrency(giftBoxFee)}</span></div>}
                <div className="flex justify-between">
                    <span>Phí vận chuyển</span>
                    {isFreeShippingEligible && shippingOption === 'standard' ? (
                        <span className="text-green-600 font-bold">Miễn phí</span>
                    ) : (
                        <span>{shippingOption === 'bookship' ? '0₫' : formatCurrency(shippingFee)}</span>
                    )}
                </div>
                {isEarlyBird && (
                    <div className="flex justify-between text-green-700 font-bold">
                        <span>Ưu đãi đặt sớm (5%)</span>
                        <span>-{formatCurrency(earlyBirdDiscountAmount)}</span>
                    </div>
                )}
                {isLoyalCustomer && (
                    <div className="flex justify-between text-blue-600 font-bold">
                        <span className="flex items-center gap-1">💎 Khách quen (5%)</span>
                        <span>-{formatCurrency(loyaltyDiscountAmount)}</span>
                    </div>
                )}
                {appliedVoucher && (
                    <div className="flex justify-between text-purple-600 font-bold">
                        <span>Voucher ({appliedVoucher.code})</span>
                        <span>-{formatCurrency(voucherDiscountAmount)}</span>
                    </div>
                )}
              </div>

              {/* Voucher Input */}
              <div className="mt-4 pt-2 border-t border-dashed">
                  <p className="text-xs font-bold text-gray-500 mb-2">Mã giảm giá</p>
                  <div className="flex gap-2">
                      <input 
                          type="text" 
                          placeholder="Nhập mã" 
                          value={voucherCode} 
                          onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                          disabled={!!appliedVoucher}
                          className="flex-grow p-2 border rounded-lg text-sm uppercase"
                      />
                      {appliedVoucher ? (
                          <button type="button" onClick={handleRemoveVoucher} className="bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-200">Xóa</button>
                      ) : (
                          <button type="button" onClick={handleApplyVoucher} disabled={isCheckingVoucher || !voucherCode} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50">
                              {isCheckingVoucher ? '...' : 'Áp dụng'}
                          </button>
                      )}
                  </div>
                  {voucherError && <p className="text-xs text-red-500 mt-1">{voucherError}</p>}
                  {appliedVoucher && <p className="text-xs text-green-600 mt-1">Đã áp dụng mã: {appliedVoucher.description || appliedVoucher.code}</p>}
              </div>

              <div className="border-t mt-4 pt-4 flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="border-t mt-2 pt-2 flex justify-between font-bold text-lg text-luvin-pink">
                  <span>Cần thanh toán</span>
                  <span>{formatCurrency(amountToPay)}</span>
              </div>
              <div className="border-t mt-4 pt-4">
                <h3 className="font-semibold mb-2">Phương thức thanh toán</h3>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 cursor-pointer">
                    <input type="radio" name="payment" value="deposit" checked={paymentMethod === 'deposit'} onChange={() => setPaymentMethod('deposit')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink" />
                    <span className="ml-2 text-sm font-medium">Chuyển khoản cọc 70%</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 cursor-pointer">
                    <input type="radio" name="payment" value="full" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink" />
                    <span className="ml-2 text-sm font-medium">Chuyển khoản toàn bộ</span>
                  </label>
                </div>
              </div>
              
              {submissionError && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-bold flex items-start gap-2 animate-bounce-small">
                      <span className="text-xl">⚠️</span>
                      <span>{submissionError}</span>
                  </div>
              )}

              <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-wait transition-all shadow-md">
                {isSubmitting ? 'Đang xử lý...' : (initialOrder ? 'LƯU CẬP NHẬT ĐƠN HÀNG' : 'ĐẶT HÀNG NGAY')}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
