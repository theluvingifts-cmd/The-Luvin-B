
import React, { useState, useMemo } from 'react';
import { LegoPart, FrameOption, PresetBackground, CollectionTemplate } from '../../types';
import { addPart, updatePart, deletePart, seedDatabase, reorderPartsList } from '../../services/productService';
import { addFrame, updateFrame, deleteFrame, seedFrames, reorderFramesList } from '../../services/frameService';
import { addBackground, updateBackground, deleteBackground, seedBackgrounds, reorderBackgroundsList } from '../../services/backgroundService';
import { addTemplate, updateTemplate, deleteTemplate, seedTemplates, reorderTemplatesList } from '../../services/templateService';
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
    showToast?: (message: string, type: 'success' | 'error') => void;
}

type ProductSubTab = 'parts' | 'backgrounds' | 'frames' | 'templates';
type ViewMode = 'list' | 'edit';

export const AdminProducts: React.FC<AdminProductsProps> = ({ products, frames, backgrounds, templates, onRefreshProducts, onRefreshFrames, onRefreshBackgrounds, onRefreshTemplates, showToast }) => {
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

    // Frame Filters
    const [frameSearch, setFrameSearch] = useState('');

    // Template Filters
    const [templateSearch, setTemplateSearch] = useState('');
    const [templateCategory, setTemplateCategory] = useState('all');

    // Editing States (Objects)
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [editingFrame, setEditingFrame] = useState<FrameOption | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [loading, setLoading] = useState(false);

    // Quick Stock Edit State
    const [quickStockEditId, setQuickStockEditId] = useState<string | null>(null);
    const [quickStockValue, setQuickStockValue] = useState<number>(0);

    // Filter Logic
    const filteredProducts = useMemo(() => 
        products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = productCategory === 'all' || p.type === productCategory;
            const matchesStock = showLowStockOnly ? (p.stock !== undefined && p.stock !== null && p.stock <= 10) : true;
            return matchesSearch && matchesCategory && matchesStock;
        }), 
    [products, productSearch, productCategory, showLowStockOnly]);

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

    const filteredFrames = useMemo(() => 
        frames.filter(f => f.name.toLowerCase().includes(frameSearch.toLowerCase())),
    [frames, frameSearch]);

    const templateCategories = useMemo(() => {
        return ['all', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))];
    }, [templates]);

    const filteredTemplates = useMemo(() => 
        templates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase());
            const matchesCategory = templateCategory === 'all' || t.category === templateCategory;
            return matchesSearch && matchesCategory;
        }),
    [templates, templateSearch, templateCategory]);

    // Switch View Handler
    const switchToEdit = (item: any = null, type: ProductSubTab) => {
        if (type === 'parts') setEditingPart(item);
        if (type === 'backgrounds') setEditingBg(item);
        if (type === 'frames') setEditingFrame(item);
        if (type === 'templates') setEditingTemplate(item);
        setViewMode('edit');
    };

    const switchToList = () => {
        setEditingPart(null);
        setEditingBg(null);
        setEditingFrame(null);
        setEditingTemplate(null);
        setViewMode('list');
    };

    // Handlers
    const handleSeedData = async () => { if (confirm("Thao tác này sẽ reset database về mặc định. Tiếp tục?")) { setLoading(true); const res = await seedDatabase(); setLoading(false); if (res && showToast) showToast("Đã nạp dữ liệu linh kiện!", "success"); onRefreshProducts(); } };
    const handleSeedFrames = async () => { if (confirm("Reset Frames về mặc định?")) { setLoading(true); const res = await seedFrames(); setLoading(false); if (res && showToast) showToast("Đã nạp dữ liệu khung!", "success"); onRefreshFrames(); } };
    const handleSeedBackgrounds = async () => { if (confirm("Reset backgrounds về mặc định?")) { setLoading(true); const res = await seedBackgrounds(); setLoading(false); if (res && showToast) showToast("Đã nạp dữ liệu hình nền!", "success"); onRefreshBackgrounds(); } };
    const handleSeedTemplates = async () => { if (confirm("Reset templates về mặc định?")) { setLoading(true); const res = await seedTemplates(); setLoading(false); if (res && showToast) showToast("Đã nạp dữ liệu mẫu thiết kế!", "success"); onRefreshTemplates(); } };

    const handleSaveProduct = async (part: LegoPart) => { 
        try {
            setLoading(true);
            const success = editingPart ? await updatePart(part.id, part) : await addPart(part); 
            if (success) {
                if (showToast) showToast("Đã lưu linh kiện thành công!", "success");
                onRefreshProducts(); switchToList(); 
            } else {
                if (showToast) showToast("Lỗi khi lưu linh kiện. Kiểm tra console.", "error");
            }
        } catch (err: any) {
            console.error("Save product error:", err);
            if (showToast) showToast(`Lỗi: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteProduct = async (id: string) => { 
        if (confirm("Bạn chắc chắn muốn xóa?")) { 
            try {
                setLoading(true);
                const success = await deletePart(id); 
                if (success) {
                    if (showToast) showToast("Đã xóa linh kiện", "success");
                    onRefreshProducts(); 
                } else if (showToast) showToast("Lỗi khi xóa linh kiện", "error");
            } catch (err: any) {
                console.error("Delete product error:", err);
                if (showToast) showToast(`Lỗi: ${err.message}`, "error");
            } finally {
                setLoading(false);
            }
        } 
    };
    
    const handleSaveBackground = async (bg: PresetBackground) => { 
        try {
            setLoading(true);
            const success = editingBg ? await updateBackground(bg.id, bg) : await addBackground(bg); 
            if (success) {
                if (showToast) showToast("Đã lưu hình nền thành công!", "success");
                onRefreshBackgrounds(); switchToList(); 
            } else if (showToast) showToast("Lỗi khi lưu hình nền", "error");
        } catch (err: any) {
            console.error("Save background error:", err);
            if (showToast) showToast(`Lỗi: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteBackground = async (id: string) => { 
        if (confirm("Bạn chắc chắn muốn xóa?")) { 
            try {
                setLoading(true);
                const success = await deleteBackground(id); 
                if (success) {
                    if (showToast) showToast("Đã xóa hình nền", "success");
                    onRefreshBackgrounds(); 
                } else if (showToast) showToast("Lỗi khi xóa hình nền", "error");
            } catch (err: any) {
                console.error("Delete background error:", err);
                if (showToast) showToast(`Lỗi: ${err.message}`, "error");
            } finally {
                setLoading(false);
            }
        } 
    };

    const handleSaveFrame = async (frame: FrameOption) => { 
        try {
            setLoading(true);
            const success = editingFrame ? await updateFrame(frame.id, frame) : await addFrame(frame); 
            if (success) {
                if (showToast) showToast("Đã lưu khung thành công!", "success");
                onRefreshFrames(); switchToList(); 
            } else if (showToast) showToast("Lỗi khi lưu khung", "error");
        } catch (err: any) {
            console.error("Save frame error:", err);
            if (showToast) showToast(`Lỗi: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteFrame = async (id: string) => { 
        if (confirm("Bạn chắc chắn muốn xóa?")) { 
            try {
                setLoading(true);
                const success = await deleteFrame(id); 
                if (success) {
                    if (showToast) showToast("Đã xóa khung", "success");
                    onRefreshFrames(); 
                } else if (showToast) showToast("Lỗi khi xóa khung", "error");
            } catch (err: any) {
                console.error("Delete frame error:", err);
                if (showToast) showToast(`Lỗi: ${err.message}`, "error");
            } finally {
                setLoading(false);
            }
        } 
    };

    const handleSaveTemplate = async (tpl: CollectionTemplate) => { 
        try {
            setLoading(true);
            const success = editingTemplate ? await updateTemplate(tpl.id, tpl) : await addTemplate(tpl); 
            if (success) {
                if (showToast) showToast("Đã tải mẫu thiết kế lên thành công!", "success");
                onRefreshTemplates(); switchToList(); 
            } else if (showToast) showToast("Lỗi khi tải mẫu thiết kế lên!", "error");
        } catch (err: any) {
            console.error("Save template error:", err);
            if (showToast) showToast(`Lỗi: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteTemplate(id); if (showToast) showToast("Đã xóa mẫu thiết kế", "success"); onRefreshTemplates(); } };

    // Quick Stock Edit Handlers
    const startQuickStockEdit = (id: string, currentStock: number | undefined) => {
        setQuickStockEditId(id);
        setQuickStockValue(currentStock || 0);
    };

    const saveQuickStock = async (id: string, type: 'part' | 'frame') => {
        if (type === 'part') {
            await updatePart(id, { stock: quickStockValue });
            onRefreshProducts();
        } else {
            await updateFrame(id, { stock: quickStockValue });
            onRefreshFrames();
        }
        setQuickStockEditId(null);
    };

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
        
        reorderPartsList(items).then(() => onRefreshProducts());
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

        reorderBackgroundsList(items).then(() => onRefreshBackgrounds());
    };

    const handleDropFrame = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === targetId) return;
        
        const items = [...frames];
        const draggedIndex = items.findIndex(f => f.id === draggedId);
        const targetIndex = items.findIndex(f => f.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, removed);

        reorderFramesList(items).then(() => onRefreshFrames());
    };

    const handleDropTemplate = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === targetId) return;
        
        const items = [...templates];
        const draggedIndex = items.findIndex(t => t.id === draggedId);
        const targetIndex = items.findIndex(t => t.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, removed);

        reorderTemplatesList(items).then(() => onRefreshTemplates());
    };

    return (
        <div className="animate-fade-in relative">
            {loading && <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded shadow">Loading...</div></div>}
            
            {/* View Mode Switching Logic */}
            {viewMode === 'edit' ? (
                <div className="w-full h-full bg-gray-50 z-40 overflow-y-auto p-2 sm:p-0">
                    <div className="mb-4">
                        <button onClick={switchToList} className="text-sm text-gray-500 font-bold hover:text-gray-900 transition-colors flex items-center gap-1">
                            &larr; Quay lại danh sách
                        </button>
                    </div>
                    {activeProductSubTab === 'parts' && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={switchToList} />}
                    {activeProductSubTab === 'backgrounds' && <BackgroundForm initialData={editingBg} onSave={handleSaveBackground} onCancel={switchToList} />}
                    {activeProductSubTab === 'frames' && <FrameForm initialData={editingFrame} onSave={handleSaveFrame} onCancel={switchToList} />}
                    {activeProductSubTab === 'templates' && (
                        <TemplateForm 
                            initialData={editingTemplate} 
                            allParts={products} 
                            allFrames={frames} 
                            onSave={handleSaveTemplate} 
                            onCancel={switchToList} 
                            defaultCategory={templateCategory}
                        />
                    )}
                </div>
            ) : (
                <>
                    <div className="flex border-b border-gray-200 mb-6 bg-gray-100/50 p-1 rounded-xl overflow-x-auto no-scrollbar">
                        {(['parts', 'frames', 'backgrounds', 'templates'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveProductSubTab(tab)}
                                className={`flex-1 py-2 px-4 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
                                    activeProductSubTab === tab
                                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {tab === 'parts' ? '🧩 Nhân vật & Phụ kiện' : 
                                 tab === 'frames' ? '🖼️ Khung' : 
                                 tab === 'backgrounds' ? '🌄 Hình nền' : '📋 Mẫu thiết kế'}
                            </button>
                        ))}
                    </div>

                    {activeProductSubTab === 'parts' && (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-wrap">
                                    <div className="relative w-full sm:w-64">
                                        <input 
                                            placeholder="Tìm linh kiện..." 
                                            value={productSearch} 
                                            onChange={e => setProductSearch(e.target.value)} 
                                            className="p-2 pl-8 border rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" 
                                        />
                                        <span className="absolute left-2.5 top-2.5 text-gray-400">🔍</span>
                                    </div>
                                    <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-auto focus:ring-2 focus:ring-blue-500 outline-none">
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
                                    <button 
                                        onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${showLowStockOnly ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        {showLowStockOnly ? 'Đang lọc: Sắp hết' : 'Lọc: Sắp hết'}
                                    </button>
                                    {productCategory === 'all' && productSearch === '' && (
                                        <div className="flex items-center gap-1 text-blue-500 font-bold self-center italic animate-pulse">
                                            <span className="text-[10px]">Lướt xuống để chỉnh mẫu</span>
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button 
                                        onClick={() => { if(window.confirm('Bạn có chắc chắn muốn reset toàn bộ linh kiện về mặc định?')) handleSeedData(); }} 
                                        className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg transition-colors"
                                        title="Reset Data"
                                    >
                                        🔄
                                    </button>
                                    <button 
                                        onClick={() => switchToEdit(null, 'parts')} 
                                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
                                    >
                                        <span>+</span>
                                        <span>Thêm mới</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {filteredProducts.map(part => {
                                    const effectivePrice = getEffectivePrice(part);
                                    const isSale = effectivePrice < part.price;

                                    return (
                                    <div 
                                        key={part.id} 
                                        className="bg-white border rounded-lg p-2 sm:p-3 group relative hover:shadow-md transition-all cursor-move active:opacity-50"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, part.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropProduct(e, part.id)}
                                    >
                                        <div className="aspect-square bg-gray-50 rounded mb-2 flex items-center justify-center p-2">
                                            <img src={part.imageUrl} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <h4 className="font-bold text-xs sm:text-sm truncate" title={part.name}>{part.name}</h4>
                                        <div className="flex justify-between items-center text-[10px] sm:text-xs mt-1">
                                            {isSale ? (
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-gray-400 line-through">{formatCurrency(part.price)}</span>
                                                    <span className="text-red-600 font-bold">{formatCurrency(effectivePrice)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-500">{formatCurrency(part.price)}</span>
                                            )}
                                            
                                            {/* Quick Stock Edit */}
                                            {quickStockEditId === part.id ? (
                                                <div className="flex items-center gap-1 absolute bottom-1 right-1 bg-white border border-blue-200 p-1.5 rounded-lg shadow-xl z-20 animate-in fade-in zoom-in duration-200">
                                                    <div className="relative">
                                                        <input 
                                                            type="number" 
                                                            className="w-16 border border-gray-200 rounded-md px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                                            value={quickStockValue}
                                                            onChange={(e) => setQuickStockValue(Number(e.target.value))}
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveQuickStock(part.id, 'part');
                                                                if (e.key === 'Escape') setQuickStockEditId(null);
                                                            }}
                                                        />
                                                        <span className="absolute -top-3 left-0 text-[8px] font-black text-blue-600 bg-white px-1">STOCK</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => saveQuickStock(part.id, 'part')} 
                                                        className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                                                        title="Lưu"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => setQuickStockEditId(null)} 
                                                        className="p-1 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors"
                                                        title="Hủy"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); startQuickStockEdit(part.id, part.stock); }}
                                                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer hover:bg-gray-100 ${
                                                        (part.stock !== undefined && part.stock <= 10) ? 'text-red-600 bg-red-50' : 'text-gray-500'
                                                    }`}
                                                    title="Click để sửa nhanh tồn kho"
                                                >
                                                    Kho: {part.stock === undefined || part.stock === null ? '∞' : part.stock}
                                                </button>
                                            )}
                                        </div>
                                        {isSale && <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[8px] px-1 rounded font-bold shadow-sm">SALE</div>}
                                        <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => switchToEdit(part, 'parts')} className="p-1.5 bg-blue-100 text-blue-600 rounded shadow-sm">✏️</button>
                                            <button onClick={() => handleDeleteProduct(part.id)} className="p-1.5 bg-red-100 text-red-600 rounded shadow-sm">🗑️</button>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </>
                    )}

                    {activeProductSubTab === 'frames' && (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                    <div className="relative w-full sm:w-64">
                                        <input 
                                            placeholder="Tìm khung..." 
                                            value={frameSearch} 
                                            onChange={e => setFrameSearch(e.target.value)} 
                                            className="p-2 pl-8 border rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" 
                                        />
                                        <span className="absolute left-2.5 top-2.5 text-gray-400">🔍</span>
                                    </div>
                                    {frameSearch === '' && (
                                        <div className="flex items-center gap-1 text-blue-500 font-bold self-center italic animate-pulse">
                                            <span className="text-[10px]">Lướt xuống để chỉnh mẫu</span>
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button 
                                        onClick={() => { if(window.confirm('Bạn có chắc chắn muốn reset toàn bộ khung về mặc định?')) handleSeedFrames(); }} 
                                        className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg transition-colors"
                                        title="Reset Frames"
                                    >
                                        🔄
                                    </button>
                                    <button 
                                        onClick={() => switchToEdit(null, 'frames')} 
                                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
                                    >
                                        <span>+</span>
                                        <span>Thêm Khung</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                                {filteredFrames.map(frame => {
                                    const effectivePrice = getEffectivePrice(frame);
                                    const isSale = effectivePrice < frame.price;

                                    return (
                                    <div 
                                        key={frame.id} 
                                        className="bg-white border rounded-lg p-4 shadow-sm relative group cursor-move active:opacity-50"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, frame.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropFrame(e, frame.id)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-base sm:text-lg">{frame.name}</h4>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{frame.id}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1 mb-4">
                                            <p>Kích thước: {frame.frameWidthCm}x{frame.frameHeightCm}cm</p>
                                            <div className="flex items-center gap-2">
                                                <span>Giá:</span>
                                                {isSale ? (
                                                    <>
                                                        <span className="line-through text-gray-400">{formatCurrency(frame.price)}</span>
                                                        <span className="font-bold text-red-600">{formatCurrency(effectivePrice)}</span>
                                                        <span className="bg-red-100 text-red-600 text-[10px] px-1 rounded font-bold">SALE</span>
                                                    </>
                                                ) : (
                                                    <span className="font-bold text-gray-900">{formatCurrency(frame.price)}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span>Tồn kho:</span>
                                                {/* Quick Stock Edit for Frames */}
                                                {quickStockEditId === frame.id ? (
                                                    <div className="flex items-center gap-1 bg-white border border-blue-200 p-1.5 rounded-lg shadow-xl z-20 animate-in fade-in zoom-in duration-200">
                                                        <div className="relative">
                                                            <input 
                                                                type="number" 
                                                                className="w-16 border border-gray-200 rounded-md px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                                                value={quickStockValue}
                                                                onChange={(e) => setQuickStockValue(Number(e.target.value))}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') saveQuickStock(frame.id, 'frame');
                                                                    if (e.key === 'Escape') setQuickStockEditId(null);
                                                                }}
                                                            />
                                                            <span className="absolute -top-3 left-0 text-[8px] font-black text-blue-600 bg-white px-1">STOCK</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => saveQuickStock(frame.id, 'frame')} 
                                                            className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                                                            title="Lưu"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => setQuickStockEditId(null)} 
                                                            className="p-1 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors"
                                                            title="Hủy"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => startQuickStockEdit(frame.id, frame.stock)}
                                                        className={`font-bold hover:underline ${(frame.stock !== undefined && frame.stock <= 10) ? 'text-red-600' : 'text-gray-900'}`}
                                                        title="Click sửa nhanh"
                                                    >
                                                        {frame.stock}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-1 mt-1">
                                                {frame.colors.map(c => <span key={c} className="w-3 h-3 rounded-full border" style={{backgroundColor: c === 'wood' ? '#d2b48c' : c}}></span>)}
                                            </div>
                                        </div>
                                        <div className="absolute top-4 right-4 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => switchToEdit(frame, 'frames')} className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-xs font-bold">Sửa</button>
                                            <button onClick={() => handleDeleteFrame(frame.id)} className="px-3 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">Xóa</button>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </>
                    )}

                    {activeProductSubTab === 'backgrounds' && (
                        <>
                            <div className="flex flex-col gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                        <div className="relative w-full sm:w-64">
                                            <input 
                                                placeholder="Tìm background..." 
                                                value={bgSearch} 
                                                onChange={e => setBgSearch(e.target.value)} 
                                                className="p-2 pl-8 border rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" 
                                            />
                                            <span className="absolute left-2.5 top-2.5 text-gray-400">🔍</span>
                                        </div>
                                        <select value={bgTypeFilter} onChange={(e: any) => setBgTypeFilter(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-auto focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="all">Tất cả loại</option>
                                            <option value="square">Vuông</option>
                                            <option value="rectangle">Chữ nhật</option>
                                        </select>
                                        {bgSearch === '' && bgCategoryFilter === 'all' && bgTypeFilter === 'all' && (
                                            <div className="flex items-center gap-1 text-blue-500 font-bold self-center italic animate-pulse">
                                                <span className="text-[10px]">Lướt xuống để chỉnh mẫu</span>
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                                        <button 
                                            onClick={() => { if(window.confirm('Bạn có chắc chắn muốn reset toàn bộ background về mặc định?')) handleSeedBackgrounds(); }} 
                                            className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg transition-colors"
                                            title="Reset Backgrounds"
                                        >
                                            🔄
                                        </button>
                                        <button 
                                            onClick={() => switchToEdit(null, 'backgrounds')} 
                                            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
                                        >
                                            <span>+</span>
                                            <span>Thêm mới</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase mr-2 flex-shrink-0">Dịp:</span>
                                    {bgCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setBgCategoryFilter(cat)}
                                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                                bgCategoryFilter === cat 
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
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
                                        className="bg-white border rounded-lg p-2 sm:p-3 group relative hover:shadow-md transition-all cursor-move active:opacity-50"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, bg.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropBackground(e, bg.id)}
                                    >
                                        <div className={`aspect-${bg.type === 'square' ? 'square' : '[2/3]'} bg-gray-50 rounded mb-2 flex items-center justify-center overflow-hidden border border-gray-100 relative`}>
                                            {(bg.previewUrl || !bg.url.startsWith('#')) ? (
                                                <img 
                                                    src={bg.previewUrl || bg.url} 
                                                    className="w-full h-full object-cover" 
                                                    alt="design preview"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-400">
                                                    No Preview
                                                </div>
                                            )}
                                            
                                            {/* Show fallback if missing preview but has template data */}
                                            {bg.overlayConfig && !bg.previewUrl && (
                                                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-2 text-center border-2 border-red-500">
                                                    <span className="text-2xl mb-1">⚠️</span>
                                                    <span className="text-[10px] font-bold text-red-600 leading-tight">Lỗi Thumbnail</span>
                                                    <span className="text-[8px] text-gray-500">Cần vào sửa & lưu lại</span>
                                                </div>
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

                    {activeProductSubTab === 'templates' && (
                        <>
                            <div className="flex flex-col gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                        <div className="relative w-full sm:w-64">
                                            <input 
                                                placeholder="Tìm mẫu..." 
                                                value={templateSearch} 
                                                onChange={e => setTemplateSearch(e.target.value)} 
                                                className="p-2 pl-8 border rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" 
                                            />
                                            <span className="absolute left-2.5 top-2.5 text-gray-400">🔍</span>
                                        </div>
                                        <select value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-auto focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="all">Tất cả danh mục</option>
                                            {templateCategories.filter(c => c !== 'all').map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        {templateSearch === '' && templateCategory === 'all' && (
                                            <div className="flex items-center gap-1 text-blue-500 font-bold self-center italic animate-pulse">
                                                <span className="text-[10px]">Lướt xuống để chỉnh mẫu</span>
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                                        <button 
                                            onClick={() => { if(window.confirm('Bạn có chắc chắn muốn reset toàn bộ mẫu về mặc định?')) handleSeedTemplates(); }} 
                                            className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg transition-colors"
                                            title="Reset Mẫu"
                                        >
                                            🔄
                                        </button>
                                        <button 
                                            onClick={() => switchToEdit(null, 'templates')} 
                                            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
                                        >
                                            <span>+</span>
                                            <span>Thêm Mẫu</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredTemplates.map(tpl => (
                                    <div 
                                        key={tpl.id} 
                                        className="bg-white border rounded-lg overflow-hidden group relative shadow-sm hover:shadow-md transition-all cursor-move active:opacity-50"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, tpl.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropTemplate(e, tpl.id)}
                                    >
                                        <img src={tpl.imageUrl} className="w-full h-48 object-cover" />
                                        <div className="p-3">
                                            <h4 className="font-bold text-gray-800">{tpl.name}</h4>
                                            <div className="flex justify-between items-center mt-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit">{tpl.category || 'Mẫu thiết kế'}</span>
                                                    <div className="flex gap-1">
                                                        {tpl.isHot && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-bold">🔥 HOT</span>}
                                                        {tpl.isNew && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded font-bold">✨ NEW</span>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full mb-1 ${tpl.isSimple ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                        {tpl.isSimple ? 'Mẫu Đơn Giản' : 'Mẫu Thiết Kế'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-bold">{tpl.isSimple ? formatCurrency(tpl.price || 0) : `${tpl.config.characters.length} Nhân vật`}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button onClick={() => switchToEdit(tpl, 'templates')} className="px-3 py-1 bg-white text-gray-900 rounded font-bold text-sm hover:bg-gray-100">Sửa</button>
                                            <button onClick={() => handleDeleteTemplate(tpl.id)} className="px-3 py-1 bg-red-600 text-white rounded font-bold text-sm hover:bg-red-700">Xóa</button>
                                        </div>
                                    </div>
                                ))}
                                {templates.length === 0 && (
                                    <div className="col-span-3 text-center py-10 text-gray-400">
                                        Chưa có mẫu nào.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
