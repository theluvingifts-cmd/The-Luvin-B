
import React from 'react';

export const WarrantyPage: React.FC = () => (
    <div className="min-h-screen bg-[#f9f4ef] pb-20 font-body">
        {/* Header */}
        <div className="bg-white sticky top-0 z-30 shadow-sm transition-all">
            <div className="container mx-auto px-6 py-6 md:py-8">
                <div className="relative">
                    <h1 className="text-5xl md:text-7xl font-script text-luvin-pink transform -rotate-2 origin-left drop-shadow-sm mb-2">Chính sách</h1>
                    <p className="text-xs text-gray-400 mt-2 font-medium tracking-widest uppercase ml-1">Bảo hành & Đổi trả</p>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 py-12">
            <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100 space-y-8 leading-relaxed text-gray-700">
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-luvin-pink font-bold">1</div>
                        <h3 className="text-xl font-bold text-gray-900">Chính sách đổi trả</h3>
                    </div>
                    <div className="pl-11">
                        <ul className="list-disc pl-5 space-y-2 marker:text-luvin-pink">
                            <li>Hỗ trợ đổi trả miễn phí trong vòng <strong>7 ngày</strong> kể từ khi nhận hàng nếu sản phẩm có lỗi từ nhà sản xuất (gãy vỡ, sai mẫu, thiếu mảnh ghép).</li>
                            <li>Sản phẩm đổi trả phải còn nguyên vẹn, chưa qua sử dụng và đầy đủ phụ kiện/quà tặng đi kèm.</li>
                        </ul>
                    </div>
                </section>
                
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-luvin-pink font-bold">2</div>
                        <h3 className="text-xl font-bold text-gray-900">Chính sách bảo hành</h3>
                    </div>
                    <div className="pl-11">
                        <ul className="list-disc pl-5 space-y-2 marker:text-luvin-pink">
                            <li>Bảo hành <strong>vĩnh viễn</strong> cho keo dán và độ bền của khung tranh. Nếu các chi tiết bị bong tróc trong quá trình sử dụng, bạn có thể gửi lại shop để được dán lại miễn phí.</li>
                            <li>Hỗ trợ thay thế/bổ sung mảnh ghép bị mất (có tính phí ưu đãi) trọn đời.</li>
                        </ul>
                    </div>
                </section>

                <section className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Quy trình xử lý</h3>
                    <p className="text-sm">
                        Vui lòng liên hệ với chúng tôi qua Fanpage hoặc Hotline <strong className="text-luvin-pink">0964 393 115</strong> ngay khi gặp vấn đề. The Luvin sẽ phản hồi và hướng dẫn bạn cách thức gửi hàng nhanh nhất.
                    </p>
                </section>
            </div>
        </div>
    </div>
);
