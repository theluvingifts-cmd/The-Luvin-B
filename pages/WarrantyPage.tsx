
import React from 'react';
import { StoreConfig } from '../services/configService';

export const WarrantyPage: React.FC<{ config?: StoreConfig }> = ({ config }) => (
    <div className="min-h-screen bg-gray-50 pb-20 font-body text-site-text transition-colors duration-300">
        {/* Modern Header */}
        <div className="bg-white border-b border-gray-100 py-16">
            <div className="container mx-auto px-6 text-center">
                <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-4">Chính Sách & Bảo Hành</h1>
                <p className="text-gray-500 max-w-2xl mx-auto">
                    The Luvin cam kết đồng hành cùng bạn không chỉ khi mua hàng mà trong suốt quá trình sử dụng sản phẩm.
                </p>
            </div>
        </div>

        <div className="container mx-auto px-6 -mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Feature Cards */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🛡️</div>
                    <h3 className="font-bold text-gray-900 mb-2">Bảo Hành Trọn Đời</h3>
                    <p className="text-sm text-gray-500">Cho keo dán và độ bền khung.</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">cw</div>
                    <h3 className="font-bold text-gray-900 mb-2">Đổi Trả 7 Ngày</h3>
                    <p className="text-sm text-gray-500">Miễn phí nếu có lỗi sản xuất.</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔧</div>
                    <h3 className="font-bold text-gray-900 mb-2">Hỗ Trợ 24/7</h3>
                    <p className="text-sm text-gray-500">Thay thế mảnh ghép bị mất.</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto mt-12 space-y-8">
                {/* Policy Section 1 */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-heading font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm">1</span>
                        Chính sách Đổi trả
                    </h2>
                    <div className="prose prose-sm text-gray-600 max-w-none">
                        <p className="mb-4">Chúng tôi luôn mong muốn bạn hài lòng tuyệt đối với món quà của mình. Tuy nhiên, nếu có sơ suất, The Luvin hỗ trợ đổi trả theo quy định sau:</p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none pl-0">
                            <li className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>Đổi trả miễn phí trong vòng <strong>7 ngày</strong> nếu sản phẩm bị gãy vỡ do vận chuyển, sai mẫu thiết kế đã chốt, hoặc thiếu mảnh ghép.</span>
                            </li>
                            <li className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>Sản phẩm đổi trả cần giữ nguyên vẹn bao bì, hộp quà và phụ kiện đi kèm (nếu có).</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Policy Section 2 */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-heading font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm">2</span>
                        Chính sách Bảo hành
                    </h2>
                    <div className="space-y-4">
                        <div className="border-l-4 border-primary pl-4 py-1">
                            <h4 className="font-bold text-gray-900">Bảo hành keo dán vĩnh viễn</h4>
                            <p className="text-sm text-gray-600 mt-1">Trong quá trình sử dụng, nếu các chi tiết LEGO bị bong tróc khỏi nền, bạn có thể gửi lại shop để được dán lại hoàn toàn miễn phí.</p>
                        </div>
                        <div className="border-l-4 border-blue-400 pl-4 py-1">
                            <h4 className="font-bold text-gray-900">Hỗ trợ mảnh ghép</h4>
                            <p className="text-sm text-gray-600 mt-1">Nếu bạn vô tình làm mất mảnh ghép (tóc, phụ kiện...), The Luvin hỗ trợ tìm và thay thế với chi phí ưu đãi trọn đời sản phẩm.</p>
                        </div>
                    </div>
                </div>

                {/* Contact CTA */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-center text-white shadow-lg">
                    <h3 className="text-2xl font-bold mb-2">Cần hỗ trợ ngay?</h3>
                    <p className="text-gray-300 mb-6 text-sm">Đội ngũ The Luvin luôn sẵn sàng lắng nghe và giải quyết vấn đề của bạn.</p>
                    <div className="flex justify-center gap-4">
                        <a href={`https://zalo.me/${config?.hotline?.replace(/\s/g, '') || '0964393115'}`} target="_blank" rel="noopener noreferrer" className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2">
                            Chat Zalo
                        </a>
                        <a href="https://m.me/theluvin" target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
                            Messenger
                        </a>
                    </div>
                    <p className="mt-4 text-xs text-gray-400">Hotline: {config?.hotline || '0964 393 115'}</p>
                </div>
            </div>
        </div>
    </div>
);
