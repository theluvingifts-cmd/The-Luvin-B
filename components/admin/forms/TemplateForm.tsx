
import React, { useState, useMemo } from 'react';
import { CollectionTemplate, LegoPart, LegoCharacterConfig, DraggableItem, FrameConfig } from '../../../types';
import { INITIAL_FRAME_CONFIG } from '../../../constants';
import { uploadFile } from '../../../services/uploadService';

const SUGGESTED_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Doanh nghiệp', 'Màu trơn'];

export const TemplateForm: React.FC<{
    initialData?: CollectionTemplate | null;
    allParts: LegoPart[];
    onSave: (tpl: CollectionTemplate) => void;
    onCancel: () => void;
}> = ({ initialData, allParts, onSave, onCancel }) => {
    const [formData, setFormData] = useState<CollectionTemplate>(initialData || {
        id: `tpl_${Date.now()}`, name: '', imageUrl: '', category: 'Khác', config: INITIAL_FRAME_CONFIG
    });
    const [isUploading, setIsUploading] = useState(false);
    const [configJson, setConfigJson] = useState(JSON.stringify(initialData?.config || INITIAL_FRAME_CONFIG, null, 2));
    
    // State for visual configuration
    const [config, setConfig] = useState<FrameConfig>(initialData?.config || INITIAL_FRAME_CONFIG);
    const [activeCharId, setActiveCharId] = useState<number | null>(config.characters[0]?.id || null);

    const partsByType = useMemo(() => {
        const result: Record<string, LegoPart[]> = {
            hair: [], face: [], shirt: [], pants: [], accessory: [], pet: [], hat: [], set: []
        };
        allParts.forEach(p => {
            // Only include parts that are in stock
            if (result[p.type] && (p.stock === undefined || p.stock > 0)) {
                result[p.type].push(p);
            }
        });
        return result;
    }, [allParts]);

    const CharacterPreview: React.FC<{ character: LegoCharacterConfig }> = ({ character }) => {
        const { hair, face, shirt, pants, hat } = character;
        const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
        const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
        const hairImageUrl = character.selectedHairColor?.imageUrl || hair?.imageUrl;
        const faceImageUrl = face?.imageUrl;
        const hatImageUrl = hat?.imageUrl;

        const partStyle: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none'
        };

        return (
            <div className="relative w-24 h-36 bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex items-center justify-center overflow-hidden mx-auto">
                <div className="relative w-full h-full">
                    {pantsImageUrl && <img src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} referrerPolicy="no-referrer" />}
                    {shirtImageUrl && <img src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} referrerPolicy="no-referrer" />}
                    {faceImageUrl && <img src={faceImageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} referrerPolicy="no-referrer" />}
                    {hairImageUrl && <img src={hairImageUrl} alt="hair" style={{ ...partStyle, zIndex: 4 }} referrerPolicy="no-referrer" />}
                    {hatImageUrl && <img src={hatImageUrl} alt="hat" style={{ ...partStyle, zIndex: 5 }} referrerPolicy="no-referrer" />}
                </div>
            </div>
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        setFormData(prev => ({ ...prev, [e.target.name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadFile(file);
                if (url) setFormData(prev => ({ ...prev, imageUrl: url }));
                else alert("Lỗi tải ảnh");
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleAddChar = () => {
        const newId = Date.now();
        const newChar: LegoCharacterConfig = {
            id: newId,
            hair: partsByType.hair[0],
            face: partsByType.face[0],
            shirt: partsByType.shirt[0],
            pants: partsByType.pants[0],
            x: 50, y: 75, rotation: 0, scale: 1,
            selectedShirtColor: partsByType.shirt[0]?.colors?.[0],
            selectedPantsColor: partsByType.pants[0]?.colors?.[0],
            selectedHairColor: partsByType.hair[0]?.colors?.[0],
        };
        setConfig(prev => ({ ...prev, characters: [...prev.characters, newChar] }));
        setActiveCharId(newId);
    };

    const handleRemoveChar = (id: number) => {
        setConfig(prev => ({ ...prev, characters: prev.characters.filter(c => c.id !== id) }));
        if (activeCharId === id) setActiveCharId(null);
    };

    const handleUpdateChar = (id: number, field: keyof LegoCharacterConfig, partId: string) => {
        const part = allParts.find(p => p.id === partId);
        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
                if (c.id === id) {
                    const updated = { ...c, [field]: part };
                    // Reset colors when part changes
                    if (field === 'shirt') updated.selectedShirtColor = part?.colors?.[0];
                    if (field === 'pants') updated.selectedPantsColor = part?.colors?.[0];
                    if (field === 'hair') updated.selectedHairColor = part?.colors?.[0];
                    return updated;
                }
                return c;
            })
        }));
    };

    const handleUpdateCharColor = (charId: number, field: 'selectedShirtColor' | 'selectedPantsColor' | 'selectedHairColor', color: any) => {
        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => c.id === charId ? { ...c, [field]: color } : c)
        }));
    };

    const handleUpdateCharmColor = (charmId: number, color: any) => {
        setConfig(prev => ({
            ...prev,
            draggableItems: prev.draggableItems.map(item => item.id === charmId ? { ...item, selectedColor: color } : item)
        }));
    };

    const handleAddCharm = (partId: string) => {
        const part = allParts.find(p => p.id === partId);
        if (!part) return;
        const newItem: DraggableItem = {
            id: Date.now(),
            partId: part.id,
            type: part.type as any,
            x: 50, y: 50, rotation: 0, scale: 1,
            selectedColor: part.colors?.[0]
        };
        setConfig(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
    };

    const handleRemoveCharm = (id: number) => {
        setConfig(prev => ({ ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== id) }));
    };

    const handleSave = () => {
        try {
            // Always use the visual 'config' state, even for simple templates
            // isSimple just determines how it's displayed to the customer
            onSave({ 
                ...formData, 
                config: config 
            });
        } catch (e) {
            console.error(e);
            alert("Lỗi khi lưu mẫu!");
        }
    };

    const activeCharacter = config.characters.find(c => c.id === activeCharId);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-4xl mx-auto">
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
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Giá bán (VNĐ)</label>
                        <input 
                            type="number"
                            name="price" 
                            value={formData.price || ''} 
                            onChange={handleChange} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:bg-white focus:border-blue-500 outline-none font-bold text-red-600" 
                            placeholder="VD: 350000" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Lượt chọn ảo (Social Proof)</label>
                        <input 
                            type="number"
                            name="purchaseCount" 
                            value={formData.purchaseCount || 0} 
                            onChange={handleChange} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:bg-white focus:border-blue-500 outline-none" 
                            placeholder="VD: 100" 
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Số lượng này sẽ hiển thị trên web để tăng độ uy tín.</p>
                    </div>
                {/* Badges Selection */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={formData.isHot || false} 
                            onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500" 
                        />
                        <span className="text-xs font-bold text-gray-600 group-hover:text-orange-600">🔥 Mẫu Bán Chạy (HOT)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={formData.isNew || false} 
                            onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600" 
                        />
                        <span className="text-xs font-bold text-gray-600 group-hover:text-blue-600">✨ Mẫu Mới (NEW)</span>
                    </label>
                </div>
                {/* Mode Selection */}
                <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Chế độ hiển thị</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Chọn cách khách hàng nhìn thấy mẫu này</p>
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
                            <button 
                                type="button"
                                onClick={() => setFormData({ ...formData, isSimple: false })}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!formData.isSimple ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Thiết kế (Canvas)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setFormData({ ...formData, isSimple: true })}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.isSimple ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Đơn giản (Ảnh mẫu)
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
                            {formData.isSimple 
                                ? "💡 Chế độ Đơn giản: Khách hàng sẽ thấy ảnh mẫu bạn tải lên. Các nhân vật & charm bạn thêm bên dưới sẽ được liệt kê như danh sách phụ kiện đi kèm."
                                : "💡 Chế độ Thiết kế: Khách hàng có thể tự do di chuyển, thay đổi vị trí nhân vật & charm trên khung hình trực tuyến."}
                        </p>
                    </div>
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

                {!formData.isSimple && (
                    <div className="space-y-6 border-t border-gray-100 pt-6">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Cấu hình nhân vật & Charm</h4>
                            <button 
                                onClick={handleAddChar}
                                className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                            >
                                + Thêm nhân vật
                            </button>
                        </div>

                        {/* Characters List */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {config.characters.map((char, idx) => (
                                <div key={char.id} className="relative group">
                                    <button 
                                        onClick={() => setActiveCharId(char.id)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeCharId === char.id ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                                    >
                                        Nhân vật {idx + 1}
                                    </button>
                                    <button 
                                        onClick={() => handleRemoveChar(char.id)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Active Character Editor */}
                        {activeCharacter && (
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-8">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Chỉnh sửa nhân vật</h4>
                                    <button onClick={() => setActiveCharId(null)} className="text-xs text-gray-400 hover:text-gray-600">Đóng</button>
                                </div>

                                <div className="flex flex-col md:flex-row gap-8">
                                    {/* Left: Preview */}
                                    <div className="flex-shrink-0">
                                        <CharacterPreview character={activeCharacter} />
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Vị trí X (%)</label>
                                                <input 
                                                    type="number" 
                                                    value={activeCharacter.x} 
                                                    onChange={(e) => setConfig(prev => ({
                                                        ...prev,
                                                        characters: prev.characters.map(c => c.id === activeCharacter.id ? { ...c, x: parseFloat(e.target.value) } : c)
                                                    }))}
                                                    className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Vị trí Y (%)</label>
                                                <input 
                                                    type="number" 
                                                    value={activeCharacter.y} 
                                                    onChange={(e) => setConfig(prev => ({
                                                        ...prev,
                                                        characters: prev.characters.map(c => c.id === activeCharacter.id ? { ...c, y: parseFloat(e.target.value) } : c)
                                                    }))}
                                                    className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <button 
                                                onClick={() => {
                                                    const randomPart = (type: string) => {
                                                        const options = partsByType[type];
                                                        if (!options || options.length === 0) return null;
                                                        return options[Math.floor(Math.random() * options.length)];
                                                    };
                                                    const hair = randomPart('hair');
                                                    const face = randomPart('face');
                                                    const shirt = randomPart('shirt');
                                                    const pants = randomPart('pants');
                                                    
                                                    setConfig(prev => ({
                                                        ...prev,
                                                        characters: prev.characters.map(c => c.id === activeCharacter.id ? {
                                                            ...c,
                                                            hair, face, shirt, pants,
                                                            selectedShirtColor: shirt?.colors?.[Math.floor(Math.random() * (shirt.colors?.length || 1))],
                                                            selectedPantsColor: pants?.colors?.[Math.floor(Math.random() * (pants.colors?.length || 1))],
                                                            selectedHairColor: hair?.colors?.[Math.floor(Math.random() * (hair.colors?.length || 1))],
                                                        } : c)
                                                    }));
                                                }}
                                                className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                                            >
                                                🎲 Ngẫu nhiên đồ
                                            </button>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Giá in theo yêu cầu</label>
                                                <input 
                                                    type="number" 
                                                    value={activeCharacter.customPrintPrice || 0} 
                                                    onChange={(e) => setConfig(prev => ({
                                                        ...prev,
                                                        characters: prev.characters.map(c => c.id === activeCharacter.id ? { ...c, customPrintPrice: parseFloat(e.target.value) } : c)
                                                    }))}
                                                    className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-blue-600"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Part Selection */}
                                    <div className="flex-grow space-y-6">
                                        {(['hair', 'face', 'shirt', 'pants', 'hat'] as const).map(type => {
                                            const selectedPart = activeCharacter[type];
                                            const colorField = type === 'shirt' ? 'selectedShirtColor' : type === 'pants' ? 'selectedPantsColor' : type === 'hair' ? 'selectedHairColor' : null;

                                            return (
                                                <div key={type} className="space-y-3">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex justify-between">
                                                        <span>{type === 'hair' ? 'Tóc' : type === 'face' ? 'Mặt' : type === 'shirt' ? 'Áo' : type === 'pants' ? 'Quần' : 'Mũ'}</span>
                                                        {selectedPart && <span className="text-primary normal-case">{selectedPart.name}</span>}
                                                    </label>
                                                    
                                                    <div className="flex flex-wrap gap-2">
                                                        {type === 'hat' && (
                                                            <button 
                                                                onClick={() => handleUpdateChar(activeCharacter.id, type, '')}
                                                                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-[8px] font-bold flex-shrink-0 transition-all ${!selectedPart ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-300 hover:border-gray-200'}`}
                                                            >
                                                                TRỐNG
                                                            </button>
                                                        )}
                                                        {partsByType[type].map(part => (
                                                            <button 
                                                                key={part.id}
                                                                onClick={() => handleUpdateChar(activeCharacter.id, type, part.id)}
                                                                className={`w-12 h-12 rounded-xl border-2 flex-shrink-0 p-1 transition-all ${selectedPart?.id === part.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                                                                title={part.name}
                                                            >
                                                                <img src={part.imageUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Color Selection for Part */}
                                                    {selectedPart && selectedPart.colors && selectedPart.colors.length > 0 && colorField && (
                                                        <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-gray-100">
                                                            {selectedPart.colors.map((color, cIdx) => (
                                                                <button
                                                                    key={cIdx}
                                                                    onClick={() => handleUpdateCharColor(activeCharacter.id, colorField, color)}
                                                                    className={`w-6 h-6 rounded-full border-2 transition-all ${activeCharacter[colorField]?.hex === color.hex ? 'border-primary scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                                                                    style={{ backgroundColor: color.hex }}
                                                                    title={color.name}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Charms Section */}
                        <div className="space-y-6 pt-6 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Charm cố định (Sticker/Thú cưng)</h4>
                                <span className="text-[10px] text-gray-400">Bấm vào Charm bên dưới để thêm</span>
                            </div>

                            {/* Visual Charm Picker */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                <div className="space-y-4">
                                    {/* Accessories */}
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Phụ kiện & Sticker</p>
                                        <div className="flex flex-wrap gap-2">
                                            {partsByType.accessory.map(p => (
                                                <button 
                                                    key={p.id}
                                                    onClick={() => handleAddCharm(p.id)}
                                                    className="w-12 h-12 bg-white rounded-xl border border-gray-200 p-1.5 hover:border-primary hover:shadow-sm transition-all group"
                                                    title={p.name}
                                                >
                                                    <img src={p.imageUrl} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Pets */}
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Thú cưng</p>
                                        <div className="flex flex-wrap gap-2">
                                            {partsByType.pet.map(p => (
                                                <button 
                                                    key={p.id}
                                                    onClick={() => handleAddCharm(p.id)}
                                                    className="w-12 h-12 bg-white rounded-xl border border-gray-200 p-1.5 hover:border-primary hover:shadow-sm transition-all group"
                                                    title={p.name}
                                                >
                                                    <img src={p.imageUrl} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Added Charms Management */}
                            {config.draggableItems.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {config.draggableItems.map(item => {
                                        const part = allParts.find(p => p.id === item.partId);
                                        return (
                                            <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-200 relative group shadow-sm">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-8 h-8 bg-gray-50 rounded-lg p-1">
                                                        <img src={part?.imageUrl} className="w-full h-full object-contain" />
                                                    </div>
                                                    <span className="text-[10px] font-bold truncate flex-1">{part?.name}</span>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <div className="space-y-0.5">
                                                        <span className="text-[8px] text-gray-400 font-bold uppercase">X (%)</span>
                                                        <input 
                                                            type="number" 
                                                            value={item.x} 
                                                            onChange={(e) => setConfig(prev => ({
                                                                ...prev,
                                                                draggableItems: prev.draggableItems.map(i => i.id === item.id ? { ...i, x: parseFloat(e.target.value) } : i)
                                                            }))}
                                                            className="w-full p-1 text-[10px] border border-gray-200 rounded bg-gray-50 focus:bg-white outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[8px] text-gray-400 font-bold uppercase">Y (%)</span>
                                                        <input 
                                                            type="number" 
                                                            value={item.y} 
                                                            onChange={(e) => setConfig(prev => ({
                                                                ...prev,
                                                                draggableItems: prev.draggableItems.map(i => i.id === item.id ? { ...i, y: parseFloat(e.target.value) } : i)
                                                            }))}
                                                            className="w-full p-1 text-[10px] border border-gray-200 rounded bg-gray-50 focus:bg-white outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Charm Color Picker if available */}
                                                {part?.colors && part.colors.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1 pt-2 border-t border-gray-50">
                                                        {part.colors.map((c, cIdx) => (
                                                            <button
                                                                key={cIdx}
                                                                onClick={() => handleUpdateCharmColor(item.id, c)}
                                                                className={`w-4 h-4 rounded-full border transition-all ${item.selectedColor?.hex === c.hex ? 'ring-1 ring-primary scale-110' : 'border-transparent'}`}
                                                                style={{ backgroundColor: c.hex }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}

                                                <button 
                                                    onClick={() => handleRemoveCharm(item.id)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        
                        <div className="pt-4 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Cấu hình nâng cao (JSON)</label>
                            <textarea 
                                value={configJson} 
                                onChange={(e) => setConfigJson(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono h-32 focus:bg-white focus:border-blue-500 outline-none"
                                placeholder="Paste frame config JSON here..." 
                            />
                            <button 
                                onClick={() => {
                                    try {
                                        const parsed = JSON.parse(configJson);
                                        setConfig(parsed);
                                        alert("Đã cập nhật cấu hình từ JSON!");
                                    } catch (e) {
                                        alert("Lỗi định dạng JSON!");
                                    }
                                }}
                                className="mt-2 text-[10px] font-bold text-blue-600 hover:underline"
                            >
                                Áp dụng JSON vào trình chỉnh sửa trực quan
                            </button>
                        </div>
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
