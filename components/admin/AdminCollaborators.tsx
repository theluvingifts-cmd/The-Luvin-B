
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order } from '../../types';
import { formatCurrency } from '../../utils/pricing';

interface CollaboratorProfile {
    uid: string;
    fullName: string;
    phone: string;
    bankName: string;
    bankAccount: string;
    bankOwner: string;
    referralCode: string;
    status: string;
    createdAt: number;
    customCommissionRate?: number;
}

interface AdminCollaboratorsProps {
    orders: Order[];
}

export const AdminCollaborators: React.FC<AdminCollaboratorsProps> = ({ orders }) => {
    const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchCollaborators = async () => {
            try {
                const q = query(collection(db, 'collaborators'));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as CollaboratorProfile));
                setCollaborators(list);
            } catch (error) {
                console.error("Error fetching collaborators:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCollaborators();
    }, []);

    const handleUpdateStatus = async (uid: string, newStatus: string) => {
        if (!confirm(`Bạn có chắc chắn muốn chuyển trạng thái CTV này sang "${newStatus === 'active' ? 'Hoạt động' : newStatus === 'pending' ? 'Chờ duyệt' : 'Tạm khóa'}"?`)) return;
        
        try {
            await updateDoc(doc(db, 'collaborators', uid), { status: newStatus });
            setCollaborators(prev => prev.map(c => c.uid === uid ? { ...c, status: newStatus } : c));
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Lỗi khi cập nhật trạng thái");
        }
    };

    const handleUpdateCommission = async (uid: string, rate: number) => {
        try {
            await updateDoc(doc(db, 'collaborators', uid), { customCommissionRate: rate });
            setCollaborators(prev => prev.map(c => c.uid === uid ? { ...c, customCommissionRate: rate } : c));
        } catch (error) {
            console.error("Error updating commission:", error);
            alert("Lỗi khi cập nhật hoa hồng");
        }
    };

    const colabStats = useMemo(() => {
        return collaborators.map(c => {
            const cOrders = orders.filter(o => o.referredBy === c.phone || o.referredBy === c.referralCode);
            const successfulOrders = cOrders.filter(o => o.status === 'Đã giao hàng');
            
            const calculateOrderCommission = (o: Order) => {
                if (o.commissionAmount !== undefined) return o.commissionAmount;
                const rate = c.customCommissionRate !== undefined ? c.customCommissionRate / 100 : (successfulOrders.length < 2 ? 0.05 : 0.1);
                return Math.round(o.totalPrice * rate);
            };

            const totalCommission = successfulOrders.reduce((sum, o) => sum + calculateOrderCommission(o), 0);
            const unpaidCommission = successfulOrders.filter(o => !o.commissionPaid).reduce((sum, o) => sum + calculateOrderCommission(o), 0);
            
            return {
                ...c,
                totalOrders: cOrders.length,
                successfulOrders: successfulOrders.length,
                totalCommission,
                unpaidCommission
            };
        });
    }, [collaborators, orders]);

    const filteredColabs = colabStats.filter(c => 
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm) ||
        c.bankAccount.includes(searchTerm)
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải danh sách CTV...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Quản lý Cộng tác viên</h2>
                    <p className="text-xs text-gray-500">Tổng số: {collaborators.length} CTV</p>
                </div>
                <div className="relative w-full md:w-64">
                    <input 
                        type="text" 
                        placeholder="Tìm tên, SĐT, STK..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-gray-900 outline-none"
                    />
                    <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-4">CTV / Thông tin</th>
                                <th className="px-6 py-4">Ngân hàng</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4 text-center">Hoa hồng (%)</th>
                                <th className="px-6 py-4 text-center">Đơn hàng</th>
                                <th className="px-6 py-4 text-right">Tổng hoa hồng</th>
                                <th className="px-6 py-4 text-right text-orange-600">Chưa trả</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredColabs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">Không tìm thấy CTV nào.</td>
                                </tr>
                            ) : filteredColabs.map(c => (
                                <tr key={c.uid} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{c.fullName}</div>
                                        <div className="text-xs text-gray-500">{c.phone}</div>
                                        <div className="text-[10px] text-luvin-pink font-bold mt-1">Mã: {c.referralCode}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-700">{c.bankName}</div>
                                        <div className="font-mono text-xs">{c.bankAccount}</div>
                                        <div className="text-[10px] text-gray-400 uppercase">{c.bankOwner}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                            c.status === 'active' ? 'bg-green-100 text-green-600' : 
                                            c.status === 'pending' ? 'bg-amber-100 text-amber-600' : 
                                            'bg-red-100 text-red-600'
                                        }`}>
                                            {c.status === 'active' ? 'Đang hoạt động' : 
                                             c.status === 'pending' ? 'Chờ duyệt' : 
                                             'Tạm khóa'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <input 
                                                type="number" 
                                                className="w-12 p-1 border rounded text-xs text-center font-bold"
                                                defaultValue={c.customCommissionRate || (c.successfulOrders < 2 ? 5 : 10)}
                                                onBlur={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (!isNaN(val) && val >= 0 && val <= 100) {
                                                        handleUpdateCommission(c.uid, val);
                                                    }
                                                }}
                                            />
                                            <span className="text-xs text-gray-400">%</span>
                                        </div>
                                        {c.customCommissionRate === undefined && (
                                            <div className="text-[9px] text-gray-400 mt-1 italic">Mặc định</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="font-bold text-gray-900">{c.successfulOrders} / {c.totalOrders}</div>
                                        <div className="text-[10px] text-gray-400">Thành công / Tổng</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {formatCurrency(c.totalCommission, 'admin')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-bold text-orange-600">{formatCurrency(c.unpaidCommission, 'admin')}</div>
                                        {c.unpaidCommission > 0 && (
                                            <div className="text-[10px] text-orange-400 italic">Cần thanh toán</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {c.status === 'pending' && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(c.uid, 'active')}
                                                    className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                                                    title="Duyệt CTV"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                </button>
                                            )}
                                            {c.status === 'active' ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(c.uid, 'suspended')}
                                                    className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"
                                                    title="Khóa CTV"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                </button>
                                            ) : c.status === 'suspended' ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(c.uid, 'active')}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                                    title="Mở khóa"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
