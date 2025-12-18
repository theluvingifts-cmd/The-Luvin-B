
import React, { useState, useMemo } from 'react';
import { LegoPart, FrameOption, PresetBackground, CollectionTemplate } from '../../types';
import { addPart, updatePart, deletePart, seedDatabase, reorderParts } from '../../services/productService';
import { addFrame, updateFrame, deleteFrame, seedFrames } from '../../services/frameService';
import { addBackground, updateBackground, deleteBackground, seedBackgrounds, reorderBackgrounds } from '../../services/backgroundService';
import { addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../../services/templateService';
import { ProductForm } from './forms/ProductForm';
import { FrameForm } from './forms/FrameForm';
import { BackgroundForm } from './forms/BackgroundForm';
import { TemplateForm } from './forms/TemplateForm';
import { formatCurrency, getEffectivePrice } from '../../utils/pricing';

interface AdminProductsProps {
    products: LegoPart[];
    frames: FrameOption[];
    backgrounds: PresetBackground[];
    templates: CollectionTemplate[];
    onRefreshProducts: () => void;
    onRefreshFrames: () => void;
    onRefreshBackgrounds: () => void;
    onRefreshTemplates: () => void;
    onJumpToDesign?: () => void;
}

type ProductSubTab = 'parts' | 'backgrounds' | 'frames' | 'templates';
type ViewMode = 'list' | 'edit';

export const AdminProducts: React.FC<AdminProductsProps> = ({ products, frames, backgrounds, templates, onRefreshProducts, onRefreshFrames, onRefreshBackgrounds, onRefreshTemplates, onJumpToDesign }) => {
    const [activeProductSubTab, setActiveProductSubTab] = useState<ProductSubTab>('parts');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    
    // Product Filters
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    
    // Background Filters
    const [bgSearch, setBgSearch] = useState('');
    const [bgTypeFilter, setBgTypeFilter] = useState<'all' | 'square' | 'rectangle'>('all');
    const [bgCategoryFilter, setBgCategoryFilter] = useState<string>('all');

    // Editing States
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [editingFrame, setEditingFrame] = useState<FrameOption | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [loading, setLoading] = useState(false);

    // Quick Stock Edit State
    const [quickStockEditId, setQuickStockEditId] = useState<string | null>(null);
    const [quickStockValue, setQuickStockValue] = useState<number>(0);

    // FIX: Add missing handleDragStart for reordering
    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    // FIX: Add missing handleDragOver for reordering
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // FIX: Add missing handleDropProduct for reordering
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

        reorderParts(items);
        onRefreshProducts();
    };

    // FIX: Add missing handleDropBackground for reordering
    const handleDropBackground = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === targetId) return;
        if (bgTypeFilter !== 'all' || bgCategoryFilter !== 'all' || bgSearch !== '') return;

        const items = [...backgrounds];
        const draggedIndex = items.findIndex(b => b.id === draggedId);
        const targetIndex = items.findIndex(b => b.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, removed);

        reorderBackgrounds(items);
        onRefreshBackgrounds();
    };

    const filteredProducts = useMemo(() => 
        products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = productCategory === 'all' || p.type === productCategory;
            const matchesStock = showLowStockOnly ? (p.stock !== undefined && p.stock !== null && p.stock <= 10) : true;
            return matchesSearch && matchesCategory && matchesStock;
        }), 
    [products, productSearch, productCategory, showLowStockOnly]);

    const bgCategories = useMemo(() => ['all', ...Array.from(new Set(backgrounds.map(bg => bg.category)))], [backgrounds]);

    const filteredBackgrounds = useMemo(() => 
        backgrounds.filter(bg => {
            const matchType = bgTypeFilter === 'all' || bg.type === bgTypeFilter;
            const matchCategory = bgCategoryFilter === 'all' || bg.category === bgCategoryFilter;
            const matchSearch = bg.name.toLowerCase().includes(bgSearch.toLowerCase());
            return matchType && matchCategory && matchSearch;
        }),
    [backgrounds, bgTypeFilter, bgCategoryFilter, bgSearch]);

    const switchToEdit = (item: any = null, type: ProductSubTab) => {
        if (type === 'parts') setEditingPart(item);
        if (type === 'backgrounds') setEditingBg(item);
        if (type === 'frames') setEditingFrame(item);
        if (type === 'templates') setEditingTemplate(item);
        setViewMode('edit');
    };

    const switchToList = () => {
        setEditingPart(null); setEditingBg(null); setEditingFrame(null); setEditingTemplate(null);
        setViewMode('list');
    };

    const handleSaveProduct = async (part: LegoPart) => { if (editingPart) await updatePart(part.id, part); else await addPart(part); onRefreshProducts(); switchToList(); };
    const handleDeleteProduct = async (id: string) => { if (confirm("Xóa sản phẩm này?")) { await deletePart(id); onRefreshProducts(); } };
    const handleSaveBackground = async (bg: PresetBackground) => { if (editingBg) await updateBackground(bg.id, bg); else await addBackground(bg); onRefreshBackgrounds(); switchToList(); };
    const handleDeleteBackground = async (id: string) => { if (confirm("Xóa nền này?")) { await deleteBackground(id); onRefreshBackgrounds(); } };
    const handleSaveFrame = async (frame: FrameOption) => { if (editingFrame) await updateFrame(frame.id, frame); else await addFrame(frame); onRefreshFrames(); switchToList(); };
    const handleDeleteFrame = async (id: string) => { if (confirm("Xóa khung này?")) { await deleteFrame(id); onRefreshFrames(); } };
    const handleSaveTemplate = async (tpl: CollectionTemplate) => { if (editingTemplate) await updateTemplate(tpl.id, tpl); else await addTemplate(tpl); onRefreshTemplates(); switchToList(); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Xóa mẫu này?")) { await deleteTemplate(id); onRefreshTemplates(); } };

    const saveQuickStock = async (id: string, type: 'part' | 'frame') => {
        if (type === 'part') { await updatePart(id, { stock: quickStockValue }); onRefreshProducts(); }
        else { await updateFrame(id, { stock: quickStockValue }); onRefreshFrames(); }
        setQuickStockEditId(null);
    };

    return (
        <div className="animate-fade-in relative">
            {loading && <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded shadow">Loading...</div></div>}
            
            {viewMode === 'edit' ? (
                <div className="w-full h-full bg-gray-50 z-40 overflow-y-auto p-2 sm:p-0">
                    <div className="mb-4"><button onClick={switchToList} className="text-sm text-gray-500 font-bold hover:text-gray-900 transition-colors flex items-center gap-1">&larr; Quay lại danh sách</button></div>
                    {activeProductSubTab === 'parts' && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={switchToList} />}
                    {activeProductSubTab === 'backgrounds' && <BackgroundForm initialData={editingBg} onSave={handleSaveBackground} onCancel={switchToList} />}
                    {activeProductSubTab === 'frames' && <FrameForm initialData={editingFrame} onSave={handleSaveFrame} onCancel={switchToList} />}
                    {activeProductSubTab === 'templates' && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={switchToList} />}
                </div>
            ) : (
                <>
                    <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-gray-200 pb-2 sm:pb-4 overflow-x-auto no-scrollbar">
                        <button onClick={() => setActiveProductSubTab('parts')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'parts' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Linh kiện</button>
                        <button onClick={() => setActiveProductSubTab('frames')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'frames' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Khung</button>
                        <button onClick={() => setActiveProductSubTab('backgrounds')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'backgrounds' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Hình nền</button>
                        <button onClick={() => setActiveProductSubTab('templates')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'templates' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Mẫu thiết kế</button>
                    </div>

                    {activeProductSubTab === 'parts' && (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-4">
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
                                    <input placeholder="Tìm linh kiện..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-48" />
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
                                    <button onClick={() => setShowLowStockOnly(!showLowStockOnly)} className={`px-3 py-2 text-xs font-bold rounded border transition-colors ${showLowStockOnly ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{showLowStockOnly ? 'Đang lọc: Sắp hết' : 'Lọc: Sắp hết'}</button>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button onClick={seedDatabase} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap">Reset Data</button>
                                    <button onClick={() => switchToEdit(null, 'parts')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">+ Thêm</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {filteredProducts.map(part => (
                                    <div key={part.id} className="bg-white border rounded-lg p-2 sm:p-3 group relative hover:shadow-md transition-all">
                                        <div className="aspect-square bg-gray-50 rounded mb-2 flex items-center justify-center p-2"><img src={part.imageUrl} className="max-w-full max-h-full object-contain" /></div>
                                        <h4 className="font-bold text-xs sm:text-sm truncate">{part.name}</h4>
                                        <div className="flex justify-between items-center text-[10px] sm:text-xs mt-1">
                                            <span className="text-gray-500 font-bold">{formatCurrency(part.price)}</span>
                                            <button onClick={() => { setQuickStockEditId(part.id); setQuickStockValue(part.stock || 0); }} className={`px-1.5 py-0.5 rounded font-bold ${ (part.stock !== undefined && part.stock <= 10) ? 'text-red-600 bg-red-50' : 'text-gray-500' }`}>Kho: {part.stock ?? '∞'}</button>
                                        </div>
                                        {quickStockEditId === part.id && (
                                            <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-2 z-10">
                                                <input type="number" className="w-16 p-1 border rounded text-xs" value={quickStockValue} onChange={e => setQuickStockValue(Number(e.target.value))} />
                                                <button onClick={() => saveQuickStock(part.id, 'part')} className="ml-1 text-green-600 font-bold">✓</button>
                                                <button onClick={() => setQuickStockEditId(null)} className="ml-1 text-red-500 font-bold">×</button>
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><button onClick={() => switchToEdit(part, 'parts')} className="p-1.5 bg-blue-100 text-blue-600 rounded">✏️</button><button onClick={() => handleDeleteProduct(part.id)} className="p-1.5 bg-red-100 text-red-600 rounded">🗑️</button></div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeProductSubTab === 'frames' && (
                        <>
                            <div className="flex justify-end gap-2 mb-4">
                                <button onClick={seedFrames} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset Frames</button>
                                <button onClick={() => switchToEdit(null, 'frames')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700">+ Thêm Khung</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {frames.map(frame => (
                                    <div key={frame.id} className="bg-white border rounded-lg p-4 relative group shadow-sm">
                                        <h4 className="font-bold text-lg">{frame.name}</h4>
                                        <p className="text-sm text-gray-500">Giá: {formatCurrency(frame.price)} | Kho: {frame.stock}</p>
                                        <div className="absolute top-4 right-4 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><button onClick={() => switchToEdit(frame, 'frames')} className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-xs font-bold">Sửa</button><button onClick={() => handleDeleteFrame(frame.id)} className="px-3 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">Xóa</button></div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeProductSubTab === 'backgrounds' && (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    <input placeholder="Tìm background..." value={bgSearch} onChange={e => setBgSearch(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-64" />
                                    <select value={bgTypeFilter} onChange={(e: any) => setBgTypeFilter(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-auto">
                                        <option value="all">Tất cả loại</option><option value="square">Vuông</option><option value="rectangle">Chữ nhật</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button onClick={onJumpToDesign} className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1 shadow-sm">🎨 Studio Thiết Kế</button>
                                    <button onClick={seedBackgrounds} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap">Reset BG</button>
                                    <button onClick={() => switchToEdit(null, 'backgrounds')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">+ Thêm</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {filteredBackgrounds.map(bg => (
                                    <div key={bg.id} className="bg-white border rounded-lg p-2 group relative hover:shadow-md transition-all cursor-move" draggable onDragStart={(e) => handleDragStart(e, bg.id)} onDragOver={handleDragOver} onDrop={(e) => handleDropBackground(e, bg.id)}>
                                        <div className={`aspect-${bg.type === 'square' ? 'square' : '[2/3]'} bg-gray-50 rounded mb-2 overflow-hidden border`}><img src={bg.previewUrl || bg.url} className="w-full h-full object-cover" /></div>
                                        <h4 className="font-bold text-xs truncate">{bg.name}</h4>
                                        <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><button onClick={() => switchToEdit(bg, 'backgrounds')} className="p-1.5 bg-blue-100 text-blue-600 rounded shadow-sm">✏️</button><button onClick={() => handleDeleteBackground(bg.id)} className="p-1.5 bg-red-100 text-red-600 rounded shadow-sm">🗑️</button></div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeProductSubTab === 'templates' && (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                <div className="text-sm text-gray-500 italic">Mẫu sản phẩm đầy đủ để hiển thị trong Bộ Sưu Tập cho khách chọn nhanh.</div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button onClick={onJumpToDesign} className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-2 shadow-sm">
                                        🎨 Thiết kế trực quan (Vào Studio)
                                    </button>
                                    <button onClick={seedTemplates} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap">Reset Mẫu</button>
                                    <button onClick={() => switchToEdit(null, 'templates')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">+ Thêm (Manual)</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {templates.map(tpl => (
                                    <div key={tpl.id} className="bg-white border rounded-xl overflow-hidden group relative shadow-sm hover:shadow-md transition-all">
                                        <img src={tpl.imageUrl} className="w-full h-48 object-contain bg-gray-50 p-4" />
                                        <div className="p-4 bg-white">
                                            <h4 className="font-bold text-gray-800">{tpl.name}</h4>
                                            <p className="text-xs text-gray-500 mt-1">{tpl.config.characters.length} nhân vật | {tpl.category || 'Khác'}</p>
                                        </div>
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button onClick={() => switchToEdit(tpl, 'templates')} className="px-4 py-2 bg-white text-gray-900 rounded-lg font-bold text-sm hover:bg-gray-100 shadow-xl">Sửa thông tin</button>
                                            <button onClick={() => handleDeleteTemplate(tpl.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-xl">Xóa</button>
                                        </div>
                                    </div>
                                ))}
                                {templates.length === 0 && <div className="col-span-3 text-center py-20 text-gray-400 border-2 border-dashed rounded-xl italic">Chưa có mẫu nào trong bộ sưu tập.</div>}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
