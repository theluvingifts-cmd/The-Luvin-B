
import React, { useState } from 'react';
import { LegoPart, OutfitColor, BulkPriceTier } from '../../../types';
import { uploadToCloudinary } from '../../../services/uploadService';
import { formatCurrency } from '../../../utils/pricing';

export const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, name: '', price: 0, costPrice: 0, salePrice: 0, saleEndDate: '', imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1, colors: [], category: '', bulkPricing: []
    });
    const [isUploading, setIsUploading] = useState(false);
    
    const [colors, setColors] = useState<OutfitColor[]>(initialData?.colors || []);
    const [newColor, setNewColor] = useState<OutfitColor>({ name: '', hex: '#000000', price: 0, imageUrl: '', stock: undefined });
    const [isUploadingColorImg, setIsUploadingColorImg] = useState(false);
    const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
    const [draggedColorIndex, setDraggedColorIndex] = useState<number | null>(null);

    // Bulk Pricing State
    const [bulkTiers, setBulkTiers] = useState<BulkPriceTier[]>(initialData?.bulkPricing || []);
    const [newTierQty, setNewTierQty] = useState<number>(0);
    const [newTierPrice, setNewTierPrice] = useState<number>(0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'stock') {
            const stockVal = value === '' ? undefined : Number(value);
            setFormData(prev => ({ ...prev, stock: stockVal }));
        } else {
            setFormData(prev => ({ 
                ...prev, 
                [name]: ['price', 'costPrice', 'salePrice', 'widthCm', 'heightCm'].includes(name) ? Number(value) : value 
            }));
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

    // Bulk Pricing Handlers
    const addBulkTier = () => {
        if (newTierQty <= 1 || newTierPrice <= 0) {
            alert("Số lượng phải > 1 và giá phải > 0");
            return;
        }
        if (bulkTiers.some(t => t.quantity === newTierQty)) {
            alert("Đã có mức giá cho số lượng này.");
            return;
        }
        setBulkTiers([...bulkTiers, { quantity: newTierQty, price: newTierPrice }].sort((a,b) => a.quantity - b.quantity));
        setNewTierQty(0);
        setNewTierPrice(0);
    };

    const removeBulkTier = (index: number) => {
        setBulkTiers(bulkTiers.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const dataToSave = { ...formData, colors: colors, bulkPricing: bulkTiers };
        const cleanData = JSON.parse(JSON.stringify(dataToSave));
        onSave(cleanData);
    };

    const canHaveColors = ['shirt', 'pants', 'accessory', 'pet', 'hair', 'hat', 'set'].includes(formData.type);
    const canHaveBulkPricing = ['accessory', 'pet'].includes(formData.type);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                    &larr; Quay lại danh sách
                </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Main Info */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Section 1: Basic Info */}
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-800 border-b pb-3 mb-4 text-base flex items-center gap-2">
                                ℹ️ Thông tin chung
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tên sản phẩm</label>
                                    <input name="name" value={formData.name} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base" placeholder="Nhập tên sản phẩm..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Loại sản phẩm</label>
                                    <select name="type" value={formData.type} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-base cursor-pointer">
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
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Danh mục / Dịp</label>
                                    <input name="category" value={formData.category || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" placeholder="VD: Noel, Sinh nhật" disabled={!['accessory', 'pet'].includes(formData.type)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Giá bán (VNĐ)</label>
                                    <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base font-bold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 text-red-600">Giá vốn (VNĐ)</label>
                                    <input type="number" name="costPrice" value={formData.costPrice || 0} onChange={handleChange} className="w-full p-3 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-base text-red-600 font-medium" />
                                </div>
                                
                                {/* Promotion Settings */}
                                <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                                    <h5 className="font-bold text-sm text-blue-600 mb-3">🔥 Thiết lập Khuyến mãi</h5>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Giá Sale (VNĐ)</label>
                                            <input type="number" name="salePrice" value={formData.salePrice || 0} onChange={handleChange} className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" placeholder="0 = Không sale" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Kết thúc khuyến mãi</label>
                                            <input type="date" name="saleEndDate" value={formData.saleEndDate || ''} onChange={handleChange} className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tồn kho <span className="text-gray-400 font-normal text-xs">(Để trống = Vô hạn)</span></label>
                                        <input type="number" name="stock" value={formData.stock === undefined ? '' : formData.stock} onChange={handleChange} placeholder="Vô hạn" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Colors Variants */}
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-800 border-b pb-3 mb-4 text-base flex items-center gap-2">
                                🎨 Biến thể màu sắc
                            </h4>
                            
                            {canHaveColors ? (
                                <>
                                    {/* Color List */}
                                    {colors.length > 0 && (
                                        <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto border rounded-lg p-2 bg-gray-50 custom-scrollbar">
                                            {colors.map((color, idx) => (
                                                <div 
                                                    key={idx} 
                                                    draggable
                                                    onDragStart={(e) => handleColorDragStart(e, idx)}
                                                    onDragOver={handleColorDragOver}
                                                    onDrop={(e) => handleColorDrop(e, idx)}
                                                    className={`flex items-center justify-between bg-white p-3 rounded border cursor-move shadow-sm transition-all ${
                                                        editingColorIndex === idx ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'hover:border-gray-400'
                                                    } ${draggedColorIndex === idx ? 'opacity-50' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="cursor-move text-gray-400">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full border shadow-sm" style={{ backgroundColor: color.hex }}></div>
                                                        {color.imageUrl ? (
                                                            <img src={color.imageUrl} alt="" className="w-10 h-10 object-contain bg-gray-100 rounded border" />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center text-[8px] text-gray-400">No IMG</div>
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-800">{color.name}</p>
                                                            <div className="flex gap-2 text-xs text-gray-500">
                                                                <span>+{formatCurrency(color.price)}</span>
                                                                {color.stock !== undefined && <span className={color.stock === 0 ? 'text-red-500' : ''}>Kho: {color.stock}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => startEditColor(idx)} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-bold">Sửa</button>
                                                        <button onClick={() => removeColor(idx)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-bold">Xóa</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add/Edit Color Form */}
                                    <div className={`p-4 rounded-xl border transition-colors ${editingColorIndex !== null ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-100'}`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <p className={`text-sm font-bold ${editingColorIndex !== null ? 'text-yellow-800' : 'text-blue-800'}`}>
                                                {editingColorIndex !== null ? `Đang sửa màu: ${colors[editingColorIndex].name}` : 'Thêm màu mới'}
                                            </p>
                                            {editingColorIndex !== null && (
                                                <button onClick={cancelColorEdit} className="text-xs text-red-500 hover:underline font-bold">Hủy sửa</button>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                            <input 
                                                placeholder="Tên màu (VD: Đỏ)" 
                                                className="w-full p-2.5 border rounded-lg text-sm"
                                                value={newColor.name}
                                                onChange={e => setNewColor({...newColor, name: e.target.value})}
                                            />
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number"
                                                    placeholder="Giá thêm" 
                                                    className="w-full p-2.5 border rounded-lg text-sm"
                                                    value={newColor.price}
                                                    onChange={e => setNewColor({...newColor, price: Number(e.target.value)})}
                                                />
                                                <input 
                                                    type="number"
                                                    placeholder="Kho (SL)" 
                                                    className="w-full p-2.5 border rounded-lg text-sm"
                                                    value={newColor.stock === undefined ? '' : newColor.stock}
                                                    onChange={e => setNewColor({...newColor, stock: e.target.value === '' ? undefined : Number(e.target.value)})}
                                                />
                                            </div>
                                            <div className="col-span-1 sm:col-span-2 flex gap-4 items-center">
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-sm font-medium">Mã màu:</span>
                                                    <input 
                                                        type="color" 
                                                        className="w-10 h-10 border rounded cursor-pointer"
                                                        value={newColor.hex}
                                                        onChange={e => setNewColor({...newColor, hex: e.target.value})}
                                                    />
                                                </div>
                                                <div className="relative flex-grow">
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={handleColorFileChange}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        disabled={isUploadingColorImg}
                                                    />
                                                    <button className={`w-full p-2.5 border rounded-lg bg-white text-left text-sm flex items-center justify-between ${isUploadingColorImg ? 'text-gray-400' : 'text-gray-700'}`}>
                                                        <span>{isUploadingColorImg ? 'Đang tải ảnh...' : newColor.imageUrl ? 'Đã chọn ảnh (Click thay đổi)' : 'Tải ảnh màu (Tùy chọn)'}</span>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleSaveColor} 
                                            disabled={isUploadingColorImg}
                                            className={`w-full text-white text-sm font-bold py-3 rounded-lg transition-colors shadow-sm disabled:opacity-50 ${editingColorIndex !== null ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                        >
                                            {editingColorIndex !== null ? 'Lưu thay đổi màu sắc' : '+ Thêm biến thể màu'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded text-center">Loại sản phẩm này không hỗ trợ biến thể màu sắc.</p>
                            )}
                        </div>

                        {/* Section 3: Bulk Pricing (Combo) */}
                        {canHaveBulkPricing && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <h4 className="font-bold text-gray-800 border-b pb-3 mb-4 text-base flex items-center gap-2">
                                    📦 Giá Combo (Mua nhiều giảm giá)
                                </h4>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-2">
                                        <input 
                                            type="number" 
                                            placeholder="SL tối thiểu" 
                                            className="p-2 border rounded text-sm"
                                            value={newTierQty || ''}
                                            onChange={(e) => setNewTierQty(Number(e.target.value))}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Giá bán mới" 
                                            className="p-2 border rounded text-sm"
                                            value={newTierPrice || ''}
                                            onChange={(e) => setNewTierPrice(Number(e.target.value))}
                                        />
                                        <button onClick={addBulkTier} className="bg-green-600 text-white font-bold rounded text-sm hover:bg-green-700">Thêm</button>
                                    </div>
                                    
                                    {bulkTiers.length > 0 ? (
                                        <div className="bg-gray-50 rounded border divide-y">
                                            {bulkTiers.map((tier, index) => (
                                                <div key={index} className="flex justify-between items-center p-2 text-sm">
                                                    <span>Mua từ <b>{tier.quantity}</b> cái:</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-green-700">{formatCurrency(tier.price)}</span>
                                                        <button onClick={() => removeBulkTier(index)} className="text-red-500 hover:bg-red-100 p-1 rounded font-bold">×</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Chưa có cấu hình giá combo.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Image & Dimensions */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm sticky top-0">
                            <h4 className="font-bold text-gray-800 border-b pb-3 mb-4 text-base flex items-center gap-2">
                                🖼️ Hình ảnh & Kích thước
                            </h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Hình ảnh hiển thị</label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors relative aspect-square flex items-center justify-center overflow-hidden cursor-pointer group">
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" disabled={isUploading} />
                                        {isUploading ? (
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                                <span className="text-xs text-blue-600 font-bold">Đang tải ảnh...</span>
                                            </div>
                                        ) : formData.imageUrl ? (
                                            <>
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <span className="text-white font-bold text-sm bg-black/50 px-3 py-1 rounded-full">Thay đổi ảnh</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-gray-400 text-center">
                                                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <span className="text-sm font-medium">Bấm để tải ảnh</span>
                                                <span className="text-xs block mt-1">(Khuyên dùng PNG trong suốt)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rộng (cm)</label>
                                            <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-center font-mono" step="0.1" />
                                    </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cao (cm)</label>
                                            <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-center font-mono" step="0.1" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-4">
                <button onClick={onCancel} className="px-6 py-3 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors">Hủy bỏ</button>
                <button onClick={handleSave} disabled={isUploading} className="px-8 py-3 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {isUploading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Đang xử lý...</span>
                        </>
                    ) : (
                        <span>Lưu sản phẩm</span>
                    )}
                </button>
            </div>
        </div>
    );
};