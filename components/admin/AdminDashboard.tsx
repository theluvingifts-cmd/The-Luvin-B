
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

// --- CHART UTILS ---
const CHART_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#64748B'
];

const DonutChart = ({ data }: { data: { label: string; value: number }[] }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    
    if (total === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                <div className="w-24 h-24 rounded-full border-4 border-gray-100 mb-2"></div>
                <span className="text-xs">Chưa có dữ liệu</span>
            </div>
        );
    }

    let currentAngle = 0;
    const gradientParts = data.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const start = currentAngle;
        const end = currentAngle + (percentage * 3.6); // 3.6 degrees per percent
        currentAngle = end;
        return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}deg ${end}deg`;
    });

    const gradientStyle = {
        background: `conic-gradient(${gradientParts.join(', ')})`,
    };

    return (
        <div className="flex gap-6 items-center">
            <div className="relative w-32 h-32 flex-shrink-0">
                <div className="w-full h-full rounded-full" style={gradientStyle}></div>
                {/* Hole to make it a donut */}
                <div className="absolute inset-0 m-auto w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-gray-800">{total}</span>
                    <span className="text-[10px] text-gray-500 uppercase">Tổng</span>
                </div>
            </div>
            <div className="flex-grow space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                {data.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                            <span 
                                className="w-3 h-3 rounded-sm flex-shrink-0" 
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            ></span>
                            <span className="text-gray-700 truncate max-w-[120px]" title={item.label}>
                                {item.label}
                            </span>
                        </div>
                        <span className="font-bold text-gray-900">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ChartCard = ({ title, data }: { title: string, data: Record<string, number> }) => {
    // Transform hash map to array for chart, sort by value desc
    const chartData = Object.entries(data)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 h-full flex flex-col">
            <h4 className="font-bold text-sm text-gray-800 mb-4 uppercase tracking-wider border-b pb-2">{title}</h4>
            <div className="flex-grow flex items-center justify-center">
                <DonutChart data={chartData} />
            </div>
        </div>
    );
};

const RevenueChart: React.FC<{ data: { date: string; revenue: number }[] }> = ({ data }) => {
    const maxRevenue = Math.max(...data.map(d => d.revenue), 100000); 

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="font-bold text-sm text-gray-700 mb-6 uppercase tracking-wider">Biểu đồ doanh thu (7 ngày)</h4>
            <div className="flex items-end justify-between h-40 gap-2 sm:gap-4">
                {data.map((d, index) => {
                    const heightPercent = (d.revenue / maxRevenue) * 100;
                    return (
                        <div key={index} className="flex flex-col items-center flex-1 group relative">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {formatCurrency(d.revenue, 'admin')}
                            </div>
                            
                            <div 
                                className="w-full bg-blue-100 hover:bg-blue-200 rounded-t transition-all relative flex flex-col justify-end overflow-hidden" 
                                style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                            >
                                <div className="absolute bottom-0 left-0 w-full bg-blue-500 opacity-20 h-1"></div>
                            </div>
                            <span className="text-[10px] text-gray-500 mt-2 font-medium">{d.date}</span>
                        </div>
                    );
                })}
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
            return time >= s.getTime() && time <= e.getTime();
        });

        const currentOrders = getOrdersInPeriod(start, end);
        const prevOrders = getOrdersInPeriod(prevStart, prevEnd);

        const revenue = currentOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const revenueGrowth = prevRevenue === 0 ? (revenue > 0 ? 100 : 0) : ((revenue - prevRevenue) / prevRevenue) * 100;

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
                const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
                const frameName = frame ? `Khung ${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                
                item.draggableItems.forEach(di => {
                    if (di.type === 'charm') {
                        inventory.totalCharms++;
                    } else {
                        // Use allKnownParts to ensure counting even if product deleted from current list
                        // but still exists in historical data (mapped by ID)
                        const part = allKnownParts[di.partId];
                        const name = part?.name || `ID: ${di.partId}`; // Fallback if name unknown
                        if (part) {
                             if (di.type === 'accessory') inventory.accessory[name] = (inventory.accessory[name] || 0) + 1;
                             if (di.type === 'pet') inventory.pet[name] = (inventory.pet[name] || 0) + 1;
                             if (di.type === 'hat') inventory.hat[name] = (inventory.hat[name] || 0) + 1;
                        }
                    }
                });

                item.characters.forEach(char => {
                    if (char.hair) {
                        const name = char.hair.name || `Hair ${char.hair.id}`;
                        inventory.hair[name] = (inventory.hair[name] || 0) + 1;
                    }
                    if (char.face) {
                        const name = char.face.name || `Face ${char.face.id}`;
                        inventory.face[name] = (inventory.face[name] || 0) + 1;
                    }
                    if (char.shirt) {
                        const name = char.shirt.name || `Shirt ${char.shirt.id}`;
                        inventory.shirt[name] = (inventory.shirt[name] || 0) + 1;
                    }
                    if (char.pants) {
                        const name = char.pants.name || `Pants ${char.pants.id}`;
                        inventory.pants[name] = (inventory.pants[name] || 0) + 1;
                    }
                    if (char.hat) {
                        const name = char.hat.name || `Hat ${char.hat.id}`;
                        inventory.hat[name] = (inventory.hat[name] || 0) + 1;
                    }
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
            
            const dailyRevenue = orders
                .filter(o => {
                    const time = o.createdAt || 0;
                    return time >= dStart.getTime() && time <= dEnd.getTime();
                })
                .reduce((sum, o) => sum + o.totalPrice, 0);
            
            chartData.push({
                date: `${d.getDate()}/${d.getMonth() + 1}`,
                revenue: dailyRevenue
            });
        }

        return { revenue, revenueGrowth, orderCount, orderGrowth, inventory, packers, dateLabel, chartData };
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
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doanh thu</p><span className={`text-xs font-bold flex items-center ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(analytics.revenueGrowth).toFixed(1)}%</span></div>
                    <p className="text-3xl font-light text-gray-900">{formatCurrency(analytics.revenue, 'payment')}</p>
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
                <ChartCard title="Khung Ảnh" data={analytics.inventory.frames} />
                <ChartCard title="Tóc" data={analytics.inventory.hair} />
                <ChartCard title="Khuôn mặt" data={analytics.inventory.face} />
                <ChartCard title="Áo" data={analytics.inventory.shirt} />
                <ChartCard title="Quần" data={analytics.inventory.pants} />
                <ChartCard title="Mũ" data={analytics.inventory.hat} />
                <ChartCard title="Phụ kiện" data={analytics.inventory.accessory} />
                <ChartCard title="Thú cưng" data={analytics.inventory.pet} />
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
