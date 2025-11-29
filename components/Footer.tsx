
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

export const Footer: React.FC<{ navigateTo: (page: Page) => void, config?: StoreConfig }> = ({ navigateTo, config }) => {
  // Dynamic Styles from Config
  const footerStyle = {
      backgroundColor: 'var(--footer-bg)',
      color: 'var(--footer-text)',
  };

  return (
    <footer className="mt-auto font-body text-sm border-t border-gray-100" style={footerStyle}>
        <div className="bg-gray-50/50 py-2">
            <div className="container mx-auto px-6 text-center opacity-60 text-xs tracking-widest uppercase">
                <span>LEGO</span>
                <span className="mx-2">|</span>
                <span>QUÀ TẶNG</span>
                <span className="mx-2">|</span>
                <span>KỶ NIỆM</span>
                <span className="mx-2">|</span>
                <span>TÌNH YÊU</span>
            </div>
        </div>
        <div className="container mx-auto px-6 py-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <h3 className="font-bold text-base mb-3 text-primary font-heading text-xl">The Luvin</h3>
                    <p className="opacity-80 text-xs leading-relaxed">Nơi những mảnh ghép LEGO kể câu chuyện tình yêu của riêng bạn. Quà tặng độc đáo, tinh tế và đầy ý nghĩa.</p>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3 uppercase tracking-wider">LIÊN HỆ</h3>
                    <p className="opacity-80 mb-1">Địa chỉ: Khu 6, Thư Lâm, Hà Nội</p>
                    <p className="opacity-80 mb-1">
                        Hotline: <a href="https://zalo.me/0964393115" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors font-semibold">0964 393 115</a>
                    </p>
                    <p className="opacity-80">Email: theluvin.gifts@gmail.com</p>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3 uppercase tracking-wider">CHÍNH SÁCH & HỖ TRỢ</h3>
                    <ul className="space-y-2 opacity-80">
                        <li><button onClick={() => navigateTo('order-lookup')} className="hover:text-primary transition-colors">Tra cứu đơn hàng</button></li>
                        <li><button onClick={() => navigateTo('warranty')} className="hover:text-primary transition-colors">Chính sách bảo hành</button></li>
                        <li><button onClick={() => navigateTo('about')} className="hover:text-primary transition-colors">Về chúng tôi</button></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3 uppercase tracking-wider">KẾT NỐI VỚI CHÚNG TÔI</h3>
                    <div className="flex space-x-4">
                        <a href="https://www.instagram.com/the_luvin/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-primary hover:text-white transition-all shadow-sm"><InstagramIcon /></a>
                        <a href="https://www.facebook.com/theluvin" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><FacebookIcon /></a>
                        <a href="https://www.tiktok.com/@the_luvin" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-black hover:text-white transition-all shadow-sm"><TikTokIcon /></a>
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
