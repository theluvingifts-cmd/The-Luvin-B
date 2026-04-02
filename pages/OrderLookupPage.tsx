
import React, { useState, useEffect, useRef } from 'react';
import { Order, FrameOption } from '../types';
import { getOrderById, getOrdersByPhone, updateOrder } from '../services/orderService';
import { uploadToCloudinary } from '../services/uploadService';
import { MOCK_ORDERS, FRAME_OPTIONS } from '../constants';
import { formatCurrency } from '../utils/pricing';
import { formatFullAddress } from '../utils/helpers';
import { getAllFrames } from '../services/frameService';
import { useLanguage } from '../src/contexts/LanguageContext';

// Orders that can be edited by customer must not have these statuses
const PACKED_STATUSES = ['Đang đóng hàng', 'Chờ chuyển hàng', 'Gửi hàng đi', 'Đã giao hàng', 'Huỷ đơn', 'Xoá đơn'];

export const OrderLookupPage: React.FC<{onZoomImage: (url: string) => void; onEditOrder: (order: Order) => void}> = ({onZoomImage, onEditOrder}) => {
    const { t } = useLanguage();
    const [orderCode, setOrderCode] = useState('');
    const [foundOrder, setFoundOrder] = useState<Order | null | 'not_found' | 'permission_error'>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [savedOrders, setSavedOrders] = useState<{id: string, date: number}[]>([]);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    
    // Upload state
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('my_orders') || '[]');
            if (Array.isArray(saved)) {
                setSavedOrders(saved);
            }
        } catch(e) {}
    }, []);

    useEffect(() => {
        const fetchFrames = async () => {
            const fetched = await getAllFrames();
            if (fetched && fetched.length > 0) {
                setFrames(fetched);
            }
        };
        fetchFrames();
    }, []);

    const handleSearch = async (e?: React.FormEvent, codeOverride?: string) => {
        if (e) e.preventDefault();
        let codeToSearch = (codeOverride || orderCode).trim().toUpperCase();
        if (!codeToSearch) return;

        const isPhone = /^0\d{9}$/.test(codeToSearch);

        if (!isPhone && !codeToSearch.startsWith('#')) {
            codeToSearch = '#' + codeToSearch;
        }
        
        if (codeOverride) setOrderCode(codeToSearch);

        setIsLoading(true);
        setFoundOrder(null);
        
        try {
            let order: Order | null = null;

            if (isPhone) {
                const orders = await getOrdersByPhone(codeToSearch);
                if (orders.length > 0) {
                    order = orders[0];
                }
            } else {
                order = await getOrderById(codeToSearch);
                if (!order) {
                    order = MOCK_ORDERS[codeToSearch] || null;
                }
            }

            setFoundOrder(order || 'not_found');
        } catch (error: any) {
            console.error("Lỗi tra cứu đơn hàng:", error);
            if (error.code === 'permission-denied') {
                setFoundOrder('permission_error');
            } else {
                setFoundOrder('not_found');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && foundOrder && typeof foundOrder === 'object') {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    const success = await updateOrder(foundOrder.id, { 
                        paymentProofUrl: url,
                        paymentProofUploadedAt: new Date().toISOString()
                    });
                    
                    if (success) {
                        setFoundOrder({ 
                            ...foundOrder, 
                            paymentProofUrl: url, 
                            paymentProofUploadedAt: new Date().toISOString() 
                        });
                        alert("Đã gửi ảnh xác nhận thành công!");
                    } else {
                        alert("Lỗi cập nhật đơn hàng.");
                    }
                } else {
                    alert("Lỗi tải ảnh lên.");
                }
            } catch (error) {
                console.error(error);
                alert("Đã có lỗi xảy ra.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const StatusTracker: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
        const { t } = useLanguage();
        const steps = [
            { label: t('order_lookup.status_payment'), icon: '💳' },
            { label: t('order_lookup.status_design'), icon: '📐' },
            { label: t('order_lookup.status_packing'), icon: '🎁' },
            { label: t('order_lookup.status_shipping'), icon: '🚚' },
            { label: t('order_lookup.status_completed'), icon: '❤️' }
        ];

        const getStepIndex = (status: string) => {
            switch(status) {
                case 'Chờ thanh toán': return 0;
                case 'Đã xác nhận': return 1;
                case 'Chưa thiết kế': return 1;
                case 'Ưu tiên xuất đơn':
                case 'Đang đóng hàng':
                    return 2;
                case 'Chờ chuyển hàng':
                case 'Gửi hàng đi':
                case 'Đang giao hàng': 
                    return 3;
                case 'Đã giao hàng': return 4;
                case 'Huỷ đơn': return -1;
                case 'Xoá đơn': return -1;
                default: return 0; 
            }
        };

        const currentStepIndex = getStepIndex(currentStatus);
        const progressPercentage = (currentStepIndex / (steps.length - 1)) * 100;

        if (currentStepIndex === -1) {
            return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-700 font-bold mb-6">
                    {t('order_lookup.order_cancelled')}
                </div>
            );
        }

        return (
            <div className="mb-8 px-0 sm:px-4 w-full">
                <div className="relative">
                    {/* Progress Bar Background */}
                    <div className="absolute top-4 sm:top-5 left-0 w-full h-1 bg-gray-100 rounded-full -z-10"></div>
                    
                    {/* Active Progress Bar */}
                    <div 
                        className="absolute top-4 sm:top-5 left-0 h-1 bg-luvin-pink rounded-full -z-10 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.max(0, Math.min(100, progressPercentage))}%` }}
                    ></div>

                    <div className="flex justify-between items-start w-full">
                        {steps.map((step, index) => {
                            const isCompleted = index <= currentStepIndex;
                            const isCurrent = index === currentStepIndex;

                            return (
                                <div key={index} className="flex flex-col items-center flex-1">
                                    <div 
                                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-white
                                        ${isCompleted ? 'border-luvin-pink text-luvin-pink shadow-md' : 'border-gray-200 text-gray-300'}
                                        ${isCurrent ? 'ring-2 ring-pink-100 scale-110' : ''}`}
                                    >
                                        <span className="text-xs sm:text-sm">{isCompleted ? step.icon : (index + 1)}</span>
                                    </div>
                                    <p className={`mt-2 text-center text-[9px] sm:text-xs font-bold leading-tight transition-colors duration-300 max-w-[60px] sm:max-w-none ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                        {step.label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const getVietQR = (order: Order) => {
        const BANK_ID = '970407';
        const ACCOUNT_NO = '65838666666';
        const TEMPLATE = 'compact2';
        const DESCRIPTION = encodeURIComponent(order.id.replace('#', ''));
        const amount = order.amountToPay;
        return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${DESCRIPTION}&accountName=TheLuvin`;
    };

    return (
        <div className="min-h-screen bg-gray-50 font-body text-gray-800 pb-20">
            {/* Hero Section */}
            <div className="bg-gradient-to-b from-pink-50 to-white py-12 md:py-16 text-center border-b border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none" 
                     style={{backgroundImage: 'radial-gradient(#efa3b5 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                </div>
                <div className="relative z-10 container mx-auto px-4">
                    <h1 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-3 tracking-tight">
                        {t('order_lookup.title')}
                    </h1>
                    <p className="text-gray-500 max-w-lg mx-auto text-sm md:text-base">
                        {t('order_lookup.subtitle')}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 -mt-8 relative z-20">
                <div className="max-w-3xl mx-auto space-y-8">
                    
                    {/* Search Card */}
                    <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 transition-transform duration-300">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-grow">
                                <input
                                    type="text"
                                    value={orderCode}
                                    onChange={(e) => setOrderCode(e.target.value)}
                                    placeholder={t('order_lookup.placeholder')}
                                    className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-luvin-pink focus:border-transparent text-base outline-none bg-gray-50 focus:bg-white transition-all font-medium placeholder-gray-400 uppercase"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <button 
                                type="submit" 
                                disabled={isLoading} 
                                className="bg-gray-900 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-luvin-pink transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-wait whitespace-nowrap active:scale-95"
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>{t('order_lookup.searching')}</span>
                                    </div>
                                ) : t('order_lookup.search')}
                            </button>
                        </form>
                        
                        {savedOrders.length > 0 && !foundOrder && (
                            <div className="mt-6">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('order_lookup.recent_searches')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {savedOrders.map((item, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => handleSearch(undefined, item.id)}
                                            className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 hover:bg-white hover:border-luvin-pink hover:text-luvin-pink transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {item.id}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {foundOrder === 'not_found' && (
                        <div className="bg-white border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm flex items-center gap-4 animate-fade-in">
                            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center flex-shrink-0 text-2xl">🤔</div>
                            <div>
                                <h3 className="font-bold text-gray-900">{t('order_lookup.not_found_title')}</h3>
                                <p className="text-sm text-gray-500 mt-1">{t('order_lookup.not_found_desc')}</p>
                            </div>
                        </div>
                    )}
                    
                    {foundOrder === 'permission_error' && (
                        <div className="bg-white border-l-4 border-yellow-500 p-6 rounded-r-xl shadow-sm flex items-center gap-4 animate-fade-in">
                            <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center flex-shrink-0 text-2xl">🚧</div>
                            <div>
                                <h3 className="font-bold text-gray-900">{t('order_lookup.maintenance_title')}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {t('order_lookup.maintenance_desc', { phone: '0964 393 115 - 0345 126 019' })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Order Details Card */}
                    {foundOrder && typeof foundOrder === 'object' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-fade-in-up">
                            {/* Header */}
                            <div className="bg-gray-50/80 p-5 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="font-heading font-bold text-2xl text-gray-900">{foundOrder.id}</h2>
                                        {foundOrder.isUrgent && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">{t('order_lookup.urgent_order')}</span>}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">{t('order_lookup.order_date', { date: foundOrder.createdAt ? new Date(foundOrder.createdAt).toLocaleDateString() : '---' })}</p>
                                </div>
                                
                                {!PACKED_STATUSES.includes(foundOrder.status) && (
                                    <button 
                                        onClick={() => onEditOrder(foundOrder as Order)}
                                        className="group bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:border-luvin-pink hover:text-luvin-pink hover:shadow-md transition-all flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        {t('order_lookup.edit_order')}
                                    </button>
                                )}
                            </div>

                            <div className="p-5 md:p-8">
                                <StatusTracker currentStatus={foundOrder.status} />

                                {/* Payment Callout */}
                                {foundOrder.status === 'Chờ thanh toán' && (
                                    <div className="mb-8 bg-yellow-50/50 border border-yellow-100 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
                                        <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex-shrink-0">
                                            <img src={getVietQR(foundOrder)} alt="QR" className="w-32 h-32 object-contain" />
                                        </div>
                                        <div className="flex-grow text-center sm:text-left">
                                            <h3 className="font-bold text-gray-900 mb-2">{t('order_lookup.unpaid_title')}</h3>
                                            <p className="text-sm text-gray-600 mb-4">
                                                {t('order_lookup.unpaid_desc', { amount: formatCurrency(foundOrder.amountToPay), id: foundOrder.id })}
                                            </p>
                                            
                                            {foundOrder.paymentProofUrl ? (
                                                <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold">
                                                    <span>✓</span> {t('order_lookup.proof_uploaded')}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col sm:flex-row gap-3 items-center justify-center sm:justify-start">
                                                    <button 
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isUploading}
                                                        className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-black transition-colors flex items-center gap-2 shadow-md"
                                                    >
                                                        {/* Fix: Removed duplicate stroke attribute */}
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                        {isUploading ? t('order_lookup.uploading') : t('order_lookup.upload_proof')}
                                                    </button>
                                                    <span className="text-xs text-gray-500 italic">{t('order_lookup.upload_tip')}</span>
                                                </div>
                                            )}
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Column 1: Info */}
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">{t('order_lookup.recipient')}</h4>
                                            <div className="space-y-2 text-sm text-gray-700">
                                                <p className="font-bold text-base text-gray-900">{foundOrder.customer.name}</p>
                                                <p className="flex items-center gap-2 text-gray-600"><span className="text-gray-400 w-4 text-center">📞</span> {foundOrder.customer.phone}</p>
                                                <p className="flex items-start gap-2 text-gray-600"><span className="text-gray-400 w-4 text-center mt-0.5">📍</span> {formatFullAddress(foundOrder.customer)}</p>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">{t('order_lookup.shipping_notes')}</h4>
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">{t('order_lookup.shipping_method')}</span> 
                                                    <span className="font-medium text-gray-800">{foundOrder.shipping.method === 'standard' ? t('checkout.shipping_standard') : foundOrder.shipping.method === 'express' ? t('checkout.shipping_express') : t('checkout.shipping_bookship')}</span>
                                                </div>
                                                {foundOrder.trackingCode && <div className="flex justify-between"><span className="text-gray-500">{t('order_lookup.tracking_code')}</span> <span className="font-mono font-bold text-blue-600 bg-white border px-1.5 rounded">{foundOrder.trackingCode}</span></div>}
                                                <div className="border-t border-gray-200 pt-2 mt-2">
                                                    <span className="text-gray-500 block text-xs mb-1 font-bold">{t('order_lookup.your_notes')}</span>
                                                    <p className="italic text-gray-600 text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                        {foundOrder.delivery.notes || t('order_lookup.no_notes')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Items & Total */}
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">{t('order_lookup.products', { count: foundOrder.items.length })}</h4>
                                        <div className="space-y-3 mb-6">
                                            {foundOrder.items.map((item, idx) => {
                                                const frameObj = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
                                                const frameName = frameObj ? frameObj.name : item.frameId;
                                                return (
                                                    <div key={idx} className="flex gap-4 border border-gray-100 p-3 rounded-xl hover:bg-gray-50 transition-colors bg-white">
                                                        <div className="w-16 h-16 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => item.previewImageUrl && onZoomImage(item.previewImageUrl)}>
                                                            {item.previewImageUrl ? <img src={item.previewImageUrl} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{t('checkout.no_image')}</div>}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-800 text-sm">{t('order_lookup.frame_lego', { name: frameName })}</p>
                                                            <p className="text-xs text-gray-500 mt-1">{t('order_lookup.item_desc', { count: item.characters.length, bg: item.background.type === 'color' ? t('order_lookup.bg_color') : t('order_lookup.bg_image') })}</p>
                                                            {item.quantity && item.quantity > 1 && <p className="text-xs font-bold text-luvin-pink mt-1">x{item.quantity}</p>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="bg-gray-50 rounded-xl p-5 space-y-3 text-sm">
                                            <div className="flex justify-between text-gray-600">
                                                <span>{t('order_lookup.subtotal')}</span>
                                                <span>{formatCurrency(foundOrder.totalPrice - foundOrder.shipping.fee - (foundOrder.addGiftBox ? 30000 : 0))}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600">
                                                <span>{t('order_lookup.shipping_fee')}</span>
                                                <span>{foundOrder.shipping.fee > 0 ? formatCurrency(foundOrder.shipping.fee) : t('checkout.free')}</span>
                                            </div>
                                            {foundOrder.addGiftBox && (
                                                <div className="flex justify-between text-gray-600">
                                                    <span>{t('order_lookup.premium_gift_box')}</span>
                                                    <span>{formatCurrency(30000)}</span>
                                                </div>
                                            )}
                                            {foundOrder.discountAmount && foundOrder.discountAmount > 0 && (
                                                <div className="flex justify-between text-green-600 font-medium">
                                                    <span>{t('order_lookup.discount')}</span>
                                                    <span>-{formatCurrency(foundOrder.discountAmount)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-gray-200 pt-3 mt-1 flex justify-between items-center">
                                                <span className="font-bold text-gray-900 text-base">{t('order_lookup.total_payment')}</span>
                                                <span className="font-heading font-bold text-xl text-luvin-pink">{formatCurrency(foundOrder.totalPrice)}</span>
                                            </div>
                                            {foundOrder.payment.method === 'deposit' && (
                                                <div className="flex justify-between text-xs text-gray-500 pt-1">
                                                    <span>{t('order_lookup.deposit_required')}</span>
                                                    <span className="font-bold">{formatCurrency(foundOrder.amountToPay)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
