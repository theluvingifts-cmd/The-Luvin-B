
import React, { useState } from 'react';
import { FrameOption } from '../../../types';

export const FrameForm: React.FC<{
    initialData?: FrameOption | null;
    onSave: (frame: FrameOption) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<FrameOption>(initialData || {
        id: `frame_${Date.now()}`,
        name: '',
        frameWidthCm: 15,
        frameHeightCm: 15,
        backgroundWidthCm: 12,
        backgroundHeightCm: 12,
        price: 0,
        costPrice: 0,
        salePrice: 0,
        saleEndDate: '',
        imageUrl: '',
        description: '',
        stock: 100,
        colors: ['black', 'white'] 
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: ['price', 'costPrice', 'salePrice', 'frameWidthCm', 'frameHeightCm', 'backgroundWidthCm', 'backgroundHeightCm', 'stock'].includes(name) ? Number(value) : value
        }));
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const colors = e.target.value.split(',').map(c => c.trim()).filter(c => c !== '');
        setFormData(prev => ({ ...prev, colors }));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Chỉnh sửa Khung' : 'Thêm Khung Mới'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                    &larr; Quay lại danh sách
                </button>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-4">Thông tin cơ bản</h4>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">ID (Unique)</label>
                            <input name="id" value={formData.id} onChange={handleChange} disabled={!!initialData} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm disabled:bg-gray-100 disabled:text-gray-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên Khung</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm focus:border-gray-500 outline-none" placeholder="15x15cm..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá bán (VNĐ)</label>
                                <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm font-bold text-gray-800" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 text-red-600">Giá vốn (VNĐ)</label>
                                <input type="number" name="costPrice" value={formData.costPrice || 0} onChange={handleChange} className="w-full p-2.5 border border-red-200 rounded bg-red-50 text-sm text-red-600 font-bold focus:ring-1 focus:ring-red-500" />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <h5 className="font-bold text-sm text-blue-700 mb-3">🔥 Thiết lập Khuyến mãi</h5>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Giá Sale (VNĐ)</label>
                                    <input type="number" name="salePrice" value={formData.salePrice || 0} onChange={handleChange} className="w-full p-2.5 border border-blue-200 rounded bg-white text-sm" placeholder="0 = Không sale" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Kết thúc KM</label>
                                    <input type="date" name="saleEndDate" value={formData.saleEndDate || ''} onChange={handleChange} className="w-full p-2.5 border border-blue-200 rounded bg-white text-sm" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tồn kho</label>
                            <input type="number" name="stock" value={formData.stock} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mô tả ngắn</label>
                            <input name="description" value={formData.description} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" placeholder="Nhỏ gọn, tinh tế..." />
                        </div>
                    </div>

                    <div className="space-y-5">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-4">Thông số & Màu sắc</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng Khung (cm)</label>
                                <input type="number" name="frameWidthCm" value={formData.frameWidthCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao Khung (cm)</label>
                                <input type="number" name="frameHeightCm" value={formData.frameHeightCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng Nền (cm)</label>
                                <input type="number" name="backgroundWidthCm" value={formData.backgroundWidthCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao Nền (cm)</label>
                                <input type="number" name="backgroundHeightCm" value={formData.backgroundHeightCm} onChange={handleChange} step="0.1" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Màu sắc (Phân cách dấu phẩy)</label>
                            <input 
                                value={formData.colors.join(', ')} 
                                onChange={handleColorChange} 
                                className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" 
                                placeholder="black, white, wood..." 
                            />
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {formData.colors.map(c => (
                                    <span key={c} className="px-2 py-1 bg-gray-100 border rounded text-xs font-medium">{c}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors">Hủy bỏ</button>
                <button onClick={() => onSave(formData)} className="px-6 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg transition-colors shadow-lg">Lưu Khung</button>
            </div>
        </div>
    );
};
