import React, { useState, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, Order, Voucher, CollectionTemplate, FrameOption } from '../types';
import { calculatePrice, formatCurrency, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';
import { Scissors, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { FRAME_OPTIONS, GENERAL_ASSETS } from '../constants';
import { ZoomIcon } from '../components/ZoomIcon';
import { validateVoucher, incrementVoucherUsage } from '../services/voucherService';
import { getOrdersByPhone, getOrderById, getOrdersByReferralCode } from '../services/orderService'; 
import { getStoreConfig, StoreConfig } from '../services/configService';
import { trackFunnelStep } from '../services/analyticsService';
import { useLanguage } from '../src/contexts/LanguageContext';
import { getCollaboratorByReferralCode } from '../services/shareService';
import { CharacterPreview } from '../components/shared/CharacterPreview';
import { DateInput } from '../components/ui/DateInput';
import { trackInitiateCheckout, trackPurchase } from '../utils/analytics';
import PolaroidUpload from '../components/PolaroidUpload';

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
  templates: CollectionTemplate[];
  frames: FrameOption[];
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ cartItems, allParts, onPlaceOrder, onZoomImage, initialOrder, templates, frames }) => {
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
  const [addLight, setAddLight] = useState(false);
  const [polaroidOption, setPolaroidOption] = useState<0 | 2 | 4>(0);
  const [polaroidImages, setPolaroidImages] = useState<string[]>([]);
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
  const [isSelfReferral, setIsSelfReferral] = useState(false);
  
  const [manualReferralCode, setManualReferralCode] = useState(localStorage.getItem('referred_by') || '');

  const GIFT_BOX_PRICE = 30000;
  const SHIPPING_FEES = { standard: 25000, express: 45000, bookship: 0 };
  const EARLY_BIRD_THRESHOLD = 20; 
  const EARLY_BIRD_DISCOUNT_PERCENT = 0.05; 
  const LOYALTY_DISCOUNT_PERCENT = 0.05; 

  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    getStoreConfig().then(cfg => setStoreConfig(cfg));
    if (!initialOrder) {
      trackFunnelStep('checkout_start');
      trackInitiateCheckout(totalPrice, totalQuantity);
    }
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
          setAddLight(initialOrder.addLight || false);
          setPolaroidOption(initialOrder.addPolaroid || 0);
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


  useEffect(() => {
      const checkSelfReferral = async () => {
          if (manualReferralCode && phone.length >= 10) {
              const collaborator = await getCollaboratorByReferralCode(manualReferralCode);
              setIsSelfReferral(collaborator?.phone === phone);
          } else {
              setIsSelfReferral(false);
          }
      };
      checkSelfReferral();
  }, [manualReferralCode, phone]);

  const subtotal = useMemo(() => {
      return cartItems.reduce((total, item) => total + calculatePrice(item, allParts, frames, templates).totalPrice * (item.quantity || 1), 0);
  }, [cartItems, allParts, templates, frames]);

  const totalQuantity = useMemo(() => cartItems.reduce((total, item) => total + (item.quantity || 1), 0), [cartItems]);
  
  const legoQuantity = useMemo(() => {
    return cartItems
      .filter(item => (item.productLine || 'lego') === 'lego')
      .reduce((total, item) => total + (item.quantity || 1), 0);
  }, [cartItems]);

  const hasLegoItems = legoQuantity > 0;
  
  const hasCustomPrint = useMemo(() => {
    return cartItems.some(item => {
      const { priceBreakdown } = calculatePrice(item, allParts, frames, templates);
      return priceBreakdown.some(pb => pb.label.includes('In mặt riêng') || pb.label.includes(t('studio.custom_print')));
    });
  }, [cartItems, allParts, t, templates, frames]);

  let calculatedShippingFee = SHIPPING_FEES[shippingOption];
  const isFreeShippingEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
  
  if (shippingOption === 'standard' && isFreeShippingEligible) {
      calculatedShippingFee = 0;
  }
  
  const shippingFee = calculatedShippingFee;
  // Gift box fee only if in stock and selected, based on quantity
  const giftBoxFee = (!storeConfig?.giftBoxOutOfStock && addGiftBox) ? GIFT_BOX_PRICE * totalQuantity : 0;
  
  const lightFee = (!storeConfig?.lightOutOfStock && addLight && hasLegoItems) ? (storeConfig?.lightPrice || 50000) * legoQuantity : 0;

  const polaroidFee = polaroidOption === 2 ? 15000 : polaroidOption === 4 ? 25000 : 0;
  
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
  const totalPrice = Math.max(0, subtotal + shippingFee + giftBoxFee + lightFee + polaroidFee - totalDiscount);
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

  const checkLoyaltyAndAutofill = async (phoneNumber: string) => {
      if (phoneNumber.length === 10 && !initialOrder) {
          setIsCheckingPhone(true);
          try {
              const history = await getOrdersByPhone(phoneNumber);
              if (history && history.length > 0) {
                  const lastOrder = history[0];
                  
                  const hasConfirmedOrder = history.some(order => 
                    order.status === 'Đã giao hàng'
                  );

                  if (hasConfirmedOrder) {
                      setIsLoyalCustomer(true);
                  }

                  if (!name) setName(lastOrder.customer.name);
                  if (!email && lastOrder.customer.email) setEmail(lastOrder.customer.email);
                  if (!demoContact && lastOrder.customer.demoContact) setDemoContact(lastOrder.customer.demoContact);
                  
                  // Auto-fill address components if not already set
                  // Try to match names with codes for dropdowns if API is working
                  if (!selectedProvince && lastOrder.customer.province) {
                      const p = provinces.find(p => p.name === lastOrder.customer.province);
                      if (p) {
                          setSelectedProvince(p.code.toString());
                      } else {
                          setSelectedProvince(lastOrder.customer.province);
                          setIsApiError(true); // Fallback to text inputs ONLY if name doesn't match a code
                      }
                  }
                  
                  if (!selectedDistrict && lastOrder.customer.district && !isApiError) {
                      // We can't easily match district/ward here because they depend on province selection
                      // which triggers an effect. So we might just set the name and hope for the best
                      // or let the user select since province is filled.
                      // For now, we'll try to stick to defaults.
                  }

                  if (!street && lastOrder.customer.address) {
                      setStreet(lastOrder.customer.address.split(',')[0].trim());
                  }
              }
          } catch (e) {
              console.error("Autofill error", e);
          } finally {
              setIsCheckingPhone(false);
          }
      }
  };

  const handlePhoneChange = (val: string) => {
      const numericVal = val.replace(/\D/g, '').slice(0, 10);
      setPhone(numericVal);
      setPhoneError('');
      setIsLoyalCustomer(false);
      if (numericVal.length === 10) {
          checkLoyaltyAndAutofill(numericVal);
      }
  };

  const handlePhoneBlur = () => {
      if (phone.length === 10) {
          checkLoyaltyAndAutofill(phone);
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

    let finalCommissionAmount = 0;
    
    // Tiered Commission Logic
    if (manualReferralCode) {
        try {
            const collaborator = await getCollaboratorByReferralCode(manualReferralCode);
            if (collaborator) {
                // Self-referral check
                if (collaborator.phone === phone) {
                    finalCommissionAmount = 0;
                    console.log("Self-referral detected. Commission set to 0.");
                } else {
                    // Logic: Custom rate > Tiered rate (First 2 orders = 5%, From 3rd order = 10%)
                    let rate = 0;
                    if (collaborator.customCommissionRate !== undefined) {
                        rate = collaborator.customCommissionRate / 100;
                    } else {
                        const refOrders = await getOrdersByReferralCode(manualReferralCode);
                        const successfulOrdersCount = refOrders.filter(o => o.status === 'Đã giao hàng').length;
                        rate = successfulOrdersCount < 2 ? 0.05 : 0.1;
                    }
                    
                    finalCommissionAmount = Math.round(totalPrice * rate);
                    console.log(`Commission rate applied: ${rate * 100}%`);
                }
            }
        } catch (e) {
            console.error("Error calculating tiered commission:", e);
            // Fallback to 5% if error
            finalCommissionAmount = Math.round(totalPrice * 0.05);
        }
    }

    const provinceVal = provinces.find(p => String(p.code) === String(selectedProvince))?.name || selectedProvince || '';
    const districtVal = districts.find(d => String(d.code) === String(selectedDistrict))?.name || selectedDistrict || '';
    const wardVal = wards.find(w => String(w.code) === String(selectedWard))?.name || selectedWard || '';

    const fullAddress = [street, wardVal, districtVal, provinceVal].filter(Boolean).join(', ');
    const orderId = initialOrder ? initialOrder.id : `#TL${Date.now().toString().slice(-6)}`;
    
    let autoTags = '';
    if (isEarlyBird) autoTags += t('checkout.early_bird_tag');
    if (isLoyalCustomer) autoTags += t('checkout.loyal_customer_tag');
    if (appliedVoucher) autoTags += t('checkout.voucher_tag', { code: appliedVoucher.code });
    
    const itemNotes = cartItems
        .map((item, index) => {
            const note = item.customFormData?.order_note;
            if (note) return `[SP ${index + 1}]: ${note}`;
            return null;
        })
        .filter(Boolean)
        .join(' | ');

    const finalNotes = [autoTags, itemNotes, notes].filter(n => n && n.trim()).join(' --- ');

    // Identify if the order comes from collection
    const mainTemplateItem = cartItems.find(item => item.templateId);
    let templateSource: 'collection' | 'builder' = 'builder';
    let firstTemplateId = '';
    let firstTemplateName = '';

    if (mainTemplateItem) {
        templateSource = 'collection';
        firstTemplateId = mainTemplateItem.templateId || '';
        firstTemplateName = mainTemplateItem.customFormData?.template_name || '';
    }

    try {
        await onPlaceOrder({
          id: orderId,
          source: templateSource,
          templateId: firstTemplateId || undefined,
          templateName: firstTemplateName || undefined,
          templateOrderCounted: false,
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
            const { totalPrice: itemPrice } = calculatePrice(item, allParts, frames, templates);
            return { ...item, price: itemPrice };
          }),
          addGiftBox: !storeConfig?.giftBoxOutOfStock && addGiftBox,
          addLight: !storeConfig?.lightOutOfStock && addLight,
          addPolaroid: polaroidOption,
          polaroidImages: polaroidOption > 0 ? polaroidImages : [],
          shipping: { method: shippingOption, fee: shippingFee },
          payment: { method: paymentMethod },
          totalPrice,
          amountToPay,
          discountCode: appliedVoucher?.code || (isLoyalCustomer ? 'LOYALTY' : undefined),
          discountAmount: totalDiscount,
          referredBy: manualReferralCode || undefined,
          commissionAmount: finalCommissionAmount,
          commissionPaid: false
        });

        if (!initialOrder) {
            trackFunnelStep('order_complete');
            trackPurchase(orderId, totalPrice, cartItems);
        }

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
      <form onSubmit={handleSubmit} className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:6 text-center">
            {initialOrder ? t('checkout.update_order_title') : t('checkout.title')}
        </h1>
        {initialOrder && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 sm:p-4 rounded-lg mb-4 sm:6 text-center text-xs sm:text-sm">
                {t('checkout.editing_order_notice', { id: initialOrder.id })}
            </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            
            <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border shadow-sm">
              <h2 className="font-bold text-lg sm:text-xl text-gray-800 mb-4 sm:6 pb-2 border-b border-gray-200">{t('checkout.shipping_info')}</h2>
              
              <div className="mb-4 sm:6 border-b border-gray-200 pb-4 sm:6">
                  <div className="flex justify-between items-center mb-2 sm:3">
                    <h3 className="text-[11px] sm:text-sm font-bold text-gray-500 uppercase tracking-wider">{t('checkout.recipient')}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:4">
                    <div className="relative">
                      <input 
                        type="tel" 
                        placeholder={t('checkout.phone')} 
                        value={phone} 
                        onChange={e => handlePhoneChange(e.target.value)} 
                        onBlur={handlePhoneBlur}
                        className={`w-full p-2.5 sm:p-3 border ${phoneError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none text-sm sm:text-base`} 
                        required 
                      />
                      {isCheckingPhone && <span className="absolute right-3 top-3.5 text-xs text-gray-400 animate-pulse">{t('checkout.checking_phone')}</span>}
                      {isLoyalCustomer && !isCheckingPhone && (
                          <div className="absolute right-2 top-2 bg-blue-100 text-blue-700 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm border border-blue-200 animate-fade-in">
                              <span>💎</span> {t('checkout.loyal_customer')}
                          </div>
                      )}
                      {phoneError && <p className="text-red-500 text-[10px] sm:text-xs mt-1 ml-1">{phoneError}</p>}
                    </div>
                    <input type="text" placeholder={t('checkout.full_name')} value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none text-sm sm:text-base" required />
                    <input type="email" placeholder={t('checkout.email_notice')} value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 md:col-span-2 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none text-sm sm:text-base" required />
                    <div className="md:col-span-2">
                      <label className="text-[10px] sm:text-xs font-semibold text-gray-500 block mb-1">{t('checkout.demo_contact_label')}</label>
                      <input 
                        type="text" 
                        placeholder={t('checkout.demo_contact_placeholder')} 
                        value={demoContact} 
                        onChange={e => setDemoContact(e.target.value)} 
                        className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none text-sm sm:text-base" 
                        required 
                      />
                      <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1 italic">{t('checkout.demo_contact_note')}</p>
                    </div>
                  </div>
              </div>

              <div className="mb-4 sm:6 border-b border-gray-200 pb-4 sm:6">
                  <div className="flex justify-between items-center mb-2 sm:3">
                    <h3 className="text-[11px] sm:text-sm font-bold text-gray-500 uppercase tracking-wider">{t('checkout.address_shipping')}</h3>
                  </div>
                  
                  <div className="space-y-3 sm:4">
                     {!isApiError ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select 
                                value={selectedProvince} 
                                onChange={e => setSelectedProvince(e.target.value)} 
                                className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm sm:text-base"
                                required={!isApiError}
                            >
                                <option value="">{isLoadingProvinces ? t('common.loading') : t('checkout.province')}</option>
                                {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                            </select>
                            <select 
                                value={selectedDistrict} 
                                onChange={e => setSelectedDistrict(e.target.value)} 
                                className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm sm:text-base" 
                                disabled={!selectedProvince}
                                required={!isApiError}
                            >
                                <option value="">{t('checkout.district')}</option>
                                {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                            </select>
                            <select 
                                value={selectedWard} 
                                onChange={e => setSelectedWard(e.target.value)} 
                                className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm sm:text-base" 
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
                                className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm sm:text-base" 
                                required 
                            />
                            <input 
                                type="text" 
                                placeholder={t('checkout.district')} 
                                value={selectedDistrict} 
                                onChange={e => setSelectedDistrict(e.target.value)} 
                                className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm sm:text-base" 
                                required 
                            />
                            <input 
                                type="text" 
                                placeholder={t('checkout.ward')} 
                                value={selectedWard} 
                                onChange={e => setSelectedWard(e.target.value)} 
                                className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm sm:text-base" 
                                required 
                            />
                        </div>
                     )}

                     <input type="text" placeholder={t('checkout.street')} value={street} onChange={e => setStreet(e.target.value)} className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-luvin-pink outline-none text-sm sm:text-base" required />

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:6 text-left">
                        <div>
                           <DateInput 
                            label={t('checkout.delivery_date')}
                            value={deliveryDate} 
                            onChange={setDeliveryDate} 
                            required 
                            min={today} 
                           />
                           {isEarlyBird ? (
                               <p className="text-[10px] sm:text-xs text-green-600 font-bold mt-1 animate-pulse">
                                   {t('checkout.early_bird_discount_applied', { days: daysDifference })}
                               </p>
                           ) : (
                               <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                                   {t('checkout.early_bird_tip')}
                               </p>
                           )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-xs sm:text-sm mb-2 text-gray-700">{t('checkout.shipping_method')}</h3>
                            <div className="space-y-1.5 sm:2">
                                <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="standard" checked={shippingOption === 'standard'} onChange={() => setShippingOption('standard')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <div className="ml-2 flex-grow">
                                        <span className="text-[11px] sm:text-sm block text-gray-700 font-medium">{t('checkout.shipping_standard')}</span>
                                    </div>
                                    {isFreeShippingEligible ? (
                                        <div className="text-right">
                                            <span className="text-[9px] sm:text-xs text-gray-400 line-through mr-1">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                            <span className="text-xs sm:text-sm font-bold text-green-600">{t('checkout.free')}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs sm:text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.standard)}</span>
                                    )}
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="express" checked={shippingOption === 'express'} onChange={() => setShippingOption('express')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <div className="ml-2 flex-grow">
                                        <span className="text-[11px] sm:text-sm block text-gray-700 font-medium">{t('checkout.shipping_express')}</span>
                                    </div>
                                     <span className="text-xs sm:text-sm font-bold text-gray-800">{formatCurrency(SHIPPING_FEES.express)}</span>
                                </label>
                                 <label className="flex items-center p-2 border rounded-lg bg-white cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50">
                                    <input type="radio" name="shipping" value="bookship" checked={shippingOption === 'bookship'} onChange={() => setShippingOption('bookship')} className="h-4 w-4 text-luvin-pink focus:ring-luvin-pink"/>
                                    <div className="ml-2 flex-grow">
                                        <span className="text-[11px] sm:text-sm block text-gray-700 font-medium">{t('checkout.shipping_bookship')}</span>
                                        <p className="text-[8px] sm:text-[10px] text-gray-400 italic leading-tight">{t('checkout.warehouse_location')}</p>
                                    </div>
                                     <span className="text-xs sm:text-sm font-bold text-gray-800">{t('checkout.zero_vnd')}</span>
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
                              <p>{t('checkout.distance_warning_desc', { location: storeConfig?.warehouseAddress || t('checkout.warehouse_location') })}</p>
                              <a 
                                 href={storeConfig?.googleMapsUrl || t('checkout.warehouse_google_maps_link')} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="inline-block mt-2 text-blue-600 font-bold hover:underline bg-white/50 px-2 py-1 rounded border border-blue-100 transition-colors"
                              >
                                 {t('checkout.view_on_google_maps')}
                              </a>
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
                        <p className="text-xs text-gray-500">
                            {storeConfig?.cardOutOfStock 
                                ? "Hộp quà, túi & rơm (tạm hết thiệp đi kèm, áp dụng cho mỗi tranh trong giỏ hàng)" 
                                : t('checkout.gift_box_desc')}
                        </p>
                    </div>
                    <div className="flex flex-col items-end min-w-[80px]">
                        <span className="font-bold text-luvin-pink text-sm">+{formatCurrency(GIFT_BOX_PRICE * totalQuantity)}</span>
                        <span className="text-[10px] text-gray-400 font-medium">({formatCurrency(GIFT_BOX_PRICE)} x {totalQuantity})</span>
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

            {hasLegoItems && (
                <div className={`bg-gray-50 p-4 rounded-lg border transition-all ${storeConfig?.lightOutOfStock ? 'opacity-70 grayscale-[0.5]' : ''} mt-4`}>
                    <label className={`flex items-center p-3 rounded-lg bg-white border transition-all ${storeConfig?.lightOutOfStock ? 'cursor-not-allowed border-gray-200' : 'cursor-pointer hover:bg-pink-50 has-[:checked]:border-luvin-pink has-[:checked]:bg-pink-50'}`}>
                        <img src={storeConfig?.lightImageUrl || GENERAL_ASSETS.light} alt="Đèn Spotlight" className="w-12 h-12 object-contain mr-4"/>
                        <div className="flex-grow">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">{t('checkout.add_light', { count: legoQuantity })}</span>
                                {storeConfig?.lightOutOfStock && (
                                    <span className="bg-gray-200 text-gray-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">{t('checkout.out_of_stock')}</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">{t('checkout.light_desc')}</p>
                        </div>
                        <div className="flex flex-col items-end min-w-[80px]">
                            <span className="font-bold text-luvin-pink text-sm">+{formatCurrency((storeConfig?.lightPrice || 50000) * legoQuantity)}</span>
                            <span className="text-[10px] text-gray-400 font-medium">({formatCurrency(storeConfig?.lightPrice || 50000)} x {legoQuantity})</span>
                            {!storeConfig?.lightOutOfStock && (
                                <input 
                                    type="checkbox" 
                                    checked={addLight} 
                                    onChange={e => setAddLight(e.target.checked)} 
                                    className="h-5 w-5 rounded text-luvin-pink focus:ring-luvin-pink mt-1"
                                />
                            )}
                        </div>
                    </label>
                    {(cartItems.some(item => (item.productLine || 'lego') === 'gallery') || cartItems.some(item => (item as any).productLine === 'gallery')) && (
                        <p className="mt-2 text-[10px] text-blue-600 font-bold italic px-2 flex items-center gap-2 animate-fade-in">
                            <Info className="w-3 h-3 flex-shrink-0" />
                            <span>Lưu ý: Chỉ áp dụng gắn đèn cho khung LEGO, không áp dụng cho khung Gallery.</span>
                        </p>
                    )}
                    {storeConfig?.lightOutOfStock && (
                        <p className="text-[10px] text-gray-400 mt-2 italic px-1">
                            {t('checkout.light_out_of_stock_note')}
                        </p>
                    )}
                </div>
            )}

            {/* Polaroid Option */}
            <div className="bg-gray-50/50 p-2 sm:p-3 rounded-2xl border border-gray-100 mt-4">
                <div className="flex items-start gap-2 sm:gap-3">
                    {storeConfig?.polaroidSampleImages && storeConfig.polaroidSampleImages.length > 0 ? (
                        <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto no-scrollbar max-w-[120px] sm:max-w-[150px] py-0.5">
                            {storeConfig.polaroidSampleImages.map((url, i) => (
                                <div 
                                    key={i} 
                                    className="w-10 h-14 sm:w-12 sm:h-16 flex-shrink-0 border rounded-sm overflow-hidden bg-white shadow-sm cursor-zoom-in hover:scale-105 transition-transform"
                                    onClick={() => onZoomImage?.(url)}
                                >
                                    <img src={url} alt="Polaroid Sample" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white rounded-xl flex-shrink-0 text-sm sm:text-base shadow-sm border border-pink-50">
                            📸
                        </div>
                    )}
                    <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start mb-1">
                            <div>
                                <span className="font-bold text-gray-800 block text-[12px] sm:text-[13px] leading-tight">{t('checkout.add_polaroid')}</span>
                                <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{t('checkout.polaroid_desc')}</p>
                            </div>
                            {polaroidFee > 0 && (
                                <span className="font-black text-luvin-pink text-xs whitespace-nowrap ml-2">+{formatCurrency(polaroidFee)}</span>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => { setPolaroidOption(0); setPolaroidImages([]); }}
                                className={`py-1.5 sm:py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${polaroidOption === 0 ? 'bg-luvin-pink text-white border-luvin-pink shadow-sm' : 'bg-white text-gray-400 border-gray-100 hover:border-luvin-pink'}`}
                            >
                                {t('checkout.polaroid_option_none')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPolaroidOption(2)}
                                className={`py-1.5 sm:py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${polaroidOption === 2 ? 'bg-luvin-pink text-white border-luvin-pink shadow-sm' : 'bg-white text-gray-400 border-gray-100 hover:border-luvin-pink'}`}
                            >
                                {t('checkout.polaroid_option_2')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPolaroidOption(4)}
                                className={`py-1.5 sm:py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${polaroidOption === 4 ? 'bg-luvin-pink text-white border-luvin-pink shadow-sm' : 'bg-white text-gray-400 border-gray-100 hover:border-luvin-pink'}`}
                            >
                                {t('checkout.polaroid_option_4')}
                            </button>
                        </div>
                    </div>
                </div>

                {polaroidOption > 0 && (
                    <PolaroidUpload 
                        count={polaroidOption} 
                        images={polaroidImages} 
                        onImagesChange={setPolaroidImages} 
                    />
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

              <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
                <h2 className="font-extrabold text-xl tracking-tight text-gray-800 font-heading">{t('checkout.your_order')}</h2>
                <div className="bg-pink-50 text-luvin-pink text-[10px] font-black px-2.5 py-1 rounded-full border border-pink-100 uppercase tracking-wider">
                    {totalQuantity} {totalQuantity > 1 ? t('cart.items') || 'sản phẩm' : t('cart.item') || 'sản phẩm'}
                </div>
              </div>

              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {cartItems.map((item, index) => {
                  const { totalPrice } = calculatePrice(item, allParts, frames, templates);
                  const quantity = item.quantity || 1;
                  const frameName = (frames.find(f => f.id === item.frameId) || frames[0] || FRAME_OPTIONS[0]).name;
                  
                  return (
                    <div key={index} className="border border-gray-100 rounded-2xl p-3 bg-white shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-center">
                        <div className="flex gap-4 items-center min-w-0">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-50 border border-gray-50 rounded-2xl overflow-hidden relative group-hover:scale-105 transition-transform duration-300 shadow-sm" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)}>
                                {item.previewImageUrl ? (
                                    <>
                                        <img src={item.previewImageUrl} className="w-full h-full object-contain" alt="preview" />
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                            <ZoomIcon className="w-5 h-5 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[8px] text-gray-400">{t('checkout.no_image')}</div>
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800 text-[13px] sm:text-sm truncate">#{index + 1} {t('checkout.custom_frame')}</span>
                                    {item.galleryOptions?.assembly && (
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${item.galleryOptions.assembly === 'pre-assembled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {item.galleryOptions.assembly === 'pre-assembled' ? 'Shop hoàn thiện' : 'Tự lắp'}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium tracking-tight truncate">{frameName}</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black text-luvin-pink bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-100">x{quantity}</span>
                                    {item.characters && (
                                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-tighter opacity-80">{item.characters.length} NV</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 pl-2">
                            <span className="font-black text-gray-900 text-sm sm:text-[17px] tracking-tight font-heading">{formatCurrency(totalPrice * quantity)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-gray-100 mt-6 pt-5 space-y-3.5 text-sm">
                <div className="flex justify-between text-gray-500 font-medium tracking-tight">
                    <span>{t('cart.subtotal')}</span>
                    <span className="text-gray-700 font-heading font-bold">{formatCurrency(subtotal)}</span>
                </div>
                {(!storeConfig?.giftBoxOutOfStock && addGiftBox) && (
                    <div className="flex justify-between text-gray-500 font-medium tracking-tight">
                        <span>{t('checkout.gift_box')} <small className="opacity-60 text-[10px]">({formatCurrency(GIFT_BOX_PRICE)} x {totalQuantity})</small></span>
                        <span className="text-gray-700 font-heading font-bold">{formatCurrency(giftBoxFee)}</span>
                    </div>
                )}
                {(!storeConfig?.lightOutOfStock && addLight && hasLegoItems) && (
                    <div className="flex justify-between text-gray-500 font-medium tracking-tight">
                        <span>{t('checkout.light_box')} <small className="opacity-60 text-[10px]">({formatCurrency(storeConfig?.lightPrice || 50000)} x {legoQuantity})</small></span>
                        <span className="text-gray-700 font-heading font-bold">{formatCurrency(lightFee)}</span>
                    </div>
                )}
                {polaroidOption > 0 && (
                    <div className="flex justify-between text-gray-500 font-medium tracking-tight">
                        <span>{t('checkout.add_polaroid')} <small className="opacity-60 text-[10px]">(x{polaroidOption})</small></span>
                        <span className="text-gray-700 font-heading font-bold">{formatCurrency(polaroidFee)}</span>
                    </div>
                )}
                <div className="flex justify-between text-gray-500 font-medium tracking-tight">
                    <span>{t('checkout.shipping_fee')}</span>
                    {isFreeShippingEligible && shippingOption === 'standard' ? (
                        <span className="text-green-600 font-extrabold uppercase text-[10px] tracking-widest font-heading">{t('checkout.free')}</span>
                    ) : (
                        <span className="text-gray-700 font-heading font-bold">{shippingOption === 'bookship' ? t('checkout.zero_vnd') : formatCurrency(shippingFee)}</span>
                    )}
                </div>
                {isEarlyBird && (
                    <div className="flex justify-between text-green-600 font-bold tracking-tight">
                        <span>{t('checkout.early_bird_discount')}</span>
                        <span className="font-heading">-{formatCurrency(earlyBirdDiscountAmount)}</span>
                    </div>
                )}
                {isLoyalCustomer && (
                    <div className="flex justify-between text-blue-600 font-bold tracking-tight">
                        <span className="flex items-center gap-1">💎 {t('checkout.loyalty_discount')}</span>
                        <span className="font-heading">-{formatCurrency(loyaltyDiscountAmount)}</span>
                    </div>
                )}
                {appliedVoucher && (
                    <div className="flex justify-between text-purple-600 font-bold tracking-tight">
                        <span>{t('checkout.voucher')} ({appliedVoucher.code})</span>
                        <span className="font-heading">-{formatCurrency(voucherDiscountAmount)}</span>
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
                      <p className={`text-xs mt-1 ${isSelfReferral ? 'text-amber-600 font-bold' : 'text-green-600'}`}>
                          {isSelfReferral 
                            ? "⚠️ Bạn không thể nhận hoa hồng cho đơn hàng của chính mình." 
                            : t('checkout.referral_applied', { code: manualReferralCode })}
                      </p>
                  )}
              </div>

              <div className="border-t border-gray-100 mt-5 pt-4 flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-[11px] tracking-widest">{t('cart.total')}</span>
                <span className="font-black text-xl text-gray-900 tracking-tighter font-heading">{formatCurrency(totalPrice)}</span>
              </div>
              <div className="border-t border-luvin-pink/10 mt-3 pt-3 flex justify-between items-center bg-pink-50/30 -mx-4 px-4 py-2">
                  <span className="font-extrabold text-luvin-pink uppercase text-[11px] tracking-widest">{t('checkout.amount_to_pay')}</span>
                  <span className="font-black text-2xl text-luvin-pink tracking-tighter drop-shadow-sm font-heading">{formatCurrency(amountToPay)}</span>
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
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl text-sm font-medium flex flex-col gap-3 animate-fade-in shadow-sm">
                      <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <div>
                              <p className="font-bold text-red-800 mb-1">
                                  {submissionError.includes('size') ? 'Dữ liệu thiết kế quá lớn' : t('common.error')}
                              </p>
                              <p className="text-xs opacity-90 leading-relaxed">
                                  {submissionError.includes('size') 
                                    ? 'Dữ liệu của bạn đã được shop tối ưu lại để phù hợp. Vui lòng thử nhấn "ĐẶT HÀNG NGAY" một lần nữa.' 
                                    : 'Đã có sự cố khi xử lý đơn hàng của bạn. Đừng lo lắng, bạn có thể nhắn tin trực tiếp để shop hỗ trợ hoàn tất đơn qua Zalo nhé!'}
                              </p>
                              {submissionError.length > 50 && !submissionError.includes('size') && (
                                  <div className="mt-2 p-2 bg-red-100/50 rounded border border-red-200/50">
                                      <code className="text-[10px] block break-all font-mono opacity-60">
                                          Error log: {submissionError}
                                      </code>
                                  </div>
                              )}
                          </div>
                      </div>
                      
                      <div className="flex gap-2 mt-1">
                        <a 
                            href="https://zalo.me/0964393115" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex-grow bg-blue-600 text-white text-center py-2 px-4 rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <span>💬</span> Nhắn Zalo hỗ trợ ngay
                        </a>
                      </div>
                  </div>
              )}

              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-[10px] font-bold text-red-600 leading-relaxed text-center">
                      {t('checkout.payment_deadline_warning')}
                  </p>
              </div>

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
