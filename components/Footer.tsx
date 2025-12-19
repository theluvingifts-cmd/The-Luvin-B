
import React from 'react';
import type { Page } from '../types';
import { StoreConfig } from '../services/configService';

const InstagramIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-instagram"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
)

const FacebookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-facebook"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
)

const TikTokIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"></path>
    </svg>
)

interface FooterProps {
    navigateTo: (page: Page, category?: string) => void;
    config?: StoreConfig;
    occasions?: string[];
}

export const Footer: React.FC<FooterProps> = ({ navigateTo, config, occasions = [] }) => {
  // Dynamic Styles from Config
  const footerStyle = {
      backgroundColor: 'var(--footer-bg)',
      color: 'var(--footer-text)',
  };

  // Nếu không có dịp nào từ DB, dùng mặc định
  const displayOccasions = occasions.length > 0 ? occasions : ['Sinh nhật', 'Kỷ niệm', 'Tình yêu', 'Tốt nghiệp', 'Bạn thân', 'Cưới hỏi'];

  return (
    <footer className="mt-auto font-body text-sm border-t border-gray-100" style={footerStyle}>
        {/* Dynamic Horizontal Occasions Bar */}
        <div className="bg-gray-50/80 border-b border-gray-100">
            <div className="container mx-auto">
                <div className="flex items-center overflow-x-auto no-scrollbar whitespace-nowrap py-3 px-6 md:justify-center">
                    {/* Nút All/LEGO ở đầu */}
                    <button 
                        onClick={() => navigateTo('collection', 'Tất cả')}
                        className="text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase text-gray-400 hover:text-primary transition-colors pr-4 border-r border-gray-200"
                    >
                        LEGO
                    </button>
                    
                    <div className="flex items-center">
                        {displayOccasions.map((occ, idx) => (
                            <React.Fragment key={occ}>
                                <button 
                                    onClick={() => navigateTo('collection', occ)}
                                    className="px-4 text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase text-gray-500 hover:text-primary transition-colors"
                                >
                                    {occ}
                                </button>
                                {idx < displayOccasions.length - 1 && (
                                    <span className="text-gray-200 font-light">|</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        <div className="container mx-auto px-6 py-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
                <div className="lg:col-span-1">
                    <h3 className="font-bold text-base mb-3 text-primary font-heading text-xl italic tracking-tight">The Luvin</h3>
                    <p className="opacity-80 text-xs leading-relaxed max-w-xs">Nơi những mảnh ghép LEGO kể câu chuyện tình yêu của riêng bạn. Quà tặng độc đáo, tinh tế và đầy ý nghĩa cho mọi dịp kỷ niệm.</p>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3 uppercase tracking-wider text-[11px] opacity-50">LIÊN HỆ</h3>
                    <div className="space-y-1 text-xs">
                        <p className="opacity-80">Địa chỉ: {config?.address || 'Khu 6, Thư Lâm, Hà Nội'}</p>
                        <p className="opacity-80">
                            Hotline: <a href={`https://zalo.me/${config?.hotline?.replace(/\s/g, '') || '0964393115'}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors font-bold tracking-tight">{config?.hotline || '0964 393 115'}</a>
                        </p>
                        <p className="opacity-80">Email: {config?.email || 'theluvin.gifts@gmail.com'}</p>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3 uppercase tracking-wider text-[11px] opacity-50">CHÍNH SÁCH & HỖ TRỢ</h3>
                    <ul className="space-y-2 opacity-80 text-xs font-medium">
                        <li><button onClick={() => navigateTo('order-lookup')} className="hover:text-primary transition-colors">Tra cứu đơn hàng</button></li>
                        <li><button onClick={() => navigateTo('warranty')} className="hover:text-primary transition-colors">Chính sách bảo hành</button></li>
                        <li><button onClick={() => navigateTo('business')} className="hover:text-primary transition-colors">Khách hàng Doanh nghiệp</button></li>
                        <li><button onClick={() => navigateTo('about')} className="hover:text-primary transition-colors">Về chúng tôi</button></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3 uppercase tracking-wider text-[11px] opacity-50">KẾT NỐI VỚI CHÚNG TÔI</h3>
                    <div className="flex space-x-4">
                        <a href={config?.instagramUrl || "https://www.instagram.com/the_luvin/"} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-primary hover:text-white transition-all shadow-sm"><InstagramIcon /></a>
                        <a href={config?.facebookUrl || "https://www.facebook.com/theluvin"} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><FacebookIcon /></a>
                        <a href={config?.tiktokUrl || "https://www.tiktok.com/@the_luvin"} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-black hover:text-white transition-all shadow-sm"><TikTokIcon /></a>
                    </div>
                </div>
            </div>
        </div>
        <div className="border-t border-gray-100">
            <div className="container mx-auto px-6 py-4 flex flex-col items-center justify-center text-xs opacity-60 relative">
                <p className="mb-2">Copyright © {new Date().getFullYear()} The Luvin. All Rights Reserved.</p>
                <a href="https://www.facebook.com/ngojinbtrongduong/" target="_blank" rel="noopener noreferrer" className="text-[11px] hover:text-primary transition-colors font-medium">
                   Designed & Developed by <strong>Trong Duong</strong>
                </a>
            </div>
        </div>
    </footer>
  );
};
