
import React, { useState, useEffect } from 'react';
import { CollectionTemplate, LegoPart } from '../../../types';
import { INITIAL_FRAME_CONFIG } from '../../../constants';
import { uploadToCloudinary } from '../../../services/uploadService';
import { getAllParts } from '../../../services/productService';

const SUGGESTED_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Doanh nghiệp', 'Màu trơn'];

export const TemplateForm: React.FC<{
    initialData?: CollectionTemplate | null;
    onSave: (tpl: CollectionTemplate) => void;
    onCancel: () => void;
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<CollectionTemplate>(initialData || {
        id: `tpl_${Date.now()}`, 
        name: '', 
        imageUrl: '', 
        category: 'Khác', 
        config: INITIAL_FRAME_CONFIG,
        isSimpleTemplate: false,
        basePrice: 0,
        includedPartIds: []
    });
    const [isUploading, setIsUploading] = useState(false);
    const [configJson, setConfigJson] = useState(JSON.stringify(initialData?.config || INITIAL_FRAME_CONFIG, null, 2));
    const [allParts, setAllParts] = useState<LegoPart[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchParts = async () => {
            const parts = await getAllParts();
            setAllParts(parts);
        };
        fetchParts();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else if (name === 'basePrice') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const togglePart = (partId: string) => {
        setFormData(prev => {
            const current = prev.includedPartIds || [];
            if (current.includes(partId)) {
                return { ...prev, includedPartIds: current.filter(id => id !== partId) };
            } else {
                return { ...prev, includedPartIds: [...current, partId] };
            }
        });
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
            let parsedConfig = JSON.parse(configJson);
            
            // If it's a simple template, we should ensure the config reflects the included parts
            if (formData.isSimpleTemplate && formData.includedPartIds && formData.includedPartIds.length > 0) {
                // We keep existing items but add the ones from includedPartIds if they aren't there
                // Or better, for a simple template, the draggableItems should match the includedPartIds initially
                const newDraggableItems = formData.includedPartIds.map((partId, index) => ({
                    id: Date.now() + index,
                    partId,
                    type: 'accessory' as const, // Default to accessory
                    x: 30 + (index % 5) * 10,
                    y: 30 + Math.floor(index / 5) * 10,
                    rotation: 0,
                    scale: 0.5,
                    isFlipped: false
                }));
                parsedConfig = { ...parsedConfig, draggableItems: newDraggableItems };
            }
            
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

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="isSimpleTemplate" 
                            name="isSimpleTemplate" 
                            checked={formData.isSimpleTemplate} 
                            onChange={handleChange}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <label htmlFor="isSimpleTemplate" className="text-sm font-bold text-blue-800">Đây là mẫu đơn giản (Chỉ cần ảnh & chọn Charm)</label>
                    </div>

                    {formData.isSimpleTemplate && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-xs font-bold text-blue-600 uppercase mb-1.5">Giá trọn bộ (VNĐ)</label>
                                <input 
                                    type="number"
                                    name="basePrice" 
                                    value={formData.basePrice} 
                                    onChange={handleChange} 
                                    className="w-full p-3 border border-blue-200 rounded-lg bg-white text-sm focus:border-blue-500 outline-none" 
                                    placeholder="VD: 500000" 
                                />
                                <p className="text-[10px] text-blue-400 mt-1">Giá này đã bao gồm khung, nền và các charm được chọn bên dưới.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-blue-600 uppercase mb-1.5">Chọn các Charm đi kèm</label>
                                <div className="bg-white border border-blue-200 rounded-lg p-3">
                                    <input 
                                        type="text" 
                                        placeholder="Tìm charm..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full p-2 mb-3 border border-gray-200 rounded text-sm outline-none focus:border-blue-400"
                                    />
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2">
                                        {allParts
                                            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map(part => (
                                            <button 
                                                key={part.id}
                                                onClick={() => togglePart(part.id)}
                                                className={`flex items-center gap-2 p-2 rounded border text-left transition-all ${
                                                    formData.includedPartIds?.includes(part.id) 
                                                    ? 'bg-blue-100 border-blue-400 ring-1 ring-blue-400' 
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                <img src={part.imageUrl} className="w-8 h-8 object-contain rounded bg-white" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-bold truncate">{part.name}</span>
                                                    <span className="text-[9px] text-gray-500">{part.price.toLocaleString()}đ</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Đã chọn: {formData.includedPartIds?.length || 0} charm</span>
                                        <button onClick={() => setFormData(prev => ({ ...prev, includedPartIds: [] }))} className="text-[10px] text-red-500 font-bold hover:underline">Xóa hết</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {!formData.isSimpleTemplate && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Cấu hình kỹ thuật (JSON)</label>
                        <textarea 
                            value={configJson} 
                            onChange={(e) => setConfigJson(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono h-64 focus:bg-white focus:border-blue-500 outline-none"
                            placeholder="Paste frame config JSON here..." 
                        />
                    </div>
                )}
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
