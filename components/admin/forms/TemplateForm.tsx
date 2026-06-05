
import React, { useState, useMemo } from 'react';
import { CollectionTemplate, LegoPart, LegoCharacterConfig, DraggableItem, FrameConfig, FrameOption } from '../../../types';
import { INITIAL_FRAME_CONFIG, FRAME_OPTIONS } from '../../../constants';
import { uploadFile } from '../../../services/uploadService';
import { calculatePrice, formatCurrency } from '../../../utils/pricing';

const SUGGESTED_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Doanh nghiệp', 'Mẫu thiết kế yêu cầu', 'Màu trơn'];

export const TemplateForm: React.FC<{
    initialData?: CollectionTemplate | null;
    allParts: LegoPart[];
    allFrames: FrameOption[];
    onSave: (tpl: CollectionTemplate) => void;
    onCancel: () => void;
    defaultCategory?: string;
}> = ({ initialData, allParts, allFrames, onSave, onCancel, defaultCategory }) => {
    const [formData, setFormData] = useState<CollectionTemplate>(initialData || {
        id: `tpl_${Date.now()}`, 
        name: '', 
        imageUrl: '', 
        category: defaultCategory && defaultCategory !== 'all' ? defaultCategory : 'Khác', 
        config: INITIAL_FRAME_CONFIG
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
            if (result[p.type]) {
                result[p.type].push(p);
            }
        });
        return result;
    }, [allParts]);

    const CharacterPreview: React.FC<{ character: LegoCharacterConfig }> = ({ character }) => {
        const { hair, face, shirt, pants, hat, set } = character;
        const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
        const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
        const hatImageUrl = character.selectedHatColor?.imageUrl || hat?.imageUrl;
        const hairImageUrl = character.selectedHairColor?.imageUrl || hair?.imageUrl;
        const setImageUrl = character.selectedSetColor?.imageUrl || set?.imageUrl;
        const faceImageUrl = face?.imageUrl;

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
                    {!set && pantsImageUrl && <img src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} referrerPolicy="no-referrer" />}
                    {!set && shirtImageUrl && <img src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} referrerPolicy="no-referrer" />}
                    {set && setImageUrl && <img src={setImageUrl} alt="set" style={{ ...partStyle, zIndex: 2 }} referrerPolicy="no-referrer" />}
                    {faceImageUrl && <img src={faceImageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} referrerPolicy="no-referrer" />}
                    {hairImageUrl && <img src={hairImageUrl} alt="hair" style={{ ...partStyle, zIndex: 4 }} referrerPolicy="no-referrer" />}
                </div>
            </div>
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        let finalValue: any = value;
        if (type === 'number') {
            if (value === '') {
                finalValue = name === 'stock' ? undefined : 0;
            } else {
                finalValue = parseFloat(value);
            }
        }
        
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const url = await uploadFile(file);
                if (url) {
                    setFormData(prev => ({ ...prev, imageUrl: url }));
                    // No toast here as it might be annoying, but keep it in mind
                } else {
                    alert("Lỗi tải ảnh");
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi hệ thống khi tải ảnh");
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
                    if (field === 'shirt') {
                        updated.selectedShirtColor = part?.colors?.[0];
                        updated.set = undefined;
                    }
                    if (field === 'pants') {
                        updated.selectedPantsColor = part?.colors?.[0];
                        updated.set = undefined;
                    }
                    if (field === 'hair') updated.selectedHairColor = part?.colors?.[0];
                    if (field === 'hat') updated.selectedHatColor = part?.colors?.[0];
                    if (field === 'set') {
                        updated.selectedSetColor = part?.colors?.[0];
                        updated.shirt = undefined;
                        updated.pants = undefined;
                    }
                    return updated;
                }
                return c;
            })
        }));
    };

    const handleUpdateCharColor = (charId: number, field: 'selectedShirtColor' | 'selectedPantsColor' | 'selectedHairColor' | 'selectedHatColor' | 'selectedSetColor', color: any) => {
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
            if (!formData.name) {
                alert("Vui lòng nhập tên mẫu!");
                return;
            }
            if (!formData.imageUrl) {
                alert("Vui lòng tải ảnh xem trước!");
                return;
            }
            
            // Sync gallery options into config for better persistence
            const finalConfig = {
                ...config,
                galleryOptions: formData.galleryOptions
            };

            // Always use the visual 'config' state, even for simple templates
            // isSimple just determines how it's displayed to the customer
            onSave({ 
                ...formData, 
                config: finalConfig 
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
                    {formData.productLine !== 'gallery' && (
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
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Dòng sản phẩm (Phân loại chính)</label>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button 
                                type="button"
                                onClick={() => setFormData({ 
                                    ...formData, 
                                    productLine: 'lego', 
                                    config: { 
                                        ...formData.config, 
                                        frameId: formData.config.frameId === 'gallery-1520' ? 'lg' : formData.config.frameId,
                                        background: { ...formData.config.background, type: 'color' } 
                                    } 
                                })}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${(!formData.productLine || formData.productLine === 'lego') ? 'bg-white text-luvin-pink shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Khung Lego
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    const newConfig = { 
                                        ...formData.config, 
                                        frameId: 'gallery-1520',
                                        frameColor: 'black'
                                    };
                                    setFormData({ 
                                        ...formData, 
                                        productLine: 'gallery', 
                                        isSimple: false,
                                        config: newConfig 
                                    });
                                    setConfig(prev => ({ ...prev, frameId: 'gallery-1520', frameColor: 'black' }));
                                }}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${formData.productLine === 'gallery' ? 'bg-white text-luvin-pink shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Khung Gallery
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5">Dòng sản phẩm sẽ giúp tách biệt các bộ sưu tập trên trang web.</p>
                    </div>

                    {formData.productLine === 'gallery' && (
                        <div className="col-span-full bg-pink-50/50 p-6 rounded-3xl border-2 border-pink-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-pink-100 rounded-lg text-lg">⚙️</div>
                                <div>
                                    <h3 className="text-sm font-black text-pink-900 uppercase tracking-tight">Cấu hình Gallery</h3>
                                    <p className="text-[10px] text-pink-400 font-bold uppercase tracking-widest">Thiết lập đèn và khung ảnh hiển thị cho khách</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white/60 p-4 rounded-2xl border border-pink-100 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={formData.galleryOptions?.showPhotoOptions || false} 
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    galleryOptions: { ...formData.galleryOptions, showPhotoOptions: e.target.checked } 
                                                })}
                                                className="w-4 h-4 rounded border-gray-300 text-pink-600 focus:ring-pink-600" 
                                            />
                                            <span className="text-xs font-bold text-gray-700">Khách được chọn số khung ảnh</span>
                                        </label>
                                        <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Khung ảnh</span>
                                    </div>
                                    <div className="pt-2 border-t border-pink-50">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Số khung ảnh (Mặc định)</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={formData.galleryOptions?.photoFrameCount || 0}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    galleryOptions: { ...formData.galleryOptions, photoFrameCount: parseInt(e.target.value) || 0 } 
                                                })}
                                                className="w-full p-2.5 pl-9 border border-pink-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-pink-200 focus:border-pink-300 outline-none transition-all font-bold"
                                                placeholder="VD: 8"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg opacity-50">📸</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/60 p-4 rounded-2xl border border-pink-100 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={formData.galleryOptions?.showLightOptions || false} 
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    galleryOptions: { ...formData.galleryOptions, showLightOptions: e.target.checked } 
                                                })}
                                                className="w-4 h-4 rounded border-gray-300 text-pink-600 focus:ring-pink-600" 
                                            />
                                            <span className="text-xs font-bold text-gray-700">Khách được chọn số đèn</span>
                                        </label>
                                        <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Đèn LED</span>
                                    </div>
                                    <div className="pt-2 border-t border-pink-50">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Số đèn LED (Mặc định)</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={formData.galleryOptions?.lightCount || 0}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    galleryOptions: { ...formData.galleryOptions, lightCount: parseInt(e.target.value) || 0 } 
                                                })}
                                                className="w-full p-2.5 pl-9 border border-pink-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-pink-200 focus:border-pink-300 outline-none transition-all font-bold"
                                                placeholder="VD: 3"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg opacity-50">💡</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Lượt chọn ảo (Social Proof)</label>
                        <input 
                            type="number"
                            name="fakeOrderCount" 
                            value={formData.fakeOrderCount || formData.purchaseCount || 0} 
                            onChange={handleChange} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:bg-white focus:border-blue-500 outline-none" 
                            placeholder="VD: 100" 
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Số lượng này sẽ hiển thị trên web để tăng độ uy tín.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Tồn kho mẫu (Hết hàng sẽ không thể đặt)</label>
                        <input 
                            type="number"
                            name="stock" 
                            value={formData.stock === undefined ? '' : formData.stock} 
                            onChange={handleChange} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:bg-white focus:border-blue-500 outline-none" 
                            placeholder="Để trống là còn hàng" 
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Nhập 0 để đánh dấu hết hàng mẫu sẵn này.</p>
                    </div>
                </div>

                {/* Frame Settings */}
                <div className="bg-blue-50/50 p-6 rounded-3xl border-2 border-blue-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-lg">🖼️</div>
                        <div>
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-tight">Cấu hình khung mẫu</h3>
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Thiết lập kích thước và màu sắc mặc định</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Kích thước khung</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {(allFrames.length > 0 ? allFrames : FRAME_OPTIONS)
                                        .filter(f => {
                                            const supported = f.supportedProductLines || ['lego'];
                                            if (formData.productLine === 'gallery') return supported.includes('gallery');
                                            return supported.includes('lego');
                                        })
                                        .map(f => (
                                        <button 
                                            key={f.id}
                                            type="button"
                                            onClick={() => {
                                                setConfig({ ...config, frameId: f.id });
                                                // If price is 0 or empty, suggest the frame's default price
                                                if (!formData.price) {
                                                    setFormData(prev => ({ ...prev, price: f.price }));
                                                }
                                            }}
                                            className={`p-3 border-2 rounded-xl flex items-center justify-between transition-all ${config.frameId === f.id ? 'border-blue-500 bg-white shadow-md' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}
                                        >
                                            <div className="text-left">
                                                <p className="text-xs font-black uppercase text-gray-800">{f.name}</p>
                                                <p className="text-[10px] text-blue-600 font-bold">{f.backgroundWidthCm}x{f.backgroundHeightCm}cm</p>
                                                <p className="text-[9px] text-gray-400 italic lowercase">{f.description}</p>
                                            </div>
                                            {config.frameId === f.id && <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Màu khung mặc định</label>
                                <div className="flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setConfig({ ...config, frameColor: 'white' })}
                                        className={`flex-1 p-3 border-2 rounded-2xl transition-all ${config.frameColor === 'white' ? 'border-primary bg-white shadow-lg scale-[1.02]' : 'border-gray-100 bg-gray-50'}`}
                                    >
                                        <div className="w-full h-10 bg-white border mb-2 rounded-xl shadow-inner"></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Trắng</span>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setConfig({ ...config, frameColor: 'black' })}
                                        className={`flex-1 p-3 border-2 rounded-2xl transition-all ${config.frameColor === 'black' ? 'border-primary bg-white shadow-lg scale-[1.02]' : 'border-gray-100 bg-gray-50'}`}
                                    >
                                        <div className="w-full h-10 bg-gray-900 mb-2 rounded-xl shadow-inner"></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Đen</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-2xl border-2 border-blue-100 shadow-sm">
                                {/* Live Price Calc Preview */}
                                {(() => {
                                    const { totalPrice, priceBreakdown } = calculatePrice({ ...config, productLine: formData.productLine, galleryOptions: formData.galleryOptions }, allParts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}), allFrames);
                                    return (
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Kiểm tra giá tự động</span>
                                                <div className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black rounded uppercase">Live Calc</div>
                                            </div>
                                            
                                            <div className="space-y-1.5 mb-4">
                                                {priceBreakdown.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-[10px]">
                                                        <span className="text-gray-500">{item.label}</span>
                                                        <span className="font-bold text-gray-700">{formatCurrency(item.value)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                                                    <span className="text-xs font-black text-gray-900 uppercase">Giá mẫu thiết kế</span>
                                                    <span className="text-sm font-black text-blue-600">{formatCurrency(totalPrice)}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-start gap-3">
                                                <span className="text-lg">✅</span>
                                                <p className="text-[9px] text-green-700 font-medium leading-relaxed">
                                                    Mẫu này đang sử dụng <b>giá tự động</b> ({formatCurrency(totalPrice)}). Giá sẽ tự cập nhật khi khách hàng thêm bớt linh kiện.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 h-fit">
                                <p className="text-[10px] text-blue-700 leading-relaxed mb-2">
                                    <span className="font-black">💰 CHÚ Ý VỀ GIÁ TỰ ĐỘNG:</span>
                                </p>
                                <ul className="text-[9px] text-blue-600 space-y-1 list-disc pl-4">
                                    <li>Mẫu thiết kế giờ đây luôn sử dụng <b>giá tính tự động</b> dựa trên tổng thành phần cấu thành (Khung + Nhân vật + Phụ kiện).</li>
                                    <li>Giá hiển thị cho khách hàng sẽ thay đổi nếu họ tùy chỉnh thêm/bớt so với cấu hình mẫu này.</li>
                                    <li>Đối với "Khung Gallery", hệ thống sẽ cộng thêm phí khung ảnh và đèn LED nếu có cấu hình.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
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
                                                    const hat = randomPart('hat');
                                                    
                                                    setConfig(prev => ({
                                                        ...prev,
                                                        characters: prev.characters.map(c => c.id === activeCharacter.id ? {
                                                            ...c,
                                                            hair, face, shirt, pants, hat,
                                                            selectedShirtColor: shirt?.colors?.[Math.floor(Math.random() * (shirt.colors?.length || 1))],
                                                            selectedPantsColor: pants?.colors?.[Math.floor(Math.random() * (pants.colors?.length || 1))],
                                                            selectedHairColor: hair?.colors?.[Math.floor(Math.random() * (hair.colors?.length || 1))],
                                                            selectedHatColor: hat?.colors?.[Math.floor(Math.random() * (hat.colors?.length || 1))],
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
                                        {(['hair', 'face', 'shirt', 'pants', 'hat', 'set'] as const).map(type => {
                                            const selectedPart = activeCharacter[type];
                                            const colorField = type === 'shirt' ? 'selectedShirtColor' : 
                                                              type === 'pants' ? 'selectedPantsColor' : 
                                                              type === 'hair' ? 'selectedHairColor' : 
                                                              type === 'hat' ? 'selectedHatColor' :
                                                              type === 'set' ? 'selectedSetColor' : null;

                                            return (
                                                <div key={type} className="space-y-3">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex justify-between">
                                                        <span>{type === 'hair' ? 'Tóc' : type === 'face' ? 'Mặt' : type === 'shirt' ? 'Áo' : type === 'pants' ? 'Quần' : type === 'hat' ? 'Mũ' : 'Bộ đồ'}</span>
                                                        {selectedPart && <span className="text-primary normal-case">{selectedPart.name}</span>}
                                                    </label>
                                                    
                                                    <div className="flex flex-wrap gap-2">
                                                        {type === 'hat' && (
                                                            <button 
                                                                onClick={() => handleUpdateChar(activeCharacter.id, type, 'none')}
                                                                className={`w-12 h-12 rounded-xl border-2 border-dashed flex-shrink-0 flex items-center justify-center transition-all ${!selectedPart ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                                                                title="Không chọn"
                                                            >
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Trống</span>
                                                            </button>
                                                        )}
                                                        {partsByType[type].map(part => (
                                                            <button 
                                                                key={part.id}
                                                                onClick={() => handleUpdateChar(activeCharacter.id, type, part.id)}
                                                                className={`w-12 h-12 rounded-xl border-2 flex-shrink-0 p-1 transition-all relative ${selectedPart?.id === part.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'} ${part.stock === 0 ? 'opacity-60' : ''}`}
                                                                title={part.name + (part.stock === 0 ? ' (HẾT HÀNG)' : '')}
                                                            >
                                                                <img src={part.imageUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                                {part.stock === 0 && (
                                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                        <span className="bg-red-500 text-white text-[6px] font-black px-0.5 rounded shadow-sm uppercase rotate-12">Hết</span>
                                                                    </div>
                                                                )}
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
                                                    className={`w-12 h-12 bg-white rounded-xl border p-1.5 hover:border-primary hover:shadow-sm transition-all group relative ${p.stock === 0 ? 'opacity-60 border-red-200' : 'border-gray-200'}`}
                                                    title={p.name + (p.stock === 0 ? ' (HẾT HÀNG)' : '')}
                                                >
                                                    <img src={p.imageUrl} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                                    {p.stock === 0 && (
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <span className="bg-red-500 text-white text-[6px] font-black px-0.5 rounded shadow-sm uppercase rotate-12">Hết</span>
                                                        </div>
                                                    )}
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
                                                    className={`w-12 h-12 bg-white rounded-xl border p-1.5 hover:border-primary hover:shadow-sm transition-all group relative ${p.stock === 0 ? 'opacity-60 border-red-200' : 'border-gray-200'}`}
                                                    title={p.name + (p.stock === 0 ? ' (HẾT HÀNG)' : '')}
                                                >
                                                    <img src={p.imageUrl} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                                    {p.stock === 0 && (
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <span className="bg-red-500 text-white text-[6px] font-black px-0.5 rounded shadow-sm uppercase rotate-12">Hết</span>
                                                        </div>
                                                    )}
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
