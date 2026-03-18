
import React from 'react';
import { formatCurrency, FREE_SHIPPING_THRESHOLD, PriceBreakdownItem } from '../../utils/pricing';

const DesignerCommitment: React.FC = () => (
    <div className="mt-8 mb-6 animate-fade-in text-left">
        <div className="bg-white border-2 border-green-500 rounded-[2rem] p-5 shadow-[0_10px_30px_rgba(34,197,94,0.12)] overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700 pointer-events-none"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shadow-sm border border-green-100 flex-shrink-0">
                        <span className="text-xl animate-pulse">🛡️</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-heading text-lg font-black text-green-700 uppercase tracking-tight">An tâm tuyệt đối</h4>
                        <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                            MIỄN PHÍ 100%
                        </span>
                    </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium">
                    Sau khi đặt hàng, <span className="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded-lg font-bold">Designer chuyên nghiệp</span> sẽ trực tiếp căn chỉnh lại bố cục, font chữ đẹp nhất và <span className="text-green-700 font-bold border-b-2 border-green-200">gửi ảnh thực tế</span> cho bạn duyệt trước khi đóng gói & gửi đi.
                </p>
            </div>
        </div>
    </div>
);

const UrgencyFlashSale: React.FC<{ timeLeft: number }> = ({ timeLeft }) => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formatTime = (val: number) => val.toString().padStart(2, '0');

    return (
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-4 mb-4 text-white shadow-lg animate-pulse">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🔥</span>
                    <div className="text-left">
                        <p className="font-black text-sm uppercase tracking-wider">Ưu đãi phút chót!</p>
                        <p className="text-[10px] opacity-90 font-bold">Hoàn tất đơn để nhận 1 Sticker quà tặng</p>
                    </div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg font-mono font-bold text-lg border border-white/30">
                    {formatTime(minutes)}:{formatTime(seconds)}
                </div>
            </div>
        </div>
    );
};

export const Step4Summary: React.FC<{ 
    totalPrice: number; 
    priceBreakdown: PriceBreakdownItem[]; 
    frameName: string; 
    charCount: number; 
    onAddToCart: () => void; 
    onBuyNow: () => void; 
    isSaving: boolean; 
    isEditingOrder?: boolean;
    urgencyTimeLeft: number;
}> = ({ totalPrice, priceBreakdown, frameName, charCount, onAddToCart, onBuyNow, isSaving, isEditingOrder, urgencyTimeLeft }) => {
  const remainingForFreeShip = FREE_SHIPPING_THRESHOLD - totalPrice;

  return (
    <div className="text-left">
        {/* Temporarily hide urgency flash sale */}
        {false && !isEditingOrder && urgencyTimeLeft > 0 && <UrgencyFlashSale timeLeft={urgencyTimeLeft} />}
        
        <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
                <span>CHI TIẾT HÓA ĐƠN</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{charCount} Nhân vật</span>
            </h4>
            
            <div className="space-y-2 text-sm text-gray-700 max-h-60 overflow-y-auto custom-scrollbar pr-1 text-left">
                {priceBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-1">
                        <div className="flex flex-col">
                            <span className={item.isBase ? 'font-semibold text-gray-800' : 'text-gray-600'}>
                                {item.label}
                            </span>
                            {item.details && <span className="text-[10px] text-gray-400 italic">{item.details}</span>}
                        </div>
                        <div className="text-right">
                            {item.originalValue !== undefined && item.originalValue > item.value && (
                                <span className="block text-[10px] text-gray-400 line-through">
                                    {formatCurrency(item.originalValue)}
                                </span>
                            )}
                            <span className={`font-medium ${item.value > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                {item.value > 0 ? formatCurrency(item.value) : 'Miễn phí'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="border-t border-gray-200 my-3 pt-2">
                <div className="flex justify-between text-base font-bold text-gray-800 items-center">
                    <span>Tạm tính</span>
                    <span className="text-xl text-luvin-pink">{formatCurrency(totalPrice)}</span>
                </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200 mt-2">
                {remainingForFreeShip > 0 ? (
                    <p className="text-xs text-gray-600 text-center">
                        Mua thêm <span className="font-bold text-luvin-pink">{formatCurrency(remainingForFreeShip)}</span> để được <span className="font-bold text-green-600 uppercase">Freeship</span>
                    </p>
                ) : (
                    <p className="text-xs text-green-600 font-bold text-center flex items-center justify-center gap-1">
                        <span>🎉</span> Đơn hàng đủ điều kiện Freeship!
                    </p>
                )}
            </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mt-4 flex gap-3 items-start animate-fade-in text-left">
            <span className="text-xl">📅</span>
            <div>
                <p className="font-bold text-indigo-900 text-sm mb-1">Mẹo: Đặt Lịch Sớm (Early Bird)</p>
                <p className="text-xs text-indigo-700 leading-relaxed">
                    Sản phẩm thủ công cần <b>1-2 ngày hoàn thiện</b> (với in theo yêu cầu cần <b>10-15 ngày</b>) và 2-4 ngày vận chuyển.
                    <br/>
                    Nếu bạn có kế hoạch tặng quà xa, hãy chọn ngày nhận <b>sau 20 ngày</b> ở bước thanh toán để được <b>Giảm ngay 5%</b>!
                </p>
            </div>
        </div>

        <div className="mt-4 space-y-2">
            {!isEditingOrder && <DesignerCommitment />}
            
            {!isEditingOrder && (
                <button onClick={onBuyNow} disabled={isSaving} className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg text-base hover:opacity-90 transition-colors shadow-md">
                    {isSaving ? 'Đang xử lý...' : 'Mua ngay & Thanh toán'}
                </button>
            )}
            <button onClick={onAddToCart} disabled={isSaving} className={`w-full font-bold py-3 rounded-lg text-base transition-colors ${isEditingOrder ? 'bg-luvin-pink text-gray-800 hover:opacity-90' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                {isSaving ? '...' : (isEditingOrder ? 'Lưu mẫu thiết kế' : 'Thêm vào giỏ hàng')}
            </button>
        </div>
    </div>
  );
};
