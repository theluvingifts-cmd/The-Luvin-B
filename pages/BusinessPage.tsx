
import React from 'react';
import { StoreConfig } from '../services/configService';
import { Page } from '../types';

// Placeholder images for B2B context
const B2B_HERO_IMG = "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop";
const GIFT_IMG_1 = "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?q=80&w=2070&auto=format&fit=crop"; 

interface BusinessPageProps {
    config?: StoreConfig;
    navigateTo?: (page: Page) => void;
}

export const BusinessPage: React.FC<BusinessPageProps> = ({ config, navigateTo }) => {
    const handleContact = () => {
        const hotline = config?.hotline?.replace(/\s/g, '') || '0964393115';
        window.open(`https://zalo.me/${hotline}`, '_blank');
    };

    const handleQuotation = () => {
        if (navigateTo) navigateTo('quotation-client');
    };

    return (
        <div className="min-h-screen bg-white font-body text-site-text transition-colors duration-300">
            {/* Hero Section */}
            <div className="relative h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                    <img src={B2B_HERO_IMG} className="w-full h-full object-cover" alt="Business Office" />
                    <div className="absolute inset-0 bg-gray-900/60 mix-blend-multiply"></div>
                </div>
                <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
                    <span className="text-white/80 font-bold tracking-[0.2em] text-xs uppercase mb-4 block">The Luvin B2B</span>
                    <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6 leading-tight">
                        Quà Tặng Doanh Nghiệp <br/>
                        <span className="text-primary italic">Độc Đáo & Tinh Tế</span>
                    </h1>
                    <p className="text-lg text-gray-200 mb-8 max-w-2xl mx-auto font-light">
                        Nâng tầm thương hiệu, gắn kết đội ngũ và tri ân đối tác với những khung tranh LEGO được cá nhân hóa riêng biệt.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button 
                            onClick={handleQuotation}
                            className="bg-primary text-white px-8 py-4 rounded-full font-bold text-sm tracking-wide hover:bg-white hover:text-primary transition-all shadow-lg transform hover:-translate-y-1"
                        >
                            Dự toán báo giá ngay
                        </button>
                        <button 
                            onClick={handleContact}
                            className="bg-white/10 backdrop-blur-md text-white border border-white/30 px-8 py-4 rounded-full font-bold text-sm tracking-wide hover:bg-white hover:text-gray-900 transition-all shadow-lg"
                        >
                            Liên hệ tư vấn Zalo
                        </button>
                    </div>
                </div>
            </div>

            {/* Why Choose Us */}
            <section className="py-20 bg-gray-50">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-heading font-bold text-gray-900 mb-4">Tại sao chọn The Luvin?</h2>
                        <p className="text-gray-500 max-w-xl mx-auto">Chúng tôi hiểu rằng quà tặng doanh nghiệp không chỉ là vật chất, mà còn là bộ mặt và sự trân trọng của công ty.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-6">🎯</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Cá Nhân Hóa Logo</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Thiết kế khung tranh theo màu sắc thương hiệu, in logo công ty và khắc tên từng nhân viên/đối tác lên sản phẩm.
                            </p>
                        </div>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-3xl mb-6">💰</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Chiết Khấu Hấp Dẫn</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Chính sách giá ưu đãi đặc biệt cho đơn hàng số lượng lớn (từ 10 sản phẩm).
                            </p>
                        </div>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center text-3xl mb-6">🎁</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Trọn Gói Quà Tặng</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Hỗ trợ đóng gói hộp quà cao cấp, thiệp viết tay và giao hàng tận nơi đến từng địa chỉ theo yêu cầu.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Use Cases */}
            <section className="py-20">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center gap-16">
                        <div className="w-full md:w-1/2 order-2 md:order-1">
                            <h2 className="text-3xl font-heading font-bold text-gray-900 mb-6">Giải pháp quà tặng cho mọi dịp</h2>
                            <ul className="space-y-6">
                                <li className="flex gap-4">
                                    <span className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">👋</span>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Welcome Kit / Onboarding</h4>
                                        <p className="text-sm text-gray-500 mt-1">Chào đón nhân viên mới với khung tranh chứa nhân vật LEGO mô phỏng chính họ.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <span className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">🏆</span>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Kỷ niệm thâm niên / Vinh danh</h4>
                                        <p className="text-sm text-gray-500 mt-1">Ghi nhận cống hiến 1 năm, 5 năm, 10 năm với thiết kế trang trọng và ý nghĩa.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <span className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">🤝</span>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Quà tặng Đối tác / Sự kiện</h4>
                                        <p className="text-sm text-gray-500 mt-1">Món quà độc lạ thay lời cảm ơn, gây ấn tượng mạnh mẽ với khách hàng VIP.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="w-full md:w-1/2 order-1 md:order-2">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 rounded-2xl transform rotate-3"></div>
                                <img src={GIFT_IMG_1} className="relative rounded-2xl shadow-xl w-full" alt="Gift Example" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Process */}
            <section className="py-20 bg-gray-900 text-white">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-heading font-bold mb-12">Quy trình hợp tác</h2>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative">
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-700 -z-0"></div>
                        
                        {[
                            { step: 1, title: "Liên hệ & Tư vấn", desc: "Trao đổi nhu cầu, số lượng và ngân sách." },
                            { step: 2, title: "Thiết kế mẫu", desc: "Lên demo thiết kế có logo và màu sắc thương hiệu." },
                            { step: 3, title: "Ký HĐ & Sản xuất", desc: "Đặt cọc và tiến hành sản xuất hàng loạt." },
                            { step: 4, title: "Giao hàng", desc: "Kiểm tra chất lượng và giao tận nơi." }
                        ].map((item, idx) => (
                            <div key={idx} className="relative z-10 bg-gray-900 px-4 w-full md:w-1/4">
                                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4 border-4 border-gray-800">
                                    {item.step}
                                </div>
                                <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                                <p className="text-gray-400 text-sm">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Contact */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-6">
                    <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto">
                        <h2 className="text-3xl font-heading font-bold text-gray-900 mb-6">Liên hệ hợp tác</h2>
                        <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                            Bạn đã sẵn sàng tạo nên những món quà đặc biệt cho doanh nghiệp mình? Hãy để lại thông tin hoặc liên hệ trực tiếp với chúng tôi.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button 
                                onClick={handleContact}
                                className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-base shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.8.48 3.5 1.32 5L2.04 22l5.18-1.26C8.42 21.56 10.17 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
                                Chat Zalo: {config?.hotline || '0964 393 115'}
                            </button>
                            <a 
                                href="mailto:theluvin.gifts@gmail.com"
                                className="bg-white border-2 border-gray-200 text-gray-800 px-8 py-4 rounded-full font-bold text-base hover:border-gray-900 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                Gửi Email
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
