
import React, { useState } from 'react';
import { CollectionTemplate } from '../../../types';
import { INITIAL_FRAME_CONFIG } from '../../../constants';
import { uploadToCloudinary } from '../../../services/uploadService';

const SUGGESTED_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Doanh nghiệp', 'Màu trơn'];

export const TemplateForm: React.FC<{
    initialData?: CollectionTemplate | null;
    onSave: (tpl: CollectionTemplate) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<CollectionTemplate>(initialData || {
        id: `tpl_${Date.now()}`, name: '', imageUrl: '', category: 'Khác', config: INITIAL_FRAME_CONFIG
    });
    const [isUploading, setIsUploading] = useState(false);
    const [configJson, setConfigJson] = useState(JSON.stringify(initialData?.config || INITIAL_FRAME_CONFIG, null, 2));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) setFormData(prev => ({ ...prev, imageUrl: url }));
                else alert("Lỗi tải ảnh");
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleSave = () => {
        try {
            const parsedConfig = JSON.parse(configJson);
            onSave({ ...formData, config: parsedConfig });
        } catch (e) {
            alert("Lỗi định dạng JSON trong cấu hình!");
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-3xl mx-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Sửa Mẫu Thiết Kế' : 'Thêm Mẫu Mới'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                    &larr; Quay lại
                </button>
            </div>
            
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Tên mẫu thiết kế</label>
                        <input 
                            name="name" 
                            value={formData.name} 
                            onChange={handleChange} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:bg-white focus:border-blue-500 outline-none" 
                            placeholder="VD: Kỷ niệm ngày cưới..." 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Danh mục (Gõ mới để thêm dịp)</label>
                        <div className="relative">
                            <input 
                                list="category-suggestions"
                                name="category" 
                                value={formData.category} 
                                onChange={handleChange} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:bg-white focus:border-blue-500 outline-none"
                                placeholder="Chọn hoặc nhập dịp mới..."
                            />
                            <datalist id="category-suggestions">
                                {SUGGESTED_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5">Trang chủ sẽ tự động hiển thị tab theo các tên bạn nhập ở đây.</p>
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Hình ảnh đại diện</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                        {isUploading ? (
                            <div className="flex flex-col items-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                <span className="text-xs text-blue-600 font-bold">Đang tải...</span>
                            </div>
                        ) : formData.imageUrl ? (
                            <img src={formData.imageUrl} className="max-h-64 mx-auto object-contain rounded shadow-sm" />
                        ) : (
                            <div className="py-8">
                                <span className="text-2xl block mb-2">📸</span>
                                <span className="text-xs text-gray-400 font-medium">Bấm để tải ảnh đại diện mẫu</span>
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Cấu hình kỹ thuật (JSON)</label>
                    <textarea 
                        value={configJson} 
                        onChange={(e) => setConfigJson(e.target.value)} 
                        className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono h-64 focus:bg-white focus:border-blue-500 outline-none"
                        placeholder="Paste frame config JSON here..." 
                    />
                </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <button onClick={onCancel} className="px-5 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">Hủy</button>
                <button onClick={handleSave} disabled={isUploading || !formData.imageUrl || !formData.name} className="px-8 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg disabled:opacity-50 transition-all shadow-md">
                    {initialData ? 'Cập nhật mẫu' : 'Lưu mẫu mới'}
                </button>
            </div>
        </div>
    );
};
