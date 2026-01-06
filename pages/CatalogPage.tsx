
import React, { useState, useMemo } from 'react';
import { LegoPart, FrameOption, CollectionTemplate } from '../types';
import { formatCurrency } from '../utils/pricing';

interface CatalogPageProps {
    legoParts: any;
    frames: FrameOption[];
    templates: CollectionTemplate[];
    onCustomize: (tpl: CollectionTemplate) => void;
    onZoom: (url: string) => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({ legoParts, frames, templates, onCustomize, onZoom }) => {
    const [activeSection, setActiveSection] = useState<'templates' | 'frames' | 'parts'>('templates');

    return (
        <div className="min-h-screen bg-white font-body pb-24">
            {/* Catalog Banner */}
            <div className="bg-gray-900 text-white py-12 px-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2 block">The Luvin Presents</span>
                    <h1 className="text-4xl font-heading font-bold mb-3">Digital Catalog</h1>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">Khám phá vũ trụ quà tặng LEGO độc bản dành riêng cho bạn.</p>
                </div>
            </div>

            {/* Quick Navigation Tabs */}
            <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-md border-b flex justify-around py-3">
                {[
                    { id: 'templates', label: 'Mẫu HOT', icon: '✨' },
                    { id: 'frames', label: 'Khung Ảnh', icon: '🖼️' },
                    { id: 'parts', label: 'Linh Kiện', icon: '🧩' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => {
                            setActiveSection(tab.id as any);
                            const el = document.getElementById(`section-${tab.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`flex flex-col items-center gap-1 transition-all ${activeSection === tab.id ? 'text-primary scale-110' : 'text-gray-400'}`}
                    >
                        <span className="text-xl">{tab.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
                        {activeSection === tab.id && <div className="w-1 h-1 bg-primary rounded-full mt-1"></div>}
                    </button>
                ))}
            </div>

            <div className="container mx-auto px-4 mt-8 space-y-16">
                {/* SECTION: TEMPLATES */}
                <section id="section-templates" className="scroll-mt-32">
                    <div className="flex items-end justify-between mb-6 border-l-4 border-primary pl-4">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-gray-900">Mẫu Thiết Kế Sẵn</h2>
                            <p className="text-xs text-gray-500">Các mẫu bán chạy nhất được Designer gợi ý</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="group relative rounded-2xl overflow-hidden border shadow-sm bg-gray-50">
                                <div className="aspect-[3/4] overflow-hidden cursor-zoom-in" onClick={() => onZoom(tpl.imageUrl)}>
                                    <img src={tpl.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={tpl.name} />
                                </div>
                                <div className="p-3 bg-white">
                                    <h3 className="text-xs font-bold text-gray-800 truncate mb-2">{tpl.name}</h3>
                                    <button 
                                        onClick={() => onCustomize(tpl)}
                                        className="w-full py-2 bg-gray-900 text-white text-[10px] font-black uppercase rounded-lg hover:bg-primary transition-colors"
                                    >
                                        Dùng mẫu này
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* SECTION: FRAMES */}
                <section id="section-frames" className="scroll-mt-32">
                    <div className="flex items-end justify-between mb-6 border-l-4 border-blue-500 pl-4">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-gray-900">Các Loại Khung</h2>
                            <p className="text-xs text-gray-500">Kích thước và chất liệu khung tranh</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {frames.map(frame => (
                            <div key={frame.id} className="flex gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                                <div className="w-24 h-24 bg-white rounded-2xl border flex items-center justify-center p-2 flex-shrink-0">
                                    <img src={frame.imageUrl || 'https://via.placeholder.com/150'} className="max-w-full max-h-full object-contain" />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h3 className="font-bold text-gray-900">{frame.name}</h3>
                                    <p className="text-xs text-gray-500 mb-2">{frame.description}</p>
                                    <p className="text-sm font-black text-primary">{formatCurrency(frame.price)}</p>
                                    <div className="flex gap-1 mt-2">
                                        {frame.colors.map(c => <div key={c} className="w-3 h-3 rounded-full border" style={{backgroundColor: c === 'wood' ? '#d2b48c' : c}}></div>)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* SECTION: PARTS */}
                <section id="section-parts" className="scroll-mt-32">
                    <div className="flex items-end justify-between mb-6 border-l-4 border-green-500 pl-4">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-gray-900">Thư Viện Linh Kiện</h2>
                            <p className="text-xs text-gray-500">Tự do mix & match hàng nghìn lựa chọn</p>
                        </div>
                    </div>
                    
                    {['shirt', 'hair', 'accessory', 'pet'].map(type => (
                        <div key={type} className="mb-8">
                            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4 ml-1">
                                {type === 'shirt' ? 'Trang phục' : type === 'hair' ? 'Kiểu tóc' : type === 'accessory' ? 'Phụ kiện' : 'Thú cưng'}
                            </h4>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {(legoParts[type] || []).slice(0, 12).map((part: LegoPart) => (
                                    <div key={part.id} className="flex flex-col items-center">
                                        <div className="aspect-square w-full bg-gray-50 rounded-xl border flex items-center justify-center p-2 mb-1 hover:border-primary transition-colors cursor-pointer" onClick={() => onZoom(part.imageUrl)}>
                                            <img src={part.imageUrl} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <span className="text-[8px] font-bold text-gray-500 text-center truncate w-full">{part.name}</span>
                                    </div>
                                ))}
                                <div className="aspect-square w-full bg-blue-50 rounded-xl border border-dashed border-blue-200 flex flex-col items-center justify-center text-blue-500 gap-1 opacity-80">
                                    <span className="text-xs font-black">+{ (legoParts[type]?.length || 12) - 12 }</span>
                                    <span className="text-[7px] font-bold uppercase">Mẫu khác</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>
            </div>

            {/* Sticky Order Button for Customer */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
                <button 
                    onClick={() => window.location.href = '/thiet-ke'}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                    <span>🎨</span> Bắt đầu tự thiết kế ngay
                </button>
            </div>
        </div>
    );
};
