
import React, { useState, useEffect } from 'react';
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

    // Khởi tạo dữ liệu: Lấy formFields cũ từ database nếu có, nếu không thì để mảng rỗng
    const [formData, setFormData] = useState<PresetBackground>(initialData || {
        id: `bg_${Date.now()}`, 
        name: '', 
        url: '', 
        category: 'Khác', 
        type: 'square', 
        orientation: 'portrait',
        formFields: [] // Đảm bảo luôn có mảng này
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

    // --- LOGIC QUẢN LÝ CÁC Ô NHẬP LIỆU (FORM FIELDS) ---
    
    const handleAddField = () => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            label: 'Tên ô nhập mới',
            type: 'text',
            required: false,
            placeholder: 'Nhập gợi ý cho khách...'
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
        if (confirm("Xóa ô nhập liệu này?")) {
            setFormData(prev => ({
                ...prev,
                formFields: (prev.formFields || []).filter(f => f.id !== id)
            }));
        }
    };

    const loadDefaultTemplate = () => {
        const defaults: FormField[] = [
            { id: 'names', label: 'Tên / Lời tựa ngắn', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
            { id: 'date', label: 'Ngày kỷ niệm', type: 'date', required: false },
            { id: 'message', label: 'Thông điệp', type: 'textarea', required: false, placeholder: 'Nhập lời nhắn gửi...' },
            { id: 'photo', label: 'Ảnh in thêm (1)', type: 'image', required: false },
        ];
        setFormData(prev => ({ ...prev, formFields: [...(prev.formFields || []), ...defaults] }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'SỬA BACKGROUND' : 'THÊM BACKGROUND MỚI'}
                        </h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Cấu hình mẫu in và các yêu cầu từ khách hàng</p>
                    </div>
                    <button onClick={onCancel} className="bg-white border border-gray-300 px-5 py-2 rounded-xl text-sm font-black hover:bg-gray-100 transition-all">
                        HỦY BỎ
                    </button>
                </div>
                
                <div className="flex-grow overflow-hidden flex flex-col lg:flex-row">
                    {/* CỘT TRÁI: THÔNG TIN NỀN (Ảnh, Màu, Tên) */}
                    <div className="w-full lg:w-5/12 p-8 border-r border-gray-100 overflow-y-auto custom-scrollbar bg-gray-50/30">
                        <h4 className="font-black text-[10px] text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">1</span>
                            Thông tin hiển thị
                        </h4>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1">Tên hiển thị</label>
                                <input name="name" value={formData.name} onChange={handleChange} className="w-full p-3.5 border border-gray-200 rounded-2xl bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold shadow-sm transition-all" placeholder="VD: Graduation 2..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1">Danh mục</label>
                                    <input name="category" value={formData.category} onChange={handleChange} className="w-full p-3.5 border border-gray-200 rounded-2xl bg-white text-sm font-medium" placeholder="VD: Kỷ niệm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1">Loại khung</label>
                                    <select name="type" value={formData.type} onChange={handleChange} className="w-full p-3.5 border border-gray-200 rounded-2xl bg-white text-sm font-bold cursor-pointer">
                                        <option value="square">Vuông (15x15, 23x23)</option>
                                        <option value="rectangle">Chữ nhật (A5)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1">Hình ảnh / Màu nền mẫu</label>
                                <div className="flex bg-gray-200 p-1 rounded-xl w-max mb-4 shadow-inner">
                                    <button onClick={() => setMode('image')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${mode === 'image' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🖼️ HÌNH ẢNH</button>
                                    <button onClick={() => setMode('color')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${mode === 'color' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🎨 MÀU SẮC</button>
                                </div>

                                {mode === 'image' ? (
                                    <div className="border-2 border-dashed border-gray-300 rounded-[2rem] p-6 text-center bg-white hover:bg-gray-50 transition-all relative aspect-square flex items-center justify-center overflow-hidden shadow-sm group">
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                                        {isUploading ? (
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                                <span className="text-xs font-bold text-blue-600">Đang tải...</span>
                                            </div>
                                        ) : formData.url && !formData.url.startsWith('#') ? (
                                            <img src={formData.url} alt="Preview" className="w-full h-full object-contain rounded-2xl" />
                                        ) : (
                                            <div className="text-gray-400">
                                                <div className="text-3xl mb-2">☁️</div>
                                                <span className="text-xs font-bold uppercase">Bấm để tải ảnh lên</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-6 border border-gray-200 rounded-[2rem] bg-white flex items-center gap-6 shadow-sm">
                                        <input type="color" className="w-20 h-20 rounded-2xl border-4 border-gray-50 cursor-pointer shadow-md" value={formData.url.startsWith('#') ? formData.url : '#ffffff'} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
                                        <div className="flex-grow">
                                            <span className="text-[10px] font-black text-gray-400 uppercase block mb-1.5 ml-1">Mã màu HEX</span>
                                            <input className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase font-bold" value={formData.url} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CỘT PHẢI: TRÌNH DỰNG FORM (CÁC Ô KHÁCH PHẢI NHẬP) */}
                    <div className="w-full lg:w-7/12 p-8 bg-white overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h4 className="font-black text-[10px] text-orange-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="w-5 h-5 bg-orange-100 rounded flex items-center justify-center">2</span>
                                    Các ô thông tin khách cần nhập
                                </h4>
                                <p className="text-[11px] text-gray-400 mt-1 font-bold">Thêm các ô dữ liệu để khách điền khi mua mẫu này</p>
                            </div>
                            <button 
                                onClick={loadDefaultTemplate}
                                className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase hover:bg-orange-100 transition-all border border-orange-200 shadow-sm"
                            >
                                + Mẫu cơ bản
                            </button>
                        </div>

                        {/* DANH SÁCH CÁC TRƯỜNG FORM ĐANG HOẠT ĐỘNG */}
                        <div className="space-y-4">
                            {(formData.formFields || []).map((field, index) => (
                                <div key={field.id} className="group p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] relative animate-fade-in hover:border-blue-300 hover:bg-white transition-all shadow-sm">
                                    {/* Nút xóa */}
                                    <button 
                                        onClick={() => handleRemoveField(field.id)}
                                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all z-20 hover:scale-110 active:scale-90"
                                    >
                                        &times;
                                    </button>

                                    <div className="grid grid-cols-12 gap-5">
                                        <div className="col-span-1 flex items-center justify-center">
                                            <span className="text-2xl font-black text-gray-200">{index + 1}</span>
                                        </div>

                                        <div className="col-span-5">
                                            <label className="block text-[9px] font-black text-gray-400 uppercase mb-1.5 ml-1">Tên ô nhập (VD: Tên của bạn)</label>
                                            <input 
                                                value={field.label} 
                                                onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                                                className="w-full p-2.5 border border-gray-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all"
                                            />
                                        </div>

                                        <div className="col-span-3">
                                            <label className="block text-[9px] font-black text-gray-400 uppercase mb-1.5 ml-1">Loại dữ liệu</label>
                                            <select 
                                                value={field.type} 
                                                onChange={e => handleUpdateField(field.id, { type: e.target.value as any })}
                                                className="w-full p-2.5 border border-gray-200 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer"
                                            >
                                                <option value="text">Chữ ngắn</option>
                                                <option value="textarea">Chữ dài</option>
                                                <option value="date">Ngày tháng</option>
                                                <option value="image">Hình ảnh</option>
                                            </select>
                                        </div>

                                        <div className="col-span-3 flex items-end pb-1 justify-end">
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <span className="text-[10px] font-black text-gray-400 uppercase">Bắt buộc?</span>
                                                <div 
                                                    onClick={() => handleUpdateField(field.id, { required: !field.required })}
                                                    className={`w-11 h-6 rounded-full p-1 transition-colors ${field.required ? 'bg-green-500' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${field.required ? 'translate-x-5' : ''}`}></div>
                                                </div>
                                            </label>
                                        </div>

                                        {/* Placeholder (Gợi ý nhập) */}
                                        {['text', 'textarea'].includes(field.type) && (
                                            <div className="col-span-11 col-start-2">
                                                <input 
                                                    value={field.placeholder || ''} 
                                                    onChange={e => handleUpdateField(field.id, { placeholder: e.target.value })}
                                                    className="w-full p-2 bg-transparent border-b border-gray-100 text-[10px] outline-none italic text-gray-500 focus:border-blue-400 transition-colors"
                                                    placeholder="Gợi ý nội dung cho khách (VD: Nhập tối đa 10 chữ...)"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Nút thêm mới */}
                            <button 
                                onClick={handleAddField}
                                className="w-full py-6 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 transition-all flex flex-col items-center gap-2 group"
                            >
                                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                    <span className="text-2xl">+</span>
                                </div>
                                <span>Thêm ô nhập liệu mới</span>
                            </button>

                            {(!formData.formFields || formData.formFields.length === 0) && (
                                <div className="text-center py-16 bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                                    <div className="text-4xl mb-4 opacity-20">📝</div>
                                    <p className="text-sm text-gray-400 font-bold">Mẫu này chưa có ô thông tin nào.</p>
                                    <p className="text-[10px] text-gray-300 mt-1 uppercase font-black">Bấm "+ Mẫu cơ bản" ở trên để cài đặt nhanh</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-10 py-6 border-t border-gray-100 bg-white flex justify-end gap-4 shadow-top">
                    <button 
                        onClick={() => {
                            if (!formData.name) return alert("Vui lòng nhập tên mẫu nền!");
                            if (!formData.url) return alert("Vui lòng tải ảnh nền!");
                            onSave(formData);
                        }} 
                        disabled={isUploading} 
                        className="px-16 py-4 text-sm font-black text-white bg-gray-900 hover:bg-blue-600 rounded-2xl disabled:opacity-50 shadow-xl transition-all transform active:scale-95 uppercase tracking-widest"
                    >
                        {isUploading ? 'ĐANG XỬ LÝ...' : 'LƯU THAY ĐỔI'}
                    </button>
                </div>
            </div>
        </div>
    );
};
