
import React, { useState, useMemo } from 'react';
import { Order, CustomerStats } from '../../types';
import { formatCurrency } from '../../utils/pricing';

interface AdminCustomersProps {
    orders: Order[];
}

export const AdminCustomers: React.FC<AdminCustomersProps> = ({ orders }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerStats | null>(null);

    // Aggregate Data Logic (Mini CRM)
    const customers = useMemo(() => {
        const stats: Record<string, CustomerStats> = {};

        orders.forEach(order => {
            // Normalize phone (key)
            const phone = order.customer.phone.trim();
            if (!phone) return;

            if (!stats[phone]) {
                stats[phone] = {
                    phone,
                    name: order.customer.name,
                    email: order.customer.email,
                    address: order.customer.address,
                    province: order.customer.province,
                    district: order.customer.district,
                    ward: order.customer.ward,
                    totalOrders: 0,
                    totalSpent: 0,
                    lastOrderDate: 0,
                    orders: []
                };
            }

            // Update Stats
            stats[phone].totalOrders += 1;
            // Only count paid/valid orders for spend? Or all? Let's count revenue from valid statuses
            if (!['Huỷ đơn', 'Xoá đơn'].includes(order.status)) {
                stats[phone].totalSpent += order.totalPrice;
            }
            if (order.createdAt > stats[phone].lastOrderDate) {
                stats[phone].lastOrderDate = order.createdAt;
                // Update latest info
                stats[phone].name = order.customer.name;
                stats[phone].address = order.customer.address;
                stats[phone].province = order.customer.province;
                stats[phone].district = order.customer.district;
                stats[phone].ward = order.customer.ward;
            }
            stats[phone].orders.push(order);
        });

        return Object.values(stats).sort((a, b) => b.lastOrderDate - a.lastOrderDate);
    }, [orders]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.phone.includes(searchTerm) ||
            (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [customers, searchTerm]);

    return (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)] gap-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tổng khách hàng</p>
                    <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Khách quay lại</p>
                    <p className="text-2xl font-bold text-blue-600">{customers.filter(c => c.totalOrders > 1).length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Top chi tiêu</p>
                    <p className="text-lg font-bold text-green-600 truncate">{customers.sort((a,b) => b.totalSpent - a.totalSpent)[0]?.name || '---'}</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-grow overflow-hidden">
                {/* Customer List */}
                <div className={`${selectedCustomer ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-1/2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`}>
                    <div className="p-4 border-b bg-gray-50">
                        <input 
                            type="text" 
                            placeholder="Tìm tên, SĐT, email..." 
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-900"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-grow divide-y divide-gray-100">
                        {filteredCustomers.map(customer => (
                            <div 
                                key={customer.phone} 
                                onClick={() => setSelectedCustomer(customer)}
                                className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors flex justify-between items-center ${selectedCustomer?.phone === customer.phone ? 'bg-blue-50' : ''}`}
                            >
                                <div>
                                    <p className="font-bold text-gray-900">{customer.name}</p>
                                    <p className="text-xs text-gray-500">{customer.phone} {customer.email ? `• ${customer.email}` : ''}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900">{formatCurrency(customer.totalSpent)}</p>
                                    <p className="text-xs text-gray-500">{customer.totalOrders} đơn hàng</p>
                                </div>
                            </div>
                        ))}
                        {filteredCustomers.length === 0 && (
                            <div className="p-8 text-center text-gray-400 italic">Không tìm thấy khách hàng.</div>
                        )}
                    </div>
                </div>

                {/* Customer Detail */}
                <div className={`${!selectedCustomer ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-1/2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative`}>
                    {selectedCustomer ? (
                        <>
                            <div className="absolute top-4 right-4 lg:hidden">
                                <button onClick={() => setSelectedCustomer(null)} className="text-gray-500 p-2 bg-gray-100 rounded-full">&times;</button>
                            </div>
                            <div className="p-6 border-b bg-gray-50">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                                        {selectedCustomer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                                        <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                                        <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm bg-white p-3 rounded-lg border">
                                    <div>
                                        <span className="text-gray-500 block text-xs">Tổng chi tiêu</span>
                                        <span className="font-bold text-green-600 text-lg">{formatCurrency(selectedCustomer.totalSpent)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Tổng đơn hàng</span>
                                        <span className="font-bold text-gray-900 text-lg">{selectedCustomer.totalOrders}</span>
                                    </div>
                                    <div className="col-span-2 border-t pt-2 mt-1">
                                        <span className="text-gray-500 block text-xs">Địa chỉ gần nhất</span>
                                        <span className="text-gray-800">
                                            {selectedCustomer.address}
                                            {selectedCustomer.province && !selectedCustomer.address.toLowerCase().includes(selectedCustomer.province.toLowerCase()) && (
                                                <>
                                                    {', '}
                                                    {[selectedCustomer.ward, selectedCustomer.district, selectedCustomer.province].filter(Boolean).join(', ')}
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-grow overflow-y-auto p-4 bg-gray-50">
                                <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider">Lịch sử đơn hàng</h3>
                                <div className="space-y-3">
                                    {selectedCustomer.orders.sort((a,b) => b.createdAt - a.createdAt).map(order => (
                                        <div key={order.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono font-bold text-sm text-blue-600">{order.id}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{order.status}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mb-2">
                                                {new Date(order.createdAt).toLocaleString('vi-VN')}
                                            </div>
                                            <div className="flex justify-between items-center border-t border-dashed pt-2">
                                                <span className="text-xs text-gray-600">{order.items.length} sản phẩm</span>
                                                <span className="font-bold text-gray-900">{formatCurrency(order.totalPrice)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 italic">
                            Chọn một khách hàng để xem chi tiết.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
