
import React, { useMemo, useState, useEffect } from 'react';
import { Order, LegoPart, FrameOption } from '../../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';
import { formatCurrency } from '../../utils/pricing';
import { getAdsCosts, saveAdsCost } from '../../services/configService';

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

// Valid statuses for Revenue Calculation
const VALID_REVENUE_STATUSES = [
    'Đã xác nhận', 
    'Ưu tiên xuất đơn', 
    'Đang đóng hàng', 
    'Chờ chuyển hàng', 
    'Gửi hàng đi', 
    'Đã giao hàng'
];

const TopItemsCard = ({ title, data }: { title: string, data: Record<string, number> }) => (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col h-full">
        <h4 className="font-bold text-sm text-gray-700 mb-3 uppercase tracking-wider">{title}</h4>
        {Object.keys(data).length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-grow max-h-40 custom-scrollbar">
                {Object.entries(data)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([name, count], idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-gray-400 font-mono w-4 flex-shrink-0">{idx + 1}.</span>
                                <span className="font-medium text-gray-700 truncate" title={name}>{name}</span>
                            </div>
                            <span className="font-bold w-6 text-right flex-shrink-0">{count}</span>
                        </div>
                    ))
                }
            </div>
        ) : (
            <div className="text-center py-4 text-gray-300 text-xs italic border border-dashed rounded">
                Chưa có dữ liệu
            </div>
        )}
    </div>
);

const BarChart: React.FC<{ data: { date: string; revenue: number; profit: number; ads: number }[] }> = ({ data }) => {
    // Find max value to scale chart
    const maxValue = Math.max(...data.map(d => Math.max(d.revenue, d.profit, d.ads)), 100000);

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-full flex flex-col">
            <h4 className="font-bold text-sm text-gray-700 mb-6 uppercase tracking-wider">Biểu đồ Tài chính</h4>
            <div className="flex-grow flex items-end justify-between gap-2 sm:gap-4 relative h-48">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                    <div className="border-t border-gray-100 w-full"></div>
                    <div className="border-t border-gray-100 w-full"></div>
                    <div className="border-t border-gray-100 w-full"></div>
                    <div className="border-t border-gray-100 w-full"></div>
                </div>

                {data.map((d, index) => {
                    const revenueHeight = (d.revenue / maxValue) * 100;
                    const profitHeight = (d.profit / maxValue) * 100;
                    const adsHeight = (d.ads / maxValue) * 100;

                    return (
                        <div key={index} className="flex flex-col items-center flex-1 h-full justify-end group relative z-10">
                            {/* Bars Container */}
                            <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                                {/* Revenue Bar */}
                                <div 
                                    className="w-2 sm:w-4 bg-blue-200 hover:bg-blue-300 rounded-t transition-all duration-500 relative"
                                    style={{ height: `${Math.max(revenueHeight, 1)}%` }}
                                >
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                        DT: {formatCurrency(d.revenue, 'admin')}
                                    </div>
                                </div>
                                {/* Ads Bar */}
                                <div 
                                    className="w-2 sm:w-4 bg-red-200 hover:bg-red-300 rounded-t transition-all duration-500 relative"
                                    style={{ height: `${Math.max(adsHeight, 1)}%` }}
                                >
                                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-red-800 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                        Ads: {formatCurrency(d.ads, 'admin')}
                                    </div>
                                </div>
                                {/* Profit Bar */}
                                <div 
                                    className="w-2 sm:w-4 bg-green-200 hover:bg-green-300 rounded-t transition-all duration-500 relative"
                                    style={{ height: `${Math.max(profitHeight, 1)}%` }}
                                >
                                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 bg-green-800 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                        LN: {formatCurrency(d.profit, 'admin')}
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-500 mt-2 font-medium truncate w-full text-center">{d.date}</span>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-center gap-4 mt-4 flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-blue-200 rounded"></div>
                    <span className="text-gray-600">Doanh thu</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-red-200 rounded"></div>
                    <span className="text-gray-600">Chi phí Ads</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-green-200 rounded"></div>
                    <span className="text-gray-600">Lợi nhuận ròng</span>
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
    
    // Daily Ads Costs State
    const [dailyAdsCosts, setDailyAdsCosts] = useState<Record<string, number>>({});
    
    // Inline Ads Management State
    const [adsDateInput, setAdsDateInput] = useState(new Date().toISOString().split('T')[0]);
    const [adsCostInput, setAdsCostInput] = useState<number>(0);
    const [isSavingAds, setIsSavingAds] = useState(false);

    // Calculate start and end dates based on filter
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

    // Fetch Ads Costs when date range changes
    useEffect(() => {
        const fetchCosts = async () => {
            if (startDate && endDate) {
                const costs = await getAdsCosts(startDate, endDate);
                setDailyAdsCosts(costs);
            }
        };
        fetchCosts();
    }, [startDate, endDate]);

    const handleSaveAdsInline = async () => {
        if (!adsDateInput) return;
        setIsSavingAds(true);
        const success = await saveAdsCost(adsDateInput, adsCostInput);
        if (success) {
            setDailyAdsCosts(prev => ({ ...prev, [adsDateInput]: adsCostInput }));
            // Reset input to 0 to indicate success visually, or keep it. Let's keep it.
            alert(`Đã lưu chi phí ngày ${new Date(adsDateInput).toLocaleDateString('vi-VN')}`);
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

    // Calculate profit for a single order
    const calculateOrderProfit = (order: Order): number => {
        let totalCost = 0;
        
        // Frame cost
        order.items.forEach(item => {
            const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
            if (frame) totalCost += (frame.costPrice || 0);

            // Parts cost
            item.characters.forEach(char => {
                if (char.hair) totalCost += (allKnownParts[char.hair.id]?.costPrice || 0);
                if (char.face) totalCost += (allKnownParts[char.face.id]?.costPrice || 0);
                if (char.shirt) totalCost += (allKnownParts[char.shirt.id]?.costPrice || 0);
                if (char.pants) totalCost += (allKnownParts[char.pants.id]?.costPrice || 0);
                if (char.hat) totalCost += (allKnownParts[char.hat.id]?.costPrice || 0);
            });

            // Draggable Items cost
            item.draggableItems.forEach(di => {
                if (di.type !== 'charm') {
                    totalCost += (allKnownParts[di.partId]?.costPrice || 0);
                }
            });
        });

        // Box cost (Approximate)
        if (order.addGiftBox) totalCost += 15000; 

        // Profit = Revenue (User paid) - Cost - Shipping (We pay shipping carrier, assumed equal to fee collected or absorbed)
        // Simplifying: Profit = (Order Total - Shipping Fee) - Product Cost
        return order.totalPrice - order.shipping.fee - totalCost; 
    };

    const analytics = useMemo(() => {
        const prevStart = new Date(startDate);
        const prevEnd = new Date(endDate);
        const duration = endDate.getTime() - startDate.getTime();
        prevStart.setTime(prevStart.getTime() - duration);
        prevEnd.setTime(prevEnd.getTime() - duration);

        const getOrdersInPeriod = (s: Date, e: Date) => orders.filter(o => {
            const time = o.createdAt || Number(o.id.slice(3)) || 0;
            return time >= s.getTime() && time <= e.getTime();
        });

        const allCurrentOrders = getOrdersInPeriod(startDate, endDate);
        const prevOrders = getOrdersInPeriod(prevStart, prevEnd);

        // Filter valid orders for revenue/profit
        const validOrders = allCurrentOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));
        const validPrevOrders = prevOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));

        const revenue = validOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const grossProfit = validOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
        
        // Sum ads costs for days in range
        let totalAdsCost = 0;
        const tempDate = new Date(startDate);
        while (tempDate <= endDate) {
            const dateStr = tempDate.toISOString().split('T')[0];
            totalAdsCost += (dailyAdsCosts[dateStr] || 0);
            tempDate.setDate(tempDate.getDate() + 1);
        }

        const netProfit = grossProfit - totalAdsCost;

        const prevRevenue = validPrevOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const revenueGrowth = prevRevenue === 0 ? (revenue > 0 ? 100 : 0) : ((revenue - prevRevenue) / prevRevenue) * 100;

        const orderCount = allCurrentOrders.length; // Count ALL orders placed, not just valid ones
        const prevOrderCount = prevOrders.length;
        const orderGrowth = prevOrderCount === 0 ? (orderCount > 0 ? 100 : 0) : ((orderCount - prevOrderCount) / prevOrderCount) * 100;

        // Inventory & Packers Stats (Use all orders to reflect activity)
        const inventory = { 
            frames: {} as Record<string, number>, 
            hair: {} as Record<string, number>,
            face: {} as Record<string, number>,
            shirt: {} as Record<string, number>,
            pants: {} as Record<string, number>,
            hat: {} as Record<string, number>,
            accessory: {} as Record<string, number>,
            pet: {} as Record<string, number>,
            totalCharms: 0,
        };
        const packerStats: Record<string, number> = {};

        allCurrentOrders.forEach(order => {
            if (order.packedBy) packerStats[order.packedBy] = (packerStats[order.packedBy] || 0) + 1;
            order.items.forEach(item => {
                const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
                const frameName = frame ? `Khung ${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                
                item.draggableItems.forEach(di => {
                    if (di.type === 'charm') {
                        inventory.totalCharms++;
                    } else {
                        const part = allKnownParts[di.partId];
                        if (part) {
                             if (di.type === 'accessory') inventory.accessory[part.name] = (inventory.accessory[part.name] || 0) + 1;
                             if (di.type === 'pet') inventory.pet[part.name] = (inventory.pet[part.name] || 0) + 1;
                             inventory.totalCharms++;
                        }
                    }
                });

                item.characters.forEach(char => {
                    if (char.hair) inventory.hair[char.hair.name] = (inventory.hair[char.hair.name] || 0) + 1;
                    if (char.face) inventory.face[char.face.name] = (inventory.face[char.face.name] || 0) + 1;
                    if (char.shirt) inventory.shirt[char.shirt.name] = (inventory.shirt[char.shirt.name] || 0) + 1;
                    if (char.pants) inventory.pants[char.pants.name] = (inventory.pants[char.pants.name] || 0) + 1;
                    if (char.hat) inventory.hat[char.hat.name] = (inventory.hat[char.hat.name] || 0) + 1;
                });
            });
        });

        const packers = Object.entries(packerStats).map(([email, count]) => ({ email, count })).sort((a, b) => b.count - a.count);

        // Chart Data (Daily)
        const chartData = [];
        // Loop from start to end
        const loopDate = new Date(startDate);
        while (loopDate <= endDate) {
            const dateStr = loopDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const displayDate = `${loopDate.getDate()}/${loopDate.getMonth() + 1}`;
            const dStart = getStartOfDay(loopDate);
            const dEnd = getEndOfDay(loopDate);
            
            const dailyOrders = orders.filter(o => {
                const time = o.createdAt || 0;
                return time >= dStart.getTime() && time <= dEnd.getTime();
            });

            // Only count revenue/profit for valid statuses
            const dailyValidOrders = dailyOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));

            const dailyRevenue = dailyValidOrders.reduce((sum, o) => sum + o.totalPrice, 0);
            const dailyGrossProfit = dailyValidOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
            const dailyAds = dailyAdsCosts[dateStr] || 0;
            const dailyNetProfit = dailyGrossProfit - dailyAds;
            
            chartData.push({
                date: displayDate,
                revenue: dailyRevenue,
                profit: dailyNetProfit,
                ads: dailyAds
            });

            loopDate.setDate(loopDate.getDate() + 1);
        }

        return { revenue, profit: netProfit, revenueGrowth, orderCount, orderGrowth, inventory, packers, chartData, totalAdsCost };
    }, [orders, startDate, endDate, allKnownParts, frames, dailyAdsCosts]); 

    return (
        <div className="space-y-8 animate-fade-in">
            {/* 1. Control Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">Tổng quan {dateLabel}</h2>
                <div className="flex flex-wrap gap-4 items-center justify-end">
                    <div className="flex bg-gray-100 p-1 rounded-md">
                        <button onClick={() => setFilterType('period')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'period' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Nhanh</button>
                        <button onClick={() => setFilterType('month')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tháng</button>
                        <button onClick={() => setFilterType('custom')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'custom' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tùy chỉnh</button>
                    </div>
                    {filterType === 'period' && (
                        <div className="flex gap-2">
                            {(['today', 'yesterday', '7days', '30days'] as const).map(t => (
                                <button key={t} onClick={() => setPeriod(t)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors border ${period === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{t === 'today' ? 'Hôm nay' : t === 'yesterday' ? 'Hôm qua' : t === '7days' ? '7 ngày' : '30 ngày'}</button>
                            ))}
                        </div>
                    )} 
                    {filterType === 'month' && (
                        <div className="flex gap-2 items-center">
                            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700 focus:ring-0 focus:border-gray-900 outline-none">{Array.from({length: 12}, (_, i) => (<option key={i} value={i}>Tháng {i + 1}</option>))}</select>
                            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700 focus:ring-0 focus:border-gray-900 outline-none"><option value={2024}>2024</option><option value={2025}>2025</option><option value={2026}>2026</option></select>
                        </div>
                    )}
                    {filterType === 'custom' && (
                        <div className="flex gap-2 items-center">
                            <input type="date" className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                            <span className="text-gray-400">-</span>
                            <input type="date" className="p-1.5 border border-gray-300 rounded-md text-xs font-bold text-gray-700" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doanh thu (Xác nhận)</p>
                        <span className={`text-xs font-bold flex items-center ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.revenueGrowth).toFixed(1)}%</span>
                    </div>
                    <p className="text-3xl font-light text-gray-900">{formatCurrency(analytics.revenue, 'admin')}</p>
                </div>
                
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lợi nhuận ròng</p>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                        <p className={`text-3xl font-light ${analytics.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(analytics.profit, 'admin')}</p>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400">Tổng phí Ads</p>
                            <p className="text-xs text-red-500 font-bold">-{formatCurrency(analytics.totalAdsCost, 'admin')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng Đơn hàng</p><span className={`text-xs font-bold flex items-center ${analytics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.orderGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.orderGrowth).toFixed(1)}%</span></div>
                    <p className="text-3xl font-light text-gray-900">{analytics.orderCount}</p>
                </div>
                 <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Hiệu suất kho</p>
                    <div className="flex items-end gap-2"><p className="text-3xl font-light text-gray-900">{analytics.packers.length > 0 ? analytics.packers[0].count : 0}</p><p className="text-sm font-medium text-gray-600 mb-1 truncate w-24">Top 1</p></div>
                </div>
            </div>

            {/* 3. Inline Ads Management & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <BarChart data={analytics.chartData} />
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-sm text-gray-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-lg">📢</span> Quản lý Chi phí Marketing
                    </h4>
                    
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <label className="block text-xs font-bold text-gray-500 mb-2">Cập nhật chi phí theo ngày</label>
                            <div className="flex flex-col gap-3">
                                <input 
                                    type="date" 
                                    className="w-full p-2 border rounded text-sm"
                                    value={adsDateInput}
                                    onChange={(e) => {
                                        setAdsDateInput(e.target.value);
                                        // Auto-fill cost if exists in data
                                        if (dailyAdsCosts[e.target.value]) {
                                            setAdsCostInput(dailyAdsCosts[e.target.value]);
                                        } else {
                                            setAdsCostInput(0);
                                        }
                                    }}
                                />
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Số tiền (VNĐ)"
                                        className="w-full p-2 border rounded text-sm font-semibold"
                                        value={adsCostInput}
                                        onChange={(e) => setAdsCostInput(Number(e.target.value))}
                                    />
                                    <button 
                                        onClick={handleSaveAdsInline}
                                        disabled={isSavingAds}
                                        className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-black disabled:opacity-50 whitespace-nowrap"
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Chi phí gần đây</p>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {Object.entries(dailyAdsCosts)
                                    .sort((a, b) => b[0].localeCompare(a[0])) // Sort date desc
                                    .slice(0, 5) // Show top 5
                                    .map(([date, cost]) => (
                                        <div key={date} className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                                            <span className="text-gray-600">{new Date(date).toLocaleDateString('vi-VN')}</span>
                                            <span className="font-mono font-medium">{formatCurrency(cost, 'admin')}</span>
                                        </div>
                                    ))}
                                {Object.keys(dailyAdsCosts).length === 0 && <p className="text-xs text-gray-400 italic">Chưa có dữ liệu.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Top Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <TopItemsCard title="Khung Ảnh" data={analytics.inventory.frames} />
                <TopItemsCard title="Tóc" data={analytics.inventory.hair} />
                <TopItemsCard title="Khuôn mặt" data={analytics.inventory.face} />
                <TopItemsCard title="Áo" data={analytics.inventory.shirt} />
                <TopItemsCard title="Quần" data={analytics.inventory.pants} />
                <TopItemsCard title="Mũ" data={analytics.inventory.hat} />
                <TopItemsCard title="Phụ kiện" data={analytics.inventory.accessory} />
                <TopItemsCard title="Thú cưng" data={analytics.inventory.pet} />
            </div>

            {/* 5. Packers */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                    <h3 className="font-bold text-gray-800 mb-4">Bảng Xếp Hạng Đóng Gói</h3>
                    {analytics.packers.length > 0 ? (
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 border-b">
                                    <tr>
                                        <th className="py-2 px-3 text-left font-semibold">Hạng</th>
                                        <th className="py-2 px-3 text-left font-semibold">Nhân viên</th>
                                        <th className="py-2 px-3 text-right font-semibold">Số đơn</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analytics.packers.map((packer, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="py-3 px-3">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-200 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 font-medium text-gray-800">{packer.email}</td>
                                            <td className="py-3 px-3 text-right font-bold">{packer.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                            Chưa có dữ liệu đóng gói trong khoảng thời gian này
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
