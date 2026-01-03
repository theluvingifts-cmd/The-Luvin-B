
import React, { useEffect } from 'react';
import type { FrameConfig, FrameOption } from '../../types';
import { getEffectivePrice, formatCurrency } from '../../utils/pricing';

export const Step1Frame: React.FC<{ config: FrameConfig; setConfig: (c: FrameConfig) => void; frames: FrameOption[] }> = ({ config, setConfig, frames }) => {
  const selectedFrame = frames.find(f => f.id === config.frameId) || frames[0];
  
  useEffect(() => {
      if (selectedFrame && selectedFrame.colors && selectedFrame.colors.length > 0) {
          if (!config.frameColor || !selectedFrame.colors.includes(config.frameColor)) {
              setConfig({ ...config, frameColor: selectedFrame.colors[0] });
          }
      }
  }, [selectedFrame, config.frameColor, setConfig, config]);

  return (
    <div className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-lg text-left">
        <h4 className="font-bold text-gray-800 mb-3 uppercase text-sm">CHỌN KÍCH THƯỚC</h4>
        <div className="grid grid-cols-3 gap-3">
          {frames.map(frame => {
            const effectivePrice = getEffectivePrice(frame);
            const isSale = effectivePrice < frame.price;

            return (
                <button
                key={frame.id}
                onClick={() => setConfig({ ...config, frameId: frame.id })}
                disabled={frame.stock === 0}
                className={`border rounded-lg py-2 px-1 text-xs sm:text-sm font-semibold transition-all duration-200 flex flex-col items-center justify-center h-20 relative hover:scale-105 active:scale-95 ${
                    config.frameId === frame.id ? 'bg-luvin-pink text-gray-800 border-luvin-pink shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-50'
                } ${frame.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                <span>{frame.name}</span>
                {isSale ? (
                    <div className="flex flex-col items-center leading-none mt-1">
                        <span className="font-normal opacity-60 line-through text-[10px]">{formatCurrency(frame.price)}</span>
                        <span className="font-bold text-red-600 text-xs">{formatCurrency(effectivePrice)}</span>
                    </div>
                ) : (
                    <span className="font-normal opacity-80 mt-1">{formatCurrency(frame.price)}</span>
                )}
                
                {isSale && (
                    <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm font-bold whitespace-nowrap z-10">SALE</span>
                )}
                {frame.id === 'lg' && !isSale && (
                    <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-[9px] px-1.5 py-0.5 rounded shadow-sm text-yellow-900 font-bold whitespace-nowrap z-10">Phổ biến nhất</span>
                )}
                {frame.stock === 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] px-1 rounded-bl">Hết hàng</span>}
                </button>
            );
          })}
        </div>

        {selectedFrame && selectedFrame.colors && selectedFrame.colors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="font-bold text-xs text-gray-500 uppercase mb-2">MÀU KHUNG</h4>
                <div className="flex gap-3 flex-wrap">
                    {selectedFrame.colors.map(color => {
                        const getColorStyle = (c: string) => {
                            if (c === 'white') return { bg: '#fff', border: '#ddd' };
                            if (c === 'black') return { bg: '#000', border: '#000' };
                            if (c === 'wood') return { bg: '#d2b48c', border: '#c1a075' };
                            if (c === 'gold') return { bg: '#ffd700', border: '#e6c200' };
                            return { bg: c, border: c };
                        };
                        const style = getColorStyle(color);
                        const isSelected = config.frameColor === color;

                        return (
                            <button 
                                key={color}
                                onClick={() => setConfig({ ...config, frameColor: color })}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all capitalize hover:shadow-sm ${isSelected ? 'border-luvin-pink ring-1 ring-luvin-pink bg-pink-50' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                                <div 
                                    className="w-4 h-4 rounded-full shadow-sm border" 
                                    style={{ backgroundColor: style.bg, borderColor: style.border }}
                                ></div>
                                <span className="text-sm font-medium text-gray-700">{color === 'white' ? 'Trắng' : color === 'black' ? 'Đen' : color}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        )}
      </div>
       {selectedFrame && (
        <div className="p-4 border border-gray-200 rounded-lg text-left">
            <h4 className="font-bold text-gray-800 mb-3 uppercase text-sm">GIÁ CƠ BẢN BAO GỒM</h4>
            <ul className="text-sm list-disc list-inside text-gray-600 space-y-1">
                <li>1 Khung ảnh {selectedFrame.name} ({selectedFrame.description}).</li>
                <li>1 Nền tùy chọn (mẫu có sẵn hoặc ảnh của bạn).</li>
                <li>Miễn phí thêm chữ & ảnh nhỏ trang trí.</li>
                <li>Hộp quà & thiệp viết tay theo yêu cầu.</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2 italic">Lưu ý: Giá chưa bao gồm nhân vật LEGO và phụ kiện.</p>
        </div>
      )}
    </div>
  );
};
