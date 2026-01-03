
import React, { useState } from 'react';
import { PresetBackground, FormField } from '../../../types';
import { uploadToCloudinary } from '../../../services/uploadService';

export const BackgroundForm: React.FC<{
    initialData?: PresetBackground | null;
    onSave: (bg: PresetBackground) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [mode, setMode] = useState<'image' | 'color'>(
        initialData?.url?.startsWith('#') ? 'color' : 'image'
    );

    const [formData, setFormData] = useState<PresetBackground>(initialData || {
        id: `bg_${Date.now()}`, name: '', url: '', category: 'Khác', type: 'square', orientation: 'portrait',
        formFields: []
    });
    
    const [fields, setFields] = useState<FormField[]>(initialData?.formFields || [
        { id: 'names', label: 'Tên / Lời tựa', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
        { id: 'message', label: 'Thông điệp', type: 'textarea', required: false, placeholder: 'Lời nhắn gửi đến người nhận...' }
    ]);

    const [isUploading, setIsUploading] = useState(false);

    const handleAddField = () => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            label: 'Trường thông tin mới',
            type: 'text',
            required: false,
            placeholder: 'Nhập hướng dẫn ví dụ tại đây...',
            limit: 1
        };
        setFields([...fields, newField]);
    };

    const handleUpdateField = (id: string, updates: Partial<FormField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleRemoveField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) setFormData(prev => ({ ...prev, url: url }));
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-2xl mx-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Sửa Background' : 'Thêm Background'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium">
                    &larr; Quay lại
                </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tên hiển thị</label>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Danh mục</label>
                        <input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm" />
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-black text-gray-700 uppercase tracking-tight">Cấu hình Form thông tin (Step 2)</h4>
                        <button onClick={handleAddField} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">+ Thêm trường</button>
                    </div>
                    
                    <div className="space-y-4">
                        {fields.map((field) => (
                            <div key={field.id} className="p-4 bg-gray-50 border rounded-xl relative group">
                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-6">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tiêu đề trường (Label)</label>
                                        <input 
                                            value={field.label} 
                                            onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                                            className="w-full p-2 border rounded text-xs font-bold" 
                                            placeholder="VD: Tên của bạn"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Loại nhập liệu</label>
                                        <select 
                                            value={field.type} 
                                            onChange={e => handleUpdateField(field.id, { type: e.target.value as any })}
                                            className="w-full p-2 border rounded text-xs bg-white"
                                        >
                                            <option value="text">Chữ (1 dòng)</option>
                                            <option value="textarea">Đoạn văn (Nhiều dòng)</option>
                                            <option value="date">Ngày tháng</option>
                                            <option value="image">Ảnh đính kèm</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 flex items-end justify-center pb-2">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={field.required} onChange={e => handleUpdateField(field.id, { required: e.target.checked })} className="w-3.5 h-3.5 accent-blue-600" />
                                            <span className="text-[10px] font-bold text-gray-500">Bắt buộc</span>
                                        </label>
                                    </div>
                                    
                                    <div className="col-span-8">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tin nhắn hướng dẫn (Ví dụ / Placeholder)</label>
                                        <input 
                                            value={field.placeholder || ''} 
                                            onChange={e => handleUpdateField(field.id, { placeholder: e.target.value })}
                                            className="w-full p-2 border rounded text-xs italic" 
                                            placeholder="VD: Ví dụ: Nguyễn Văn A..."
                                        />
                                    </div>
                                    
                                    {field.type === 'image' && (
                                        <div className="col-span-4">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Số lượng ảnh tối đa</label>
                                            <input 
                                                type="number"
                                                value={field.limit || 1} 
                                                onChange={e => handleUpdateField(field.id, { limit: parseInt(e.target.value) || 1 })}
                                                className="w-full p-2 border rounded text-xs font-mono" 
                                                min="1" max="10"
                                            />
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => handleRemoveField(field.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">×</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600">Hủy</button>
                <button onClick={() => onSave({ ...formData, formFields: fields })} className="px-6 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded shadow-lg">Lưu Background</button>
            </div>
        </div>
    );
};
