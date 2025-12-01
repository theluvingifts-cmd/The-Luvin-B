
import React, { useState, useEffect } from 'react';
import { Voucher } from '../../types';
import { getAllVouchers, addVoucher, updateVoucher, deleteVoucher } from '../../services/voucherService';
import { formatCurrency } from '../../utils/pricing';

export const AdminVouchers: React.FC = () => {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [formData, setFormData] = useState<Partial<Voucher>>({
        code: '', type: 'fixed', value: 0, minOrderValue: 0, maxUsage: 0, expiryDate: '', isActive: true, description: ''
    });

    useEffect(() => {
        fetchVouchers();
    }, []);

    const fetchVouchers = async () => {
        setLoading(true);
        const data = await getAllVouchers();
        setVouchers(data);
        setLoading(false);
    };

    const handleEdit = (voucher: Voucher) => {
        setEditingVoucher(voucher);
        setFormData(voucher);
        setIsEditing(true);
    };

    const handleAddNew = () => {
        setEditingVoucher(null);
        setFormData({
            code: '', type: 'fixed', value: 0, minOrderValue: 0, maxUsage: 100, usedCount: 0, expiryDate: '', isActive: true, description: ''
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!formData.code || formData.value === undefined) {
            alert("Vui lòng điền mã và giá trị giảm.");
            return;
        }

        const voucherData = {
            ...formData,
            code: formData.code.toUpperCase().trim(),
            usedCount: formData.usedCount || 0,
        } as Voucher;

        setLoading(true);
        if (editingVoucher) {
            await updateVoucher(editingVoucher.id, voucherData);
        } else {
            const exists = vouchers.find(v => v.code === voucherData.code);
            if (exists) {
                alert("Mã này đã tồn tại!");
                setLoading(false);
                return;
            }
            await addVoucher(voucherData);
        }
        await fetchVouchers();
        setIsEditing(false);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Bạn có chắc muốn xóa mã này?")) {
            setLoading(true);
            await deleteVoucher(id);
            await fetchVouchers();
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in p-2 sm:p-0">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Quản lý Mã Giảm Giá</h2>
                <button onClick={handleAddNew} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors shadow-lg">
                    + Tạo Mã Mới
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                            <tr>
                                <th className="px-4 py-3">Mã Code</th>
                                <th className="px-4 py-3">Giảm giá</th>
                                <th className="px-4 py-3">Đơn tối thiểu</th>
                                <th className="px-4 py-3">Lượt dùng</th>
                                <th className="px-4 py-3">Hết hạn</th>
                                <th className="px-4 py-3">Trạng thái</th>
                                <th className="px-4 py-3 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {vouchers.map(v => (
                                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-blue-600 font-mono">{v.code}</td>
                                    <td className="px-4 py-3 font-medium">
                                        {v.type === 'percent' ? `${v.value}%` : formatCurrency(v.value)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{formatCurrency(v.minOrderValue)}</td>
                                    <td className="px-4 py-3">
                                        <span className="font-bold">{v.usedCount}</span>
                                        {v.maxUsage ? <span className="text-gray-400">/{v.maxUsage}</span> : <span className="text-gray-400">/∞</span>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {v.expiryDate ? new Date(v.expiryDate).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {v.isActive ? 'Hoạt động' : 'Đã khóa'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <button onClick={() => handleEdit(v)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">Sửa</button>
                                        <button onClick={() => handleDelete(v.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">Xóa</button>
                                    </td>
                                </tr>
                            ))}
                            {vouchers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 italic">Chưa có mã giảm giá nào.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Form */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">{editingVoucher ? 'Sửa Voucher' : 'Tạo Voucher Mới'}</h3>
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mã Code (Tự động in hoa)</label>
                                <input 
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 outline-none font-mono uppercase"
                                    value={formData.code}
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    placeholder="LUVIN10"
                                    disabled={!!editingVoucher}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loại giảm</label>
                                    <select 
                                        className="w-full p-2 border border-gray-300 rounded"
                                        value={formData.type}
                                        onChange={e => setFormData({...formData, type: e.target.value as 'fixed' | 'percent'})}
                                    >
                                        <option value="fixed">Số tiền (VNĐ)</option>
                                        <option value="percent">Phần trăm (%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Giá trị giảm</label>
                                    <input 
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded"
                                        value={formData.value}
                                        onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Đơn tối thiểu</label>
                                    <input 
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded"
                                        value={formData.minOrderValue}
                                        onChange={e => setFormData({...formData, minOrderValue: Number(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Giới hạn SL (0 = ∞)</label>
                                    <input 
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded"
                                        value={formData.maxUsage}
                                        onChange={e => setFormData({...formData, maxUsage: Number(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày hết hạn (Để trống = Vĩnh viễn)</label>
                                <input 
                                    type="date"
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={formData.expiryDate}
                                    onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mô tả</label>
                                <textarea 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    rows={2}
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    placeholder="Ví dụ: Giảm giá ngày 8/3..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="isActive"
                                    className="w-4 h-4"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Kích hoạt mã này</label>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded">Hủy</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-md">
                                {loading ? 'Đang lưu...' : 'Lưu Mã'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
