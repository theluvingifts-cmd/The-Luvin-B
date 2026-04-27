
import React from 'react';
import { StoreConfig } from '../services/configService';
import { useLanguage } from '../src/contexts/LanguageContext';

export const WarrantyPage: React.FC<{ config?: StoreConfig }> = ({ config }) => {
    const { t } = useLanguage();
    return (
    <div className="min-h-screen bg-gray-50 pb-20 font-body text-site-text transition-colors duration-300">
        {/* Modern Header */}
        <div className="bg-white border-b border-gray-100 py-16">
            <div className="container mx-auto px-6 text-center">
                <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-4">{t('warranty.warranty_title')}</h1>
                <p className="text-gray-500 max-w-2xl mx-auto">
                    {t('warranty.warranty_subtitle')}
                </p>
            </div>
        </div>

        <div className="container mx-auto px-6 -mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Feature Cards */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🛡️</div>
                    <h3 className="font-bold text-gray-900 mb-2">{t('warranty.lifetime_warranty_title')}</h3>
                    <p className="text-sm text-gray-500">{t('warranty.lifetime_warranty_desc')}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔄</div>
                    <h3 className="font-bold text-gray-900 mb-2">{t('warranty.return_7days_title')}</h3>
                    <p className="text-sm text-gray-500">{t('warranty.return_7days_desc')}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔧</div>
                    <h3 className="font-bold text-gray-900 mb-2">{t('warranty.support_247_title')}</h3>
                    <p className="text-sm text-gray-500">{t('warranty.support_247_desc')}</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto mt-12 space-y-8">
                {/* Policy Section 1 */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-heading font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm">1</span>
                        {t('warranty.return_policy_title')}
                    </h2>
                    <div className="prose prose-sm text-gray-600 max-w-none">
                        <p className="mb-4">{t('warranty.return_policy_intro')}</p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none pl-0">
                            <li className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
                                <span className="text-green-500 font-bold">✓</span>
                                <span dangerouslySetInnerHTML={{ __html: t('warranty.return_policy_item1') }} />
                            </li>
                            <li className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
                                <span className="text-green-500 font-bold">✓</span>
                                <span>{t('warranty.return_policy_item2')}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Policy Section 2 */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-heading font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm">2</span>
                        {t('warranty.warranty_policy_title')}
                    </h2>
                    <div className="space-y-4">
                        <div className="border-l-4 border-primary pl-4 py-1">
                            <h4 className="font-bold text-gray-900">{t('warranty.permanent_glue_warranty')}</h4>
                            <p className="text-sm text-gray-600 mt-1">{t('warranty.permanent_glue_desc')}</p>
                        </div>
                        <div className="border-l-4 border-blue-400 pl-4 py-1">
                            <h4 className="font-bold text-gray-900">{t('warranty.part_support_title')}</h4>
                            <p className="text-sm text-gray-600 mt-1">{t('warranty.part_support_desc')}</p>
                        </div>
                    </div>
                </div>

                {/* Contact CTA */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-center text-white shadow-lg">
                    <h3 className="text-2xl font-bold mb-2">{t('warranty.need_help')}</h3>
                    <p className="text-gray-300 mb-6 text-sm">{t('warranty.need_help_desc')}</p>
                    <div className="flex justify-center flex-wrap gap-4">
                        <a href={`https://zalo.me/${config?.hotline?.replace(/\s/g, '') || '0968432043'}`} target="_blank" rel="noopener noreferrer" className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2">
                            {t('warranty.chat_zalo')} 1
                        </a>
                        <a href={`https://zalo.me/${config?.hotline2?.replace(/\s/g, '') || '0345126019'}`} target="_blank" rel="noopener noreferrer" className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2">
                            {t('warranty.chat_zalo')} 2
                        </a>
                        <a href="https://m.me/theluvin.vn" target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
                            {t('warranty.messenger')}
                        </a>
                    </div>
                    <p className="mt-4 text-xs text-gray-400">{t('warranty.hotline')}: {config?.hotline || '0968 432 043'} - {config?.hotline2 || '0345 126 019'}</p>
                </div>
            </div>
        </div>
    </div>
    );
};
