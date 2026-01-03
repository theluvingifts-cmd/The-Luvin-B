
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
        { id: 'date', label: 'Ngày kỷ niệm', type: 'date', required: false },
        { id: 'message', label: 'Thông điệp', type: 'textarea', required: false }
    ]);

    const [isUploading, setIsUploading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddField = () => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            label: 'Trường thông tin mới',
            type: 'text',
            required: false,
            placeholder: ''
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
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setFormData(prev => ({ ...prev, url: url }));
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleFinalSave = () => {
        onSave({ ...formData, formFields: fields });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-2xl mx-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Sửa Background' : 'Thêm Background'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                    &larr; Quay lại
                </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tên hiển thị</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm" placeholder="VD: Graduation 1..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Danh mục</label>
                        <input name="category" value={formData.category} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Loại khung áp dụng</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm">
                            <option value="square">Vuông (15x15, 23x23)</option>
                            <option value="rectangle">Chữ nhật (A5)</option>
                        </select>
                    </div>
                    {formData.type === 'rectangle' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hướng</label>
                            <select name="orientation" value={formData.orientation} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm">
                                <option value="portrait">Dọc</option>
                                <option value="landscape">Ngang</option>
                            </select>
                        </div>
                    )}
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Loại nền</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg w-max mb-3">
                        <button onClick={() => setMode('image')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${mode === 'image' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🖼️ Ảnh</button>
                        <button onClick={() => setMode('color')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${mode === 'color' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🎨 Màu</button>
                    </div>

                    {mode === 'image' ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            {formData.url && !formData.url.startsWith('#') ? <img src={formData.url} alt="Preview" className="max-h-40 object-contain mx-auto rounded" /> : <span className="text-xs text-gray-400">Chọn ảnh nền</span>}
                        </div>
                    ) : (
                        <div className="flex gap-4 items-center p-3 border rounded-lg bg-gray-50">
                            <input type="color" value={formData.url.startsWith('#') ? formData.url : '#ffffff'} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} className="w-12 h-12 border-0 cursor-pointer" />
                            <input value={formData.url} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} className="flex-grow p-2 border rounded text-sm font-mono uppercase" placeholder="#FFFFFF" />
                        </div>
                    )}
                </div>

                {/* DYNAMIC FORM FIELDS SECTION */}
                <div className="pt-6 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-black text-gray-700 uppercase tracking-tight">Cấu hình Form thông tin (Step 2)</h4>
                        <button onClick={handleAddField} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">+ Thêm trường</button>
                    </div>
                    
                    <div className="space-y-3">
                        {fields.map((field, index) => (
                            <div key={field.id} className="p-3 bg-gray-50 border rounded-xl flex flex-col gap-3 relative group">
                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-5">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Tên nhãn (Label)</label>
                                        <input 
                                            value={field.label} 
                                            onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                                            className="w-full p-2 border rounded text-xs" 
                                            placeholder="VD: Tên của bạn"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Loại nhập liệu</label>
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
                                    <div className="col-span-3 flex flex-col justify-end pb-1">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={field.required} 
                                                onChange={e => handleUpdateField(field.id, { required: e.target.checked })}
                                                className="w-3.5 h-3.5 accent-blue-600"
                                            />
                                            <span className="text-[10px] font-bold text-gray-500">Bắt buộc</span>
                                        </label>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleRemoveField(field.id)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >×</button>
                            </div>
                        ))}
                        {fields.length === 0 && <p className="text-center text-xs text-gray-400 italic">Mẫu này sẽ không yêu cầu khách nhập thông tin.</p>}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                <button onClick={handleFinalSave} disabled={isUploading || !formData.url} className="px-6 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded disabled:opacity-50">Lưu mẫu nền</button>
            </div>
        </div>
    );
};
