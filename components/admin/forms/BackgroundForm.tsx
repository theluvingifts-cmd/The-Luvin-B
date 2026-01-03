
import React, { useState } from 'react';
import { PresetBackground, FormField } from '../../../types';
import { uploadToCloudinary } from '../../../services/uploadService';

const FIELD_TYPES = [
    { value: 'text', label: 'Dòng văn bản ngắn' },
    { value: 'textarea', label: 'Đoạn văn bản dài' },
    { value: 'date', label: 'Ngày tháng' },
    { value: 'image', label: 'Tải ảnh đính kèm' }
];

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
    
    const [isUploading, setIsUploading] = useState(false);

    // Form Field Handlers
    const addField = () => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            label: 'Thông tin mới',
            type: 'text',
            required: true,
            placeholder: 'Nhập gợi ý...'
        };
        setFormData({ ...formData, formFields: [...(formData.formFields || []), newField] });
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setFormData({
            ...formData,
            formFields: (formData.formFields || []).map(f => f.id === id ? { ...f, ...updates } : f)
        });
    };

    const removeField = (id: string) => {
        setFormData({
            ...formData,
            formFields: (formData.formFields || []).filter(f => f.id !== id)
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setFormData(prev => ({ ...prev, url: url }));
                } else {
                    alert("Lỗi tải ảnh");
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-3xl mx-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Sửa Background' : 'Thêm Background'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                    &larr; Quay lại
                </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Cấu hình cơ bản */}
                <div className="space-y-4 border-r pr-0 md:pr-8 border-gray-100">
                    <h4 className="font-bold text-blue-600 uppercase text-xs tracking-widest mb-4">1. Hình ảnh & Thông số</h4>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên hiển thị</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white text-sm" placeholder="Ví dụ: Sinh nhật 1..." />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Danh mục</label>
                        <input name="category" value={formData.category} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white text-sm" placeholder="Kỷ niệm, Sinh nhật, Màu trơn..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại khung</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white text-sm">
                                <option value="square">Vuông</option>
                                <option value="rectangle">Chữ nhật</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại nền</label>
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setMode('image')} className={`flex-1 py-1 text-xs font-bold rounded ${mode === 'image' ? 'bg-white shadow' : 'text-gray-500'}`}>Ảnh</button>
                                <button onClick={() => setMode('color')} className={`flex-1 py-1 text-xs font-bold rounded ${mode === 'color' ? 'bg-white shadow' : 'text-gray-500'}`}>Màu</button>
                            </div>
                        </div>
                    </div>
                    
                    {mode === 'image' ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                            {isUploading ? <span className="text-xs">Đang tải...</span> : formData.url && !formData.url.startsWith('#') ? <img src={formData.url} className="max-h-32 mx-auto rounded" /> : <span className="text-xs text-gray-400">Chọn ảnh nền</span>}
                        </div>
                    ) : (
                        <div className="flex gap-4 items-center p-3 border rounded-lg bg-gray-50">
                            <input type="color" value={formData.url.startsWith('#') ? formData.url : '#ffffff'} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} className="w-10 h-10 rounded border-0 cursor-pointer" />
                            <input className="flex-grow p-2 border rounded text-xs uppercase font-mono" value={formData.url} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
                        </div>
                    )}
                </div>

                {/* Cấu hình Form động (User Request) */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-blue-600 uppercase text-xs tracking-widest">2. Form thông tin cho khách</h4>
                        <button onClick={addField} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded-lg font-bold hover:bg-blue-700 transition-colors">+ Thêm ô nhập</button>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar border-t pt-3">
                        {(!formData.formFields || formData.formFields.length === 0) ? (
                            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-xs text-gray-400">Mẫu này đang dùng Form mặc định.<br/>Bấm nút phía trên để tự tạo Form riêng.</p>
                            </div>
                        ) : (
                            formData.formFields.map((field, idx) => (
                                <div key={field.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 relative group">
                                    <button onClick={() => removeField(field.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-xs font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">×</button>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Nhãn hiển thị</label>
                                            <input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} className="w-full p-1.5 border rounded text-xs font-bold" placeholder="VD: Tên của bé" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Loại dữ liệu</label>
                                            <select value={field.type} onChange={(e: any) => updateField(field.id, { type: e.target.value })} className="w-full p-1.5 border rounded text-xs bg-white">
                                                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-end">
                                            <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                                                <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} className="w-3 h-3 accent-blue-600" />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase">Bắt buộc</span>
                                            </label>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Gợi ý (Placeholder)</label>
                                            <input value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} className="w-full p-1.5 border rounded text-xs" placeholder="VD: Nhập tên bé tại đây..." />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <button onClick={onCancel} className="px-5 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg">Hủy</button>
                <button onClick={() => onSave(formData)} disabled={isUploading || !formData.url} className="px-8 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg disabled:opacity-50 shadow-md">Lưu Mẫu & Form</button>
            </div>
        </div>
    );
};
