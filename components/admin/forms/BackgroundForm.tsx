
import React, { useState, useRef } from 'react';
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
        id: `bg_${Date.now()}`, 
        name: '', 
        url: '', 
        category: 'Khác', 
        type: 'square', 
        orientation: 'portrait',
        formFields: []
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
        if (confirm("Thêm bộ trường mặc định (Tên, Ngày, Tin nhắn, 1 Ảnh)?")) {
            const defaults: FormField[] = [
                { id: 'names', label: 'Tên / Lời tựa ngắn', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
                { id: 'date', label: 'Ngày kỷ niệm', type: 'date', required: false },
                { id: 'message', label: 'Thông điệp', type: 'textarea', required: false, placeholder: 'Nhập lời nhắn gửi...' },
                { id: 'photo', label: 'Ảnh in thêm (1)', type: 'image', required: false },
            ];
            setFormData(prev => ({
                ...prev,
                formFields: [...(prev.formFields || []), ...defaults]
            }));
        }
    };

    const loadManyPhotosTemplate = () => {
        const count = prompt("Khách cần gửi bao nhiêu ảnh cho mẫu này?", "5");
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'SỬA BACKGROUND' : 'THÊM BACKGROUND MỚI'}
                        </h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Cấu hình hiển thị và yêu cầu in ấn</p>
                    </div>
                    <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-900">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex-grow overflow-hidden flex flex-col lg:flex-row">
                    {/* LEFT COL: THÔNG TIN NỀN */}
                    <div className="w-full lg:w-2/5 p-8 border-r border-gray-100 overflow-y-auto custom-scrollbar bg-gray-50/30">
                        <h4 className="font-black text-xs text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-[10px]">01</span>
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
                                    <input name="category" value={formData.category} onChange={handleChange} className="w-full p-3.5 border border-gray-200 rounded-2xl bg-white text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all" placeholder="VD: Graduation" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1">Loại khung</label>
                                    <select name="type" value={formData.type} onChange={handleChange} className="w-full p-3.5 border border-gray-200 rounded-2xl bg-white text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all cursor-pointer">
                                        <option value="square">Vuông (15x15, 23x23)</option>
                                        <option value="rectangle">Chữ nhật (A5)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1">Hình ảnh / Màu nền chủ đạo</label>
                                <div className="flex bg-gray-200 p-1 rounded-xl w-max mb-4 shadow-inner">
                                    <button onClick={() => setMode('image')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${mode === 'image' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🖼️ HÌNH ẢNH</button>
                                    <button onClick={() => setMode('color')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${mode === 'color' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>🎨 MÀU SẮC</button>
                                </div>

                                {mode === 'image' ? (
                                    <div className="border-2 border-dashed border-gray-300 rounded-[2rem] p-6 text-center bg-white hover:bg-gray-50 transition-all relative aspect-square flex items-center justify-center overflow-hidden shadow-sm group">
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                                        {isUploading ? (
                                            <div className="flex flex-col items-center">
                                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Đang tải...</span>
                                            </div>
                                        ) : formData.url && !formData.url.startsWith('#') ? (
                                            <div className="relative w-full h-full">
                                                <img src={formData.url} alt="Preview" className="w-full h-full object-contain rounded-2xl" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                                    <span className="text-white text-[10px] font-black uppercase tracking-widest bg-black/50 px-4 py-2 rounded-full">Thay đổi ảnh</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-400">
                                                <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider">Bấm để tải ảnh lên</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-6 border border-gray-200 rounded-[2rem] bg-white flex items-center gap-6 shadow-sm">
                                        <input type="color" className="w-20 h-20 rounded-2xl border-4 border-gray-50 cursor-pointer shadow-md" value={formData.url.startsWith('#') ? formData.url : '#ffffff'} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
                                        <div className="flex-grow">
                                            <span className="text-[10px] font-black text-gray-400 uppercase block mb-1.5 ml-1">Mã màu HEX</span>
                                            <input className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase font-bold focus:border-blue-500 outline-none" value={formData.url} onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: FORM BUILDER */}
                    <div className="w-full lg:w-3/5 p-8 bg-white overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                            <div>
                                <h4 className="font-black text-xs text-orange-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="w-6 h-6 bg-orange-100 rounded flex items-center justify-center text-[10px]">02</span>
                                    Thiết lập Form khách nhập
                                </h4>
                                <p className="text-[11px] text-gray-400 mt-1 font-bold">Khách hàng sẽ điền các thông tin này khi chọn mẫu nền</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={loadDefaultTemplate} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition-all border border-gray-200 shadow-sm">
                                    Mẫu cơ bản
                                </button>
                                <button onClick={loadManyPhotosTemplate} className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase hover:bg-orange-100 transition-all border border-orange-200 shadow-sm">
                                    Mẫu album ảnh
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {(formData.formFields || []).map((field, index) => (
                                <div key={field.id} className="group p-5 bg-gray-50/50 border border-gray-100 rounded-[1.5rem] relative animate-fade-in hover:border-blue-300 hover:bg-white transition-all shadow-sm">
                                    {/* Action Buttons */}
                                    <button 
                                        onClick={() => handleRemoveField(field.id)}
                                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all z-20 hover:scale-110 active:scale-90"
                                    >
                                        &times;
                                    </button>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                                        <div className="sm:col-span-1 flex items-center justify-center">
                                            <span className="text-2xl font-black text-gray-200">{index + 1}</span>
                                        </div>

                                        <div className="sm:col-span-5">
                                            <label className="block text-[9px] font-black text-gray-400 uppercase mb-1.5 ml-1">Tên ô nhập (Label)</label>
                                            <input 
                                                value={field.label} 
                                                onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                                                className="w-full p-2.5 border border-gray-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all"
                                                placeholder="VD: Tên của bạn..."
                                            />
                                        </div>

                                        <div className="sm:col-span-3">
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

                                        <div className="sm:col-span-3 flex items-end pb-1 justify-end">
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

                                        {['text', 'textarea'].includes(field.type) && (
                                            <div className="sm:col-span-11 sm:col-start-2">
                                                <input 
                                                    value={field.placeholder || ''} 
                                                    onChange={e => handleUpdateField(field.id, { placeholder: e.target.value })}
                                                    className="w-full p-2 bg-transparent border-b border-gray-100 text-[10px] outline-none italic text-gray-500 focus:border-blue-400 transition-colors"
                                                    placeholder="Gợi ý cho khách (VD: Nhập tối đa 10 chữ...)"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

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
                                    <p className="text-sm text-gray-400 font-bold">Mẫu này chưa yêu cầu khách nhập thông tin.</p>
                                    <p className="text-[10px] text-gray-300 mt-1 uppercase font-black tracking-tighter">Sử dụng nút "Mẫu cơ bản" để cài đặt nhanh</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-10 py-6 border-t border-gray-100 bg-white flex justify-end gap-4 shadow-top">
                    <button onClick={onCancel} className="px-8 py-3 text-sm font-black text-gray-400 hover:text-gray-600 transition-all uppercase tracking-widest">Hủy bỏ</button>
                    <button 
                        onClick={() => {
                            if (!formData.name) return alert("Vui lòng nhập tên mẫu nền!");
                            if (!formData.url) return alert("Vui lòng tải ảnh hoặc chọn màu!");
                            onSave(formData);
                        }} 
                        disabled={isUploading} 
                        className="px-12 py-3.5 text-sm font-black text-white bg-gray-900 hover:bg-blue-600 rounded-2xl disabled:opacity-50 shadow-xl shadow-gray-200 transition-all transform active:scale-95 uppercase tracking-[0.1em]"
                    >
                        {isUploading ? 'ĐANG XỬ LÝ...' : (initialData ? 'LƯU THAY ĐỔI' : 'LƯU MẪU MỚI')}
                    </button>
                </div>
            </div>
        </div>
    );
};
