
import React, { useState } from 'react';
import { PresetBackground } from '../../../types';
import { uploadFile } from '../../../services/uploadService';

export const BackgroundForm: React.FC<{
    initialData?: PresetBackground | null;
    onSave: (bg: PresetBackground) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    // Detect mode based on existing URL (if it starts with #, it's a color)
    const [mode, setMode] = useState<'image' | 'color'>(
        initialData?.url?.startsWith('#') ? 'color' : 'image'
    );

    const [formData, setFormData] = useState<PresetBackground>(initialData || {
        id: `bg_${Date.now()}`, name: '', url: '', category: 'Khác', type: 'square', orientation: 'portrait'
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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-2xl mx-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Sửa Background' : 'Thêm Background'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                    &larr; Quay lại
                </button>
            </div>
            
            <div className="p-6 space-y-4">
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
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại khung áp dụng</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white text-sm">
                            <option value="square">Vuông (15x15, 23x23)</option>
                            <option value="rectangle">Chữ nhật (A5)</option>
                        </select>
                    </div>
                    {formData.type === 'rectangle' && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hướng hiển thị</label>
                            <div className="flex gap-2">
                                <label className={`flex-1 flex items-center justify-center gap-2 border p-2 rounded cursor-pointer transition-colors ${formData.orientation !== 'landscape' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'hover:bg-gray-50'}`}>
                                    <input 
                                        type="radio" 
                                        name="orientation" 
                                        value="portrait" 
                                        checked={formData.orientation !== 'landscape'} 
                                        onChange={() => setFormData({...formData, orientation: 'portrait'})} 
                                        className="hidden"
                                    />
                                    <span className="text-sm font-medium">Dọc (Portrait)</span>
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-2 border p-2 rounded cursor-pointer transition-colors ${formData.orientation === 'landscape' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'hover:bg-gray-50'}`}>
                                    <input 
                                        type="radio" 
                                        name="orientation" 
                                        value="landscape" 
                                        checked={formData.orientation === 'landscape'} 
                                        onChange={() => setFormData({...formData, orientation: 'landscape'})} 
                                        className="hidden"
                                    />
                                    <span className="text-sm font-medium">Ngang (Landscape)</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
                
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Loại nền</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg w-max mb-3">
                        <button 
                            onClick={() => { setMode('image'); if(formData.url.startsWith('#')) setFormData({...formData, url: ''}); }}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${mode === 'image' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            🖼️ Hình ảnh
                        </button>
                        <button 
                            onClick={() => { setMode('color'); if(!formData.url.startsWith('#')) setFormData({...formData, url: '#ffffff'}); }}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${mode === 'color' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            🎨 Màu sắc
                        </button>
                    </div>

                    {mode === 'image' ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                            {isUploading ? (
                                <span className="text-xs text-gray-500">Đang tải...</span>
                            ) : formData.url && !formData.url.startsWith('#') ? (
                                <img src={formData.url} alt="Preview" className="max-h-64 object-contain mx-auto rounded" />
                            ) : (
                                <span className="text-xs text-gray-400">Bấm để tải ảnh lên</span>
                            )}
                        </div>
                    ) : (
                        <div className="flex gap-4 items-center p-4 border rounded-lg bg-gray-50">
                            <input 
                                type="color" 
                                className="w-16 h-16 rounded border-0 cursor-pointer"
                                value={formData.url.startsWith('#') ? formData.url : '#ffffff'}
                                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                            />
                            <div className="flex-grow">
                                <label className="text-xs text-gray-500 mb-1 block">Mã màu (Hex)</label>
                                <input 
                                    className="w-full p-2 border rounded text-sm uppercase font-mono"
                                    value={formData.url}
                                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                                    placeholder="#RRGGBB"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                <button onClick={() => onSave(formData)} disabled={isUploading || !formData.url} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded disabled:opacity-50">Lưu</button>
            </div>
        </div>
    );
};
