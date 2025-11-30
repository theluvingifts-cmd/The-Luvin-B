
import React, { useMemo, useState } from 'react';
import { Order, LegoPart, FrameOption } from '../../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';
import { formatCurrency } from '../../utils/pricing';

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

const RevenueChart: React.FC<{ data: { date: string; revenue: number; profit: number }[] }> = ({ data }) => {
    // Determine max value for scale (use revenue as it's generally higher than profit)
    const maxVal = Math.max(...data.map(d => d.revenue), 100000);

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm w-full">
            <h4 className="font-bold text-sm text-gray-700 mb-6 uppercase tracking-wider">Biểu đồ doanh thu & Lợi nhuận (7 ngày)</h4>
            <div className="flex items-end justify-between h-48 gap-2 sm:gap-4 w-full">
                {data.map((d, index) => {
                    const revHeight = Math.max(4, (d.revenue / maxVal) * 100);
                    const profHeight = Math.max(4, (d.profit / maxVal) * 100);
                    
                    return (
                        <div key={index} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                            {/* Bars Container */}
                            <div className="w-full flex justify-center items-end gap-1 h-full">
                                {/* Revenue Bar */}
                                <div 
                                    className="w-3 sm:w-6 bg-blue-100 hover:bg-blue-200 rounded-t transition-all relative flex flex-col justify-end overflow-hidden" 
                                    style={{ height: `${revHeight}%` }}
                                >
                                    <div className="absolute bottom-0 left-0 w-full bg-blue-500 opacity-20 h-1"></div>
                                </div>
                                {/* Profit Bar */}
                                <div 
                                    className="w-3 sm:w-6 bg-green-100 hover:bg-green-200 rounded-t transition-all relative flex flex-col justify-end overflow-hidden" 
                                    style={{ height: `${profHeight}%` }}
                                >
                                    <div className="absolute bottom-0 left-0 w-full bg-green-500 opacity-20 h-1"></div>
                                </div>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] py-2 px-3 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                <div className="font-bold text-blue-300">Thu: {formatCurrency(d.revenue)}</div>
                                <div className="font-bold text-green-300">Lãi: {formatCurrency(d.profit)}</div>
                            </div>
                            
                            <span className="text-[10px] text-gray-500 mt-2 font-medium">{d.date}</span>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-200 rounded-sm"></div>
                    <span className="text-xs text-gray-600">Doanh thu</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-200 rounded-sm"></div>
                    <span className="text-xs text-gray-600">Lợi nhuận</span>
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

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);

    // Helper to calculate cost of a single order
    const calculateOrderCost = (order: Order) => {
        let totalCost = 0;
        
        // Shipping Cost (Actual cost to shop, approximate as equal to fee charged or 0 if free ship? 
        // For simplicity, let's assume if free ship, shop pays ~25k. If customer pays, it cancels out.
        // Better: Assume 'fee' is what customer pays. We need a 'shippingCost' field in future. 
        // For now, let's just count product costs.
        // Gift box cost
        if (order.addGiftBox) totalCost += 15000; // Estimated cost for box

        order.items.forEach(item => {
            // Frame Cost
            const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
            if (frame && frame.costPrice) totalCost += frame.costPrice;

            // Characters Cost
            item.characters.forEach(char => {
                // Main parts cost
                if (char.hair && allKnownParts[char.hair.id]?.costPrice) totalCost += allKnownParts[char.hair.id].costPrice!;
                if (char.face && allKnownParts[char.face.id]?.costPrice) totalCost += allKnownParts[char.face.id].costPrice!;
                if (char.shirt && allKnownParts[char.shirt.id]?.costPrice) totalCost += allKnownParts[char.shirt.id].costPrice!;
                if (char.pants && allKnownParts[char.pants.id]?.costPrice) totalCost += allKnownParts[char.pants.id].costPrice!;
                if (char.hat && allKnownParts[char.hat.id]?.costPrice) totalCost += allKnownParts[char.hat.id].costPrice!;

                // Colors Cost (If defined)
                if (char.selectedShirtColor?.costPrice) totalCost += char.selectedShirtColor.costPrice;
                if (char.selectedPantsColor?.costPrice) totalCost += char.selectedPantsColor.costPrice;
                if (char.selectedHairColor?.costPrice) totalCost += char.selectedHairColor.costPrice;
            });

            // Draggable Items Cost
            item.draggableItems.forEach(di => {
                if (di.type !== 'charm') {
                    const part = allKnownParts[di.partId];
                    if (part && part.costPrice) totalCost += part.costPrice;
                    if (di.selectedColor?.costPrice) totalCost += di.selectedColor.costPrice;
                }
            });
        });

        return totalCost;
    };

    const analytics = useMemo(() => {
        let start: Date, end: Date, prevStart: Date, prevEnd: Date;
        let dateLabel = '';

        if (filterType === 'month') {
            dateLabel = `Tháng ${month + 1}/${year}`;
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23, 59, 59, 999);
            prevStart = new Date(year, month - 1, 1);
            prevEnd = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (filterType === 'custom') {
            dateLabel = 'Tùy chỉnh';
            start = customStartDate ? new Date(customStartDate) : new Date(0);
            end = customEndDate ? new Date(customEndDate) : new Date();
            end.setHours(23, 59, 59, 999);
            const duration = end.getTime() - start.getTime();
            prevEnd = new Date(start.getTime() - 1);
            prevStart = new Date(prevEnd.getTime() - duration);
        } else {
            const now = new Date();
            start = getStartOfDay(now);
            end = getEndOfDay(now);
            prevStart = getStartOfDay(now);
            prevEnd = getEndOfDay(now);

            if (period === 'yesterday') {
                start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1);
                prevStart.setDate(prevStart.getDate() - 2); prevEnd.setDate(prevEnd.getDate() - 2);
                dateLabel = 'Hôm qua';
            } else if (period === '7days') {
                start.setDate(start.getDate() - 7);
                prevStart.setDate(prevStart.getDate() - 14); prevEnd.setDate(prevEnd.getDate() - 7);
                dateLabel = '7 ngày qua';
            } else if (period === '30days') {
                start.setDate(start.getDate() - 30);
                prevStart.setDate(prevStart.getDate() - 60); prevEnd.setDate(prevEnd.getDate() - 30);
                dateLabel = '30 ngày qua';
            } else {
                prevStart.setDate(prevStart.getDate() - 1); prevEnd.setDate(prevEnd.getDate() - 1);
                dateLabel = 'Hôm nay';
            }
        }

        const getOrdersInPeriod = (s: Date, e: Date) => orders.filter(o => {
            const time = o.createdAt || Number(o.id.slice(3)) || 0;
            // Exclude cancelled/deleted orders from analytics
            return time >= s.getTime() && time <= e.getTime() && o.status !== 'Huỷ đơn' && o.status !== 'Xoá đơn';
        });

        const currentOrders = getOrdersInPeriod(start, end);
        const prevOrders = getOrdersInPeriod(prevStart, prevEnd);

        const calculateTotalStats = (orderList: Order[]) => {
            return orderList.reduce((acc, o) => {
                const cost = calculateOrderCost(o);
                const revenue = o.totalPrice;
                return {
                    revenue: acc.revenue + revenue,
                    cost: acc.cost + cost,
                    profit: acc.profit + (revenue - cost)
                };
            }, { revenue: 0, cost: 0, profit: 0 });
        };

        const currentStats = calculateTotalStats(currentOrders);
        const prevStats = calculateTotalStats(prevOrders);

        const revenueGrowth = prevStats.revenue === 0 ? (currentStats.revenue > 0 ? 100 : 0) : ((currentStats.revenue - prevStats.revenue) / prevStats.revenue) * 100;
        const orderCount = currentOrders.length;
        const prevOrderCount = prevOrders.length;
        const orderGrowth = prevOrderCount === 0 ? (orderCount > 0 ? 100 : 0) : ((orderCount - prevOrderCount) / prevOrderCount) * 100;

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

        currentOrders.forEach(order => {
            if (order.packedBy) packerStats[order.packedBy] = (packerStats[order.packedBy] || 0) + 1;
            order.items.forEach(item => {
                const frame = frames.find(f => f.id === item.frameId);
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

        // Chart Data (Last 7 days relative to 'end' date)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(end);
            d.setDate(d.getDate() - i);
            const dStart = getStartOfDay(d);
            const dEnd = getEndOfDay(d);
            
            const dailyOrders = orders.filter(o => {
                const time = o.createdAt || 0;
                return time >= dStart.getTime() && time <= dEnd.getTime() && o.status !== 'Huỷ đơn' && o.status !== 'Xoá đơn';
            });

            const dailyStats = calculateTotalStats(dailyOrders);
            
            chartData.push({
                date: `${d.getDate()}/${d.getMonth() + 1}`,
                revenue: dailyStats.revenue,
                profit: dailyStats.profit
            });
        }

        return { 
            revenue: currentStats.revenue, 
            profit: currentStats.profit,
            revenueGrowth, 
            orderCount, 
            orderGrowth, 
            inventory, 
            packers, 
            dateLabel, 
            chartData 
        };
    }, [orders, filterType, period, month, year, customStartDate, customEndDate, allKnownParts, frames]); 

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">Tổng quan {analytics.dateLabel}</h2>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doanh thu</p><span className={`text-xs font-bold flex items-center ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.revenueGrowth).toFixed(1)}%</span></div>
                    <p className="text-3xl font-light text-gray-900">{formatCurrency(analytics.revenue, 'payment')}</p>
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-medium">Lợi nhuận ước tính:</span>
                        <span className="text-sm font-bold text-green-600">{formatCurrency(analytics.profit, 'payment')}</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn hàng</p><span className={`text-xs font-bold flex items-center ${analytics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.orderGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.orderGrowth).toFixed(1)}%</span></div>
                    <p className="text-3xl font-light text-gray-900">{analytics.orderCount}</p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tổng Charm</p>
                    <p className="text-3xl font-light text-gray-900">{analytics.inventory.totalCharms}</p>
                </div>
                 <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Hiệu suất kho</p>
                    <div className="flex items-end gap-2"><p className="text-3xl font-light text-gray-900">{analytics.packers.length > 0 ? analytics.packers[0].count : 0}</p><p className="text-sm font-medium text-gray-600 mb-1 truncate w-24">Top 1</p></div>
                </div>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 gap-6">
                <RevenueChart data={analytics.chartData} />
            </div>

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