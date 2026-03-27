
import React from 'react';
import { StoreConfig } from '../services/configService';
import { useLanguage } from '../src/contexts/LanguageContext';

// Fallback images if config images are missing
const PLACEHOLDER_IMG_1 = "https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?q=80&w=2071&auto=format&fit=crop";
const PLACEHOLDER_IMG_2 = "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=1974&auto=format&fit=crop";

export const AboutPage: React.FC<{ config?: StoreConfig }> = ({ config }) => {
    const { t } = useLanguage();
    return (
    <div className="min-h-screen bg-white font-body text-site-text transition-colors duration-300">
        {/* Hero Section */}
        <div className="relative py-24 bg-secondary/30 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="container mx-auto px-6 relative z-10 text-center">
                <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-4 block">{t('about.our_story')}</span>
                <h1 className="text-5xl md:text-7xl font-heading font-bold text-gray-900 mb-6">{t('about.about_title')}</h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                    {t('about.about_subtitle')}
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
                            <p className="font-heading text-xl font-bold text-primary">{t('about.slogan')}</p>
                            <p className="text-xs text-gray-500 mt-1">{t('about.slogan_desc')}</p>
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-1/2">
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-6">{t('about.inspiration_title')}</h2>
                    <div className="space-y-4 text-gray-600 leading-loose">
                        <p dangerouslySetInnerHTML={{ __html: t('about.welcome_msg') }} />
                        <p>{t('about.digital_world_msg')}</p>
                        <p>{t('about.creation_msg')}</p>
                    </div>
                </div>
            </div>
        </section>

        {/* Section 2: Values */}
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-6 text-center">
                <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-12">{t('about.core_values')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { title: t('about.sophistication'), desc: t('about.sophistication_desc'), icon: "✨" },
                        { title: t('about.personalization'), desc: t('about.personalization_desc'), icon: "🎨" },
                        { title: t('about.dedication'), desc: t('about.dedication_desc'), icon: "❤️" }
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
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-6">{t('about.our_commitment')}</h2>
                    <p className="text-gray-600 leading-loose mb-6">
                        {t('about.quality_commitment')}
                    </p>
                    <ul className="space-y-3">
                        {[t('about.lifetime_warranty'), t('about.part_replacement'), t('about.premium_packaging')].map((item, i) => (
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
            <p className="font-heading text-2xl text-primary italic">{t('about.thanks_msg')}</p>
            <p className="text-sm text-gray-400 mt-4 font-bold tracking-widest uppercase">{t('about.team_signature')}</p>
        </div>
    </div>
    );
};
