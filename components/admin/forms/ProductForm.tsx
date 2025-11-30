
import React, { useState } from 'react';
import { LegoPart, OutfitColor } from '../../../types';
import { uploadToCloudinary } from '../../../services/uploadService';
import { formatCurrency } from '../../../utils/pricing';

export const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, name: '', price: 0, costPrice: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1, colors: [], category: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    
    const [colors, setColors] = useState<OutfitColor[]>(initialData?.colors || []);
    const [newColor, setNewColor] = useState<OutfitColor>({ name: '', hex: '#000000', price: 0, imageUrl: '', stock: undefined });
    const [isUploadingColorImg, setIsUploadingColorImg] = useState(false);
    const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
    const [draggedColorIndex, setDraggedColorIndex] = useState<number | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'stock') {
            const stockVal = value === '' ? undefined : Number(value);
            setFormData(prev => ({ ...prev, stock: stockVal }));
        } else {
            setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'costPrice' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setFormData(prev => ({ ...prev, imageUrl: url }));
                } else {
                    alert("Lỗi upload ảnh.");
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload ảnh.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleColorFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploadingColorImg(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    setNewColor(prev => ({ ...prev, imageUrl: url }));
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploadingColorImg(false);
            }
        }
    };

    const handleSaveColor = () => {
        if (!newColor.name) {
            alert("Vui lòng nhập tên màu.");
            return;
        }

        if (editingColorIndex !== null) {
            const updatedColors = [...colors];
            updatedColors[editingColorIndex] = newColor;
            setColors(updatedColors);
            setEditingColorIndex(null);
        } else {
            setColors([...colors, newColor]);
        }
        
        setNewColor({ name: '', hex: '#000000', price: 0, imageUrl: '', stock: undefined });
    };

    const startEditColor = (index: number) => {
        setEditingColorIndex(index);
        setNewColor(colors[index]);
    };

    const cancelColorEdit = () => {
        setEditingColorIndex(null);
        setNewColor({ name: '', hex: '#000000', price: 0, imageUrl: '', stock: undefined });
    };

    const removeColor = (index: number) => {
        const updatedColors = colors.filter((_, i) => i !== index);
        setColors(updatedColors);
        if (editingColorIndex === index) {
            cancelColorEdit();
        } else if (editingColorIndex !== null && editingColorIndex > index) {
            setEditingColorIndex(editingColorIndex - 1);
        }
    };

    const handleColorDragStart = (e: React.DragEvent, index: number) => {
        setDraggedColorIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
    };

    const handleColorDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleColorDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedColorIndex === null || draggedColorIndex === index) return;

        const updatedColors = [...colors];
        const [movedItem] = updatedColors.splice(draggedColorIndex, 1);
        updatedColors.splice(index, 0, movedItem);

        setColors(updatedColors);
        
        if (editingColorIndex === draggedColorIndex) {
            setEditingColorIndex(index);
        } else if (editingColorIndex !== null) {
            if (draggedColorIndex < editingColorIndex && index >= editingColorIndex) {
                setEditingColorIndex(editingColorIndex - 1);
            } else if (draggedColorIndex > editingColorIndex && index <= editingColorIndex) {
                setEditingColorIndex(editingColorIndex + 1);
            }
        }
        setDraggedColorIndex(null);
    };

    const handleSave = () => {
        const dataToSave = { ...formData, colors: colors };
        const cleanData = JSON.parse(JSON.stringify(dataToSave));
        onSave(cleanData);
    };

    const canHaveColors = ['shirt', 'pants', 'accessory', 'pet', 'hair', 'hat', 'set'].includes(formData.type);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 font-sans p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-2xl font-bold text-gray-800">{initialData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Cột 1: Thông tin cơ bản */}
                    <div className="space-y-5">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-4">Thông tin chung</h4>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên sản phẩm</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" placeholder="Nhập tên..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loại</label>
                            <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm">
                                <option value="hair">Tóc</option>
                                <option value="face">Mặt</option>
                                <option value="shirt">Áo</option>
                                <option value="pants">Quần</option>
                                <option value="hat">Mũ</option>
                                <option value="accessory">Phụ kiện</option>
                                <option value="pet">Thú cưng</option>
                                <option value="set">Theo bộ (Vest/Set)</option>
                            </select>
                        </div>
                        {(formData.type === 'accessory' || formData.type === 'pet') && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Dịp / Danh mục</label>
                                <input name="category" value={formData.category || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" placeholder="VD: Noel, Sinh nhật" />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá bán (VNĐ)</label>
                                <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm font-bold text-gray-800" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá vốn (VNĐ)</label>
                                <input type="number" name="costPrice" value={formData.costPrice || 0} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm text-red-600" />
                            </div>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tồn kho (Trống = Vô hạn)</label>
                             <input type="number" name="stock" value={formData.stock === undefined ? '' : formData.stock} onChange={handleChange} placeholder="Vô hạn" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" />
                        </div>
                    </div>

                    {/* Cột 2: Hình ảnh & Kích thước */}
                    <div className="space-y-5">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-4">Hình ảnh & Kích thước</h4>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh mặc định</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative h-40 flex items-center justify-center">
                                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                                {isUploading ? (
                                    <span className="text-xs text-gray-500">Đang tải ảnh lên...</span>
                                ) : formData.imageUrl ? (
                                    <img src={formData.imageUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded shadow-sm" />
                                ) : (
                                    <div className="text-gray-400">
                                        <span className="text-xs block">Bấm để chọn ảnh</span>
                                        <span className="text-[10px] block mt-1">(PNG trong suốt)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng (cm)</label>
                                 <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                            </div>
                             <div>
                                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao (cm)</label>
                                 <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                            </div>
                        </div>
                    </div>

                    {/* Cột 3: Biến thể màu sắc */}
                    <div className="space-y-5">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-4">Biến thể màu sắc</h4>
                        
                        {canHaveColors ? (
                            <>
                                <div className="space-y-2 mb-4 h-48 overflow-y-auto border rounded p-2 bg-gray-50 custom-scrollbar">
                                    {colors.map((color, idx) => (
                                        <div 
                                            key={idx} 
                                            draggable
                                            onDragStart={(e) => handleColorDragStart(e, idx)}
                                            onDragOver={handleColorDragOver}
                                            onDrop={(e) => handleColorDrop(e, idx)}
                                            className={`flex items-center justify-between bg-white p-2 rounded border cursor-move shadow-sm transition-all ${
                                                editingColorIndex === idx ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'hover:border-gray-400'
                                            } ${draggedColorIndex === idx ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: color.hex }}></div>
                                                {color.imageUrl ? (
                                                    <img src={color.imageUrl} alt="" className="w-8 h-8 object-contain bg-gray-100 rounded border" />
                                                ) : (
                                                    <div className="w-8 h-8 bg-gray-100 rounded border flex items-center justify-center text-[8px] text-gray-400">No IMG</div>
                                                )}
                                                <div>
                                                    <p className="text-xs font-bold">{color.name}</p>
                                                    <div className="flex gap-1 text-[10px] text-gray-500">
                                                        <span>+{formatCurrency(color.price)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => startEditColor(idx)} className="text-blue-600 hover:bg-blue-100 p-1 rounded">✏️</button>
                                                <button onClick={() => removeColor(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                    {colors.length === 0 && <p className="text-xs text-center text-gray-400 mt-10">Chưa có màu nào.</p>}
                                </div>

                                <div className={`p-3 rounded-lg border transition-colors ${editingColorIndex !== null ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <p className={`text-xs font-bold ${editingColorIndex !== null ? 'text-yellow-800' : 'text-gray-700'}`}>
                                            {editingColorIndex !== null ? 'Sửa màu' : 'Thêm màu mới'}
                                        </p>
                                        {editingColorIndex !== null && (
                                            <button onClick={cancelColorEdit} className="text-xs text-red-500 hover:underline">Hủy</button>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        <input 
                                            placeholder="Tên màu" 
                                            className="col-span-1 p-1.5 text-xs border rounded"
                                            value={newColor.name}
                                            onChange={e => setNewColor({...newColor, name: e.target.value})}
                                        />
                                        <input 
                                            type="number"
                                            placeholder="Giá thêm" 
                                            className="col-span-1 p-1.5 text-xs border rounded"
                                            value={newColor.price}
                                            onChange={e => setNewColor({...newColor, price: Number(e.target.value)})}
                                        />
                                        <div className="col-span-1 flex items-center">
                                            <input 
                                                type="color" 
                                                className="w-full h-8 border rounded cursor-pointer"
                                                value={newColor.hex}
                                                onChange={e => setNewColor({...newColor, hex: e.target.value})}
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <div className="relative">
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    onChange={handleColorFileChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    disabled={isUploadingColorImg}
                                                />
                                                <button className={`w-full p-1.5 text-xs border rounded bg-white text-center truncate ${isUploadingColorImg ? 'text-gray-400' : ''}`}>
                                                    {isUploadingColorImg ? 'Đang tải...' : newColor.imageUrl ? 'Đã chọn ảnh (Click thay đổi)' : 'Tải ảnh màu (Tùy chọn)'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleSaveColor} 
                                        disabled={isUploadingColorImg}
                                        className={`w-full text-white text-xs font-bold py-2 rounded transition-colors ${editingColorIndex !== null ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-800 hover:bg-gray-900'}`}
                                    >
                                        {editingColorIndex !== null ? 'Lưu thay đổi' : 'Thêm màu'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded text-center">Loại sản phẩm này không hỗ trợ biến thể màu sắc.</p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-auto pt-6 border-t border-gray-100">
                    <button onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Hủy bỏ</button>
                    <button onClick={handleSave} disabled={isUploading} className="px-6 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2">
                        {isUploading && <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>}
                        Lưu sản phẩm
                    </button>
                </div>
            </div>
        </div>
    );
};
