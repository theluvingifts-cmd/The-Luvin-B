
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
        id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1, colors: [], category: ''
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
            setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value }));
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
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto border border-gray-100">
                <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{initialData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
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
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giá cơ bản (VNĐ)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" />
                        </div>
                        
                        {(formData.type === 'accessory' || formData.type === 'pet') && (
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Dịp / Danh mục (Ví dụ: Noel, Sinh nhật)</label>
                                <input name="category" value={formData.category || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" placeholder="Để trống nếu là phụ kiện chung" />
                            </div>
                        )}

                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hình ảnh mặc định</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                                {isUploading ? (
                                    <span className="text-xs text-gray-500">Đang tải ảnh lên...</span>
                                ) : formData.imageUrl ? (
                                    <div className="relative flex items-center justify-center">
                                        <img src={formData.imageUrl} alt="Preview" className="max-h-32 object-contain rounded shadow-sm" />
                                    </div>
                                ) : (
                                    <div className="py-4 text-gray-400">
                                        <span className="text-xs">Bấm để chọn ảnh</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rộng (cm)</label>
                             <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                         <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cao (cm)</label>
                             <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" step="0.1" />
                        </div>
                        <div className="col-span-2">
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Số lượng tồn kho (Để trống = Vô hạn)</label>
                             <input type="number" name="stock" value={formData.stock === undefined ? '' : formData.stock} onChange={handleChange} placeholder="Vô hạn" className="w-full p-2.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:border-gray-500 outline-none text-sm" />
                        </div>
                    </div>

                    {canHaveColors && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                            <h4 className="font-bold text-sm text-gray-800 mb-3">Biến thể màu sắc (Kéo thả để sắp xếp)</h4>
                            
                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                {colors.map((color, idx) => (
                                    <div 
                                        key={idx} 
                                        draggable
                                        onDragStart={(e) => handleColorDragStart(e, idx)}
                                        onDragOver={handleColorDragOver}
                                        onDrop={(e) => handleColorDrop(e, idx)}
                                        className={`flex items-center justify-between bg-gray-50 p-2 rounded border cursor-move transition-all ${
                                            editingColorIndex === idx ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'
                                        } ${draggedColorIndex === idx ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="cursor-move text-gray-400 px-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                            </div>
                                            <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: color.hex }}></div>
                                            {color.imageUrl ? (
                                                <img src={color.imageUrl} alt="" className="w-8 h-8 object-contain bg-white rounded border" />
                                            ) : (
                                                <div className="w-8 h-8 bg-gray-100 rounded border flex items-center justify-center text-[8px] text-gray-400">No IMG</div>
                                            )}
                                            <div>
                                                <p className="text-xs font-bold">{color.name}</p>
                                                <div className="flex gap-2 text-[10px] text-gray-500">
                                                    <span>+{formatCurrency(color.price)}</span>
                                                    <span className={color.stock === 0 ? 'text-red-500 font-bold' : 'text-gray-500'}>
                                                        Kho: {color.stock === undefined || color.stock === null ? '∞' : color.stock}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => startEditColor(idx)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded text-xs font-bold">
                                                Sửa
                                            </button>
                                            <button onClick={() => removeColor(idx)} className="text-red-500 hover:bg-red-100 p-1.5 rounded">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {colors.length === 0 && <p className="text-xs text-gray-400 italic">Chưa có màu nào được thêm.</p>}
                            </div>

                            <div className={`p-3 rounded-lg border transition-colors ${editingColorIndex !== null ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <p className={`text-xs font-bold ${editingColorIndex !== null ? 'text-yellow-800' : 'text-blue-800'}`}>
                                        {editingColorIndex !== null ? `Đang sửa: ${colors[editingColorIndex].name}` : 'Thêm màu mới'}
                                    </p>
                                    {editingColorIndex !== null && (
                                        <button onClick={cancelColorEdit} className="text-xs text-red-500 hover:underline font-semibold">Hủy sửa</button>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    <div className="col-span-3 sm:col-span-1">
                                        <input 
                                            placeholder="Tên màu (VD: Đỏ)" 
                                            className="w-full p-1.5 text-xs border rounded"
                                            value={newColor.name}
                                            onChange={e => setNewColor({...newColor, name: e.target.value})}
                                        />
                                    </div>
                                    <input 
                                        type="number"
                                        placeholder="Giá thêm (VNĐ)" 
                                        className="p-1.5 text-xs border rounded"
                                        value={newColor.price}
                                        onChange={e => setNewColor({...newColor, price: Number(e.target.value)})}
                                    />
                                    <input 
                                        type="number"
                                        placeholder="SL (Trống=∞)" 
                                        className="p-1.5 text-xs border rounded"
                                        value={newColor.stock === undefined ? '' : newColor.stock}
                                        onChange={e => setNewColor({...newColor, stock: e.target.value === '' ? undefined : Number(e.target.value)})}
                                    />
                                    <div className="col-span-3 flex gap-2">
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs text-gray-500">Mã màu:</span>
                                            <input 
                                                type="color" 
                                                className="w-8 h-8 border rounded cursor-pointer"
                                                value={newColor.hex}
                                                onChange={e => setNewColor({...newColor, hex: e.target.value})}
                                            />
                                        </div>
                                        <div className="relative flex-grow">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleColorFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={isUploadingColorImg}
                                            />
                                            <button className={`w-full p-1.5 text-xs border rounded bg-white text-left truncate ${isUploadingColorImg ? 'text-gray-400' : ''}`}>
                                                {isUploadingColorImg ? 'Đang tải...' : newColor.imageUrl ? 'Đã chọn ảnh ✓' : 'Tải ảnh màu (Tùy chọn)'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSaveColor} 
                                    disabled={isUploadingColorImg}
                                    className={`w-full text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 ${editingColorIndex !== null ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    {editingColorIndex !== null ? 'Lưu thay đổi' : '+ Thêm biến thể'}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                    <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">Hủy bỏ</button>
                    <button onClick={handleSave} disabled={isUploading} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded transition-colors shadow-sm disabled:opacity-50">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    );
};
