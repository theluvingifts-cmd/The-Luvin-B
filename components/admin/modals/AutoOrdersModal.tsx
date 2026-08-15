import React, { useState, useEffect } from 'react';
import { CollectionTemplate, AutoOrderDailyLog, AutoOrderSummary } from '../../../types';
import { getAutoOrderLogsAndStats, processDailyAutoOrderIncrement } from '../../../services/templateService';
import { getDisplayOrderCount, formatOrderNumber } from '../../../utils/orderUtils';

interface AutoOrdersModalProps {
    isOpen: boolean;
    onClose: () => void;
    templates: CollectionTemplate[];
    onRefreshTemplates: () => void;
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AutoOrdersModal: React.FC<AutoOrdersModalProps> = ({
    isOpen,
    onClose,
    templates,
    onRefreshTemplates,
    showToast
}) => {
    const [activeTab, setActiveTab] = useState<'daily' | 'summary'>('daily');
    const [loading, setLoading] = useState(false);
    const [runningForce, setRunningForce] = useState(false);
    const [summary, setSummary] = useState<AutoOrderSummary>({ totalAutoAddedAllTime: 0, templateTotals: {} });
    const [dailyLogs, setDailyLogs] = useState<AutoOrderDailyLog[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getAutoOrderLogsAndStats();
            setSummary(res.summary || { totalAutoAddedAllTime: 0, templateTotals: {} });
            setDailyLogs(res.dailyLogs || []);
        } catch (error) {
            console.error("Error loading auto order stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleForceAdd = async () => {
        if (!confirm("Bạn có chắc chắn muốn chạy cộng ngay +4 ~ +6 lượt đặt hàng ngẫu nhiên cho hôm nay?")) return;
        setRunningForce(true);
        try {
            const res = await processDailyAutoOrderIncrement(true);
            if (res.processed) {
                if (showToast) showToast(`Thành công! Đã cộng thêm ${res.count} lượt đặt hàng ngẫu nhiên.`, 'success');
                onRefreshTemplates();
                await loadData();
            } else {
                if (showToast) showToast('Không thể cộng thêm lúc này. Vui lòng thử lại.', 'error');
            }
        } catch (error) {
            console.error("Force add error:", error);
            if (showToast) showToast('Đã xảy ra lỗi khi cộng lượt bán.', 'error');
        } finally {
            setRunningForce(false);
        }
    };

    // Calculate aggregated view combining all templates with auto-added counts
    const templateSummaryList = templates.map(t => {
        const autoData = summary.templateTotals?.[t.id];
        const autoAddedCount = autoData?.totalAdded || 0;
        const displayCount = getDisplayOrderCount(t);
        const realCount = Math.max(Number(t.realOrderCount || 0), Number(t.orders || 0));
        const virtualBaseCount = Math.max(0, displayCount - realCount - autoAddedCount);

        return {
            template: t,
            autoAddedCount,
            displayCount,
            realCount,
            virtualBaseCount,
            lastUpdated: autoData?.lastUpdated
        };
    }).sort((a, b) => b.autoAddedCount - a.autoAddedCount);

    const filteredSummaryList = templateSummaryList.filter(item => 
        item.template.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg shadow-md shadow-blue-200">
                            🤖
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                                Lịch Sử & Thống Kê Tăng Lượt Bán Tự Động
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Hệ thống tự động cộng từ 4 – 6 lượt đặt hàng ngẫu nhiên cho các mẫu thiết kế mỗi ngày.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors border border-gray-200"
                    >
                        ✕
                    </button>
                </div>

                {/* Stats Overview Banner */}
                <div className="px-4 sm:px-6 py-3 bg-gray-50/80 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-2xs flex items-center gap-3">
                        <span className="text-xl">📈</span>
                        <div>
                            <p className="text-[10px] text-gray-500 font-medium">Tổng đã tự động cộng</p>
                            <p className="text-sm font-bold text-blue-600">
                                +{formatOrderNumber(summary.totalAutoAddedAllTime || 0)} lượt
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-2xs flex items-center gap-3">
                        <span className="text-xl">🗓️</span>
                        <div>
                            <p className="text-[10px] text-gray-500 font-medium">Ngày cộng gần nhất</p>
                            <p className="text-sm font-semibold text-gray-800">
                                {summary.lastDate ? summary.lastDate.split('-').reverse().join('/') : 'Chưa có'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-2xs col-span-2 sm:col-span-1 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-gray-500 font-medium">Lịch chạy hàng ngày</p>
                            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Tự động kích hoạt
                            </p>
                        </div>
                        <button
                            onClick={handleForceAdd}
                            disabled={runningForce}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                            {runningForce ? 'Đang cộng...' : '⚡ Cộng ngay (+5)'}
                        </button>
                    </div>
                </div>

                {/* Tabs & Search Navigation */}
                <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => setActiveTab('daily')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'daily'
                                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            📅 Nhật Ký Theo Ngày ({dailyLogs.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'summary'
                                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            📊 Thống Kê Tổng Hợp ({templates.length} mẫu)
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {activeTab === 'summary' && (
                            <input
                                type="text"
                                placeholder="Tìm kiếm mẫu..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500 w-full sm:w-48"
                            />
                        )}
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                            title="Tải lại dữ liệu"
                        >
                            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Tab Contents */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 max-h-[55vh]">
                    {loading ? (
                        <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>Đang tải nhật ký tự động...</span>
                        </div>
                    ) : activeTab === 'daily' ? (
                        dailyLogs.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 text-sm">
                                Chưa có nhật ký cộng lượt bán tự động nào. Hệ thống sẽ tự động ghi lại mỗi khi kích hoạt.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {dailyLogs.map((log) => {
                                    const formattedDate = log.date ? log.date.split('-').reverse().join('/') : 'N/A';
                                    return (
                                        <div key={log.id || log.date} className="border border-gray-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
                                            {/* Log Day Header */}
                                            <div className="bg-gray-50/90 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    <span className="font-bold text-xs text-gray-800">
                                                        Ngày {formattedDate}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        ({new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                                                    </span>
                                                </div>
                                                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full text-xs font-bold">
                                                    +{log.totalAdded} lượt
                                                </span>
                                            </div>

                                            {/* Log Day Items */}
                                            <div className="p-3 divide-y divide-gray-50">
                                                {log.items && log.items.length > 0 ? (
                                                    log.items.map((item, idx) => (
                                                        <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
                                                                    {item.templateThumbnail ? (
                                                                        <img src={item.templateThumbnail} alt={item.templateName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">🖼️</span>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-semibold text-gray-900 line-clamp-1">
                                                                        {item.templateName || 'Mẫu thiết kế'}
                                                                    </p>
                                                                    <p className="text-[10px] text-gray-400">
                                                                        ID: {item.templateId}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-md border border-emerald-200/70 shrink-0">
                                                                +{item.count} lượt đặt
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-gray-400 py-1">Chi tiết không khả dụng</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        /* Summary Tab */
                        filteredSummaryList.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 text-sm">
                                Không tìm thấy mẫu nào phù hợp với từ khóa.
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-gray-200/80 rounded-xl">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                                            <th className="p-3">Mẫu Thiết Kế</th>
                                            <th className="p-3 text-center">Tăng Tự Động</th>
                                            <th className="p-3 text-center">Gốc / Đơn Thực</th>
                                            <th className="p-3 text-right">Tổng Hiển Thị</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {filteredSummaryList.map(({ template, autoAddedCount, displayCount, realCount, virtualBaseCount }) => (
                                            <tr key={template.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                                                            <img
                                                                src={template.imageUrl || ''}
                                                                alt={template.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 line-clamp-1">{template.name}</p>
                                                            <p className="text-[10px] text-gray-400">{template.category || 'Mẫu'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {autoAddedCount > 0 ? (
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-200">
                                                            +{formatOrderNumber(autoAddedCount)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 font-medium">0</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center text-gray-600 font-medium">
                                                    <span title="Gốc ảo">{formatOrderNumber(virtualBaseCount)}</span>
                                                    <span className="text-gray-300 mx-1">/</span>
                                                    <span className="text-emerald-600 font-bold" title="Đơn thực">{formatOrderNumber(realCount)}</span>
                                                </td>
                                                <td className="p-3 text-right font-bold text-gray-900 text-sm">
                                                    {formatOrderNumber(displayCount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
                    >
                        Đóng
                    </button>
                </div>

            </div>
        </div>
    );
};
