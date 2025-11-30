
import React from 'react';
import { StoreConfig } from '../services/configService';

export const AboutPage: React.FC<{ config?: StoreConfig }> = ({ config }) => (
    <div className="min-h-screen bg-site-bg pb-20 font-body text-site-text transition-colors duration-300">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm transition-all border-b border-gray-100">
            <div className="container mx-auto px-6 py-6 md:py-8">
                <div className="relative">
                    <h1 className="text-5xl md:text-7xl font-heading text-primary transform -rotate-2 origin-left drop-shadow-sm mb-2">Về chúng tôi</h1>
                    <p className="text-xs text-gray-400 mt-2 font-medium tracking-widest uppercase ml-1">Câu chuyện thương hiệu</p>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 py-12">
            <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100 space-y-6 leading-relaxed text-gray-700">
                <p>
                    Chào mừng bạn đến với <strong className="text-primary font-bold">The Luvin</strong> – nơi những mảnh ghép LEGO không chỉ là đồ chơi, mà là ngôn ngữ của tình yêu và kỷ niệm.
                </p>
                <p>
                    Chúng tôi tin rằng mỗi món quà đều mang một câu chuyện riêng. Một khung tranh LEGO được cá nhân hóa không chỉ lưu giữ khoảnh khắc, mà còn thể hiện sự quan tâm tỉ mỉ của người tặng. Từ việc chọn từng nhân vật, phối từng bộ trang phục cho đến lời nhắn gửi yêu thương, tất cả đều được tạo nên từ chính cảm xúc của bạn.
                </p>
                <p>
                    Tại The Luvin, chúng tôi cam kết mang đến những sản phẩm chất lượng nhất với sự phục vụ tận tâm nhất. Mỗi khung tranh đều được lắp ráp thủ công, kiểm tra kỹ lưỡng và đóng gói trang trọng trước khi đến tay người nhận.
                </p>
                <p>
                    Cảm ơn bạn đã tin tưởng và chọn The Luvin để gửi gắm yêu thương.
                </p>
                <div className="text-center mt-12 pt-8 border-t border-dashed border-gray-200">
                    <p className="font-heading text-3xl text-primary">The Luvin Team</p>
                </div>
            </div>
        </div>
    </div>
);
