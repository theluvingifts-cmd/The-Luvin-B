
import React from 'react';
import type { Page } from '../types';

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

export const Footer: React.FC<{ navigateTo: (page: Page) => void }> = ({ navigateTo }) => {
  return (
    <footer className="bg-white text-gray-800 mt-auto font-body text-sm">
        <div className="bg-gray-100 py-2">
            <div className="container mx-auto px-6 text-center text-gray-500 text-xs tracking-widest">
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
                    <h3 className="font-bold text-base mb-3 text-luvin-pink font-brand-heading text-xl">The Luvin</h3>
                    <p className="text-gray-600 text-xs leading-relaxed">Nơi những mảnh ghép LEGO kể câu chuyện tình yêu của riêng bạn. Quà tặng độc đáo, tinh tế và đầy ý nghĩa.</p>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3">LIÊN HỆ</h3>
                    <p className="text-gray-600 mb-1">Địa chỉ: Khu 6, Thư Lâm, Hà Nội</p>
                    <p className="text-gray-600 mb-1">
                        Hotline: <a href="https://zalo.me/0964393115" target="_blank" rel="noopener noreferrer" className="hover:text-luvin-pink transition-colors">0964 393 115</a>
                    </p>
                    <p className="text-gray-600">Email: theluvin.gifts@gmail.com</p>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3">CHÍNH SÁCH & HỖ TRỢ</h3>
                    <ul className="space-y-2">
                        <li><button onClick={() => navigateTo('order-lookup')} className="text-gray-600 hover:text-luvin-pink transition-colors">Tra cứu đơn hàng</button></li>
                        <li><button onClick={() => navigateTo('warranty')} className="text-gray-600 hover:text-luvin-pink transition-colors">Chính sách bảo hành</button></li>
                        <li><button onClick={() => navigateTo('about')} className="text-gray-600 hover:text-luvin-pink transition-colors">Về chúng tôi</button></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-3">KẾT NỐI VỚI CHÚNG TÔI</h3>
                    <div className="flex space-x-4">
                        <a href="https://www.instagram.com/the_luvin/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-luvin-pink hover:text-white transition-all"><InstagramIcon /></a>
                        <a href="https://www.facebook.com/theluvin" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-blue-600 hover:text-white transition-all"><FacebookIcon /></a>
                        <a href="https://www.tiktok.com/@the_luvin" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-black hover:text-white transition-all"><TikTokIcon /></a>
                    </div>
                </div>
            </div>
        </div>
        <div className="border-t border-gray-200">
            <div className="container mx-auto px-6 py-4 flex flex-col items-center justify-center text-xs text-gray-500 relative">
                <p className="mb-2">Copyright © {new Date().getFullYear()} The Luvin. All Rights Reserved.</p>
                <a href="https://www.facebook.com/ngojinbtrongduong/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors font-medium">
                   Designed & Developed by <strong>Trong Duong</strong>
                </a>
            </div>
        </div>
    </footer>
  );
};
