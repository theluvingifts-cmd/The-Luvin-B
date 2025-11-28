
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
        imageUrl: '',
        description: '',
        stock: 100,
        colors: ['black', 'white'] 
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: ['price', 'frameWidthCm', 'frameHeightCm', 'backgroundWidthCm', 'backgroundHeightCm', 'stock'].includes(name) ? Number(value) : value
        }));
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const colors = e.target.value.split(',').map(c => c.trim()).filter(c => c !== '');
        setFormData(prev => ({ ...prev, colors }));
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Sửa Khung' : 'Thêm Khung Mới'}</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">ID (Unique)</label>
                            <input name="id" value={formData.id} onChange={handleChange} disabled={!!initialData} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm disabled:bg-gray-100" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên Khung</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" placeholder="15x15cm..." />
                        </div>
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
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá (VNĐ)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tồn kho</label>
                            <input type="number" name="stock" value={formData.stock} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mô tả ngắn</label>
                            <input name="description" value={formData.description} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" placeholder="Nhỏ gọn, tinh tế..." />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Màu sắc (Phân cách dấu phẩy)</label>
                            <input 
                                value={formData.colors.join(', ')} 
                                onChange={handleColorChange} 
                                className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" 
                                placeholder="black, white, wood..." 
                            />
                            <div className="flex gap-2 mt-2">
                                {formData.colors.map(c => (
                                    <span key={c} className="px-2 py-1 bg-gray-200 rounded text-xs">{c}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={() => onSave(formData)} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded">Lưu</button>
                </div>
            </div>
        </div>
    );
};
