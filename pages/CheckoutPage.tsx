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
    { name: 'Ha Noi', code: 1 },
    { name: 'Ho Chi Minh', code: 79 },
    { name: 'Da Nang', code: 48 },
    { name: 'Can Tho', code: 92 },
    { name: 'Hai Phong', code: 31 }
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
  
  const [selectedExtraCharms, setSelectedExtraCharms] = useState<LegoPart[]>([]);
  
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


  const subtotal = useMemo(() => {
      const itemsTotal = cartItems.reduce((total, item) => total + calculatePrice(item, allParts, FRAME_OPTIONS).totalPrice * (item.quantity || 1), 0);
      const charmsTotal = selectedExtraCharms.reduce((total, charm) => total + (charm.price || 0), 0);
      return itemsTotal + charmsTotal;
  }, [cartItems, allParts, selectedExtraCharms]);

  const totalQuantity = useMemo(() => cartItems.reduce((total, item) => total + (item.quantity || 1), 0), [cartItems]);
  
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
      const p = provinces.find(p => p.code === parseInt(selectedProvince));
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

    const provinceName = provinces.find(p => p.code === parseInt(selectedProvince))?.name || (isApiError ? selectedProvince : '');
    const districtName = districts.find(d => d.code === parseInt(selectedDistrict))?.name || (isApiError ? selectedDistrict : '');
    const wardName = wards.find(w => w.code === parseInt(selectedWard))?.name || (isApiError ? selectedWard : '');
    
    let fullAddress = street;
    if (provinceName && !isApiError) {
        fullAddress = [street, wardName, districtName, provinceName].filter(Boolean).join(', ');
    }

    const orderId = initialOrder ? initialOrder.id : `#TL${Date.now().toString().slice(-6)}`;
    
    let autoTags = '';
    if (isEarlyBird) autoTags += t('checkout.early_bird_tag');
    if (isLoyalCustomer) autoTags += t('checkout.loyal_customer_tag');
    if (appliedVoucher) autoTags += t('checkout.voucher_tag', { code: appliedVoucher.code });
    
    const finalNotes = autoTags + notes;

    try {
        const provinceVal = provinces.find(p => p.code === parseInt(selectedProvince))?.name || (isApiError ? selectedProvince : '');
        const districtVal = districts.find(d => d.code === parseInt(selectedDistrict))?.name || (isApiError ? selectedDistrict : '');
        const wardVal = wards.find(w => w.code === parseInt(selectedWard))?.name || (isApiError ? selectedWard : '');

        await onPlaceOrder({
          id: orderId,
          customer: { 
            name, 
            phone, 
            email, 
            address: street, 
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
          extraCharms: selectedExtraCharms,
          addGiftBox: !storeConfig?.giftBoxOutOfStock && addGiftBox,
          shipping: { method: shippingOption, fee: shippingFee },
          payment: { method: paymentMethod },
          totalPrice,
          amountToPay,
          discountCode: appliedVoucher?.code || (isLoyalCustomer ? 'LOYALTY' : undefined),
          discountAmount: totalDiscount
        });

        if (!initialOrder) trackFunnelStep('order_complete');

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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink outline-none" 
                                disabled={!selectedDistrict}
                                required={!isApiError}
                            >
                                <option value="">{t('checkout.ward')}</option>
                                {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                            </select>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink outline-none" 
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

              {/* Extra Charms Selection */}
              <div className="mt-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl">✨</span>
                      <h3 className="text-lg font-bold text-gray-800">{t('checkout.extra_charms_title') || 'Chọn thêm Charm & Phụ kiện'}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">{t('checkout.extra_charms_desc') || 'Bạn có thể mua thêm các mảnh charm lẻ để trang trí thêm cho khung hình của mình.'}</p>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {(Object.values(allParts) as LegoPart[])
                          .filter(part => part.category === 'accessory' || part.category === 'pet')
                          .map(part => {
                              const isSelected = selectedExtraCharms.some(c => c.id === part.id);
                              const count = selectedExtraCharms.filter(c => c.id === part.id).length;
                              
                              return (
                                  <div 
                                      key={part.id}
                                      onClick={() => {
                                          setSelectedExtraCharms(prev => [...prev, part]);
                                      }}
                                      className={`relative group cursor-pointer border rounded-xl p-2 transition-all hover:shadow-md ${isSelected ? 'border-luvin-pink bg-pink-50/30' : 'border-gray-100 bg-gray-50/30'}`}
                                  >
                                      <div className="aspect-square mb-2 flex items-center justify-center bg-white rounded-lg overflow-hidden">
                                          <img src={part.imageUrl} alt={part.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                      </div>
                                      <div className="text-center">
                                          <p className="text-[10px] text-gray-600 truncate mb-1">{part.name}</p>
                                          <p className="text-[11px] font-bold text-luvin-pink">{formatCurrency(part.price || 0)}</p>
                                      </div>
                                      
                                      {count > 0 && (
                                          <div className="absolute -top-2 -right-2 bg-luvin-pink text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                                              {count}
                                          </div>
                                      )}
                                      
                                      {count > 0 && (
                                          <button 
                                              type="button"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedExtraCharms(prev => {
                                                      const index = prev.findIndex(c => c.id === part.id);
                                                      if (index === -1) return prev;
                                                      const next = [...prev];
                                                      next.splice(index, 1);
                                                      return next;
                                                  });
                                              }}
                                              className="absolute -bottom-1 -right-1 bg-gray-800 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                                          >
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4"></path></svg>
                                          </button>
                                      )}
                                  </div>
                              );
                          })}
                  </div>
                  
                  {selectedExtraCharms.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-100">
                          <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-medium text-gray-600">{t('checkout.selected_charms') || 'Phụ kiện đã chọn'}:</span>
                              <button 
                                  type="button" 
                                  onClick={() => setSelectedExtraCharms([])}
                                  className="text-[10px] text-red-500 hover:underline font-medium"
                              >
                                  {t('common.clear_all') || 'Xóa tất cả'}
                              </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              {Array.from(new Set(selectedExtraCharms.map(c => c.id))).map((id: string) => {
                                  const charm = allParts[id];
                                  const count = selectedExtraCharms.filter(c => c.id === id).length;
                                  return (
                                      <div key={id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full pl-1 pr-2 py-1 shadow-sm">
                                          <img src={charm.imageUrl} className="w-4 h-4 object-contain" alt="" />
                                          <span className="text-[10px] font-medium text-gray-700">x{count}</span>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}
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
                        <span>{t('checkout.free_shipping_congrats')}</span>
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
                {selectedExtraCharms.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 mt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">{t('checkout.extra_charms') || 'Phụ kiện thêm'}</p>
                    <div className="space-y-1">
                      {Array.from(new Set(selectedExtraCharms.map(c => c.id))).map((id: string) => {
                        const charm = allParts[id];
                        const count = selectedExtraCharms.filter(c => c.id === id).length;
                        return (
                          <div key={id} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <img src={charm.imageUrl} className="w-6 h-6 object-contain" alt="" />
                              <span>{charm.name} <span className="text-gray-400 font-bold">x{count}</span></span>
                            </div>
                            <span className="font-medium">{formatCurrency((charm.price || 0) * count)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
