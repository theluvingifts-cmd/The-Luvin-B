
import React, { useState } from 'react';
import { CollectionTemplate, FeedbackItem } from '../../types';
import { StoreConfig, updateStoreConfig } from '../../services/configService';
import { addTemplate, updateTemplate, deleteTemplate, seedTemplates } from '../../services/templateService';
import { addFeedback, updateFeedback, deleteFeedback, seedFeedbacks } from '../../services/feedbackService';
import { uploadToCloudinary } from '../../services/uploadService';
import { ConfigImageUpload } from './shared/ConfigImageUpload';
import { TemplateForm } from './forms/TemplateForm';
import { FeedbackForm } from './forms/FeedbackForm';

interface AdminConfigProps {
    storeConfig: StoreConfig;
    setStoreConfig: React.Dispatch<React.SetStateAction<StoreConfig>>;
    templates: CollectionTemplate[];
    feedbacks: FeedbackItem[];
    onRefreshTemplates: () => void;
    onRefreshFeedbacks: () => void;
}

type ConfigSubTab = 'general' | 'templates' | 'feedbacks';

export const AdminConfig: React.FC<AdminConfigProps> = ({ storeConfig, setStoreConfig, templates, feedbacks, onRefreshTemplates, onRefreshFeedbacks }) => {
    const [activeConfigSubTab, setActiveConfigSubTab] = useState<ConfigSubTab>('general');
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CollectionTemplate | null>(null);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<FeedbackItem | null>(null);
    const [loading, setLoading] = useState(false);

    const handleConfigUpload = async (file: File, field: keyof StoreConfig) => {
        setUploadingField(field);
        try {
            const url = await uploadToCloudinary(file);
            if (url) {
                await updateStoreConfig({ [field]: url });
                setStoreConfig(prev => ({ ...prev, [field]: url }));
                alert(`Đã cập nhật thành công!`);
            } else {
                alert("Lỗi upload.");
            }
        } catch (error) {
            console.error(error);
            alert("Lỗi upload.");
        } finally {
            setUploadingField(null);
        }
    };

    const handleSeedTemplates = async () => { if (confirm("Reset templates về mặc định?")) { setLoading(true); await seedTemplates(); setLoading(false); onRefreshTemplates(); } };
    const handleSaveTemplate = async (tpl: CollectionTemplate) => { setIsEditingTemplate(false); if (editingTemplate) await updateTemplate(tpl.id, tpl); else await addTemplate(tpl); onRefreshTemplates(); setEditingTemplate(null); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteTemplate(id); onRefreshTemplates(); } };

    const handleSeedFeedbacks = async () => { if (confirm("Reset feedbacks về mặc định?")) { setLoading(true); await seedFeedbacks(); setLoading(false); onRefreshFeedbacks(); } };
    const handleSaveFeedback = async (fb: FeedbackItem) => { setIsEditingFeedback(false); if (editingFeedback) await updateFeedback(fb.id, fb); else await addFeedback(fb); onRefreshFeedbacks(); setEditingFeedback(null); };
    const handleDeleteFeedback = async (id: string) => { if (confirm("Bạn chắc chắn muốn xóa?")) { await deleteFeedback(id); onRefreshFeedbacks(); } };

    return (
        <div className="animate-fade-in">
            {loading && <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded shadow">Loading...</div></div>}
            
            <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveConfigSubTab('general')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'general' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Chung</button>
                <button onClick={() => setActiveConfigSubTab('templates')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'templates' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Mẫu (Collection)</button>
                <button onClick={() => setActiveConfigSubTab('feedbacks')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${activeConfigSubTab === 'feedbacks' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Feedbacks</button>
            </div>

            {activeConfigSubTab === 'general' && (
                <div className="bg-white p-6 rounded-lg border shadow-sm max-w-2xl">
                    <h3 className="text-lg font-bold mb-6">Cấu hình chung</h3>
                    <div className="space-y-6">
                        <ConfigImageUpload 
                            label="Logo Website" 
                            description="Hiển thị ở Header (Khuyên dùng PNG trong suốt)"
                            currentUrl={storeConfig.logoUrl}
                            onUpload={(f) => handleConfigUpload(f, 'logoUrl')}
                            isUploading={uploadingField === 'logoUrl'}
                        />
                        <ConfigImageUpload 
                            label="Favicon" 
                            description="Icon trên tab trình duyệt (Vuông, nhỏ)"
                            currentUrl={storeConfig.faviconUrl}
                            onUpload={(f) => handleConfigUpload(f, 'faviconUrl')}
                            isUploading={uploadingField === 'faviconUrl'}
                        />
                        <ConfigImageUpload 
                            label="Banner Hero (Trang chủ)" 
                            description="Ảnh lớn đầu trang chủ"
                            currentUrl={storeConfig.heroImageUrl}
                            onUpload={(f) => handleConfigUpload(f, 'heroImageUrl')}
                            isUploading={uploadingField === 'heroImageUrl'}
                        />
                        <ConfigImageUpload 
                            label="Banner Inspire (Trang chủ)" 
                            description="Ảnh nền phần bộ sưu tập nổi bật"
                            currentUrl={storeConfig.inspireImageUrl}
                            onUpload={(f) => handleConfigUpload(f, 'inspireImageUrl')}
                            isUploading={uploadingField === 'inspireImageUrl'}
                        />
                    </div>
                </div>
            )}

            {activeConfigSubTab === 'templates' && (
                <>
                    <div className="flex justify-end gap-2 mb-4">
                            <button onClick={handleSeedTemplates} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset Mẫu</button>
                            <button onClick={() => setIsEditingTemplate(true)} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700">+ Thêm Mẫu</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-white border rounded-lg overflow-hidden group relative">
                                <img src={tpl.imageUrl} className="w-full h-48 object-cover" />
                                <div className="p-3">
                                    <h4 className="font-bold">{tpl.name}</h4>
                                </div>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => { setEditingTemplate(tpl); setIsEditingTemplate(true); }} className="px-3 py-1 bg-white text-gray-900 rounded font-bold text-sm">Sửa</button>
                                    <button onClick={() => handleDeleteTemplate(tpl.id)} className="px-3 py-1 bg-red-600 text-white rounded font-bold text-sm">Xóa</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {activeConfigSubTab === 'feedbacks' && (
                <>
                    <div className="flex justify-end gap-2 mb-4">
                            <button onClick={handleSeedFeedbacks} className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Reset FB</button>
                            <button onClick={() => setIsEditingFeedback(true)} className="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700">+ Thêm Feedback</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {feedbacks.map(fb => (
                            <div key={fb.id} className="bg-white border rounded-lg p-4 relative group">
                                <div className="flex items-center gap-3 mb-2">
                                    <img src={fb.imageUrl} className="w-10 h-10 rounded-full object-cover" />
                                    <h4 className="font-bold text-sm">{fb.name}</h4>
                                </div>
                                <p className="text-xs text-gray-600 italic">"{fb.text}"</p>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={() => { setEditingFeedback(fb); setIsEditingFeedback(true); }} className="p-1 bg-blue-100 text-blue-600 rounded text-xs">Sửa</button>
                                    <button onClick={() => handleDeleteFeedback(fb.id)} className="p-1 bg-red-100 text-red-600 rounded text-xs">Xóa</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {isEditingTemplate && <TemplateForm initialData={editingTemplate} onSave={handleSaveTemplate} onCancel={() => { setIsEditingTemplate(false); setEditingTemplate(null); }} />}
            {isEditingFeedback && <FeedbackForm initialData={editingFeedback} onSave={handleSaveFeedback} onCancel={() => { setIsEditingFeedback(false); setEditingFeedback(null); }} />}
        </div>
    );
};
