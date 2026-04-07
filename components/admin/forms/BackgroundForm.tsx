
import React, { useState } from 'react';
import { PresetBackground, FormField } from '../../../types';
import { uploadFile } from '../../../services/uploadService';

const DEFAULT_FORM_FIELDS: FormField[] = [
    { id: 'names', label: 'Tên / Lời tựa ngắn', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
    { id: 'date', label: 'Ngày kỷ niệm (nếu có)', type: 'date', required: false },
    { id: 'message', label: 'Thông điệp của bạn', type: 'textarea', required: false, placeholder: 'Nhập lời nhắn gửi...' },
    { id: 'photo', label: 'Đính kèm ảnh in thêm', type: 'image', required: false },
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
        id: `bg_${Date.now()}`, 
        name: '', 
        url: '', 
        category: 'Khác', 
        type: 'square', 
        orientation: 'portrait',
        formFields: DEFAULT_FORM_FIELDS // Tự động nạp bộ trường mặc định khi thêm mới
    });

    const [isUploading, setIsUploading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadFile(file);
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

    // --- QUẢN LÝ CẤU HÌNH FORM (CUSTOM FIELDS) ---
    const handleAddField = () => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            label: 'Trường mới',
            type: 'text',
            required: false,
            placeholder: ''
        };
        setFormData(prev => ({
            ...prev,
            formFields: [...(prev.formFields || []), newField]
        }));
    };

    const handleUpdateField = (id: string, updates: Partial<FormField>) => {
        setFormData(prev => ({
            ...prev,
            formFields: (prev.formFields || []).map(f => f.id === id ? { ...f, ...updates } : f)
        }));
    };

    const handleRemoveField = (id: string) => {
        setFormData(prev => ({
            ...prev,
            formFields: (prev.formFields || []).filter(f => f.id !== id)
        }));
    };

    const loadDefaultTemplate = () => {
        if (confirm("Ghi đè bằng bộ trường mặc định mới?")) {
            setFormData(prev => ({
                ...prev,
                formFields: [...DEFAULT_FORM_FIELDS]
            }));
        }
    };

    const loadManyPhotosTemplate = () => {
        const count = prompt("Bạn muốn khách gửi bao nhiêu ảnh cho mẫu này?", "5");
        if (count && !isNaN(Number(count))) {
            const num = parseInt(count);
            const photoFields: FormField[] = Array.from({ length: num }, (_, i) => ({
                id: `photo_${Date.now()}_${i}`,
                label: `Ảnh in thêm ${i + 1}`,
                type: 'image',
                required: true
            }));
            setFormData(prev => ({
                ...prev,
                formFields: [...(prev.formFields || []), ...photoFields]
            }));
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-6xl mx-auto flex flex-col h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl flex-shrink-0">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Sửa Background' : 'Thêm Background'}</h3>
                    <p className="text-xs text-gray-500">Cấu hình hình ảnh và các ô nhập liệu dành cho khách hàng</p>
                </div>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all">
                    &larr; Quay lại
                </button>
            </div>
            
            <div className="flex-grow overflow-hidden flex flex-col md:flex-row">
                {/* LEFT: THÔNG TIN NỀN */}
                <div className="w-full md:w-2/5 p-6 border-r border-gray-100 overflow-y-auto custom-scrollbar">
                    <h4 className="font-black text-xs text-blue-600 uppercase tracking-widest mb-4">1. Thông tin nền</h4>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên mẫu nền</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold" placeholder="Ví dụ: Tốt nghiệp 1, Sinh nhật 4..." />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Danh mục</label>
                                <input name="category" value={formData.category} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-sm" placeholder="Kỷ niệm, Tết..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loại khung</label>
                                <select name="type" value={formData.type} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-sm font-bold">
                                    <option value="square">Vuông (15x15, 23x23)</option>
                                    <option value="rectangle">Chữ nhật (A5)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Hình ảnh nền chủ đạo</label>
                            <div className="flex bg-gray-200 p-1 rounded-xl w-max mb-3">
                                <button onClick={() => setMode('image')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'image' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🖼️ Ảnh</button>
                                <button onClick={() => setMode('color')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'color' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🎨 Màu</button>
                            </div>

                            {mode === 'image' ? (
                                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center bg-gray-50 hover:bg-gray-100 transition-all relative aspect-square flex items-center justify-center overflow-hidden">
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                                    {isUploading ? (
                                        <div className="animate-pulse flex flex-col items-center">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <span className="text-xs font-bold text-blue-600">Đang tải...</span>
                                        </div>
                                    ) : formData.url && !formData.url.startsWith('#') ? (
                                        <img src={formData.url} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                                    ) : (
                                        <div className="text-gray-400">
                                            <span className="text-3xl block mb-1">☁️</span>
                                            <span className="text-xs font-bold">Bấm để tải ảnh nền</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50 flex items-center gap-4">
                                    <input type="color" className="w-16 h-16 rounded-xl border-0 cursor-pointer shadow-sm" value={formData.url.startsWith('#') ? formData.url : '#ffffff'} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
                                    <div className="flex-grow">
                                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Mã màu HEX</span>
                                        <input className="w-full p-2 border rounded-lg text-sm font-mono uppercase" value={formData.url} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: CẤU HÌNH FORM DỮ LIỆU KHÁCH NHẬP */}
                <div className="w-full md:w-3/5 p-6 bg-white overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h4 className="font-black text-xs text-orange-600 uppercase tracking-widest">2. Thiết lập Form khách nhập</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">Quy định các ô thông tin khách cần điền khi chọn nền này</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={loadDefaultTemplate} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-all border border-gray-200">
                                Reset Mặc định
                            </button>
                            <button onClick={loadManyPhotosTemplate} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-all border border-blue-200">
                                + Mẫu nhiều ảnh
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {(formData.formFields || []).map((field, index) => (
                            <div key={field.id} className="group p-4 bg-gray-50 border border-gray-200 rounded-2xl relative animate-fade-in hover:border-blue-300 transition-all">
                                {/* Delete Button */}
                                <button 
                                    onClick={() => handleRemoveField(field.id)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                >
                                    &times;
                                </button>

                                <div className="grid grid-cols-12 gap-4">
                                    {/* Numbering */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        <span className="text-lg font-black text-gray-300">{index + 1}</span>
                                    </div>

                                    {/* Label Input */}
                                    <div className="col-span-5">
                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">Tên ô nhập (Label)</label>
                                        <input 
                                            value={field.label} 
                                            onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                                            className="w-full p-2 border rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                                            placeholder="VD: Tên của bạn..."
                                        />
                                    </div>

                                    {/* Type Selector */}
                                    <div className="col-span-3">
                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">Loại dữ liệu</label>
                                        <select 
                                            value={field.type} 
                                            onChange={e => handleUpdateField(field.id, { type: e.target.value as any })}
                                            className="w-full p-2 border rounded-lg text-[10px] font-bold bg-white"
                                        >
                                            <option value="text">Chữ ngắn</option>
                                            <option value="textarea">Chữ dài</option>
                                            <option value="date">Ngày tháng</option>
                                            <option value="number">Số lượng</option>
                                            <option value="select">Lựa chọn (Dropdown)</option>
                                            <option value="color">Màu sắc</option>
                                            <option value="image">Hình ảnh</option>
                                        </select>
                                    </div>

                                    {/* Required Toggle */}
                                    <div className="col-span-3 flex items-end pb-1.5 justify-end">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <span className="text-[10px] font-bold text-gray-500">Bắt buộc?</span>
                                            <div 
                                                onClick={() => handleUpdateField(field.id, { required: !field.required })}
                                                className={`w-10 h-5 rounded-full p-1 transition-colors ${field.required ? 'bg-blue-600' : 'bg-gray-300'}`}
                                            >
                                                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${field.required ? 'translate-x-5' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Additional Settings based on Type */}
                                    <div className="col-span-11 col-start-2 grid grid-cols-2 gap-4 mt-2 border-t pt-2">
                                        {/* Placeholder / Help Text */}
                                        <div className="col-span-2 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Gợi ý nhập (Placeholder)</label>
                                                <input 
                                                    value={field.placeholder || ''} 
                                                    onChange={e => handleUpdateField(field.id, { placeholder: e.target.value })}
                                                    className="w-full p-2 border rounded-lg text-[10px] outline-none italic text-gray-500"
                                                    placeholder="VD: Nhập tên cặp đôi tại đây..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Hướng dẫn (Help Text)</label>
                                                <input 
                                                    value={field.helpText || ''} 
                                                    onChange={e => handleUpdateField(field.id, { helpText: e.target.value })}
                                                    className="w-full p-2 border rounded-lg text-[10px] outline-none italic text-gray-500"
                                                    placeholder="VD: Tên sẽ được in hoa toàn bộ..."
                                                />
                                            </div>
                                        </div>

                                        {/* Number Settings */}
                                        {field.type === 'number' && (
                                            <div className="col-span-2 grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Tối thiểu (Min)</label>
                                                    <input type="number" value={field.min || ''} onChange={e => handleUpdateField(field.id, { min: Number(e.target.value) })} className="w-full p-2 border rounded-lg text-[10px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Tối đa (Max)</label>
                                                    <input type="number" value={field.max || ''} onChange={e => handleUpdateField(field.id, { max: Number(e.target.value) })} className="w-full p-2 border rounded-lg text-[10px]" />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Bước nhảy (Step)</label>
                                                    <input type="number" value={field.step || ''} onChange={e => handleUpdateField(field.id, { step: Number(e.target.value) })} className="w-full p-2 border rounded-lg text-[10px]" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Select Options */}
                                        {field.type === 'select' && (
                                            <div className="col-span-2">
                                                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Các lựa chọn (Cách nhau bằng dấu phẩy)</label>
                                                <input 
                                                    value={field.options?.join(', ') || ''} 
                                                    onChange={e => handleUpdateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                                                    className="w-full p-2 border rounded-lg text-[10px]"
                                                    placeholder="VD: Đỏ, Xanh, Vàng"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button 
                            onClick={handleAddField}
                            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-xs font-bold hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 transition-all flex flex-col items-center gap-1"
                        >
                            <span className="text-xl">+</span>
                            <span>Thêm ô nhập liệu mới</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 px-8 py-4 border-t border-gray-100 bg-white rounded-b-xl flex-shrink-0">
                <button onClick={onCancel} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Hủy bỏ</button>
                <button 
                    onClick={() => {
                        if (!formData.name) return alert("Vui lòng nhập tên mẫu nền!");
                        if (!formData.url) return alert("Vui lòng tải ảnh hoặc chọn màu!");
                        onSave(formData);
                    }} 
                    disabled={isUploading} 
                    className="px-10 py-2.5 text-sm font-black text-white bg-gray-900 hover:bg-blue-600 rounded-xl disabled:opacity-50 shadow-lg shadow-gray-200 transition-all transform active:scale-95"
                >
                    {isUploading ? 'ĐANG TẢI ẢNH...' : (initialData ? 'LƯU THAY ĐỔI' : 'LƯU MẪU MỚI')}
                </button>
            </div>
        </div>
    );
};
