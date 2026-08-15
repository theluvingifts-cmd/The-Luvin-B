
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
import { AutoOrdersModal } from './modals/AutoOrdersModal';
import { formatCurrency, getEffectivePrice } from '../../utils/pricing';
import { getDisplayOrderCount, formatOrderNumber } from '../../utils/orderUtils';

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
    const [frameProductLine, setFrameProductLine] = useState<'all' | 'lego' | 'gallery'>('all');

    // Template Filters
    const [templateSearch, setTemplateSearch] = useState('');
    const [templateCategory, setTemplateCategory] = useState('all');
    const [templateProductLine, setTemplateProductLine] = useState<'all' | 'lego' | 'gallery'>('all');
    const [showLowStockTemplatesOnly, setShowLowStockTemplatesOnly] = useState(false);
    const [showAutoOrdersModal, setShowAutoOrdersModal] = useState(false);

    // Editing States (Objects)
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [editingFrame, setEditingFrame] = useState<FrameOption | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [loading, setLoading] = useState(false);

    // Custom Delete Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState<{
        id: string;
        type: ProductSubTab;
        title: string;
        message: string;
    } | null>(null);

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
        frames.filter(f => {
            const matchesSearch = f.name.toLowerCase().includes(frameSearch.toLowerCase());
            const matchesLine = frameProductLine === 'all' || (f.supportedProductLines || ['lego']).includes(frameProductLine);
            return matchesSearch && matchesLine;
        }),
    [frames, frameSearch, frameProductLine]);

    const templateCategories = useMemo(() => {
        return ['all', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))];
    }, [templates]);

    const filteredTemplates = useMemo(() => 
        templates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase());
            const matchesCategory = templateCategory === 'all' || t.category === templateCategory;
            const matchesLine = templateProductLine === 'all' || (t.productLine || 'lego') === templateProductLine;
            const matchesStock = showLowStockTemplatesOnly ? (t.stock === 0) : true;
            return matchesSearch && matchesCategory && matchesLine && matchesStock;
        }),
    [templates, templateSearch, templateCategory, templateProductLine, showLowStockTemplatesOnly]);

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
    const handleDeleteProduct = async (e: React.MouseEvent, id: string) => { 
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        console.log("ADMIN: Requesting delete for Part:", id);
        setDeleteConfirm({
            id,
            type: 'parts',
            title: "Xóa Linh Kiện",
            message: "Bạn có chắc chắn muốn xóa linh kiện này? Hành động này không thể hoàn tác."
        });
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
    const handleDeleteBackground = async (e: React.MouseEvent, id: string) => { 
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        console.log("ADMIN: Requesting delete for Background:", id);
        setDeleteConfirm({
            id,
            type: 'backgrounds',
            title: "Xóa Hình Nền",
            message: "Bạn có chắc chắn muốn xóa hình nền này?"
        });
    };

    const handleSaveFrame = async (frame: FrameOption) => { 
        try {
            setLoading(true);
            const frameToSave = { ...frame };
            if (!editingFrame && (frameToSave.order === undefined || frameToSave.order === null)) {
                frameToSave.order = frames.length;
            }
            const success = editingFrame ? await updateFrame(frameToSave.id, frameToSave) : await addFrame(frameToSave); 
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
    const handleDeleteFrame = async (e: React.MouseEvent, id: string) => { 
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (!id) {
            console.error("ADMIN: Frame ID is missing!");
            if (showToast) showToast("Lỗi: Không tìm thấy ID khung để xóa", "error");
            return;
        }

        console.log("ADMIN: Requesting delete for Frame:", id);
        setDeleteConfirm({
            id,
            type: 'frames',
            title: "XÁC NHẬN XÓA KHUNG",
            message: "BẠN CÓ CHẮC CHẮN MUỐN XÓA KHUNG NÀY?\n\nHành động này sẽ xóa vĩnh viễn khỏi hệ thống và không thể hoàn tác."
        });
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
    const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => { 
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        console.log("ADMIN: Requesting delete for Template:", id);
        setDeleteConfirm({
            id,
            type: 'templates',
            title: "Xóa Mẫu Thiết Kế",
            message: "Bạn có chắc chắn muốn xóa mẫu thiết kế này?"
        });
    };

    // Centralized Delete Execution
    const executeDelete = async () => {
        if (!deleteConfirm) return;
        const { id, type } = deleteConfirm;
        setDeleteConfirm(null); // Close modal
        
        try {
            setLoading(true);
            console.log(`ADMIN: EXECUTE DELETE [${type}] for ID:`, id);
            
            let success = false;
            switch (type) {
                case 'parts':
                    success = await deletePart(id);
                    if (success) {
                        if (showToast) showToast("Đã xóa linh kiện", "success");
                        onRefreshProducts();
                    }
                    break;
                case 'backgrounds':
                    success = await deleteBackground(id);
                    if (success) {
                        if (showToast) showToast("Đã xóa hình nền", "success");
                        onRefreshBackgrounds();
                    }
                    break;
                case 'frames':
                    success = await deleteFrame(id);
                    if (success) {
                        console.log("ADMIN: deleteFrame SUCCESS", id);
                        if (showToast) showToast("Đã xóa khung thành công", "success");
                        // UI will refetch via parent if using polling or state refresh
                        onRefreshFrames(); 
                    }
                    break;
                case 'templates':
                    success = await deleteTemplate(id);
                    if (success) {
                        if (showToast) showToast("Đã xóa mẫu thiết kế", "success");
                        onRefreshTemplates();
                    }
                    break;
            }

            if (!success) {
                console.error(`ADMIN: Delete ${type} API returned false`);
                if (showToast) showToast(`Không thể xóa ${type}, vui lòng thử lại`, "error");
            }
        } catch (err: any) {
            console.error(`ADMIN: Delete ${type} error exception:`, err);
            if (showToast) showToast(`Lỗi hệ thống: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

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
                                            
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1 rounded uppercase tracking-tighter">
                                                    🛍️ {formatOrderNumber(getDisplayOrderCount(part))} lượt bán
                                                </span>
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
                                            <div 
                                                className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-50 pointer-events-auto"
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => { 
                                                        e.preventDefault();
                                                        e.stopPropagation(); 
                                                        console.log("ADMIN: Edit part clicked", part.id);
                                                        switchToEdit(part, 'parts'); 
                                                    }} 
                                                    className="p-2 bg-blue-600 text-white rounded shadow-lg hover:bg-blue-700 transition-all cursor-pointer active:scale-95"
                                                    title="Sửa"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {
                                                        console.log("ADMIN: Delete part clicked", part.id);
                                                        handleDeleteProduct(e, part.id);
                                                    }} 
                                                    className="p-2 bg-red-600 text-white rounded shadow-lg hover:bg-red-700 transition-all cursor-pointer active:scale-95"
                                                    title="Xóa"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
                                    <select 
                                        value={frameProductLine} 
                                        onChange={e => setFrameProductLine(e.target.value as any)} 
                                        className="p-2 border rounded-lg text-sm w-full sm:w-auto focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="all">Tất cả sản phẩm</option>
                                        <option value="lego">Dòng LEGO</option>
                                        <option value="gallery">Dòng GALLERY</option>
                                    </select>
                                    {frameSearch === '' && frameProductLine === 'all' && (
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
                                        onClick={onRefreshFrames}
                                        className="p-2 text-blue-500 hover:text-blue-700 bg-blue-50 border border-blue-100 rounded-lg transition-colors"
                                        title="Làm mới danh sách"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                    <button 
                                        onClick={() => { if(window.confirm('DỮ LIỆU SẼ BỊ RESET VỀ MẶC ĐỊNH. Thao tác này sẽ xóa sạch các khung bạn đã thêm! Bạn có chắc chắn?')) handleSeedFrames(); }} 
                                        className="p-2 text-gray-300 hover:text-red-500 bg-white border border-gray-200 rounded-lg transition-colors"
                                        title="Reset Data"
                                    >
                                        🗑️
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
                                                {frame.colors.map(c => <span key={c} className="w-3 h-3 rounded-full border" style={{backgroundColor: c === 'wood' ? '#d2b48c' : (c === 'black' ? '#111' : (c === 'white' ? '#fff' : c))}}></span>)}
                                            </div>
                                            
                                            <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-50">
                                                {(frame.supportedProductLines || ['lego']).map(line => (
                                                    <span key={line} className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                        line === 'gallery' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                                    }`}>
                                                        {line}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div 
                                            className="absolute top-4 right-4 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-50 pointer-events-auto"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <button 
                                                type="button" 
                                                onClick={(e) => { 
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    console.log("ADMIN: Edit button clicked", frame.id);
                                                    switchToEdit(frame, 'frames'); 
                                                }} 
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black shadow-lg hover:bg-blue-700 transition-all cursor-pointer uppercase active:scale-95"
                                            >
                                                Sửa
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {
                                                    console.log("ADMIN: Delete button clicked", frame.id);
                                                    handleDeleteFrame(e, frame.id);
                                                }} 
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-black shadow-lg hover:bg-red-700 transition-all cursor-pointer uppercase active:scale-95"
                                            >
                                                Xóa
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
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
                                        <div 
                                            className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-50 pointer-events-auto"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <button 
                                                type="button" 
                                                onClick={(e) => { 
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    console.log("ADMIN: Edit background clicked", bg.id);
                                                    switchToEdit(bg, 'backgrounds'); 
                                                }} 
                                                className="p-2 bg-blue-600 text-white rounded shadow-lg hover:bg-blue-700 transition-all cursor-pointer active:scale-95"
                                                title="Sửa"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {
                                                    console.log("ADMIN: Delete background clicked", bg.id);
                                                    handleDeleteBackground(e, bg.id);
                                                }} 
                                                className="p-2 bg-red-600 text-white rounded shadow-lg hover:bg-red-700 transition-all cursor-pointer active:scale-95"
                                                title="Xóa"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
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
                                        {templateProductLine !== 'gallery' && (
                                            <select value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} className="p-2 border rounded-lg text-sm w-full sm:w-auto focus:ring-2 focus:ring-blue-500 outline-none">
                                                <option value="all">Tất cả danh mục</option>
                                                {templateCategories.filter(c => c !== 'all').map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        )}
                                        <select value={templateProductLine} onChange={e => setTemplateProductLine(e.target.value as any)} className="p-2 border rounded-lg text-sm w-full sm:w-auto focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="all">Tất cả dòng SP</option>
                                            <option value="lego">Khung Lego</option>
                                            <option value="gallery">Khung Gallery</option>
                                        </select>
                                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 border rounded-lg hover:bg-gray-100 transition-colors self-start sm:self-auto">
                                            <input 
                                                type="checkbox" 
                                                checked={showLowStockTemplatesOnly} 
                                                onChange={(e) => setShowLowStockTemplatesOnly(e.target.checked)} 
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                            />
                                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-tight">Chỉ hiện hết hàng</span>
                                        </label>
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
                                            onClick={() => setShowAutoOrdersModal(true)} 
                                            className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
                                            title="Xem nhật ký & thống kê lượt đặt hàng tự động"
                                        >
                                            <span>🤖</span>
                                            <span>Nhật ký tăng đơn</span>
                                        </button>
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
                                                        {(tpl.stock !== undefined && tpl.stock <= 0) && <span className="text-[9px] bg-gray-800 text-white px-1 rounded font-bold">🚫 HẾT HÀNG</span>}
                                                        {tpl.isHot && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-bold">🔥 HOT</span>}
                                                        {tpl.isNew && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded font-bold">✨ NEW</span>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full mb-1 ${tpl.isSimple ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                        {tpl.isSimple ? 'Mẫu Đơn Giản' : 'Mẫu Thiết Kế'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-bold">{tpl.isSimple ? formatCurrency(tpl.price || 0) : `${tpl.config.characters.length} Nhân vật`}</span>
                                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full mt-1 border border-blue-100 italic">
                                                        🛍️ Đã bán: {formatOrderNumber(getDisplayOrderCount(tpl))}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div 
                                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-50 pointer-events-auto"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <button 
                                                type="button" 
                                                onClick={(e) => { 
                                                    e.preventDefault();
                                                    e.stopPropagation(); 
                                                    console.log("ADMIN: Edit template clicked", tpl.id);
                                                    switchToEdit(tpl, 'templates'); 
                                                }} 
                                                className="px-4 py-2 bg-white text-gray-900 rounded-lg font-black text-sm hover:bg-gray-100 shadow-xl transition-all cursor-pointer active:scale-95"
                                            >
                                                Sửa
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {
                                                    console.log("ADMIN: Delete template clicked", tpl.id);
                                                    handleDeleteTemplate(e, tpl.id);
                                                }} 
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-black text-sm hover:bg-red-700 shadow-xl transition-all cursor-pointer active:scale-95"
                                            >
                                                Xóa
                                            </button>
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

            {/* Custom Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center gap-3 text-red-600 mb-2">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                </svg>
                                <h3 className="text-xl font-black uppercase tracking-tight">{deleteConfirm.title}</h3>
                            </div>
                            <p className="text-gray-600 font-medium whitespace-pre-wrap leading-relaxed">
                                {deleteConfirm.message}
                            </p>
                        </div>
                        <div className="bg-gray-50 px-6 py-4 flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all active:scale-95 shadow-sm"
                            >
                                Hủy Bỏ
                            </button>
                            <button 
                                onClick={executeDelete}
                                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200 uppercase"
                            >
                                Xác Nhận Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto Orders Modal */}
            <AutoOrdersModal 
                isOpen={showAutoOrdersModal} 
                onClose={() => setShowAutoOrdersModal(false)} 
                templates={templates} 
                onRefreshTemplates={onRefreshTemplates} 
                showToast={showToast} 
            />
        </div>
    );
};
