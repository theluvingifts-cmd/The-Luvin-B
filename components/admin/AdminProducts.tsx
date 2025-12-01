
import React, { useState, useMemo } from 'react';
import { LegoPart, FrameOption, PresetBackground } from '../../types';
import { addPart, updatePart, deletePart, seedDatabase, reorderParts } from '../../services/productService';
import { addFrame, updateFrame, deleteFrame, seedFrames } from '../../services/frameService';
import { addBackground, updateBackground, deleteBackground, seedBackgrounds, reorderBackgrounds } from '../../services/backgroundService';
import { ProductForm } from './forms/ProductForm';
import { FrameForm } from './forms/FrameForm';
import { BackgroundForm } from './forms/BackgroundForm';
import { formatCurrency } from '../../utils/pricing';

interface AdminProductsProps {
    products: LegoPart[];
    frames: FrameOption[];
    backgrounds: PresetBackground[];
    onRefreshProducts: () => void;
    onRefreshFrames: () => void;
    onRefreshBackgrounds: () => void;
}

type ProductSubTab = 'parts' | 'backgrounds' | 'frames';
type ViewMode = 'list' | 'edit';

export const AdminProducts: React.FC<AdminProductsProps> = ({ products, frames, backgrounds, onRefreshProducts, onRefreshFrames, onRefreshBackgrounds }) => {
    const [activeProductSubTab, setActiveProductSubTab] = useState<ProductSubTab>('parts');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    
    // Product Filters
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');
    
    // Background Filters
    const [bgSearch, setBgSearch] = useState('');
    const [bgTypeFilter, setBgTypeFilter] = useState<'all' | 'square' | 'rectangle'>('all');
    const [bgCategoryFilter, setBgCategoryFilter] = useState<string>('all');

    // Editing States (Objects)
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [editingFrame, setEditingFrame] = useState<FrameOption | null>(null);
    const [loading, setLoading] = useState(false);

    // Filter Logic
    const filteredProducts = useMemo(() => 
        products.filter(p => (productCategory === 'all' || p.type === productCategory) && p.name.toLowerCase().includes(productSearch.toLowerCase())), 
    [products, productSearch, productCategory]);

    const bgCategories = useMemo(() => {
        return ['all', ...Array.from(new Set(backgrounds.map(bg => bg.category)))];
    }, [backgrounds]);

    const filteredBackgrounds = useMemo(() => 
        backgrounds.filter(bg => {
            const matchType = bgTypeFilter === 'all' || bg.type === bgTypeFilter;
            const matchCategory = bgCategoryFilter === 'all' || bg.category === bgCategoryFilter;
            const matchSearch = bg.name.toLowerCase().includes(bgSearch.toLowerCase());
            return matchType && matchCategory && matchSearch;
        }),
    [backgrounds, bgTypeFilter, bgCategoryFilter, bgSearch]);

    // Switch View Handler
    const switchToEdit = (item: any = null, type: ProductSubTab) => {
        if (type === 'parts') setEditingPart(item);
        if (type === 'backgrounds') setEditingBg(item);
        if (type === 'frames') setEditingFrame(item);
        setViewMode('edit');
    };

    const switchToList = () => {
        setEditingPart(null);
        setEditingBg(null);
        setEditingFrame(null);
        setViewMode('list');
    };

    // Handlers
    const handleSeedData = async () => { if (confirm("Thao tác này sẽ reset database về mặc định. Tiếp tục?")) { setLoading(true); await seedDatabase(); setLoading(false); onRefreshProducts(); } };
    const handleSeedFrames = async () => { if (confirm("Reset Frames về mặc định?")) { setLoading(true); await seedFrames(); setLoading(false); onRefreshFrames(); } };
    const handleSeedBackgrounds = async () => { if (confirm("Reset backgrounds về mặc định?")) { setLoading(true); await seedBackgrounds(); setLoading(false); onRefreshBackgrounds(); } };

    const handleSaveProduct = async (part: LegoPart) => { 
        if (editingPart) await updatePart(part.id, part); else await addPart(part); 
        onRefreshProducts(); switchToList(); 
    };
    const handleDeleteProduct = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deletePart(id); onRefreshProducts(); } };
    
    const handleSaveBackground = async (bg: PresetBackground) => { 
        if (editingBg) await updateBackground(bg.id, bg); else await addBackground(bg); 
        onRefreshBackgrounds(); switchToList(); 
    };
    const handleDeleteBackground = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteBackground(id); onRefreshBackgrounds(); } };

    const handleSaveFrame = async (frame: FrameOption) => { 
        if (editingFrame) await updateFrame(frame.id, frame); else await addFrame(frame); 
        onRefreshFrames(); switchToList(); 
    };
    const handleDeleteFrame = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteFrame(id); onRefreshFrames(); } };

    const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

    const handleDropProduct = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === targetId) return;
        if (productCategory !== 'all' && productSearch !== '') return; 

        const items = [...products];
        const draggedIndex = items.findIndex(p => p.id === draggedId);
        const targetIndex = items.findIndex(p => p.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, removed);
        
        reorderParts(items).then(() => onRefreshProducts());
    };

    const handleDropBackground = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === targetId) return;
        
        const items = [...backgrounds];
        const draggedIndex = items.findIndex(b => b.id === draggedId);
        const targetIndex = items.findIndex(b => b.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, removed);

        reorderBackgrounds(items).then(() => onRefreshBackgrounds());
    };

    return (
        <div className="animate-fade-in relative">
            {loading && <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded shadow">Loading...</div></div>}
            
            {/* View Mode Switching Logic */}
            {viewMode === 'edit' ? (
                <div className="w-full h-full fixed inset-0 sm:relative sm:inset-auto bg-gray-50 z-40 overflow-y-auto sm:overflow-visible p-2 sm:p-0">
                    <div className="sm:hidden mb-2">
                        <button onClick={switchToList} className="text-sm text-gray-500 font-bold">&larr; Quay lại danh sách</button>
                    </div>
                    {activeProductSubTab === 'parts' && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={switchToList} />}
                    {activeProductSubTab === 'backgrounds' && <BackgroundForm initialData={editingBg} onSave={handleSaveBackground} onCancel={switchToList} />}
                    {activeProductSubTab === 'frames' && <FrameForm initialData={editingFrame} onSave={handleSaveFrame} onCancel={switchToList} />}
                </div>
            ) : (
                <>
                    <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-gray-200 pb-2 sm:pb-4 overflow-x-auto no-scrollbar">
                        <button onClick={() => setActiveProductSubTab('parts')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'parts' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Linh kiện</button>
                        <button onClick={() => setActiveProductSubTab('frames')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'frames' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Khung</button>
                        <button onClick={() => setActiveProductSubTab('backgrounds')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'backgrounds' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Hình nền</button>
                    </div>

                    {activeProductSubTab === 'parts' && (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-4">
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    <input placeholder="Tìm linh kiện..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-64" />
                                    <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-auto">
                                        <option value="all">Tất cả loại</option>
                                        <option value="hair">Tóc</option>
                                        <option value="face">Mặt</option>
                                        <option value="shirt">Áo</option>
                                        <option value="pants">Quần</option>
                                        <option value="hat">Mũ</option>
                                        <option value="accessory">Phụ kiện</option>
                                        <option value="pet">Thú cưng</option>
                                        <option value="set">Theo bộ</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button onClick={handleSeedData} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap">Reset Data</button>
                                    <button onClick={() => switchToEdit(null, 'parts')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">+ Thêm</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {filteredProducts.map(part => (
                                    <div 
                                        key={part.id} 
                                        className="bg-white border rounded-lg p-2 sm:p-3 group relative hover:shadow-md transition-all"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, part.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropProduct(e, part.id)}
                                    >
                                        <div className="aspect-square bg-gray-50 rounded mb-2 flex items-center justify-center p-2">
                                            <img src={part.imageUrl} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <h4 className="font-bold text-xs sm:text-sm truncate" title={part.name}>{part.name}</h4>
                                        <p className="text-[10px] sm:text-xs text-gray-500">{formatCurrency(part.price)}</p>
                                        <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => switchToEdit(part, 'parts')} className="p-1.5 bg-blue-100 text-blue-600 rounded shadow-sm">✏️</button>
                                            <button onClick={() => handleDeleteProduct(part.id)} className="p-1.5 bg-red-100 text-red-600 rounded shadow-sm">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeProductSubTab === 'frames' && (
                        <>
                            <div className="flex justify-end gap-2 mb-4">
                                <button onClick={handleSeedFrames} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap">Reset Frames</button>
                                <button onClick={() => switchToEdit(null, 'frames')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">+ Thêm Khung</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                                {frames.map(frame => (
                                    <div key={frame.id} className="bg-white border rounded-lg p-4 shadow-sm relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-base sm:text-lg">{frame.name}</h4>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{frame.id}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1 mb-4">
                                            <p>Kích thước: {frame.frameWidthCm}x{frame.frameHeightCm}cm</p>
                                            <p>Giá: <span className="font-bold text-gray-900">{formatCurrency(frame.price)}</span></p>
                                            <p>Tồn kho: <span className="font-bold">{frame.stock}</span></p>
                                            <div className="flex gap-1 mt-1">
                                                {frame.colors.map(c => <span key={c} className="w-3 h-3 rounded-full border" style={{backgroundColor: c === 'wood' ? '#d2b48c' : c}}></span>)}
                                            </div>
                                        </div>
                                        <div className="absolute top-4 right-4 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => switchToEdit(frame, 'frames')} className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-xs font-bold">Sửa</button>
                                            <button onClick={() => handleDeleteFrame(frame.id)} className="px-3 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">Xóa</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeProductSubTab === 'backgrounds' && (
                        <>
                            <div className="flex flex-col gap-4 mb-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                        <input placeholder="Tìm background..." value={bgSearch} onChange={e => setBgSearch(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-64" />
                                        <select value={bgTypeFilter} onChange={(e: any) => setBgTypeFilter(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-auto">
                                            <option value="all">Tất cả loại</option>
                                            <option value="square">Vuông</option>
                                            <option value="rectangle">Chữ nhật</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                                        <button onClick={handleSeedBackgrounds} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap">Reset BG</button>
                                        <button onClick={() => switchToEdit(null, 'backgrounds')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">+ Thêm</button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase mr-2 flex-shrink-0">Dịp:</span>
                                    {bgCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setBgCategoryFilter(cat)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                                                bgCategoryFilter === cat 
                                                    ? 'bg-gray-900 text-white border-gray-900' 
                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {cat === 'all' ? 'Tất cả' : cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {filteredBackgrounds.map(bg => (
                                    <div 
                                        key={bg.id} 
                                        className="bg-white border rounded-lg p-2 sm:p-3 group relative hover:shadow-md transition-all cursor-move"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, bg.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropBackground(e, bg.id)}
                                    >
                                        <div className={`aspect-${bg.type === 'square' ? 'square' : '[2/3]'} bg-gray-50 rounded mb-2 flex items-center justify-center overflow-hidden border border-gray-100`}>
                                            {bg.url.startsWith('#') ? (
                                                <div className="w-full h-full" style={{backgroundColor: bg.url}}></div>
                                            ) : (
                                                <img src={bg.url} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <h4 className="font-bold text-xs sm:text-sm truncate" title={bg.name}>{bg.name}</h4>
                                        <p className="text-[10px] sm:text-xs text-gray-500">{bg.category}</p>
                                        <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => switchToEdit(bg, 'backgrounds')} className="p-1.5 bg-blue-100 text-blue-600 rounded shadow-sm">✏️</button>
                                            <button onClick={() => handleDeleteBackground(bg.id)} className="p-1.5 bg-red-100 text-red-600 rounded shadow-sm">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
