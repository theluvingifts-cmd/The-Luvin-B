
import React, { useMemo, useState, useEffect } from 'react';
import { Order, LegoPart, FrameOption } from '../../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';
import { formatCurrency } from '../../utils/pricing';
import { DateInput } from '../ui/DateInput';
import { getAdsCosts, saveAdsCost } from '../../services/configService';
import { getFunnelStats } from '../../services/analyticsService';

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

const ConversionFunnel = ({ stats }: { stats: any }) => {
    const steps = [
        { key: 'view_home', label: 'Xem Trang Chủ', icon: '🏠' },
        { key: 'view_collection', label: 'Xem Bộ Sưu Tập', icon: '🧧' },
        { key: 'view_product', label: 'Xem Sản Phẩm', icon: '👁️' },
        { key: 'builder_start', label: 'Bắt đầu thiết kế', icon: '🎨' },
        { key: 'step2_info', label: 'Nhập thông tin', icon: '📝' },
        { key: 'step3_parts', label: 'Phối nhân vật', icon: '🧍' },
        { key: 'step4_summary', label: 'Xem tổng kết', icon: '📋' },
        { key: 'add_to_cart', label: 'Thêm giỏ hàng', icon: '🛒' },
        { key: 'checkout_start', label: 'Vào thanh toán', icon: '💳' },
        { key: 'order_complete', label: 'Đặt hàng thành công', icon: '🎉' },
    ];

    const maxVal = stats?.view_home_count || stats?.view_collection_count || stats?.view_product_count || stats?.builder_start_count || 1;

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full">
            <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                <span>📊</span> Phễu chuyển đổi (Bộ lọc)
            </h4>
            <div className="space-y-4">
                {steps.map((step, idx) => {
                    const val = stats?.[`${step.key}_count`] || 0;
                    const percent = Math.round((val / maxVal) * 100);
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
                                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000"
                                    style={{ width: `${percent}%` }}
                                ></div>
                                {idx > 0 && dropRate > 10 && (
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
                * Dữ liệu được ghi lại kể từ khi hệ thống tracking hoạt động. Giúp bạn xác định bước nào khách hàng bỏ cuộc nhiều nhất.
            </p>
        </div>
    );
};

const FullItemsCard = ({ title, data, allKnownParts }: { title: string, data: Record<string, number>, allKnownParts: Record<string, any> }) => (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col h-full hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">{title}</h4>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Tổng: {Object.keys(data).length}</span>
        </div>
        {Object.keys(data).length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-grow max-h-80 custom-scrollbar pr-1">
                {Object.entries(data)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count], idx) => {
                        const baseName = name.split(' (')[0];
                        // Try to find by full name first, then by base name
                        const part = allKnownParts[name] || allKnownParts[baseName];
                        return (
                            <div key={idx} className="flex items-center justify-between text-xs group hover:bg-gray-50 p-1 rounded">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`font-mono w-5 flex-shrink-0 text-center text-[10px] rounded ${idx < 3 ? 'bg-yellow-100 text-yellow-700 font-bold' : 'text-gray-400'}`}>{idx + 1}</span>
                                    {part?.imageUrl && (
                                        <img 
                                            src={part.imageUrl} 
                                            alt={name} 
                                            className="w-6 h-6 object-contain bg-gray-50 rounded p-0.5"
                                            referrerPolicy="no-referrer"
                                        />
                                    )}
                                    <span className="font-medium text-gray-700 truncate group-hover:text-blue-600 transition-colors" title={name}>{name}</span>
                                </div>
                                <span className="font-bold w-8 text-right flex-shrink-0 bg-gray-100 px-1 rounded text-gray-800">{count}</span>
                            </div>
                        );
                    })
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
    const maxValue = data.length > 0 ? Math.max(...data.map(d => Math.max(d.revenue, Math.abs(d.profit), d.ads)), 100000) : 100000;
    const minWidth = Math.max(data.length * (data.length > 24 ? 30 : 45), 300); 

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
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="border-t border-gray-400 w-full border-dashed"></div>
                    ))}
                </div>

                <div className="overflow-x-auto h-full pb-2 custom-scrollbar">
                    <div className="h-full flex items-end justify-between gap-1 px-2" style={{ minWidth: `${minWidth}px` }}>
                        {data.map((d, index) => {
                            const revenueHeight = (d.revenue / maxValue) * 100;
                            const profitHeight = (d.profit / maxValue) * 100;
                            const adsHeight = (d.ads / maxValue) * 100;

                            return (
                                <div key={index} className="flex flex-col items-center flex-1 h-full justify-end group relative z-10 min-w-[15px]">
                                    <div className="w-full flex items-end justify-center gap-[1px] h-[85%] border-b border-gray-200 pb-1">
                                        <div 
                                            className="w-1.5 sm:w-2 bg-blue-400 hover:bg-blue-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(revenueHeight, 1)}%` }}
                                        ></div>
                                        <div 
                                            className={`w-1.5 sm:w-2 ${d.profit >= 0 ? 'bg-green-400 hover:bg-green-500' : 'bg-orange-400 hover:bg-orange-500'} rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom`}
                                            style={{ height: `${Math.max(Math.abs(profitHeight), 1)}%` }}
                                        ></div>
                                        <div 
                                            className="w-1.5 sm:w-2 bg-red-400 hover:bg-red-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(adsHeight, 1)}%` }}
                                        ></div>
                                    </div>
                                    
                                    <div className="absolute bottom-[90%] left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none flex flex-col gap-1">
                                        <span className="font-bold border-b border-gray-600 pb-1 mb-1 block">{d.date}</span>
                                        <span className="text-blue-200">DT: {formatCurrency(d.revenue, 'admin')}</span>
                                        <span className="text-green-200">LN: {formatCurrency(d.profit, 'admin')}</span>
                                        <span className="text-red-200">Ads: {formatCurrency(d.ads, 'admin')}</span>
                                    </div>

                                    <span className={`text-[8px] text-gray-500 mt-2 font-medium truncate w-full text-center ${data.length > 15 ? 'rotate-45 origin-left translate-x-1' : ''}`}>
                                        {d.date}
                                    </span>
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
    const [filterType, setFilterType] = useState<'period' | 'month' | 'year' | 'custom'>('period');
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

    const allKnownParts = useMemo(() => {
        const map: Record<string, any> = {};
        // Add default parts by ID and Name
        Object.values(LEGO_PARTS).flat().forEach(p => { 
            map[p.id] = p; 
            map[p.name] = p; 
        });
        // Add products (DB parts) by ID and Name
        products.forEach(p => { 
            map[p.id] = p; 
            map[p.name] = p; 
        });
        // Add frames by ID and Name
        frames.forEach(f => { 
            map[f.id] = f; 
            map[f.name] = f; 
        });
        // Add FRAME_OPTIONS (default frames)
        FRAME_OPTIONS.forEach(f => {
            map[f.id] = f;
            map[f.name] = f;
        });
        return map;
    }, [products, frames]);

    const { startDate, endDate, dateLabel, granularity } = useMemo(() => {
        let start: Date, end: Date;
        let label = '';
        let gran: 'hour' | 'day' | 'month' = 'day';

        if (filterType === 'month') {
            label = `Tháng ${month + 1}/${year}`;
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23, 59, 59, 999);
            gran = 'day';
        } else if (filterType === 'year') {
            label = `Năm ${year}`;
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23, 59, 59, 999);
            gran = 'month';
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
                start.setDate(start.getDate() - 6);
                label = '7 ngày qua';
            } else if (period === '30days') {
                start.setDate(start.getDate() - 29);
                label = '30 ngày qua';
            } else {
                label = 'Hôm nay';
            }
        }
        
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
        if (diffDays <= 1.1) gran = 'hour';
        else if (diffDays > 62) gran = 'month';
        else gran = 'day';

        return { startDate: start, endDate: end, dateLabel: label, granularity: gran };
    }, [filterType, period, month, year, customStartDate, customEndDate]);

    useEffect(() => {
        const fetchData = async () => {
            if (startDate && endDate) {
                const [costs, funnel] = await Promise.all([
                    getAdsCosts(startDate, endDate),
                    getFunnelStats(startDate, endDate)
                ]);
                setDailyAdsCosts(costs);
                setFunnelStats(funnel);
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

    const lowStockItems = useMemo(() => {
        const threshold = 10;
        const lowStockParts = products.filter(p => p.stock !== undefined && p.stock !== null && p.stock <= threshold).map(p => ({ name: p.name, stock: p.stock, type: 'Phụ kiện' }));
        const lowStockFrames = frames.filter(f => f.stock !== undefined && f.stock !== null && f.stock <= threshold).map(f => ({ name: f.name, stock: f.stock, type: 'Khung' }));
        return [...lowStockParts, ...lowStockFrames];
    }, [products, frames]);

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
        const duration = endDate.getTime() - startDate.getTime() + 1;
        const prevStart = new Date(startDate.getTime() - duration);
        const prevEnd = new Date(endDate.getTime() - duration);

        const getOrdersInPeriod = (s: Date, e: Date) => orders.filter(o => {
            const time = o.createdAt || 0;
            return time >= s.getTime() && time <= e.getTime();
        });

        const allCurrentOrders = getOrdersInPeriod(startDate, endDate);
        const prevOrders = getOrdersInPeriod(prevStart, prevEnd);

        const validOrders = allCurrentOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));
        const validPrevOrders = prevOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));

        const revenue = validOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const grossProfit = validOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
        
        const totalCodPending = allCurrentOrders
            .filter(o => !['Huỷ đơn', 'Xoá đơn', 'Đã giao hàng'].includes(o.status))
            .reduce((sum, o) => sum + (o.totalPrice - (o.amountPaid || 0)), 0);

        let totalAdsCost = 0;
        const tempDate = new Date(startDate);
        while (tempDate <= endDate) {
            const dateStr = tempDate.toISOString().split('T')[0];
            totalAdsCost += (dailyAdsCosts[dateStr] || 0);
            tempDate.setDate(tempDate.getDate() + 1);
        }

        const netProfit = grossProfit - totalAdsCost;

        const prevGrossProfit = validPrevOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
        let prevTotalAdsCost = 0;
        const prevTempDate = new Date(prevStart);
        while (prevTempDate <= prevEnd) {
            const dateStr = prevTempDate.toISOString().split('T')[0];
            prevTotalAdsCost += (dailyAdsCosts[dateStr] || 0);
            prevTempDate.setDate(prevTempDate.getDate() + 1);
        }
        const prevNetProfit = prevGrossProfit - prevTotalAdsCost;
        const profitGrowth = prevNetProfit === 0 ? (netProfit > 0 ? 100 : 0) : ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100;

        const prevRevenue = validPrevOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const revenueGrowth = prevRevenue === 0 ? (revenue > 0 ? 100 : 0) : ((revenue - prevRevenue) / prevRevenue) * 100;

        const orderCount = allCurrentOrders.length;
        const prevOrderCount = prevOrders.length;
        const validOrderCount = validOrders.length;
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

        allCurrentOrders.forEach(order => {
            order.items.forEach(item => {
                const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS.find(f => f.id === item.frameId);
                const frameName = frame ? `Khung ${frame.name}` : `Khung ${item.frameId}`; 
                inventory.frames[frameName] = (inventory.frames[frameName] || 0) + 1;
                item.draggableItems.forEach(di => {
                    if (di.type !== 'charm') {
                        const part = allKnownParts[di.partId];
                        if (part) {
                             if (di.type === 'accessory') {
                                 const key = di.selectedColor ? `${part.name} (${di.selectedColor.name})` : part.name;
                                 inventory.accessory[key] = (inventory.accessory[key] || 0) + 1;
                             }
                             if (di.type === 'pet') {
                                 const key = di.selectedColor ? `${part.name} (${di.selectedColor.name})` : part.name;
                                 inventory.pet[key] = (inventory.pet[key] || 0) + 1;
                             }
                             inventory.totalCharms++;
                        }
                    }
                });
                item.characters.forEach(char => {
                    if (char.hair) {
                        const key = char.selectedHairColor ? `${char.hair.name} (${char.selectedHairColor.name})` : char.hair.name;
                        inventory.hair[key] = (inventory.hair[key] || 0) + 1;
                    }
                    if (char.face) inventory.face[char.face.name] = (inventory.face[char.face.name] || 0) + 1;
                    if (char.shirt) {
                        const key = char.selectedShirtColor ? `${char.shirt.name} (${char.selectedShirtColor.name})` : char.shirt.name;
                        inventory.shirt[key] = (inventory.shirt[key] || 0) + 1;
                    }
                    if (char.pants) {
                        const key = char.selectedPantsColor ? `${char.pants.name} (${char.selectedPantsColor.name})` : char.pants.name;
                        inventory.pants[key] = (inventory.pants[key] || 0) + 1;
                    }
                    if (char.hat) inventory.hat[char.hat.name] = (inventory.hat[char.hat.name] || 0) + 1;
                });
            });
        });

        const chartData = [];
        if (granularity === 'hour') {
            for (let h = 0; h < 24; h++) {
                const hourStart = new Date(startDate);
                hourStart.setHours(h, 0, 0, 0);
                const hourEnd = new Date(startDate);
                hourEnd.setHours(h, 59, 59, 999);
                
                const hourOrders = orders.filter(o => {
                    const time = o.createdAt || 0;
                    return time >= hourStart.getTime() && time <= hourEnd.getTime();
                });
                const hourValidOrders = hourOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));
                const hourRevenue = hourValidOrders.reduce((sum, o) => sum + o.totalPrice, 0);
                const hourGrossProfit = hourValidOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
                
                // Distribute daily ads cost evenly across 24 hours for a more accurate hourly profit view
                const hourAds = (dailyAdsCosts[startDate.toISOString().split('T')[0]] || 0) / 24;
                
                chartData.push({ 
                    date: `${h}h`, 
                    revenue: hourRevenue, 
                    profit: hourGrossProfit - hourAds, 
                    ads: hourAds 
                });
            }
        } else if (granularity === 'month') {
            // Group by month
            const months: Record<string, { revenue: number; profit: number; ads: number }> = {};
            const loopDate = new Date(startDate);
            while (loopDate <= endDate) {
                const monthKey = `${loopDate.getMonth() + 1}/${loopDate.getFullYear()}`;
                if (!months[monthKey]) months[monthKey] = { revenue: 0, profit: 0, ads: 0 };
                
                const dStart = getStartOfDay(loopDate);
                const dEnd = getEndOfDay(loopDate);
                const dailyOrders = orders.filter(o => {
                    const time = o.createdAt || 0;
                    return time >= dStart.getTime() && time <= dEnd.getTime();
                });
                const dailyValidOrders = dailyOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));
                const dailyRevenue = dailyValidOrders.reduce((sum, o) => sum + o.totalPrice, 0);
                const dailyGrossProfit = dailyValidOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
                const dailyAds = dailyAdsCosts[loopDate.toISOString().split('T')[0]] || 0;
                
                months[monthKey].revenue += dailyRevenue;
                months[monthKey].profit += (dailyGrossProfit - dailyAds);
                months[monthKey].ads += dailyAds;
                
                loopDate.setDate(loopDate.getDate() + 1);
            }
            Object.entries(months).forEach(([date, vals]) => {
                chartData.push({ date, ...vals });
            });
        } else {
            const loopDate = new Date(startDate);
            while (loopDate <= endDate) {
                const dateStr = loopDate.toISOString().split('T')[0];
                const displayDate = `${loopDate.getDate()}/${loopDate.getMonth() + 1}`;
                const dStart = getStartOfDay(loopDate);
                const dEnd = getEndOfDay(loopDate);
                const dailyOrders = orders.filter(o => {
                    const time = o.createdAt || 0;
                    return time >= dStart.getTime() && time <= dEnd.getTime();
                });
                const dailyValidOrders = dailyOrders.filter(o => VALID_REVENUE_STATUSES.includes(o.status));
                const dailyRevenue = dailyValidOrders.reduce((sum, o) => sum + o.totalPrice, 0);
                const dailyGrossProfit = dailyValidOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
                const dailyAds = dailyAdsCosts[dateStr] || 0;
                chartData.push({ date: displayDate, revenue: dailyRevenue, profit: dailyGrossProfit - dailyAds, ads: dailyAds });
                loopDate.setDate(loopDate.getDate() + 1);
            }
        }

        const locationStats: Record<string, number> = {};
        allCurrentOrders.forEach(order => {
            let province = order.customer.province;
            
            // Try to extract from address if missing
            if (!province && order.customer.address) {
                const parts = order.customer.address.split(',').map(p => p.trim());
                province = parts[parts.length - 1];
            }
            
            const normalizedProvince = province || 'Chưa rõ';
            locationStats[normalizedProvince] = (locationStats[normalizedProvince] || 0) + 1;
        });

        return { revenue, profit: netProfit, profitGrowth, revenueGrowth, orderCount, validOrderCount, orderGrowth, inventory, chartData, totalAdsCost, totalCodPending, locationStats };
    }, [orders, startDate, endDate, allKnownParts, frames, dailyAdsCosts, granularity]); 

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4 sticky top-14 sm:top-16 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">Thời gian</h2>
                        <p className="text-xs text-gray-500 font-medium">{dateLabel}</p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center w-full sm:w-auto">
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                        <button onClick={() => setFilterType('period')} className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${filterType === 'period' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Ngày</button>
                        <button onClick={() => setFilterType('month')} className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${filterType === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tháng</button>
                        <button onClick={() => setFilterType('year')} className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${filterType === 'year' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Năm</button>
                        <button onClick={() => setFilterType('custom')} className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${filterType === 'custom' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tùy chỉnh</button>
                    </div>
                    {filterType === 'period' && (
                        <select value={period} onChange={(e: any) => setPeriod(e.target.value)} className="w-full sm:w-auto p-1.5 text-xs border border-gray-200 rounded-lg bg-white font-medium focus:ring-1 focus:ring-gray-900 outline-none">
                            <option value="today">Hôm nay</option>
                            <option value="yesterday">Hôm qua</option>
                            <option value="7days">7 ngày qua</option>
                            <option value="30days">30 ngày qua</option>
                        </select>
                    )} 
                    {(filterType === 'month' || filterType === 'year') && (
                        <div className="flex gap-1">
                            {filterType === 'month' && (
                                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="p-1.5 text-xs border border-gray-200 rounded-lg bg-white font-medium outline-none">
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i}>Tháng {i + 1}</option>
                                    ))}
                                </select>
                            )}
                            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="p-1.5 text-xs border border-gray-200 rounded-lg bg-white font-medium outline-none">
                                {[2024, 2025, 2026].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {filterType === 'custom' && (
                        <div className="flex gap-2">
                            <DateInput 
                                value={customStartDate} 
                                onChange={setCustomStartDate} 
                                className="!flex-row items-center gap-1"
                            />
                            <span className="text-gray-400 self-center">-</span>
                            <DateInput 
                                value={customEndDate} 
                                onChange={setCustomEndDate} 
                                className="!flex-row items-center gap-1"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Doanh thu</p>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                        <span className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(analytics.revenue, 'admin')}</span>
                        <span className={`text-[10px] sm:text-xs font-bold ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(analytics.revenueGrowth).toFixed(0)}%</span>
                    </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-white p-4 sm:p-5 rounded-xl border border-green-100 shadow-sm relative overflow-hidden">
                    <p className="text-[10px] sm:text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Lợi nhuận ròng</p>
                    <div className="flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                            <span className={`text-lg sm:text-2xl font-bold ${analytics.profit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(analytics.profit, 'admin')}</span>
                            <span className={`text-[10px] sm:text-xs font-bold ${analytics.profitGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.profitGrowth >= 0 ? '↑' : '↓'} {Math.abs(analytics.profitGrowth).toFixed(0)}%</span>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium">Đã trừ Ads: {formatCurrency(analytics.totalAdsCost, 'admin')}</span>
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-red-50 rounded-bl-full flex items-start justify-end p-2">
                        <span className="text-xs">💰</span>
                    </div>
                    <p className="text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Tổng COD đang treo</p>
                    <div className="flex flex-col">
                        <span className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(analytics.totalCodPending, 'admin')}</span>
                        <p className="text-[9px] text-gray-400 font-medium">* Chưa tính đơn đã giao nhưng chưa về ví</p>
                    </div>
                </div>
                 
                 <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">Giá trị trung bình đơn</p>
                    <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-xl font-bold text-gray-900">
                            {analytics.validOrderCount > 0 ? formatCurrency(analytics.revenue / analytics.validOrderCount, 'admin') : '0đ'}
                        </span>
                        <span className="text-[9px] sm:text-xs font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">AOV</span>
                    </div>
                </div>
            </div>

            {lowStockItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-4 items-start shadow-sm">
                    <div className="p-2 bg-red-100 rounded-full text-red-600 flex-shrink-0">
                        <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-red-800 text-sm mb-2 flex items-center gap-2">
                            Cảnh báo tồn kho thấp ({lowStockItems.length})
                            <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-700 font-black">STOCK {'<'} 10</span>
                        </h4>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar py-1">
                            {lowStockItems.map((item, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 bg-white border border-red-200 px-2.5 py-1 rounded-lg text-[11px] text-red-600 font-bold shadow-sm hover:border-red-400 transition-colors">
                                    <span className="opacity-50 text-[9px] uppercase">{item.type}</span>
                                    {item.name}: <b className="text-red-700 bg-red-50 px-1 rounded">{item.stock}</b>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-72 sm:h-96">
                        <BarChart data={analytics.chartData} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <ConversionFunnel stats={funnelStats} />
                         
                         <div className="space-y-6">
                            {/* Location Stats */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <span>📍</span> Phân bổ khách hàng (Tỉnh thành)
                                </h4>
                                <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                    {(Object.entries(analytics.locationStats) as [string, number][])
                                        .filter(([province]) => province !== 'Chưa rõ' || orders.length > 0)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([province, count], idx) => {
                                            const total = orders.length || 1;
                                            const percent = Math.round((count / total) * 100);
                                            return (
                                                <div key={province} className="group">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[11px] font-bold text-gray-600 flex items-center gap-2">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${province === 'Chưa rõ' ? 'bg-gray-300' : 'bg-blue-400'} group-hover:scale-125 transition-transform`}></span>
                                                            {province}
                                                        </span>
                                                        <div className="text-right">
                                                            <span className="text-[11px] font-black text-gray-900">{count} đơn</span>
                                                            <span className="text-[10px] text-gray-400 ml-1">({percent}%)</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full ${province === 'Chưa rõ' ? 'bg-gray-200' : 'bg-gradient-to-r from-blue-300 to-blue-500'} rounded-full transition-all duration-1000`}
                                                            style={{ width: `${percent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                    {Object.keys(analytics.locationStats).length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-xs italic">
                                            Chưa có dữ liệu giao hàng
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col items-center justify-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </div>
                            <div className="text-center">
                                <h4 className="font-bold text-sm text-gray-800">Cập nhật chi phí Ads</h4>
                                <p className="text-[10px] text-gray-500 mb-4">Nhập tay chi phí theo ngày</p>
                                <div className="flex flex-col gap-2 w-full">
                                    <DateInput 
                                        value={adsDateInput}
                                        onChange={(val) => {
                                            setAdsDateInput(val);
                                            if (dailyAdsCosts[val]) setAdsCostInput(dailyAdsCosts[val]);
                                            else setAdsCostInput(0);
                                        }}
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="VNĐ"
                                        className="bg-gray-50 border border-gray-300 rounded text-xs p-2 font-bold text-gray-800 focus:outline-none focus:border-gray-500"
                                        value={adsCostInput}
                                        onChange={(e) => setAdsCostInput(Number(e.target.value))}
                                    />
                                    <button 
                                        onClick={handleSaveAdsInline}
                                        disabled={isSavingAds}
                                        className="bg-gray-900 text-white p-2 rounded hover:bg-black disabled:opacity-50 transition-colors font-bold text-xs"
                                    >
                                        LƯU CHI PHÍ
                                    </button>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 h-full flex flex-col">
                    <h3 className="font-bold text-gray-800 text-sm border-b pb-2">Bán chạy nhất</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 overflow-y-auto pr-1" style={{maxHeight: 'calc(100vh - 200px)'}}>
                        <FullItemsCard title="Khung" data={analytics.inventory.frames} allKnownParts={allKnownParts} />
                        <FullItemsCard title="Phụ Kiện" data={analytics.inventory.accessory} allKnownParts={allKnownParts} />
                        <FullItemsCard title="Thú Cưng" data={analytics.inventory.pet} allKnownParts={allKnownParts} />
                        <FullItemsCard title="Tóc" data={analytics.inventory.hair} allKnownParts={allKnownParts} />
                        <FullItemsCard title="Mặt" data={analytics.inventory.face} allKnownParts={allKnownParts} />
                        <FullItemsCard title="Áo" data={analytics.inventory.shirt} allKnownParts={allKnownParts} />
                        <FullItemsCard title="Quần" data={analytics.inventory.pants} allKnownParts={allKnownParts} />
                        <FullItemsCard title="Mũ" data={analytics.inventory.hat} allKnownParts={allKnownParts} />
                    </div>
                </div>
            </div>
        </div>
    );
};
