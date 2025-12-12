
// ... (Previous imports)
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
import { logAction } from '../../services/logService';

interface AdminProductsProps {
    products: LegoPart[];
    frames: FrameOption[];
    backgrounds: PresetBackground[];
    templates: CollectionTemplate[];
    onRefreshProducts: () => void;
    onRefreshFrames: () => void;
    onRefreshBackgrounds: () => void;
    onRefreshTemplates: () => void;
}

type ProductSubTab = 'parts' | 'backgrounds' | 'frames' | 'templates';
type ViewMode = 'list' | 'edit';

export const AdminProducts: React.FC<AdminProductsProps> = ({ products, frames, backgrounds, templates, onRefreshProducts, onRefreshFrames, onRefreshBackgrounds, onRefreshTemplates }) => {
    // ... (Existing states)
    const [activeProductSubTab, setActiveProductSubTab] = useState<ProductSubTab>('parts');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    // ...
    const [loading, setLoading] = useState(false);
    
    // States for Editing forms
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [editingBg, setEditingBg] = useState<PresetBackground | null>(null);
    const [editingFrame, setEditingFrame] = useState<FrameOption | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);

    // Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');

    // ... (Filter Logic and Tab switching logic - KEEP AS IS)
    const filteredProducts = useMemo(() => products.filter(p => (productCategory === 'all' || p.type === productCategory) && p.name.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch, productCategory]);
    // ...

    const switchToList = () => {
        setEditingPart(null); setEditingBg(null); setEditingFrame(null); setEditingTemplate(null); setViewMode('list');
    };
    
    const switchToEdit = (item: any, type: ProductSubTab) => {
        if (type === 'parts') setEditingPart(item);
        if (type === 'backgrounds') setEditingBg(item);
        if (type === 'frames') setEditingFrame(item);
        if (type === 'templates') setEditingTemplate(item);
        setViewMode('edit');
    }

    const handleSaveProduct = async (part: LegoPart) => {
        setLoading(true);
        if (editingPart) {
            await updatePart(part.id, part);
            logAction('UPDATE', 'products', part.id, `Cập nhật sản phẩm ${part.name}`);
        } else {
            await addPart(part);
            logAction('CREATE', 'products', part.id, `Thêm sản phẩm mới ${part.name}`);
        }
        onRefreshProducts(); switchToList(); setLoading(false);
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm("Xóa sản phẩm này?")) {
            await deletePart(id);
            logAction('DELETE', 'products', id, `Xóa sản phẩm`);
            onRefreshProducts();
        }
    };

    // ... Other save handlers (Frames, Backgrounds) - similar logic ...
    const handleSaveFrame = async (frame: FrameOption) => { if(editingFrame) await updateFrame(frame.id, frame); else await addFrame(frame); onRefreshFrames(); switchToList(); };
    const handleDeleteFrame = async (id: string) => { if(confirm("Xóa?")) { await deleteFrame(id); onRefreshFrames(); } };
    const handleSaveBackground = async (bg: PresetBackground) => { if(editingBg) await updateBackground(bg.id, bg); else await addBackground(bg); onRefreshBackgrounds(); switchToList(); };
    const handleDeleteBackground = async (id: string) => { if(confirm("Xóa?")) { await deleteBackground(id); onRefreshBackgrounds(); } };
    const handleSaveTemplate = async (t: CollectionTemplate) => { if(editingTemplate) await updateTemplate(t.id, t); else await addTemplate(t); onRefreshTemplates(); switchToList(); };
    const handleDeleteTemplate = async (id: string) => { if(confirm("Xóa?")) { await deleteTemplate(id); onRefreshTemplates(); } };

    const handleSeedData = async () => { /* ... */ };
    const handleSeedFrames = async () => { /* ... */ };
    const handleSeedBackgrounds = async () => { /* ... */ };
    const handleSeedTemplates = async () => { /* ... */ };

    // --- BULK IMPORT LOGIC ---
    const handleBulkImport = async () => {
        try {
            const parsed = JSON.parse(importData);
            if (!Array.isArray(parsed)) throw new Error("Dữ liệu phải là mảng JSON []");
            
            setLoading(true);
            let count = 0;
            for (const item of parsed) {
                // Basic validation
                if (!item.name || !item.type) continue;
                
                const newPart: LegoPart = {
                    id: item.id || `part_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                    name: item.name,
                    type: item.type,
                    price: Number(item.price) || 0,
                    imageUrl: item.imageUrl || '',
                    widthCm: Number(item.widthCm) || 1,
                    heightCm: Number(item.heightCm) || 1,
                    stock: item.stock,
                    // Optional mapping
                    colors: item.colors || []
                };
                await addPart(newPart);
                count++;
            }
            logAction('IMPORT', 'products', 'bulk', `Nhập nhanh ${count} sản phẩm`);
            alert(`Đã nhập thành công ${count} sản phẩm!`);
            setShowImportModal(false);
            setImportData('');
            onRefreshProducts();
        } catch (e: any) {
            alert("Lỗi nhập liệu: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in relative">
            {loading && <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded shadow">Loading...</div></div>}
            
            {/* View Mode Switch */}
            {viewMode === 'edit' ? (
                <div className="w-full h-full bg-gray-50 z-40 overflow-y-auto p-2 sm:p-0">
                    <div className="mb-4"><button onClick={switchToList} className="text-sm font-bold">&larr; Quay lại</button></div>
                    {activeProductSubTab === 'parts' && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={switchToList} />}
                    {activeProductSubTab === 'frames' && <FrameForm initialData={editingFrame} onSave={handleSaveFrame} onCancel={switchToList} />}
                    {activeProductSubTab === 'backgrounds' && <BackgroundForm initialData={editingBg} onSave={handleSaveBackground} onCancel={switchToList} />}
                    {activeProductSubTab === 'templates' && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={switchToList} />}
                </div>
            ) : (
                <>
                    <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-gray-200 pb-2 sm:pb-4 overflow-x-auto no-scrollbar">
                        <button onClick={() => setActiveProductSubTab('parts')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'parts' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Linh kiện</button>
                        <button onClick={() => setActiveProductSubTab('frames')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeProductSubTab === 'frames' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>Khung</button>
                        {/* ... other tabs ... */}
                    </div>

                    {activeProductSubTab === 'parts' && (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-4">
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <input placeholder="Tìm linh kiện..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="p-2 border rounded-lg text-sm w-full" />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button onClick={() => setShowImportModal(true)} className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-100 rounded hover:bg-blue-200">Nhập Excel/JSON</button>
                                    <button onClick={() => switchToEdit(null, 'parts')} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">+ Thêm</button>
                                </div>
                            </div>
                            
                            {/* Product Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {filteredProducts.map(part => (
                                    <div key={part.id} className="bg-white border rounded-lg p-2 relative group hover:shadow-md">
                                        <div className="aspect-square bg-gray-50 flex items-center justify-center mb-2"><img src={part.imageUrl} className="max-w-full max-h-full" /></div>
                                        <h4 className="font-bold text-xs truncate">{part.name}</h4>
                                        <p className="text-xs text-gray-500">{formatCurrency(part.price)}</p>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => switchToEdit(part, 'parts')} className="p-1 bg-blue-100 text-blue-600 rounded">✏️</button>
                                            <button onClick={() => handleDeleteProduct(part.id)} className="p-1 bg-red-100 text-red-600 rounded">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    
                    {/* ... Frames, Backgrounds, Templates render blocks (Simplified for snippet) ... */}
                    {activeProductSubTab === 'frames' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {frames.map(f => (
                                <div key={f.id} className="p-4 border rounded bg-white relative group">
                                    <h4 className="font-bold">{f.name}</h4>
                                    <p className="text-sm">{f.price}đ</p>
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100">
                                        <button onClick={() => switchToEdit(f, 'frames')} className="text-blue-600 font-bold text-xs">Sửa</button>
                                        <button onClick={() => handleDeleteFrame(f.id)} className="text-red-600 font-bold text-xs">Xóa</button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => switchToEdit(null, 'frames')} className="p-4 border border-dashed rounded flex items-center justify-center text-gray-400 hover:bg-gray-50">+ Thêm khung</button>
                        </div>
                    )}
                </>
            )}

            {/* IMPORT MODAL */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
                        <h3 className="text-xl font-bold mb-4">Nhập sản phẩm hàng loạt (JSON)</h3>
                        <p className="text-xs text-gray-500 mb-2">
                            Dán danh sách sản phẩm dạng JSON mảng vào dưới đây. 
                            <br/>Cấu trúc mẫu: <code>[{`{"name": "Tóc đen", "type": "hair", "price": 10000, "imageUrl": "..."}`}, ...]</code>
                        </p>
                        <textarea 
                            className="w-full h-64 border border-gray-300 rounded p-2 text-xs font-mono mb-4"
                            value={importData}
                            onChange={(e) => setImportData(e.target.value)}
                            placeholder='[{"name": "...", ...}]'
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                            <button onClick={handleBulkImport} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Nhập dữ liệu</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
