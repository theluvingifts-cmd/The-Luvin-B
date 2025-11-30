
import React from 'react';
import { StoreConfig } from '../services/configService';

export const WarrantyPage: React.FC<{ config?: StoreConfig }> = ({ config }) => (
    <div className="min-h-screen bg-site-bg pb-20 font-body text-site-text transition-colors duration-300">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm transition-all border-b border-gray-100">
            <div className="container mx-auto px-6 py-6 md:py-8">
                <div className="relative">
                    <h1 className="text-5xl md:text-7xl font-heading text-primary transform -rotate-2 origin-left drop-shadow-sm mb-2">Chính sách</h1>
                    <p className="text-xs text-gray-400 mt-2 font-medium tracking-widest uppercase ml-1">Bảo hành & Đổi trả</p>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 py-12">
            <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100 space-y-10 leading-relaxed text-gray-700">
                <section>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-primary font-bold text-lg">1</div>
                        <h3 className="text-xl font-bold text-gray-900 font-heading">Chính sách đổi trả</h3>
                    </div>
                    <div className="pl-14">
                        <ul className="list-disc pl-5 space-y-3 marker:text-primary">
                            <li>Hỗ trợ đổi trả miễn phí trong vòng <strong>7 ngày</strong> kể từ khi nhận hàng nếu sản phẩm có lỗi từ nhà sản xuất (gãy vỡ, sai mẫu, thiếu mảnh ghép).</li>
                            <li>Sản phẩm đổi trả phải còn nguyên vẹn, chưa qua sử dụng và đầy đủ phụ kiện/quà tặng đi kèm.</li>
                        </ul>
                    </div>
                </section>
                
                <section>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-primary font-bold text-lg">2</div>
                        <h3 className="text-xl font-bold text-gray-900 font-heading">Chính sách bảo hành</h3>
                    </div>
                    <div className="pl-14">
                        <ul className="list-disc pl-5 space-y-3 marker:text-primary">
                            <li>Bảo hành <strong>vĩnh viễn</strong> cho keo dán và độ bền của khung tranh. Nếu các chi tiết bị bong tróc trong quá trình sử dụng, bạn có thể gửi lại shop để được dán lại miễn phí.</li>
                            <li>Hỗ trợ thay thế/bổ sung mảnh ghép bị mất (có tính phí ưu đãi) trọn đời.</li>
                        </ul>
                    </div>
                </section>

                <section className="bg-gray-50 p-6 rounded-xl border border-gray-100 mt-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 font-heading">Quy trình xử lý</h3>
                    <p className="text-sm text-gray-600">
                        Vui lòng liên hệ với chúng tôi qua Fanpage hoặc Hotline <a href={`https://zalo.me/${config?.hotline?.replace(/\s/g, '') || '0964393115'}`} target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">{config?.hotline || '0964 393 115'}</a> ngay khi gặp vấn đề. The Luvin sẽ phản hồi và hướng dẫn bạn cách thức gửi hàng nhanh nhất.
                    </p>
                </section>
            </div>
        </div>
    </div>
);
