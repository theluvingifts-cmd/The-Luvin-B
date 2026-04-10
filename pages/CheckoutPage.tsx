import React, { useState, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, Order, Voucher } from '../types';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { FRAME_OPTIONS, GENERAL_ASSETS } from '../constants';
import { ZoomIcon } from '../components/ZoomIcon';
import { validateVoucher, incrementVoucherUsage } from '../services/voucherService';
import { getOrdersByPhone, getOrderById } from '../services/orderService'; 
import { getStoreConfig, StoreConfig } from '../services/configService';
import { trackFunnelStep } from '../services/analyticsService';
import { useLanguage } from '../src/contexts/LanguageContext';

// Popular provinces as fallback if API fails
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
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [notes, setNotes] = useState('');
  const [demoContact, setDemoContact] = useState('');
  
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
  
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);

  // Voucher State
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  
  
  // Auto-fill & Loyalty State
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isLoyalCustomer, setIsLoyalCustomer] = useState(false);
  
  const [manualReferralCode, setManualReferralCode] = useState(localStorage.getItem('referred_by') || '');

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
          
          // If we have individual fields, use them. Otherwise fallback to full address as street.
          if (initialOrder.customer.province || initialOrder.customer.district || initialOrder.customer.ward) {
              setStreet(initialOrder.customer.address.split(',')[0].trim());
              setSelectedProvince(initialOrder.customer.province || '');
              setSelectedDistrict(initialOrder.customer.district || '');
              setSelectedWard(initialOrder.customer.ward || '');
              // Since we're loading from an order, we might need to set isApiError to true 
              // if the values are names instead of codes, to allow editing.
              // But for now, let's just set them.
              setIsApiError(true); 
          } else {
              setStreet(initialOrder.customer.address);
          }

          setDeliveryDate(initialOrder.delivery.date);
          setNotes(initialOrder.delivery.notes);
          setDemoContact(initialOrder.customer.demoContact || '');
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
            setIsApiError(true);
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
        .catch(err => {
            console.error("Ward fetch error:", err);
            setIsApiError(true);
        });
      setSelectedWard('');
    } else {
      setWards([]);
    }
  }, [selectedDistrict, isApiError]);


  const subtotal = useMemo(() => {
      return cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1), 0);
  }, [cartItems, allParts]);

  const totalQuantity = useMemo(() => cartItems.reduce((total, item) => total + (item.quantity || 1), 0), [cartItems]);
  
  const hasCustomPrint = useMemo(() => {
    return cartItems.some(item => {
      const { priceBreakdown } = calculatePrice(item, allParts, FRAME_OPTIONS);
      return priceBreakdown.some(pb => pb.label.includes('In mặt riêng') || pb.label.includes(t('studio.custom_print')));
    });
  }, [cartItems, allParts, t]);

  let calculatedShippingFee = SHIPPING_FEES[shippingOption];
  const isFreeShippingEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
  
  if (shippingOption === 'standard' && isFreeShippingEligible) {
      calculatedShippingFee = 0;
  }
  
  const shippingFee = calculatedShippingFee;
  // Gift box fee only if in stock and selected, based on quantity
  const giftBoxFee = (!storeConfig?.giftBoxOutOfStock && addGiftBox) ? GIFT_BOX_PRICE * totalQuantity : 0;
  
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

  // Warning based on warehouse location (Dong Anh, Ha Noi)
  const isNonHanoiProvince = useMemo(() => {
      const p = provinces.find(p => String(p.code) === String(selectedProvince));
      return p && p.name !== 'Thanh pho Ha Noi' && p.name !== 'Ha Noi' && p.name !== 'Hà Nội' && p.name !== 'Thành phố Hà Nội';
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
          setVoucherError(result.message || t('checkout.invalid_voucher'));
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
                  
                  const hasConfirmedOrder = history.some(order => 
                    !['Waiting for payment', 'Cancelled', 'Deleted'].includes(order.status)
                  );

                  if (hasConfirmedOrder) {
                      setIsLoyalCustomer(true);
                  }

                  if (!name) setName(lastOrder.customer.name);
                  if (!email && lastOrder.customer.email) setEmail(lastOrder.customer.email);
                  if (!street && lastOrder.customer.address) {
                      setStreet(lastOrder.customer.address);
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
        setPhoneError(t('checkout.phone_error'));
        return;
    }

    if (!deliveryDate) {
        alert(t('checkout.select_delivery_date'));
        return;
    }

    setIsSubmitting(true);

    const provinceName = provinces.find(p => String(p.code) === String(selectedProvince))?.name || selectedProvince || '';
    const districtName = districts.find(d => String(d.code) === String(selectedDistrict))?.name || selectedDistrict || '';
    const wardName = wards.find(w => String(w.code) === String(selectedWard))?.name || selectedWard || '';
    
    const fullAddress = [street, wardName, districtName, provinceName].filter(Boolean).join(', ');

    const orderId = initialOrder ? initialOrder.id : `#TL${Date.now().toString().slice(-6)}`;
    
    let autoTags = '';
    if (isEarlyBird) autoTags += t('checkout.early_bird_tag');
    if (isLoyalCustomer) autoTags += t('checkout.loyal_customer_tag');
    if (appliedVoucher) autoTags += t('checkout.voucher_tag', { code: appliedVoucher.code });
    
    const finalNotes = autoTags + notes;

    try {
        const provinceVal = provinces.find(p => String(p.code) === String(selectedProvince))?.name || selectedProvince || '';
        const districtVal = districts.find(d => String(d.code) === String(selectedDistrict))?.name || selectedDistrict || '';
        const wardVal = wards.find(w => String(w.code) === String(selectedWard))?.name || selectedWard || '';

        await onPlaceOrder({
          id: orderId,
          customer: { 
            name, 
            phone, 
            email, 
            address: fullAddress, 
            province: provinceVal,
            district: districtVal,
            ward: wardVal,
            note: notes,
            demoContact 
          },
          delivery: { date: deliveryDate, notes: finalNotes },
          items: cartItems.map(item => {
            const { totalPrice: itemPrice } = calculatePrice(item, allParts, FRAME_OPTIONS);
            return { ...item, price: itemPrice };
          }),
          addGiftBox: !storeConfig?.giftBoxOutOfStock && addGiftBox,
          shipping: { method: shippingOption, fee: shippingFee },
          payment: { method: paymentMethod },
          totalPrice,
          amountToPay,
          discountCode: appliedVoucher?.code || (isLoyalCustomer ? 'LOYALTY' : undefined),
          discountAmount: totalDiscount,
          referredBy: manualReferralCode || undefined
        });

        if (!initialOrder) trackFunnelStep('order_complete');

        // Save phone for referral system
        localStorage.setItem('last_customer_phone', phone);
        localStorage.removeItem('referred_by'); // Clear ref after use

        if (appliedVoucher) {
            await incrementVoucherUsage(appliedVoucher.code);
        }

    } catch (error: any) {
        console.error("Order submission error:", error);
        setIsSubmitting(false);
        const message = error.message || t('common.error');
        setSubmissionError(message);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  };

  if (cartItems.length === 0) {
      return <div className="text-center py-20">{t('cart.empty')}</div>
  }

  const isGiftBoxOutOfStock = storeConfig?.giftBoxOutOfStock;

  return (
    <div className="bg-white">
      <form onSubmit={handleSubmit} className="container mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            {initialOrder ? t('checkout.update_order_title') : t('checkout.title')}
        </h1>
        {initialOrder && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 text-center text-sm">
                {t('checkout.editing_order_notice', { id: initialOrder.id })}
            </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 space-y-6">
            
            <div className="bg-gray-50 p-6 rounded-lg border shadow-sm">
              <h2 className="font-bold text-xl text-gray-800 mb-6 pb-2 border-b border-gray-200">{t('checkout.shipping_info')}</h2>
              
              <div className="mb-6 border-b border-gray-200 pb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('checkout.recipient')}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        type="tel" 
                        placeholder={t('checkout.phone')} 
                        value={phone} 
                        onChange={e => { setPhone(e.target.value); setPhoneError(''); if(e.target.value.length < 10) setIsLoyalCustomer(false); }} 
                        onBlur={handlePhoneBlur}
                        className={`w-full p-3 border ${phoneError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none`} 
                        required 
                      />
                      {isCheckingPhone && <span className="absolute right-3 top-3.5 text-xs text-gray-400 animate-pulse">{t('checkout.checking_phone')}</span>}
                      {isLoyalCustomer && !isCheckingPhone && (
                          <div className="absolute right-2 top-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm border border-blue-200 animate-fade-in">
                              <span>💎</span> {t('checkout.loyal_customer')}
                          </div>
                      )}
                      {phoneError && <p className="text-red-500 text-xs mt-1 ml-1">{phoneError}</p>}
                    </div>
                    <input type="text" placeholder={t('checkout.full_name')} value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" required />
                    <input type="email" placeholder={t('checkout.email_notice')} value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" required />
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-gray-500 block mb-1">{t('checkout.demo_contact_label')}</label>
                      <input 
                        type="text" 
                        placeholder={t('checkout.demo_contact_placeholder')} 
                        value={demoContact} 
                        onChange={e => setDemoContact(e.target.value)} 
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none" 
                        required 
                      />
                      <p className="text-[10px] text-gray-400 mt-1 italic">{t('checkout.demo_contact_note')}</p>
                    </div>
                  </div>
              </div>

              <div className="mb-6 border-b border-gray-200 pb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('checkout.address_shipping')}</h3>
                  </div>
                  
                  <div className="space-y-4">
                     {!isApiError ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select 
                                value={selectedProvince} 
                                onChange={e => setSelectedProvince(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none"
                                required={!isApiError}
                            >
                                <option value="">{isLoadingProvinces ? t('common.loading') : t('checkout.province')}</option>
                                {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                            </select>
                            <select 
                                value={selectedDistrict} 
                                onChange={e => setSelectedDistrict(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                disabled={!selectedProvince}
                                required={!isApiError}
                            >
                                <option value="">{t('checkout.district')}</option>
                                {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                            </select>
                            <select 
                                value={selectedWard} 
                                onChange={e => setSelectedWard(e.target.value)} 
                                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm" 
                                disabled={!selectedDistrict}
                                required={!isApiError}
                            >
                                <option value="">{t('checkout.ward')}</option>
                                {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                            </select>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                             <input 
                                type="text" 
                                placeholder={t('checkout.province')} 
                                value={selectedProvince} 
                                onChange={e => setSelectedProvince(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                required 
                            />
                            <input 
                                type="text" 
                                placeholder={t('checkout.district')} 
                                value={selectedDistrict} 
                                onChange={e => setSelectedDistrict(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                required 
                            />
                            <input 
                                type="text" 
                                placeholder={t('checkout.ward')} 
                                value={selectedWard} 
                                onChange={e => setSelectedWard(e.target.value)} 
                                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm" 
                                required 
                            />
                        </div>
                     )}

                     <input type="text" placeholder={t('checkout.street')} value={street} onChange={e => setStreet(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none" required />

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-semibold text-gray-700 block mb-1">{t('checkout.delivery_date')}</label>
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
                                  {t('checkout.early_bird_discount_applied', { days: daysDifference })}
                              </p>
                          ) : (
                              <p className="text-xs text-gray-500 mt-1">
                                  {t('checkout.early_bird_tip')}
                              </p>
                          )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm mb-2 text-gray-700">{t('checkout.shipping_method')}</h3>
                            <div className="space-y-2">
                                <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="standard" checked={shippingOption === 'standard'} onChange={() => setShippingOption('standard')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <div className="ml-2 flex-grow">
                                        <span className="text-sm block text-gray-700 font-medium">{t('checkout.shipping_standard')}</span>
                                    </div>
                                    {isFreeShippingEligible ? (
                                        <div className="text-right">
                                            <span className="text-xs text-gray-400 line-through mr-1">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                            <span className="text-sm font-bold text-green-600">{t('checkout.free')}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                    )}
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="express" checked={shippingOption === 'express'} onChange={() => setShippingOption('express')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <div className="ml-2 flex-grow">
                                        <span className="text-sm block text-gray-700 font-medium">{t('checkout.shipping_express')}</span>
                                    </div>
                                     <span className="text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.express)}</span>
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="bookship" checked={shippingOption === 'bookship'} onChange={() => setShippingOption('bookship')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <div className="ml-2 flex-grow">
                                        <span className="text-sm block text-gray-700 font-medium">{t('checkout.shipping_bookship')}</span>
                                        <p className="text-[10px] text-gray-400 italic leading-tight">{t('checkout.warehouse_location')}</p>
                                    </div>
                                     <span className="text-sm font-bold text-gray-800">{t('checkout.zero_vnd')}</span>
                                </label>
                            </div>
                        </div>
                     </div>
                  </div>

                  {/* Distance warning for Bookship or Express */}
                  {(shippingOption === 'bookship' || shippingOption === 'express') && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 items-start animate-fade-in">
                          <span className="text-xl">📍</span>
                          <div className="text-xs text-orange-900 leading-relaxed">
                              <p className="font-bold mb-1">{t('checkout.distance_warning_title')}</p>
                              <p>{t('checkout.distance_warning_desc', { location: t('checkout.warehouse_location') })}</p>
                              {shippingOption === 'bookship' && <p className="mt-1">{t('checkout.bookship_warning')}</p>}
                              {isNonHanoiProvince && <p className="mt-1 text-red-600 font-bold">{t('checkout.non_hanoi_warning')}</p>}
                          </div>
                      </div>
                  )}

                  {hasCustomPrint && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-fade-in mb-4">
                          <span className="text-xl">⚠️</span>
                          <div className="text-xs text-amber-900 leading-relaxed">
                              <p className="font-bold mb-1">{t('studio.custom_print')}</p>
                              <p>{t('studio.custom_print_notice')}</p>
                          </div>
                      </div>
                  )}

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
                      <span className="text-xl">ℹ️</span>
                      <div className="text-xs text-blue-900 leading-relaxed">
                          <p><b>{t('common.order_note')}:</b> {t('checkout.handcrafted_note')}</p>
                      </div>
                  </div>
              </div>

              <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{t('checkout.order_notes')}</h3>
                  <textarea placeholder={t('checkout.order_notes_placeholder')} value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none"></textarea>
               </div>
            </div>

            <div className={`bg-gray-50 p-4 rounded-lg border transition-all ${isGiftBoxOutOfStock ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                <label className={`flex items-center p-3 rounded-lg bg-white border transition-all ${isGiftBoxOutOfStock ? 'cursor-not-allowed border-gray-200' : 'cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50'}`}>
                    <img src={storeConfig?.giftBoxImageUrl || GENERAL_ASSETS.giftbox} alt={t('checkout.gift_box_alt')} className="w-12 h-12 object-contain mr-4"/>
                    <div className="flex-grow">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{t('checkout.add_gift_box', { count: totalQuantity })}</span>
                            {isGiftBoxOutOfStock && (
                                <span className="bg-gray-200 text-gray-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">{t('checkout.out_of_stock')}</span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500">{t('checkout.gift_box_desc')}</p>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="font-bold text-luvin-pink">+{formatCurrency(GIFT_BOX_PRICE)}</span>
                        {!isGiftBoxOutOfStock && (
                            <input 
                                type="checkbox" 
                                checked={addGiftBox} 
                                onChange={e => setAddGiftBox(e.target.checked)} 
                                className="h-5 w-5 rounded text-luvin-pink focus:ring-luvin-pink mt-1"
                            />
                        )}
                    </div>
                </label>
                {isGiftBoxOutOfStock && (
                    <p className="text-[10px] text-gray-400 mt-2 italic px-1">
                        {t('checkout.gift_box_out_of_stock_note')}
                    </p>
                )}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-gray-50 p-4 rounded-lg border sticky top-24">
                
              <div className="mb-4 pb-4 border-b border-gray-200">
                 {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                    <div className="bg-green-100 text-green-800 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
                        <span>🎉</span>
                        <span>{t('checkout.freeship_congrats')}</span>
                    </div>
                ) : (
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{t('checkout.freeship_progress')}</span>
                            <span className="font-bold text-gray-900">{Math.round((subtotal/FREE_SHIPPING_THRESHOLD)*100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-luvin-pink transition-all duration-500" style={{width: `${(subtotal/FREE_SHIPPING_THRESHOLD)*100}%`}}></div>
                        </div>
                        <p className="text-xs text-gray-500 text-right">{t('checkout.buy_more_for_freeship', { amount: formatCurrency(FREE_SHIPPING_THRESHOLD - subtotal) })}</p>
                    </div>
                )}
              </div>

              <h2 className="font-bold text-lg mb-4 border-b pb-2">{t('checkout.your_order')}</h2>
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
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[8px]">{t('checkout.no_image')}</div>
                            )}
                        </div>
                        <div>
                            <span className="font-medium">{t('checkout.custom_frame')}</span>
                            {quantity > 1 && <span className="ml-1 text-xs font-bold text-gray-400">x{quantity}</span>}
                        </div>
                      </div>
                      <span className="font-semibold">{formatCurrency(totalPrice * quantity)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>{t('cart.subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
                {(!storeConfig?.giftBoxOutOfStock && addGiftBox) && <div className="flex justify-between"><span>{t('checkout.gift_box')}</span><span>{formatCurrency(giftBoxFee)}</span></div>}
                <div className="flex justify-between">
                    <span>{t('checkout.shipping_fee')}</span>
                    {isFreeShippingEligible && shippingOption === 'standard' ? (
                        <span className="text-green-600 font-bold">{t('checkout.free')}</span>
                    ) : (
                        <span>{shippingOption === 'bookship' ? t('checkout.zero_vnd') : formatCurrency(shippingFee)}</span>
                    )}
                </div>
                {isEarlyBird && (
                    <div className="flex justify-between text-green-700 font-bold">
                        <span>{t('checkout.early_bird_discount')}</span>
                        <span>-{formatCurrency(earlyBirdDiscountAmount)}</span>
                    </div>
                )}
                {isLoyalCustomer && (
                    <div className="flex justify-between text-blue-600 font-bold">
                        <span className="flex items-center gap-1">💎 {t('checkout.loyalty_discount')}</span>
                        <span>-{formatCurrency(loyaltyDiscountAmount)}</span>
                    </div>
                )}
                {appliedVoucher && (
                    <div className="flex justify-between text-purple-600 font-bold">
                        <span>{t('checkout.voucher')} ({appliedVoucher.code})</span>
                        <span>-{formatCurrency(voucherDiscountAmount)}</span>
                    </div>
                )}
              </div>

              {/* Voucher Input */}
              <div className="mt-4 pt-2 border-t border-dashed">
                  <p className="text-xs font-bold text-gray-500 mb-2">{t('checkout.discount_code')}</p>
                  <div className="flex gap-2">
                      <input 
                          type="text" 
                          placeholder={t('checkout.enter_code')} 
                          value={voucherCode} 
                          onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                          disabled={!!appliedVoucher}
                          className="flex-grow p-2 border rounded-lg text-sm uppercase"
                      />
                      {appliedVoucher ? (
                          <button type="button" onClick={handleRemoveVoucher} className="bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-200">{t('checkout.remove')}</button>
                      ) : (
                          <button type="button" onClick={handleApplyVoucher} disabled={isCheckingVoucher || !voucherCode} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50">
                              {isCheckingVoucher ? '...' : t('checkout.apply')}
                          </button>
                      )}
                  </div>
                  {voucherError && <p className="text-xs text-red-500 mt-1">{voucherError}</p>}
                  {appliedVoucher && <p className="text-xs text-green-600 mt-1">{t('checkout.applied_code', { desc: appliedVoucher.description || appliedVoucher.code })}</p>}
              </div>

              {/* Referral Code Input */}
              <div className="mt-4 pt-2 border-t border-dashed">
                  <p className="text-xs font-bold text-gray-500 mb-2">{t('checkout.referral_code')}</p>
                  <div className="flex gap-2">
                      <input 
                          type="text" 
                          placeholder={t('checkout.enter_referral_code')} 
                          value={manualReferralCode} 
                          onChange={e => {
                              setManualReferralCode(e.target.value);
                              localStorage.setItem('referred_by', e.target.value);
                          }}
                          className="flex-grow p-2 border rounded-lg text-sm"
                      />
                  </div>
                  {manualReferralCode && (
                      <p className="text-xs text-green-600 mt-1">
                          {t('checkout.referral_applied', { code: manualReferralCode })}
                      </p>
                  )}
              </div>

              <div className="border-t mt-4 pt-4 flex justify-between font-bold text-lg">
                <span>{t('cart.total')}</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="border-t mt-2 pt-2 flex justify-between font-bold text-lg text-luvin-pink">
                  <span>{t('checkout.amount_to_pay')}</span>
                  <span>{formatCurrency(amountToPay)}</span>
              </div>
              <div className="border-t mt-4 pt-4">
                <h3 className="font-semibold mb-2">{t('checkout.payment_method')}</h3>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 cursor-pointer">
                    <input type="radio" name="payment" value="deposit" checked={paymentMethod === 'deposit'} onChange={() => setPaymentMethod('deposit')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink" />
                    <span className="ml-2 text-sm font-medium">{t('checkout.payment_deposit')}</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg bg-white has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50 cursor-pointer">
                    <input type="radio" name="payment" value="full" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink" />
                    <span className="ml-2 text-sm font-medium">{t('checkout.payment_full')}</span>
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
                {isSubmitting ? t('checkout.processing') : (initialOrder ? t('checkout.save_order_update') : t('checkout.order_now'))}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
