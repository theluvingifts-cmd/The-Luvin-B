
import React, { useMemo, useState, useEffect } from 'react';
import { Order, LegoPart, FrameOption } from '../../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';
import { formatCurrency } from '../../utils/pricing';
import { getAdsCosts, saveAdsCost } from '../../services/configService';
import { getFunnelStatsRange } from '../../services/analyticsService';

interface AdminDashboardProps {
    orders: Order[];
    products: LegoPart[];
    frames: FrameOption[];
}

const getStartOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

const getEndOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
};

const VALID_REVENUE_STATUSES = [
    'Đã xác nhận', 
    'Ưu tiên xuất đơn', 
    'Đang đóng hàng', 
    'Chờ chuyển hàng', 
    'Gửi hàng đi', 
    'Đã giao hàng'
];

const ConversionFunnel = ({ stats, isLoading }: { stats: any, isLoading: boolean }) => {
    const steps = [
        { key: 'builder_start', label: 'Bắt đầu thiết kế', icon: '🎨' },
        { key: 'step2_info', label: 'Nhập thông tin', icon: '📝' },
        { key: 'step3_parts', label: 'Phối nhân vật', icon: '🧍' },
        { key: 'step4_summary', label: 'Xem tổng kết', icon: '📋' },
        { key: 'add_to_cart', label: 'Thêm giỏ hàng', icon: '🛒' },
        { key: 'checkout_start', label: 'Vào thanh toán', icon: '💳' },
        { key: 'order_complete', label: 'Đặt hàng thành công', icon: '🎉' },
    ];

    const maxVal = stats?.builder_start_count || 0;

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full relative">
            {isLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            )}
            <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-6 flex justify-between items-center">
                <span>📊 Phễu chuyển đổi</span>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Theo bộ lọc ngày</span>
            </h4>
            <div className="space-y-4">
                {steps.map((step, idx) => {
                    const val = stats?.[`${step.key}_count`] || 0;
                    const percent = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
                    const prevVal = idx > 0 ? stats?.[`${steps[idx-1].key}_count`] || 0 : maxVal;
                    const dropRate = idx > 0 && prevVal > 0 ? Math.round(((prevVal - val) / prevVal) * 100) : 0;

                    return (
                        <div key={step.key} className="group">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-bold text-gray-600 flex items-center gap-2">
                                    <span className="w-5 h-5 flex items-center justify-center bg-gray-100 rounded text-[10px]">{step.icon}</span>
                                    {step.label}
                                </span>
                                <div className="text-right">
                                    <span className="text-xs font-black text-gray-900">{val}</span>
                                    <span className="text-[10px] text-gray-400 ml-1">({percent}%)</span>
                                </div>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex relative">
                                <div 
                                    className="h-full bg-blue-600 transition-all duration-1000"
                                    style={{ width: `${percent}%` }}
                                ></div>
                                {idx > 0 && dropRate > 5 && (
                                    <div className="absolute right-0 top-0 h-full bg-red-100/50 flex items-center px-1">
                                        <span className="text-[8px] font-black text-red-600">-{dropRate}%</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="mt-6 text-[10px] text-gray-400 italic">
                * Dữ liệu khớp chính xác với khoảng thời gian bạn chọn phía trên.
            </p>
        </div>
    );
};

const FullItemsCard = ({ title, data }: { title: string, data: Record<string, number> }) => (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col h-full hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">{title}</h4>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Tổng: {Object.keys(data).length}</span>
        </div>
        {Object.keys(data).length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-grow max-h-80 custom-scrollbar pr-1">
                {Object.entries(data)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count], idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs group hover:bg-gray-50 p-1 rounded">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`font-mono w-5 flex-shrink-0 text-center text-[10px] rounded ${idx < 3 ? 'bg-yellow-100 text-yellow-700 font-bold' : 'text-gray-400'}`}>{idx + 1}</span>
                                <span className="font-medium text-gray-700 truncate group-hover:text-blue-600 transition-colors" title={name}>{name}</span>
                            </div>
                            <span className="font-bold w-8 text-right flex-shrink-0 bg-gray-100 px-1 rounded text-gray-800">{count}</span>
                        </div>
                    ))
                }
            </div>
        ) : (
            <div className="text-center py-4 text-gray-300 text-xs italic border border-dashed rounded bg-gray-50">
                Chưa có dữ liệu
            </div>
        )}
    </div>
);

const BarChart: React.FC<{ data: { date: string; revenue: number; profit: number; ads: number }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => Math.max(d.revenue, d.profit, d.ads)), 100000);
    const minWidth = data.length * 50; 

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider">Biểu đồ Tài chính</h4>
                <div className="flex gap-4 text-[10px] font-medium">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-400 rounded-sm"></div>Doanh thu</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-green-400 rounded-sm"></div>Lợi nhuận</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-sm"></div>Ads</div>
                </div>
            </div>
            
            <div className="flex-grow relative overflow-hidden">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 z-0">
                    {[1,2,3,4,5].map(i => <div key={i} className="border-t border-gray-400 w-full border-dashed"></div>)}
                </div>

                <div className="overflow-x-auto h-full pb-2 custom-scrollbar">
                    <div className="h-full flex items-end justify-between gap-2 px-2" style={{ minWidth: `${minWidth}px` }}>
                        {data.map((d, index) => {
                            const revenueHeight = (d.revenue / maxValue) * 100;
                            const profitHeight = (d.profit / maxValue) * 100;
                            const adsHeight = (d.ads / maxValue) * 100;

                            return (
                                <div key={index} className="flex flex-col items-center flex-1 h-full justify-end group relative z-10 min-w-[20px]">
                                    <div className="w-full flex items-end justify-center gap-[2px] h-[85%] border-b border-gray-200 pb-1">
                                        <div 
                                            className="w-1.5 sm:w-2.5 bg-blue-400 hover:bg-blue-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(revenueHeight, 1)}%` }}
                                        ></div>
                                        <div 
                                            className="w-1.5 sm:w-2.5 bg-green-400 hover:bg-green-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(profitHeight, 1)}%` }}
                                        ></div>
                                        <div 
                                            className="w-1.5 sm:w-2.5 bg-red-400 hover:bg-red-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(adsHeight, 1)}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-[9px] text-gray-500 mt-2 font-medium truncate w-full text-center">{d.date}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ orders, products, frames }) => {
    const [filterType, setFilterType] = useState<'period' | 'month' | 'custom'>('period');
    const [period, setPeriod] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');
    const [month, setMonth] = useState<number>(new Date().getMonth()); 
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    const [dailyAdsCosts, setDailyAdsCosts] = useState<Record<string, number>>({});
    const [adsDateInput, setAdsDateInput] = useState(new Date().toISOString().split('T')[0]);
    const [adsCostInput, setAdsCostInput] = useState<number>(0);
    const [isSavingAds, setIsSavingAds] = useState(false);
    
    const [funnelStats, setFunnelStats] = useState<any>(null);
    const [isFunnelLoading, setIsFunnelLoading] = useState(false);

    const { startDate, endDate, dateLabel } = useMemo(() => {
        let start: Date, end: Date;
        let label = '';

        if (filterType === 'month') {
            label = `Tháng ${month + 1}/${year}`;
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        } else if (filterType === 'custom') {
            label = 'Tùy chỉnh';
            start = customStartDate ? new Date(customStartDate) : new Date(0);
            end = customEndDate ? new Date(customEndDate) : new Date();
            end.setHours(23, 59, 59, 999);
        } else {
            const now = new Date();
            start = getStartOfDay(now);
            end = getEndOfDay(now);

            if (period === 'yesterday') {
                start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1);
                label = 'Hôm qua';
            } else if (period === '7days') {
                start.setDate(start.getDate() - 7);
                label = '7 ngày qua';
            } else if (period === '30days') {
                start.setDate(start.getDate() - 30);
                label = '30 ngày qua';
            } else {
                label = 'Hôm nay';
            }
        }
        return { startDate: start, endDate: end, dateLabel: label };
    }, [filterType, period, month, year, customStartDate, customEndDate]);

    useEffect(() => {
        const fetchData = async () => {
            if (startDate && endDate) {
                setIsFunnelLoading(true);
                const [costs, funnel] = await Promise.all([
                    getAdsCosts(startDate, endDate),
                    getFunnelStatsRange(startDate, endDate)
                ]);
                setDailyAdsCosts(costs);
                setFunnelStats(funnel);
                setIsFunnelLoading(false);
            }
        };
        fetchData();
    }, [startDate, endDate]);

    const handleSaveAdsInline = async () => {
        if (!adsDateInput) return;
        setIsSavingAds(true);
        const success = await saveAdsCost(adsDateInput, adsCostInput);
        if (success) {
            setDailyAdsCosts(prev => ({ ...prev, [adsDateInput]: adsCostInput }));
            alert("Đã lưu!");
        } else {
            alert('Lỗi lưu chi phí');
        }
        setIsSavingAds(false);
    };

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);

    const calculateOrderProfit = (order: Order): number => {
        let totalCost = 0;
        order.items.forEach(item => {
            const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
            if (frame) totalCost += (frame.costPrice || 0);
            item.characters.forEach(char => {
                if (char.hair) totalCost += (allKnownParts[char.hair.id]?.costPrice || 0);
                if (char.face) totalCost += (allKnownParts[char.face.id]?.costPrice || 0);
                if (char.shirt) totalCost += (allKnownParts[char.shirt.id]?.costPrice || 0);
                if (char.pants) totalCost += (allKnownParts[char.pants.id]?.costPrice || 0);
                if (char.hat) totalCost += (allKnownParts[char.hat.id]?.costPrice || 0);
            });
            item.draggableItems.forEach(di => {
                if (di.type !== 'charm') {
                    totalCost += (allKnownParts[di.partId]?.costPrice || 0);
                }
            });
        });
        if (order.addGiftBox) totalCost += 15000; 
        return order.totalPrice - order.shipping.fee - totalCost; 
    };

    const analytics = useMemo(() => {
        const getOrdersInPeriod = (s: Date, e: Date) => orders.filter(o => {
            const time = o.createdAt || 0;
            return time >= s.getTime() && time <= e.getTime();
        });

        const allCurrentOrders = getOrdersInPeriod(startDate, endDate);
        const validOrders = allCurrentOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));

        const revenue = validOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const grossProfit = validOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
        
        let totalAdsCost = 0;
        const tempDate = new Date(startDate);
        while (tempDate <= endDate) {
            const dateStr = tempDate.toISOString().split('T')[0];
            totalAdsCost += (dailyAdsCosts[dateStr] || 0);
            tempDate.setDate(tempDate.getDate() + 1);
        }

        const netProfit = grossProfit - totalAdsCost;
        const orderCount = allCurrentOrders.length;

        const inventory = { 
            frames: {} as Record<string, number>, 
            accessory: {} as Record<string, number>,
            pet: {} as Record<string, number>,
            hair: {} as Record<string, number>,
            shirt: {} as Record<string, number>,
        };

        allCurrentOrders.forEach(order => {
            order.items.forEach(item => {
                const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
                const frameName = frame ? `Khung ${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                item.draggableItems.forEach(di => {
                    if (di.type !== 'charm') {
                        const part = allKnownParts[di.partId];
                        if (part) {
                             const key = di.selectedColor ? `${part.name} (${di.selectedColor.name})` : part.name;
                             if (di.type === 'accessory') inventory.accessory[key] = (inventory.accessory[key] || 0) + 1;
                             if (di.type === 'pet') inventory.pet[key] = (inventory.pet[key] || 0) + 1;
                        }
                    }
                });
                item.characters.forEach(char => {
                    if (char.hair) inventory.hair[char.hair.name] = (inventory.hair[char.hair.name] || 0) + 1;
                    if (char.shirt) inventory.shirt[char.shirt.name] = (inventory.shirt[char.shirt.name] || 0) + 1;
                });
            });
        });

        const chartData = [];
        const loopDate = new Date(startDate);
        while (loopDate <= endDate) {
            const dateStr = loopDate.toISOString().split('T')[0];
            const displayDate = `${loopDate.getDate()}/${loopDate.getMonth() + 1}`;
            const dStart = getStartOfDay(loopDate);
            const dEnd = getEndOfDay(loopDate);
            const dailyValidOrders = orders.filter(o => {
                const time = o.createdAt || 0;
                return time >= dStart.getTime() && time <= dEnd.getTime() && VALID_REVENUE_STATUSES.includes(o.status);
            });
            const dailyRevenue = dailyValidOrders.reduce((sum, o) => sum + o.totalPrice, 0);
            const dailyGrossProfit = dailyValidOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
            const dailyAds = dailyAdsCosts[dateStr] || 0;
            chartData.push({ date: displayDate, revenue: dailyRevenue, profit: dailyGrossProfit - dailyAds, ads: dailyAds });
            loopDate.setDate(loopDate.getDate() + 1);
        }

        return { revenue, profit: netProfit, orderCount, inventory, chartData, totalAdsCost };
    }, [orders, startDate, endDate, allKnownParts, frames, dailyAdsCosts]); 

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4 sticky top-14 sm:top-16 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">Bộ lọc thời gian</h2>
                        <p className="text-xs text-gray-500 font-medium">{dateLabel}</p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center w-full sm:w-auto">
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                        <button onClick={() => setFilterType('period')} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'period' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Ngày</button>
                        <button onClick={() => setFilterType('month')} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Tháng</button>
                        <button onClick={() => setFilterType('custom')} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'custom' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Tùy chọn</button>
                    </div>
                    
                    {filterType === 'period' && (
                        <select value={period} onChange={(e: any) => setPeriod(e.target.value)} className="w-full sm:w-auto p-1.5 text-xs border border-gray-200 rounded-lg bg-white font-bold outline-none">
                            <option value="today">Hôm nay</option>
                            <option value="yesterday">Hôm qua</option>
                            <option value="7days">7 ngày qua</option>
                            <option value="30days">30 ngày qua</option>
                        </select>
                    )}

                    {filterType === 'custom' && (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="p-1.5 border rounded text-[10px] w-full" />
                            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="p-1.5 border rounded text-[10px] w-full" />
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-1">Doanh thu</p>
                    <p className="text-xl sm:text-2xl font-black text-gray-900">{formatCurrency(analytics.revenue, 'admin')}</p>
                </div>
                
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-wider mb-1">Lợi nhuận ròng</p>
                    <p className="text-xl sm:text-2xl font-black text-gray-900">{formatCurrency(analytics.profit, 'admin')}</p>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Đơn hàng</p>
                    <p className="text-xl sm:text-2xl font-black text-gray-900">{analytics.orderCount}</p>
                </div>
                 
                 <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-purple-500 uppercase tracking-wider mb-1">AOV (Trung bình đơn)</p>
                    <p className="text-lg sm:text-xl font-black text-gray-900">{analytics.orderCount > 0 ? formatCurrency(analytics.revenue / analytics.orderCount, 'admin') : '0đ'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Charts Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-80">
                        <BarChart data={analytics.chartData} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <ConversionFunnel stats={funnelStats} isLoading={isFunnelLoading} />

                         <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-sm text-gray-800 mb-1 flex items-center gap-2">
                                    <span>💰</span> Chi phí Marketing
                                </h4>
                                <p className="text-[10px] text-gray-500 mb-4">Cập nhật chi phí Ads bằng tay theo ngày</p>
                                
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Ngày</label>
                                        <input 
                                            type="date" 
                                            className="bg-gray-50 border border-gray-200 rounded-lg text-xs p-2.5 font-bold"
                                            value={adsDateInput}
                                            onChange={(e) => {
                                                setAdsDateInput(e.target.value);
                                                if (dailyAdsCosts[e.target.value]) setAdsCostInput(dailyAdsCosts[e.target.value]);
                                                else setAdsCostInput(0);
                                            }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Số tiền (VNĐ)</label>
                                        <input 
                                            type="number" 
                                            className="bg-gray-50 border border-gray-200 rounded-lg text-sm p-2.5 font-black text-blue-600"
                                            value={adsCostInput}
                                            onChange={(e) => setAdsCostInput(Number(e.target.value))}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleSaveAdsInline}
                                        disabled={isSavingAds}
                                        className="w-full bg-gray-900 text-white p-3 rounded-xl hover:bg-black disabled:opacity-50 transition-all font-black text-xs shadow-lg active:scale-95"
                                    >
                                        {isSavingAds ? "ĐANG LƯU..." : "LƯU CHI PHÍ NGÀY NÀY"}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-400 uppercase">Tổng chi phí trong kỳ:</span>
                                <span className="text-lg font-black text-red-600">{formatCurrency(analytics.totalAdsCost, 'admin')}</span>
                            </div>
                         </div>
                    </div>
                </div>

                {/* Best Sellers Area */}
                <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 text-sm border-b pb-2 uppercase tracking-tighter">Sản phẩm bán chạy nhất</h3>
                    <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 max-h-[calc(100vh-250px)] custom-scrollbar">
                        <FullItemsCard title="Loại Khung" data={analytics.inventory.frames} />
                        <FullItemsCard title="Phụ Kiện" data={analytics.inventory.accessory} />
                        <FullItemsCard title="Thú Cưng" data={analytics.inventory.pet} />
                        <FullItemsCard title="Kiểu Tóc" data={analytics.inventory.hair} />
                        <FullItemsCard title="Áo Lego" data={analytics.inventory.shirt} />
                    </div>
                </div>
            </div>
        </div>
    );
};
