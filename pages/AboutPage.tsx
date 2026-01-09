
import React from 'react';
import { StoreConfig } from '../services/configService';

// Fallback images if config images are missing
const PLACEHOLDER_IMG_1 = "https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?q=80&w=2071&auto=format&fit=crop";
const PLACEHOLDER_IMG_2 = "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=1974&auto=format&fit=crop";

export const AboutPage: React.FC<{ config?: StoreConfig }> = ({ config }) => (
    <div className="min-h-screen bg-white font-body text-site-text transition-colors duration-300">
        {/* Hero Section */}
        <div className="relative py-24 bg-secondary/30 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="container mx-auto px-6 relative z-10 text-center">
                <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-4 block">Our Story</span>
                <h1 className="text-5xl md:text-7xl font-heading font-bold text-gray-900 mb-6">Về The Luvin</h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                    Nơi những mảnh ghép nhỏ bé kết nối những câu chuyện tình yêu vĩ đại.
                </p>
            </div>
        </div>

        {/* Section 1: The Beginning */}
        <section className="py-20 container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-16">
                <div className="w-full md:w-1/2">
                    <div className="relative">
                        <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl">
                            <img src={config?.heroImageUrl || PLACEHOLDER_IMG_1} className="w-full h-full object-cover" alt="The Luvin Story" />
                        </div>
                        <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-lg max-w-xs hidden md:block">
                            <p className="font-heading text-xl font-bold text-primary">"Unique for every moment"</p>
                            <p className="text-xs text-gray-500 mt-1">Slogan của chúng tôi</p>
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-1/2">
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-6">Khởi nguồn cảm hứng</h2>
                    <div className="space-y-4 text-gray-600 leading-loose">
                        <p>
                            Chào mừng bạn đến với <strong className="text-primary">The Luvin</strong>. Câu chuyện của chúng tôi bắt đầu từ một niềm tin đơn giản: <em className="text-gray-800">Món quà ý nghĩa nhất không nằm ở giá trị vật chất, mà ở cảm xúc nó mang lại.</em>
                        </p>
                        <p>
                            Chúng tôi nhận ra rằng, trong thế giới số hóa vội vã, những món quà thủ công, mang đậm dấu ấn cá nhân đang dần trở nên hiếm hoi. Một khung tranh LEGO được cá nhân hóa không chỉ lưu giữ khoảnh khắc, mà còn thể hiện sự quan tâm tỉ mỉ của người tặng. 
                        </p>
                        <p>
                            Từ việc chọn từng nhân vật, phối từng bộ trang phục cho đến lời nhắn gửi yêu thương, tất cả đều được tạo nên từ chính cảm xúc của bạn. The Luvin ra đời để giúp bạn kể lại câu chuyện ấy một cách trọn vẹn nhất.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* Section 2: Values */}
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-6 text-center">
                <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-12">Giá trị cốt lõi</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { title: "Sự Tinh Tế", desc: "Mỗi sản phẩm đều được hoàn thiện tỉ mỉ, từ mảnh ghép đến hộp quà.", icon: "✨" },
                        { title: "Cá Nhân Hóa", desc: "Tôn trọng câu chuyện riêng của mỗi khách hàng.", icon: "🎨" },
                        { title: "Tận Tâm", desc: "Phục vụ khách hàng như phục vụ chính người thân yêu.", icon: "❤️" }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-2 transition-transform duration-300">
                            <div className="text-4xl mb-4">{item.icon}</div>
                            <h3 className="font-bold text-xl mb-3 text-gray-900">{item.title}</h3>
                            <p className="text-gray-600 text-sm">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Section 3: Commitment */}
        <section className="py-20 container mx-auto px-6">
            <div className="flex flex-col md:flex-row-reverse items-center gap-16">
                <div className="w-full md:w-1/2">
                    <div className="aspect-video rounded-2xl overflow-hidden shadow-lg">
                        <img src={config?.inspireImageUrl || PLACEHOLDER_IMG_2} className="w-full h-full object-cover" alt="Commitment" />
                    </div>
                </div>
                <div className="w-full md:w-1/2">
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-6">Cam kết của chúng tôi</h2>
                    <p className="text-gray-600 leading-loose mb-6">
                        Tại The Luvin, chất lượng là ưu tiên hàng đầu. Mỗi khung tranh trước khi đến tay bạn đều trải qua quy trình kiểm tra nghiêm ngặt: độ chắc chắn của keo, độ sáng bóng của mảnh ghép và sự chính xác của thiết kế.
                    </p>
                    <ul className="space-y-3">
                        {['Bảo hành trọn đời cho keo dán', 'Hỗ trợ thay thế mảnh ghép bị mất', 'Đóng gói quà tặng sang trọng miễn phí'].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">✓</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>

        {/* Footer Note */}
        <div className="py-16 text-center border-t border-dashed border-gray-200">
            <p className="font-heading text-2xl text-primary italic">"Cảm ơn bạn đã chọn The Luvin để gửi gắm yêu thương."</p>
            <p className="text-sm text-gray-400 mt-4 font-bold tracking-widest uppercase">- The Luvin Team -</p>
        </div>
    </div>
);
