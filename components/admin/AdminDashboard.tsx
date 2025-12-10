
import React, { useMemo, useState, useEffect } from 'react';
import { Order, LegoPart, FrameOption } from '../../types';
import { FRAME_OPTIONS, LEGO_PARTS } from '../../constants';
import { formatCurrency } from '../../utils/pricing';
import { getAdsCosts, saveAdsCost } from '../../services/configService';
import { uploadToCloudinary } from '../../services/uploadService';

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
    // Find max value to scale chart
    const maxValue = Math.max(...data.map(d => Math.max(d.revenue, d.profit, d.ads)), 100000);
    // Tính toán độ rộng tối thiểu để đảm bảo các cột không bị dính vào nhau khi xem 30 ngày
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
                    <div className="border-t border-gray-400 w-full border-dashed"></div>
                    <div className="border-t border-gray-400 w-full border-dashed"></div>
                    <div className="border-t border-gray-400 w-full border-dashed"></div>
                    <div className="border-t border-gray-400 w-full border-dashed"></div>
                    <div className="border-t border-gray-400 w-full border-dashed"></div>
                </div>

                {/* Scrollable Container */}
                <div className="overflow-x-auto h-full pb-2 custom-scrollbar">
                    <div className="h-full flex items-end justify-between gap-2 px-2" style={{ minWidth: `${minWidth}px` }}>
                        {data.map((d, index) => {
                            const revenueHeight = (d.revenue / maxValue) * 100;
                            const profitHeight = (d.profit / maxValue) * 100;
                            const adsHeight = (d.ads / maxValue) * 100;

                            return (
                                <div key={index} className="flex flex-col items-center flex-1 h-full justify-end group relative z-10 min-w-[20px]">
                                    {/* Bars Container */}
                                    <div className="w-full flex items-end justify-center gap-[2px] h-[85%] border-b border-gray-200 pb-1">
                                        {/* Revenue Bar */}
                                        <div 
                                            className="w-1.5 sm:w-2.5 bg-blue-400 hover:bg-blue-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(revenueHeight, 1)}%` }}
                                        ></div>
                                        {/* Profit Bar */}
                                        <div 
                                            className="w-1.5 sm:w-2.5 bg-green-400 hover:bg-green-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(profitHeight, 1)}%` }}
                                        ></div>
                                        {/* Ads Bar */}
                                        <div 
                                            className="w-1.5 sm:w-2.5 bg-red-400 hover:bg-red-500 rounded-t-sm transition-all duration-300 relative group-hover:scale-y-105 origin-bottom"
                                            style={{ height: `${Math.max(adsHeight, 1)}%` }}
                                        ></div>
                                    </div>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-[90%] left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none flex flex-col gap-1">
                                        <span className="font-bold border-b border-gray-600 pb-1 mb-1 block">{d.date}</span>
                                        <span className="text-blue-200">DT: {formatCurrency(d.revenue, 'admin')}</span>
                                        <span className="text-green-200">LN: {formatCurrency(d.profit, 'admin')}</span>
                                        <span className="text-red-200">Ads: {formatCurrency(d.ads, 'admin')}</span>
                                    </div>

                                    <span className="text-[9px] text-gray-500 mt-2 font-medium truncate w-full text-center rotate-0">{d.date}</span>
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
    
    // Daily Ads Costs State
    const [dailyAdsCosts, setDailyAdsCosts] = useState<Record<string, number>>({});
    
    // Inline Ads Management State
    const [adsDateInput, setAdsDateInput] = useState(new Date().toISOString().split('T')[0]);
    const [adsCostInput, setAdsCostInput] = useState<number>(0);
    const [isSavingAds, setIsSavingAds] = useState(false);
    const [isCheckingSystem, setIsCheckingSystem] = useState(false);

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
            alert("Đã lưu!");
        } else {
            alert('Lỗi lưu chi phí');
        }
        setIsSavingAds(false);
    };

    const handleSystemCheck = async () => {
        setIsCheckingSystem(true);
        try {
            // Test Cloudinary / Firebase Storage Upload
            // Create a small blob
            const blob = new Blob(["Test"], { type: "text/plain" });
            const testFile = new File([blob], "system_check.txt", { type: "text/plain" });
            
            const url = await uploadToCloudinary(testFile);
            
            if (url) {
                // Now try to fetch it back to test CORS
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        alert("✅ HỆ THỐNG HOẠT ĐỘNG TỐT!\n\n- Database: Đã kết nối\n- Storage: Đã kết nối\n- CORS: Đã cấu hình chính xác (Cho phép tải ảnh thiết kế)");
                    } else {
                        alert("⚠️ CẢNH BÁO CORS:\nUpload thành công nhưng không thể tải về trực tiếp từ trình duyệt.\nCó thể bạn cần đợi vài phút hoặc chạy lại lệnh CORS trong Cloud Shell.");
                    }
                } catch (fetchErr) {
                     alert("❌ LỖI CORS:\nUpload thành công nhưng trình duyệt chặn tải về.\nVui lòng chạy lại lệnh 'gsutil cors set...' trong Cloud Shell.");
                }
            } else {
                alert("❌ LỖI STORAGE:\nKhông thể upload file. Kiểm tra lại Firebase Storage Rules (phải là 'allow write: if true').");
            }
        } catch (e: any) {
            console.error(e);
            alert("❌ LỖI KHÔNG XÁC ĐỊNH:\n" + e.message);
        } finally {
            setIsCheckingSystem(false);
        }
    };

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);

    // Low Stock Alert (Threshold < 10)
    const lowStockItems = useMemo(() => {
        const threshold = 10;
        const lowStockParts = products.filter(p => p.stock !== undefined && p.stock !== null && p.stock <= threshold).map(p => ({ name: p.name, stock: p.stock, type: 'Linh kiện' }));
        const lowStockFrames = frames.filter(f => f.stock !== undefined && f.stock !== null && f.stock <= threshold).map(f => ({ name: f.name, stock: f.stock, type: 'Khung' }));
        return [...lowStockParts, ...lowStockFrames];
    }, [products, frames]);

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

        // Profit = Revenue (User paid) - Cost - Shipping - Discounts
        // Note: totalPrice already includes subtraction of discounts
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
        <div className="space-y-6 animate-fade-in pb-12">
            {/* 1. Control Bar - Stacked on Mobile */}
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
                    {/* SYSTEM CHECK BUTTON ADDED HERE */}
                    <button 
                        onClick={handleSystemCheck}
                        disabled={isCheckingSystem}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors whitespace-nowrap"
                    >
                        {isCheckingSystem ? (
                            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-700"></div> Đang kiểm tra...</>
                        ) : (
                            <>⚡ Kiểm tra hệ thống</>
                        )}
                    </button>

                    <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                        <button onClick={() => setFilterType('period')} className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${filterType === 'period' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Ngày</button>
                        <button onClick={() => setFilterType('month')} className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${filterType === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tháng</button>
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
                    {filterType === 'month' && (
                        <div className="flex gap-1 w-full sm:w-auto">
                            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="flex-1 sm:flex-none p-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-gray-900 outline-none">{Array.from({length: 12}, (_, i) => (<option key={i} value={i}>T{i + 1}</option>))}</select>
                            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="flex-1 sm:flex-none p-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-gray-900 outline-none"><option value={2024}>2024</option><option value={2025}>2025</option></select>
                        </div>
                    )}
                    {filterType === 'custom' && (
                        <div className="flex flex-col sm:flex-row gap-2 bg-white border border-gray-200 rounded-lg p-2 w-full sm:w-auto">
                            <input type="date" className="text-xs font-medium border rounded p-1 w-full sm:w-auto" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                            <span className="text-gray-300 hidden sm:inline">|</span>
                            <input type="date" className="text-xs font-medium border rounded p-1 w-full sm:w-auto" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>

            {/* ALERT LOW STOCK */}
            {lowStockItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-4 items-start shadow-sm animate-pulse">
                    <div className="p-2 bg-red-100 rounded-full text-red-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div className="flex-grow">
                        <h4 className="font-bold text-red-800 text-sm mb-1">Cảnh báo tồn kho thấp ({lowStockItems.length})</h4>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {lowStockItems.map((item, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-white border border-red-200 px-2 py-1 rounded text-xs text-red-600 font-medium whitespace-nowrap">
                                    {item.name}: <b>{item.stock}</b>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Key Metrics Cards - Grid 2 cols on mobile */}
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
                        <span className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(analytics.profit, 'admin')}</span>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium">Đã trừ Ads: {formatCurrency(analytics.totalAdsCost, 'admin')}</span>
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Đơn hàng</p>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                        <span className="text-lg sm:text-2xl font-bold text-gray-900">{analytics.orderCount}</span>
                        <span className={`text-[10px] sm:text-xs font-bold ${analytics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{analytics.orderGrowth >= 0 ? '↑' : '↓'} {Math.abs(analytics.orderGrowth).toFixed(0)}%</span>
                    </div>
                </div>
                 <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Top Staff</p>
                    <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-lg font-bold text-gray-900 truncate max-w-[80px] sm:max-w-[120px]">{analytics.packers.length > 0 ? analytics.packers[0].email.split('@')[0] : '---'}</span>
                        <span className="text-[9px] sm:text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">Top 1</span>
                    </div>
                </div>
            </div>

            {/* 3. Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Chart & Ads */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-64 sm:h-80">
                        <BarChart data={analytics.chartData} />
                    </div>
                    
                    {/* Compact Ads Management Widget */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-gray-800">Chi phí Ads</h4>
                                <p className="text-[10px] text-gray-500">Nhập chi phí marketing</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200 w-full sm:w-auto">
                            <input 
                                type="date" 
                                className="bg-white border border-gray-300 rounded text-xs p-1.5 w-full sm:w-24 focus:outline-none focus:border-gray-500"
                                value={adsDateInput}
                                onChange={(e) => {
                                    setAdsDateInput(e.target.value);
                                    if (dailyAdsCosts[e.target.value]) setAdsCostInput(dailyAdsCosts[e.target.value]);
                                    else setAdsCostInput(0);
                                }}
                            />
                            <input 
                                type="number" 
                                placeholder="VNĐ"
                                className="bg-white border border-gray-300 rounded text-xs p-1.5 w-full sm:w-24 font-bold text-gray-800 focus:outline-none focus:border-gray-500"
                                value={adsCostInput}
                                onChange={(e) => setAdsCostInput(Number(e.target.value))}
                            />
                            <button 
                                onClick={handleSaveAdsInline}
                                disabled={isSavingAds}
                                className="bg-gray-900 text-white p-1.5 rounded hover:bg-black disabled:opacity-50 transition-colors flex-shrink-0"
                                title="Lưu"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Full Inventory Lists */}
                <div className="space-y-4 h-full flex flex-col">
                    <h3 className="font-bold text-gray-800 text-sm border-b pb-2">Thống kê chi tiết</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 overflow-y-auto pr-1" style={{maxHeight: 'calc(100vh - 200px)'}}>
                        <FullItemsCard title="Khung Bán Chạy" data={analytics.inventory.frames} />
                        <FullItemsCard title="Phụ Kiện" data={analytics.inventory.accessory} />
                        <FullItemsCard title="Thú Cưng" data={analytics.inventory.pet} />
                        <FullItemsCard title="Tóc" data={analytics.inventory.hair} />
                        <FullItemsCard title="Khuôn Mặt" data={analytics.inventory.face} />
                        <FullItemsCard title="Áo" data={analytics.inventory.shirt} />
                        <FullItemsCard title="Quần" data={analytics.inventory.pants} />
                        <FullItemsCard title="Mũ" data={analytics.inventory.hat} />
                    </div>
                </div>
            </div>
        </div>
    );
};
