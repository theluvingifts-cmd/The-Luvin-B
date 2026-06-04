
import React, { useState } from 'react';
import { FrameOption } from '../../../types';
import { DateInput } from '../../ui/DateInput';
import { uploadFile } from '../../../services/uploadService';

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
        costPrice: 0,
        salePrice: 0,
        saleEndDate: '',
        imageUrl: '',
        description: '',
        stock: 100,
        colors: ['black', 'white'],
        supportedProductLines: ['lego']
    });

    const [uploading, setUploading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: ['price', 'costPrice', 'salePrice', 'frameWidthCm', 'frameHeightCm', 'backgroundWidthCm', 'backgroundHeightCm', 'stock'].includes(name) ? Number(value) : value
        }));
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const colors = e.target.value.split(',').map(c => c.trim()).filter(c => c !== '');
        setFormData(prev => ({ ...prev, colors }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const url = await uploadFile(file, `frames/${formData.id}`);
            if (url) {
                setFormData(prev => ({ ...prev, imageUrl: url }));
            }
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Lỗi khi tải ảnh lên.");
        } finally {
            setUploading(false);
        }
    };

    const toggleProductLine = (line: 'lego' | 'gallery') => {
        const current = formData.supportedProductLines || [];
        const next = current.includes(line) 
            ? current.filter(l => l !== line)
            : [...current, line];
        setFormData(prev => ({ ...prev, supportedProductLines: next as any }));
    };

    const handleSave = () => {
        if (!formData.name.trim()) {
            alert("Vui lòng nhập tên khung.");
            return;
        }
        if (!formData.id.trim()) {
            alert("Vui lòng nhập mã ID duy nhất cho khung.");
            return;
        }
        if (!formData.supportedProductLines || formData.supportedProductLines.length === 0) {
            alert("Vui lòng chọn ít nhất một loại sản phẩm (Lego hoặc Gallery).");
            return;
        }
        onSave(formData);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Chỉnh sửa Khung' : 'Thêm Khung Mới'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                    &larr; Quay lại danh sách
                </button>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-5">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-4 flex items-center gap-2">
                            <span>📝</span> Thông tin cơ bản
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ID (Mã định danh)</label>
                                <input name="id" value={formData.id} onChange={handleChange} disabled={!!initialData} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-xs disabled:bg-gray-100 disabled:text-gray-400 font-mono" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tên Khung</label>
                                <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm focus:border-blue-500 outline-none font-bold" placeholder="VD: Khung gỗ 15x15cm..." />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Giá bán (VNĐ)</label>
                                <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm font-black text-red-600" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-red-300 uppercase tracking-widest mb-1">Giá vốn (VNĐ)</label>
                                <input type="number" name="costPrice" value={formData.costPrice || 0} onChange={handleChange} className="w-full p-2.5 border border-red-100 rounded bg-red-50/30 text-sm text-red-500 font-bold focus:ring-1 focus:ring-red-400 outline-none" />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 shadow-inner">
                            <h5 className="font-black text-[10px] text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span>🔥</span> Thiết lập Khuyến mãi
                            </h5>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Giá Sale (VNĐ)</label>
                                    <input type="number" name="salePrice" value={formData.salePrice || 0} onChange={handleChange} className="w-full p-2.5 border border-blue-200 rounded-xl bg-white text-sm font-bold text-blue-600" placeholder="0 = Không sale" />
                                </div>
                                <div className="relative">
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Ngày kết thúc</label>
                                    <DateInput 
                                        value={formData.saleEndDate || ''} 
                                        onChange={(val) => setFormData(prev => ({ ...prev, saleEndDate: val }))} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Số lượng Tồn kho</label>
                                <input type="number" name="stock" value={formData.stock} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm font-bold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mô tả ngắn</label>
                                <input name="description" value={formData.description} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 text-sm" placeholder="Nhỏ gọn, tinh tế..." />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-4 flex items-center gap-2">
                            <span>📐</span> Thông số kỹ thuật & Hiển thị
                        </h4>

                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">👁️ Hiển thị theo loại sản phẩm</label>
                            <div className="flex gap-6">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => toggleProductLine('lego')}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                            (formData.supportedProductLines || []).includes('lego') 
                                                ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-100' 
                                                : 'border-gray-200 bg-white group-hover:border-gray-300'
                                        }`}
                                    >
                                        {(formData.supportedProductLines || []).includes('lego') && (
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-gray-700 uppercase">Khung LEGO Tranh</span>
                                        <span className="text-[9px] text-gray-400">Dành cho mẫu Lego cơ bản</span>
                                    </div>
                                </label>
                                
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        onClick={() => toggleProductLine('gallery')}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                            (formData.supportedProductLines || []).includes('gallery') 
                                                ? 'bg-purple-600 border-purple-600 shadow-md shadow-purple-100' 
                                                : 'border-gray-200 bg-white group-hover:border-gray-300'
                                        }`}
                                    >
                                        {(formData.supportedProductLines || []).includes('gallery') && (
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-gray-700 uppercase">Khung Gallery (1520)</span>
                                        <span className="text-[9px] text-gray-400">Dành cho bộ sưu tập 15x20cm</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Kích thước Khung (cm)</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" name="frameWidthCm" value={formData.frameWidthCm} onChange={handleChange} step="0.1" className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold" placeholder="Rộng" />
                                    <span className="text-gray-300">x</span>
                                    <input type="number" name="frameHeightCm" value={formData.frameHeightCm} onChange={handleChange} step="0.1" className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold" placeholder="Cao" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Kích thước Nền (cm)</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" name="backgroundWidthCm" value={formData.backgroundWidthCm} onChange={handleChange} step="0.1" className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold" placeholder="Rộng" />
                                    <span className="text-gray-300">x</span>
                                    <input type="number" name="backgroundHeightCm" value={formData.backgroundHeightCm} onChange={handleChange} step="0.1" className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-bold" placeholder="Cao" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">🖼️ Ảnh đại diện Khung</label>
                                <div className="flex gap-4 items-start">
                                    <div className="flex-1 space-y-2">
                                        <div className="relative">
                                            <input 
                                                name="imageUrl" 
                                                value={formData.imageUrl} 
                                                onChange={handleChange} 
                                                className="w-full p-2.5 border border-gray-300 rounded-xl bg-gray-50 text-xs focus:ring-2 focus:ring-blue-500 outline-none pr-10" 
                                                placeholder="Link ảnh (https://...)" 
                                            />
                                            <div className="absolute right-3 top-2.5 text-gray-300">🔗</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className={`flex-1 flex items-center justify-center gap-2 p-2 border-2 border-dashed rounded-xl cursor-pointer transition-all ${uploading ? 'bg-gray-100 border-gray-300' : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50 hover:border-blue-400'}`}>
                                                <span className="text-[10px] font-black text-blue-600 uppercase">{uploading ? 'Đang tải...' : 'Tải ảnh lên từ máy'}</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                                            </label>
                                        </div>
                                    </div>
                                    {formData.imageUrl && (
                                        <div className="w-24 h-24 border-2 border-gray-100 rounded-2xl bg-white p-1 flex items-center justify-center shadow-sm overflow-hidden group relative">
                                            <img src={formData.imageUrl} className="max-w-full max-h-full object-contain" />
                                            <button onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">Xóa</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">🎨 Các màu hiện có (Phân cách dấu phẩy)</label>
                                <input 
                                    value={formData.colors.join(', ')} 
                                    onChange={handleColorChange} 
                                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-gray-50 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder="black, white, wood..." 
                                />
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {formData.colors.map(c => (
                                        <span key={c} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-[9px] font-black uppercase text-gray-500 flex items-center gap-1.5 shadow-sm">
                                            <div className="w-2 h-2 rounded-full border border-gray-100" style={{ backgroundColor: c === 'wood' ? '#d2b48c' : (c === 'black' ? '#111' : (c === 'white' ? '#fff' : c)) }}></div>
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button onClick={onCancel} className="px-6 py-2.5 text-xs font-black text-gray-400 hover:text-gray-600 hover:bg-gray-100 uppercase tracking-widest transition-all">Hủy bỏ</button>
                <button 
                    onClick={handleSave} 
                    disabled={uploading}
                    className="px-8 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-xl transition-all shadow-lg shadow-blue-100 uppercase tracking-widest"
                >
                    {initialData ? 'Cập nhật Khung' : 'Lưu Khung Mới'}
                </button>
            </div>
        </div>
    );
};
