
import React from 'react';
import type { Page } from '../types';
import type { StoreConfig } from '../services/configService';

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
    navigateTo: (page: Page) => void;
    config?: StoreConfig;
}

export const Footer: React.FC<FooterProps> = ({ navigateTo, config }) => {
  const contact = config?.contact || {};

  return (
    <footer className="bg-white text-gray-800 mt-auto font-body text-sm border-t border-gray-100">
        <div className="bg-gray-50 py-2">
            <div className="container mx-auto px-6 text-center text-gray-400 text-[10px] sm:text-xs tracking-widest font-medium uppercase">
                <span>LEGO</span>
                <span className="mx-3">•</span>
                <span>QUÀ TẶNG</span>
                <span className="mx-3">•</span>
                <span>KỶ NIỆM</span>
                <span className="mx-3">•</span>
                <span>TÌNH YÊU</span>
            </div>
        </div>
        <div className="container mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <h3 className="font-bold text-base mb-4 text-luvin-pink font-brand-heading text-2xl">The Luvin</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">Nơi những mảnh ghép LEGO kể câu chuyện tình yêu của riêng bạn. Quà tặng độc đáo, tinh tế và đầy ý nghĩa.</p>
                </div>
                <div>
                    <h3 className="font-bold text-sm uppercase tracking-wide mb-4 text-gray-900">Liên hệ</h3>
                    <div className="space-y-3 text-gray-600 text-sm">
                        <p className="flex items-start gap-2">
                            <span className="mt-0.5">📍</span>
                            <span>{contact.address || 'Khu 6, Thư Lâm, Hà Nội'}</span>
                        </p>
                        <p className="flex items-center gap-2">
                            <span>📞</span>
                            <a href={`tel:${contact.hotline || '0964393115'}`} className="hover:text-luvin-pink transition-colors font-medium">
                                {contact.hotline || '0964 393 115'}
                            </a>
                        </p>
                        <p className="flex items-center gap-2">
                            <span>✉️</span>
                            <span>{contact.email || 'theluvin.gifts@gmail.com'}</span>
                        </p>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-sm uppercase tracking-wide mb-4 text-gray-900">Hỗ trợ</h3>
                    <ul className="space-y-2 text-gray-600">
                        <li><button onClick={() => navigateTo('order-lookup')} className="hover:text-luvin-pink transition-colors hover:underline">Tra cứu đơn hàng</button></li>
                        <li><button onClick={() => navigateTo('warranty')} className="hover:text-luvin-pink transition-colors hover:underline">Chính sách bảo hành</button></li>
                        <li><button onClick={() => navigateTo('about')} className="hover:text-luvin-pink transition-colors hover:underline">Về chúng tôi</button></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-bold text-sm uppercase tracking-wide mb-4 text-gray-900">Kết nối</h3>
                    <div className="flex space-x-3">
                        <a href={contact.instagram || "https://www.instagram.com/the_luvin/"} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-luvin-pink hover:text-white transition-all transform hover:-translate-y-1"><InstagramIcon /></a>
                        <a href={contact.facebook || "https://www.facebook.com/theluvin"} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-blue-600 hover:text-white transition-all transform hover:-translate-y-1"><FacebookIcon /></a>
                        <a href={contact.tiktok || "https://www.tiktok.com/@the_luvin"} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-black hover:text-white transition-all transform hover:-translate-y-1"><TikTokIcon /></a>
                    </div>
                </div>
            </div>
        </div>
        <div className="border-t border-gray-100">
            <div className="container mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-400">
                <p>Copyright © {new Date().getFullYear()} The Luvin. All Rights Reserved.</p>
                <div className="mt-2 md:mt-0">
                    Designed & Developed by <a href="https://www.facebook.com/ngojinbtrongduong/" target="_blank" rel="noopener noreferrer" className="font-bold text-gray-500 hover:text-luvin-pink transition-colors">Trong Duong</a>
                </div>
            </div>
        </div>
    </footer>
  );
};
