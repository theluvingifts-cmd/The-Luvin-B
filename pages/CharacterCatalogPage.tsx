import React, { useState, useMemo, useEffect } from 'react';
import { LegoPart, LegoCharacterConfig } from '../types';
import { getAllParts, updatePart } from '../services/productService';
import { formatCurrency } from '../utils/pricing';
import { useLanguage } from '../src/contexts/LanguageContext';
import { SmartImage } from '../components/shared/SmartImage';
import { Search, Filter, Copy, Check, ChevronRight, LayoutGrid, List, MessageSquare, RefreshCw, Users, Download, Trash2, Tag, Star, Palette, Ruler } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CharacterCatalogPage: React.FC = () => {
    const { t } = useLanguage();
    const [allParts, setAllParts] = useState<LegoPart[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<string>('all');
    const [activeGender, setActiveGender] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'bulk'>('grid');
    const [partOverrides, setPartOverrides] = useState<Record<string, 'male' | 'female' | 'unisex'>>(() => {
        const saved = localStorage.getItem('lego_part_gender_overrides');
        return saved ? JSON.parse(saved) : {};
    });
    const [openPicker, setOpenPicker] = useState<{type: string, gender: 'male' | 'female'} | null>(null);
    const [pickerSearch, setPickerSearch] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Bulk Planner State
    const [bulkConfig, setBulkConfig] = useState({
        male: 28,
        female: 27,
        legType: 'regular' as 'regular' | 'long',
        maleTheme: {
            hairId: 'all',
            faceId: 'all',
            shirtId: 'all',
            pantsId: 'all'
        },
        femaleTheme: {
            hairId: 'all',
            faceId: 'all',
            shirtId: 'all',
            pantsId: 'all'
        }
    });

    const [bulkCharacters, setBulkCharacters] = useState<LegoCharacterConfig[]>([]);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const parts = await getAllParts();
                setAllParts(parts);
            } catch (err) {
                console.error("Error loading parts:", err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const typeTabs = [
        { id: 'all', label: 'Tất cả' },
        { id: 'hair', label: 'Tóc' },
        { id: 'face', label: 'Khuôn mặt' },
        { id: 'shirt', label: 'Áo/Body' },
        { id: 'pants', label: 'Quần' },
        { id: 'hat', label: 'Mũ/Nón' },
        { id: 'accessory', label: 'Phụ kiện' },
        { id: 'pet', label: 'Thú cưng' },
    ];

    const filteredParts = useMemo(() => {
        return allParts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTab = activeTab === 'all' || p.type === activeTab;
            const matchesGender = activeGender === 'all' || inferGender(p) === activeGender || inferGender(p) === 'unisex';
            // Show all parts, we will grey out OOS in the UI
            return matchesSearch && matchesTab && matchesGender;
        });
    }, [allParts, searchTerm, activeTab, activeGender]);

    const [isTaggingMode, setIsTaggingMode] = useState(false);

    // Enhanced Gender Inference with Master Overrides
    const inferGender = (part: LegoPart): 'male' | 'female' | 'unisex' => {
        // 0. Manual Override (Highest Priority)
        if (partOverrides[part.id]) return partOverrides[part.id];

        const nameLower = part.name.toLowerCase();
        
        // 1. Graduation case (Priority & Unisex by default)
        if (nameLower.includes('tốt nghiệp') || nameLower.includes('cử nhân') || nameLower.includes('grad')) {
            if (nameLower.includes('nữ')) return 'female';
            if (nameLower.includes('nam')) return 'male';
            return 'unisex';
        }

        // 2. Female keywords
        const femaleKeywords = [
            'nữ', 'girl', 'cô gái', 'váy', 'đầm', 'vòng 1', 'ngực', 'môi', 'uốn', 'búi', 
            'nơ', 'makeup', 'son', 'mi mắt', 'lông mi', 'long hair', 'tóc dài', 'mái', 'phụ nữ',
            'eyelashes', 'lipstick', 'má hồng', 'longlashes', 'smile'
        ];
        if (femaleKeywords.some(k => nameLower.includes(k))) return 'female';
        
        // 3. Male keywords
        const maleKeywords = [
            'nam', 'boy', 'trai', 'râu', 'vest', 'cà vạt', 'ngắn', 'vuốt', 'lính', 
            'quai nón', 'ca vát', 'suit', 'gentleman', 'đàn ông', 'beard', 'goatee', 'moustache'
        ];
        if (maleKeywords.some(k => nameLower.includes(k))) return 'male';

        // 4. Specific logic for positions/types
        if (part.type === 'shirt' && (nameLower.includes('police') || nameLower.includes('security'))) return 'male';
        
        return 'unisex';
    };

    const handleOverrideGender = async (id: string, gender: 'male' | 'female' | 'unisex', e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Update local state for immediate feedback
        const newOverrides = { ...partOverrides, [id]: gender };
        setPartOverrides(newOverrides);
        localStorage.setItem('lego_part_gender_overrides', JSON.stringify(newOverrides));

        // Persist to Firestore if possible
        try {
            const success = await updatePart(id, { gender });
            if (success) {
                console.log(`Updated part ${id} gender to ${gender} in Firestore`);
            } else {
                console.warn(`Failed to update part ${id} in Firestore (Guest or Permission issue)`);
            }
        } catch (err: any) {
            console.error("Failed to persist gender override to Firestore:", err);
        }
    };

    const [isGenerating, setIsGenerating] = useState(false);

    const generateBulk = async () => {
        if (allParts.length === 0) {
            alert("Đang tải dữ liệu, vui lòng đợi giây lát...");
            return;
        }

        setIsGenerating(true);
        // Add a tiny delay for visual feedback
        await new Promise(r => setTimeout(r, 600));

        try {
            // ONLY parts in stock (ignore negative corruption)
            const inStockParts = allParts.filter(p => p.stock === undefined || p.stock === null || p.stock !== 0);
            
            const hairs = inStockParts.filter(p => p.type === 'hair');
            const faces = inStockParts.filter(p => p.type === 'face');
            const shirts = inStockParts.filter(p => p.type === 'shirt' || p.type === 'set');
            const pants = inStockParts.filter(p => p.type === 'pants');

            if (!hairs.length || !faces.length || !shirts.length || !pants.length) {
                alert(`Cảnh báo: Không đủ linh kiện CÒN HÀNG để tạo ngẫu nhiên!\n\nSố lượng còn:\n- Tóc: ${hairs.length}\n- Mặt: ${faces.length}\n- Áo: ${shirts.length}\n- Quần: ${pants.length}`);
                setIsGenerating(false);
                return;
            }

            const newChars: LegoCharacterConfig[] = [];
            
            const createChar = (gender: 'male' | 'female', index: number) => {
                const theme = gender === 'male' ? bulkConfig.maleTheme : bulkConfig.femaleTheme;

                const getPart = (pool: LegoPart[], type: string, themeId: string) => {
                    // CRITICAL: If a specific ID is picked, return it IMMEDIATELY
                    if (themeId && themeId !== 'all') {
                        const specific = allParts.find(p => p.id === themeId);
                        if (specific) return specific;
                    }

                    // Otherwise, pick random from pool filtered by current gender rules
                    let filtered = pool.filter(p => {
                        const pGender = inferGender(p);
                        return pGender === gender || pGender === 'unisex';
                    });

                    if (filtered.length === 0) filtered = pool;
                    return filtered[Math.floor(Math.random() * filtered.length)];
                };

                const charHair = getPart(hairs, 'hair', theme.hairId);
                const charFace = getPart(faces, 'face', theme.faceId);
                const charShirt = getPart(shirts, 'shirt', theme.shirtId);
                
                // Pants logic with specific ID support
                let charPants: LegoPart;
                if (theme.pantsId && theme.pantsId !== 'all') {
                    charPants = allParts.find(p => p.id === theme.pantsId) || pants[0];
                } else {
                    const gPantsPool = pants.filter(p => {
                        const pGender = inferGender(p);
                        return pGender === gender || pGender === 'unisex';
                    });
                    const pantsByLength = (gPantsPool.length > 0 ? gPantsPool : pants).filter(p => {
                        const name = p.name.toLowerCase();
                        const isLong = name.includes('dài') || name.includes('long');
                        return bulkConfig.legType === 'long' ? isLong : !isLong;
                    });
                    const poolToPickFrom = pantsByLength.length > 0 ? pantsByLength : (gPantsPool.length > 0 ? gPantsPool : pants);
                    charPants = poolToPickFrom[Math.floor(Math.random() * poolToPickFrom.length)];
                }

                return {
                    id: `${Date.now()}-${gender}-${index}-${Math.random()}`,
                    hair: charHair,
                    face: charFace,
                    shirt: charShirt,
                    pants: charPants,
                    x: 0, y: 0, rotation: 0, scale: 1
                };
            };

            const maleCount = Math.max(0, bulkConfig.male);
            const femaleCount = Math.max(0, bulkConfig.female);

            for (let i = 0; i < maleCount; i++) newChars.push(createChar('male', i));
            for (let i = 0; i < femaleCount; i++) newChars.push(createChar('female', i + maleCount));
            
            setBulkCharacters(newChars);
        } catch (err) {
            console.error("Bulk generation error:", err);
            alert("Có lỗi xảy ra khi tạo danh sách. Vui lòng thử lại!");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleCopySelection = () => {
        const text = selectedIds.join('\n');
        navigator.clipboard.writeText(text);
        alert('Đã sao chép danh sách ID đã chọn!');
    };

    const handleCopyBulkIds = () => {
        const allIds = bulkCharacters.flatMap(char => [
            char.hair?.id,
            char.face?.id,
            char.shirt?.id,
            char.pants?.id
        ].filter(Boolean));
        
        const text = allIds.join('\n');
        navigator.clipboard.writeText(text);
        alert('Đã sao chép toàn bộ mã linh kiện của các nhân vật đã tạo!');
    };

    const handleShareZalo = () => {
        const selectedParts = allParts.filter(p => selectedIds.includes(p.id));
        const message = `Danh sách linh kiện LEGO tôi đã chọn:\n\n${selectedParts.map(p => `- ${p.name} (ID: ${p.id})`).join('\n')}\n\nTổng cộng: ${selectedIds.length} món.`;
        window.open(`https://zalo.me/0964393115?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-body text-site-text pb-32">
            {/* Hero Header */}
            <div className="bg-white border-b border-gray-100 pt-12 pb-8">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] block">
                                Catalog for Bulk Orders
                            </span>
                            {bulkCharacters.length > 0 && (
                                <span className="bg-pink-100 text-primary text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                                    Đang lập kế hoạch: {bulkCharacters.length} NV
                                </span>
                            )}
                        </div>
                        <h1 className="text-4xl font-heading font-black text-gray-900 mb-4 leading-tight uppercase">
                            Thư viện <span className="text-primary italic">Phụ kiện LEGO</span>
                        </h1>
                        <p className="text-xs text-gray-400 font-bold max-w-xl leading-relaxed mb-8">
                            Dành riêng cho khách hàng sỉ và doanh nghiệp. Thiết kế nhanh danh sách nhân vật nam/nữ số lượng lớn và xem preview trực quan.
                        </p>

                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="relative flex-grow max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Tìm tên hoặc mã linh kiện..." 
                                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
                                    title="Dạng lưới"
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
                                    title="Dạng danh sách"
                                >
                                    <List className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => setViewMode('bulk')}
                                    className={`relative p-2.5 rounded-lg transition-all ${viewMode === 'bulk' ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
                                    title="Lập kế hoạch sỉ"
                                >
                                    <Users className="w-5 h-5" />
                                    {bulkCharacters.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white"></span>}
                                </button>
                            </div>
                            <div className="h-8 w-px bg-gray-100 mx-2 hidden sm:block"></div>
                            <button 
                                onClick={() => setIsTaggingMode(!isTaggingMode)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-2xl border-2 transition-all group relative overflow-hidden ${isTaggingMode ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white border-indigo-100 text-indigo-500 hover:bg-indigo-50'}`}
                                title="Chế độ phân loại Nam/Nữ"
                            >
                                <Tag className={`w-4 h-4 ${isTaggingMode ? 'fill-current' : ''}`} />
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Phân loại giới tính</span>
                                    <span className={`text-[7px] font-bold uppercase opacity-80 ${isTaggingMode ? 'text-white' : 'text-gray-400'}`}>
                                        {isTaggingMode ? 'Đang bật • Bấm để tắt' : 'Đang tắt • Bấm để sửa giới tính'}
                                    </span>
                                </div>
                                {isTaggingMode && <span className="absolute top-0 right-0 w-2 h-2 bg-red-400 animate-ping rounded-full" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Tabs - Hidden in Bulk Mode */}
            {viewMode !== 'bulk' && (
                <div className="sticky top-[64px] z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 overflow-x-auto no-scrollbar">
                    <div className="container mx-auto px-6 flex flex-col gap-4 py-4">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                            <Filter className="w-4 h-4 text-gray-300 mr-2 shrink-0" />
                            {typeTabs.map(tab => (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`whitespace-nowrap px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {/* Gender Quick Filter */}
                        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 border-t border-gray-50 pt-4">
                            <span className="shrink-0 flex items-center gap-1.5">
                                <Users className="w-3 h-3" />
                                Lọc giới tính:
                            </span>
                            <div className="flex gap-4">
                                {[
                                    { id: 'all', label: 'Tất cả' },
                                    { id: 'male', label: 'Nam' },
                                    { id: 'female', label: 'Nữ' },
                                    { id: 'unisex', label: 'Unisex' }
                                ].map(g => (
                                    <button 
                                        key={g.id}
                                        onClick={() => setActiveGender(g.id)}
                                        className={`transition-all hover:scale-105 active:scale-95 ${activeGender === g.id ? 'text-primary scale-110' : 'text-gray-300'}`}
                                    >
                                        [ {g.label} ]
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="container mx-auto px-6 py-12">
                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="aspect-square bg-gray-100 rounded-3xl animate-pulse"></div>
                        ))}
                    </div>
                ) : filteredParts.length === 0 && viewMode !== 'bulk' ? (
                    <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-gray-200">
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="font-bold text-gray-900 uppercase">Không tìm thấy linh kiện</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">vui lòng thử từ khóa khác</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                        {filteredParts.map(part => (
                            <div 
                                key={part.id}
                                onClick={() => toggleSelect(part.id)}
                                className={`group relative bg-white p-4 rounded-[2rem] border-2 transition-all cursor-pointer hover:shadow-xl hover:shadow-pink-100/30 ${selectedIds.includes(part.id) ? 'border-primary shadow-lg shadow-primary/10' : 'border-gray-50 shadow-sm'} ${part.stock === 0 ? 'opacity-60 grayscale' : ''}`}
                            >
                                {/* Selection Indicator */}
                                {selectedIds.includes(part.id) && (
                                    <div className="absolute top-3 right-3 z-10 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-scale-in">
                                        <Check className="w-3.5 h-3.5 stroke-[4]" />
                                    </div>
                                )}

                                <div className="aspect-square rounded-2xl bg-gray-50 p-2 sm:p-4 mb-4 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden relative">
                                    <SmartImage 
                                        src={part.imageUrl} 
                                        fallback="https://placehold.co/400x400?text=LEGO"
                                        className={`max-h-full max-w-full object-contain`}
                                    />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setZoomedImage(part.imageUrl); }}
                                        className="absolute bottom-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <Search className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-tighter truncate">{part.type}</p>
                                    <h4 className="text-xs font-black text-gray-900 uppercase truncate leading-tight group-hover:text-primary transition-colors">{part.name}</h4>
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                #{part.id}
                                            </span>
                                            <div className="flex flex-col gap-1.5 mt-2">
                                                {isTaggingMode ? (
                                                    <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 rounded-lg border border-gray-100 shadow-inner">
                                                        <button 
                                                            onClick={(e) => handleOverrideGender(part.id, 'male', e)}
                                                            className={`py-1 rounded-md text-[7px] font-black uppercase transition-all ${partOverrides[part.id] === 'male' ? 'bg-blue-500 text-white shadow-md shadow-blue-200' : 'text-gray-400 hover:bg-white'}`}
                                                        >
                                                            Nam
                                                        </button>
                                                        <button 
                                                            onClick={(e) => handleOverrideGender(part.id, 'female', e)}
                                                            className={`py-1 rounded-md text-[7px] font-black uppercase transition-all ${partOverrides[part.id] === 'female' ? 'bg-pink-500 text-white shadow-md shadow-pink-200' : 'text-gray-400 hover:bg-white'}`}
                                                        >
                                                            Nữ
                                                        </button>
                                                        <button 
                                                            onClick={(e) => handleOverrideGender(part.id, 'unisex', e)}
                                                            className={`py-1 rounded-md text-[7px] font-black uppercase transition-all ${partOverrides[part.id] === 'unisex' ? 'bg-gray-400 text-white' : 'text-gray-400 hover:bg-white'}`}
                                                        >
                                                            All
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${
                                                            inferGender(part) === 'female' ? 'bg-pink-50 border-pink-100 text-pink-500' : 
                                                            inferGender(part) === 'male' ? 'bg-blue-50 border-blue-100 text-blue-500' : 
                                                            'bg-gray-50 border-gray-100 text-gray-400'
                                                        }`}>
                                                            {partOverrides[part.id] && <Star className="w-2 h-2 fill-current" />}
                                                            <span className="text-[7px] font-black uppercase">
                                                                {inferGender(part)} {partOverrides[part.id] ? '(Note)' : '(AI)'}
                                                            </span>
                                                        </div>
                                                        {part.stock !== undefined && (
                                                            <span className={`text-[8px] font-bold ${part.stock > 10 ? 'text-green-400' : part.stock !== 0 ? 'text-orange-400' : 'text-red-400'}`}>
                                                                • {part.stock !== 0 ? `Tồn ${part.stock}` : 'Hết'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => handleCopy(part.id, e)}
                                            className={`p-1.5 rounded-lg transition-all ${copiedId === part.id ? 'bg-green-50 text-green-500' : 'text-gray-300 hover:text-primary hover:bg-primary/5'}`}
                                        >
                                            {copiedId === part.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                 <tr className="bg-gray-50 border-b border-gray-100">
                                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sản phẩm</th>
                                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:table-cell">Loại</th>
                                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mã ID</th>
                                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tồn kho</th>
                                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Thao tác</th>
                                 </tr>
                            </thead>
                            <tbody>
                                {filteredParts.map(part => (
                                    <tr 
                                        key={part.id}
                                        className={`border-b border-gray-50 transition-colors cursor-pointer ${selectedIds.includes(part.id) ? 'bg-primary/5' : 'hover:bg-gray-50/50'} ${part.stock === 0 ? 'opacity-60 grayscale' : ''}`}
                                        onClick={() => toggleSelect(part.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-gray-50 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                                    <img src={part.imageUrl} className={`max-w-full max-h-full object-contain`} alt="" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900 uppercase leading-none mb-1">{part.name}</span>
                                                    <span className={`text-[8px] font-black uppercase ${inferGender(part) === 'female' ? 'text-pink-400' : inferGender(part) === 'male' ? 'text-blue-400' : 'text-gray-300'}`}>
                                                        {inferGender(part)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden sm:table-cell">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{part.type}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono font-bold text-gray-500">#{part.id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-black uppercase text-gray-900`}>
                                                {part.stock !== undefined ? `${part.stock} món` : 'Liên hệ'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={(e) => handleCopy(part.id, e)}
                                                    className="p-2 text-gray-300 hover:text-primary transition-colors"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.includes(part.id) ? 'bg-primary border-primary text-white' : 'border-gray-200'}`}>
                                                    {selectedIds.includes(part.id) && <Check className="w-3 h-3 stroke-[4]" />}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        {/* Bulk Controls */}
                        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm space-y-8">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-6 bg-primary rounded-full"></div>
                                <h3 className="text-lg font-black text-gray-900 uppercase">Cấu hình nhân vật sỉ</h3>
                            </div>

                            {/* Population Settings */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">Số lượng Nam</label>
                                    <input 
                                        type="number" 
                                        value={bulkConfig.male} 
                                        onChange={(e) => setBulkConfig(prev => ({ ...prev, male: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-pink-500 uppercase tracking-widest block">Số lượng Nữ</label>
                                    <input 
                                        type="number" 
                                        value={bulkConfig.female} 
                                        onChange={(e) => setBulkConfig(prev => ({ ...prev, female: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-pink-50/30 border border-pink-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-pink-100 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Kiểu chân (Toàn bộ)</label>
                                    <select 
                                        value={bulkConfig.legType}
                                        onChange={(e) => setBulkConfig(prev => ({ ...prev, legType: e.target.value as any }))}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    >
                                        <option value="regular">Chân ngắn (Thường)</option>
                                        <option value="long">Chân dài (Fashion/High-end)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Theme Overrides */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-gray-50">
                                {/* Male Theme */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-blue-400 rounded-full"></div>
                                        <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Quy tắc riêng cho NAM</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { label: 'Tóc', type: 'hair', key: 'hairId' },
                                            { label: 'Mặt', type: 'face', key: 'faceId' },
                                            { label: 'Áo', type: 'shirt', key: 'shirtId' },
                                            { label: 'Quần', type: 'pants', key: 'pantsId' },
                                        ].map(field => {
                                            const currentId = (bulkConfig.maleTheme as any)[field.key];
                                            const part = allParts.find(p => p.id === currentId);
                                            return (
                                                <div key={field.key} className="space-y-1">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase">{field.label}</label>
                                                        <span className="text-[7px] font-bold text-blue-400 animate-pulse">BẤM ĐỂ CHỌN</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => setOpenPicker({ type: field.type, gender: 'male' })}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 bg-white border-2 rounded-xl transition-all text-left shadow-sm ${part ? 'border-blue-400 ring-2 ring-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 p-0.5 flex items-center justify-center shrink-0">
                                                            {part ? <img src={part.imageUrl} className="max-w-full max-h-full object-contain" alt="" /> : <RefreshCw className="w-4 h-4 text-gray-300" />}
                                                        </div>
                                                        <div className="flex-grow min-w-0">
                                                            <div className="text-[10px] font-black text-gray-900 truncate uppercase">{part?.name || 'Ngẫu nhiên'}</div>
                                                            <div className="text-[8px] font-mono font-bold text-gray-400">{part ? `#${part.id}` : 'AI tự phối'}</div>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Female Theme */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-pink-400 rounded-full"></div>
                                        <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Quy tắc riêng cho NỮ</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { label: 'Tóc', type: 'hair', key: 'hairId' },
                                            { label: 'Mặt', type: 'face', key: 'faceId' },
                                            { label: 'Áo', type: 'shirt', key: 'shirtId' },
                                            { label: 'Quần', type: 'pants', key: 'pantsId' },
                                        ].map(field => {
                                            const currentId = (bulkConfig.femaleTheme as any)[field.key];
                                            const part = allParts.find(p => p.id === currentId);
                                            return (
                                                <div key={field.key} className="space-y-1">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase">{field.label}</label>
                                                        <span className="text-[7px] font-bold text-pink-400 animate-pulse">BẤM ĐỂ CHỌN</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => setOpenPicker({ type: field.type, gender: 'female' })}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 bg-white border-2 rounded-xl transition-all text-left shadow-sm ${part ? 'border-pink-400 ring-2 ring-pink-50' : 'border-gray-100 hover:border-pink-200'}`}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 p-0.5 flex items-center justify-center shrink-0">
                                                            {part ? <img src={part.imageUrl} className="max-w-full max-h-full object-contain" alt="" /> : <RefreshCw className="w-4 h-4 text-gray-300" />}
                                                        </div>
                                                        <div className="flex-grow min-w-0">
                                                            <div className="text-[10px] font-black text-gray-900 truncate uppercase">{part?.name || 'Ngẫu nhiên'}</div>
                                                            <div className="text-[8px] font-mono font-bold text-gray-400">{part ? `#${part.id}` : 'AI tự phối'}</div>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>


                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-50">
                                {bulkCharacters.length > 0 && (
                                    <button 
                                        onClick={() => setBulkCharacters([])}
                                        className="px-6 py-4 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Xóa nháp
                                    </button>
                                )}
                                <button 
                                    onClick={generateBulk}
                                    disabled={isGenerating}
                                    className={`px-12 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                    {isGenerating ? 'Đang khởi tạo...' : 'Tạo danh sách'}
                                </button>
                            </div>
                        </div>


                        {/* Preview Grid */}
                        {bulkCharacters.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Xem trước danh sách ({bulkCharacters.length})</h3>
                                    <button 
                                        onClick={handleCopyBulkIds}
                                        className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                                    >
                                        <Download className="w-3 h-3" />
                                        Xuất danh sách ID
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                    <AnimatePresence mode="popLayout">
                                        {bulkCharacters.map((char, index) => (
                                            <motion.div 
                                                key={char.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ delay: index * 0.02 }}
                                                className="relative group bg-white border border-gray-100 rounded-3xl p-3 shadow-sm hover:shadow-lg transition-all"
                                            >
                                                <div className="absolute top-2 left-2 z-10 w-5 h-5 bg-gray-900 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                                    {index + 1}
                                                </div>
                                                <div className="aspect-[4/5] bg-gray-50 rounded-2xl relative overflow-hidden flex flex-col items-center justify-center p-2">
                                                    <div className="relative w-full h-full flex flex-col items-center">
                                                        {char.pants && <img src={char.pants.imageUrl} className="absolute inset-0 w-full h-full object-contain z-10" alt="" referrerPolicy="no-referrer" />}
                                                        {char.shirt && <img src={char.shirt.imageUrl} className="absolute inset-0 w-full h-full object-contain z-20" alt="" referrerPolicy="no-referrer" />}
                                                        {char.face && <img src={char.face.imageUrl} className="absolute inset-0 w-full h-full object-contain z-30" alt="" referrerPolicy="no-referrer" />}
                                                        {char.hair && <img src={char.hair.imageUrl} className="absolute inset-0 w-full h-full object-contain z-40" alt="" referrerPolicy="no-referrer" />}
                                                    </div>
                                                </div>
                                                <div className="mt-3 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className={`text-[8px] font-black uppercase ${index < bulkConfig.male ? 'text-blue-500' : 'text-pink-500'}`}>
                                                            {index < bulkConfig.male ? 'Nam' : 'Nữ'}
                                                        </span>
                                                        <button 
                                                            onClick={() => {
                                                                const maleOrFemale = index < bulkConfig.male ? 'male' : 'female';
                                                                const updatedChars = [...bulkCharacters];
                                                                const hairs = allParts.filter(p => p.type === 'hair');
                                                                const faces = allParts.filter(p => p.type === 'face');
                                                                const shirts = allParts.filter(p => p.type === 'shirt');
                                                                const pants = allParts.filter(p => p.type === 'pants');
                                                                
                                                                const filterByGender = (list: LegoPart[]) => {
                                                                    const filtered = list.filter(p => inferGender(p) === maleOrFemale || inferGender(p) === 'unisex');
                                                                    return filtered.length > 0 ? filtered : list;
                                                                };
                                                                
                                                                updatedChars[index] = {
                                                                    ...updatedChars[index],
                                                                    hair: filterByGender(hairs)[Math.floor(Math.random() * filterByGender(hairs).length)],
                                                                    face: filterByGender(faces)[Math.floor(Math.random() * filterByGender(faces).length)],
                                                                    shirt: filterByGender(shirts)[Math.floor(Math.random() * filterByGender(shirts).length)],
                                                                    pants: filterByGender(pants)[Math.floor(Math.random() * filterByGender(pants).length)],
                                                                };
                                                                setBulkCharacters(updatedChars);
                                                            }}
                                                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-primary transition-colors"
                                                        >
                                                            <RefreshCw className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                        {!bulkCharacters.length && (
                            <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-gray-200">
                                <div className="text-4xl mb-4">🏠</div>
                                <h3 className="font-bold text-gray-900 uppercase">Chưa có nhân vật nào</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Nhấn "Tạo ngẫu nhiên" để bắt đầu lập danh sách</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Selection Toolbar - Sticky Bottom */}
            {selectedIds.length > 0 && viewMode !== 'bulk' && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-full max-w-2xl px-6 animate-slide-up">
                    <div className="bg-gray-900 rounded-3xl p-5 shadow-2xl shadow-black/40 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center font-black">
                                {selectedIds.length}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-tight">Đang chọn {selectedIds.length} món</h4>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sẵn sàng để gửi yêu cầu sỉ</p>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button 
                                onClick={handleCopySelection}
                                className="flex-1 sm:flex-none px-6 py-3 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5"
                            >
                                Sao chép list ID
                            </button>
                            <button 
                                onClick={handleShareZalo}
                                className="flex-1 sm:flex-none px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-105 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4 fill-current" />
                                Gửi qua Zalo
                            </button>
                            <button 
                                onClick={() => setSelectedIds([])}
                                className="p-3 text-gray-500 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Toolbar - Sticky Bottom */}
            {bulkCharacters.length > 0 && viewMode === 'bulk' && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-full max-w-2xl px-6 animate-slide-up">
                    <div className="bg-gray-900 rounded-3xl p-5 shadow-2xl shadow-black/40 border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-4">
                                {bulkCharacters.slice(0, 3).map((char, i) => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-gray-900 bg-white p-1 overflow-hidden">
                                        {char.hair && <img src={char.hair.imageUrl} className="w-full h-full object-contain" alt="" referrerPolicy="no-referrer" />}
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-tight">{bulkCharacters.length} Nhân vật sỉ</h4>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Hoàn tất danh sách linh kiện</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={handleCopyBulkIds}
                                className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-105 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Lưu list linh kiện
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Zoom Modal */}
            {zoomedImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImage(null)}>
                    <button className="absolute top-8 right-8 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <img src={zoomedImage} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl animate-scale-in" alt="Zoom" referrerPolicy="no-referrer" />
                </div>
            )}

            {/* Visual Part Picker Modal */}
            {openPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white w-full max-w-4xl max-h-[80vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${openPicker.gender === 'male' ? 'bg-blue-400' : 'bg-pink-400'}`}></div>
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                                    Chọn {openPicker.type === 'hair' ? 'tóc' : openPicker.type === 'face' ? 'mặt' : openPicker.type === 'shirt' ? 'áo' : 'quần'} cho {openPicker.gender === 'male' ? 'Nam' : 'Nữ'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Tìm kiếm..." 
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
                                    />
                                </div>
                                <button onClick={() => { setOpenPicker(null); setPickerSearch(''); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto p-8">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {/* Random Option */}
                                <button 
                                    onClick={() => {
                                        const themeKey = openPicker.gender === 'male' ? 'maleTheme' : 'femaleTheme';
                                        const fieldKey = openPicker.type === 'hair' ? 'hairId' : openPicker.type === 'face' ? 'faceId' : openPicker.type === 'shirt' ? 'shirtId' : 'pantsId';
                                        setBulkConfig(prev => ({
                                            ...prev,
                                            [themeKey]: { ...(prev as any)[themeKey], [fieldKey]: 'all' }
                                        }));
                                        setOpenPicker(null);
                                        setPickerSearch('');
                                    }}
                                    className="aspect-square rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4 hover:border-primary hover:bg-primary/5 transition-all group"
                                >
                                    <RefreshCw className="w-8 h-8 text-gray-300 group-hover:text-primary transition-colors mb-2" />
                                    <span className="text-[9px] font-black text-gray-400 uppercase group-hover:text-primary">Ngẫu nhiên</span>
                                </button>

                                {allParts
                                    .filter(p => {
                                        const matchesType = openPicker.type === 'shirt' ? (p.type === 'shirt' || p.type === 'set') : p.type === openPicker.type;
                                        const g = inferGender(p);
                                        const matchesGender = g === openPicker.gender || g === 'unisex';
                                        const matchesSearch = p.name.toLowerCase().includes(pickerSearch.toLowerCase()) || p.id.toLowerCase().includes(pickerSearch.toLowerCase());
                                        return matchesType && matchesGender && matchesSearch;
                                    })
                                    .sort((a, b) => (b.stock || 0) - (a.stock || 0))
                                    .map(part => (
                                        <button 
                                            key={part.id}
                                            onClick={() => {
                                                const themeKey = openPicker.gender === 'male' ? 'maleTheme' : 'femaleTheme';
                                                const fieldKey = openPicker.type === 'hair' ? 'hairId' : openPicker.type === 'face' ? 'faceId' : openPicker.type === 'shirt' ? 'shirtId' : 'pantsId';
                                                setBulkConfig(prev => ({
                                                    ...prev,
                                                    [themeKey]: { ...(prev as any)[themeKey], [fieldKey]: part.id }
                                                }));
                                                setOpenPicker(null);
                                                setPickerSearch('');
                                            }}
                                            className={`group relative aspect-square rounded-3xl border-2 p-2 flex flex-col items-center transition-all ${part.stock === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-primary hover:shadow-lg'}`}
                                            disabled={part.stock === 0}
                                        >
                                            <div className="flex-grow w-full flex items-center justify-center mb-1 overflow-hidden">
                                                <img src={part.imageUrl} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" alt="" />
                                            </div>
                                            <div className="w-full text-center">
                                                <div className="text-[8px] font-black text-gray-900 truncate uppercase">{part.name}</div>
                                                <div className="text-[7px] font-mono font-bold text-gray-400 truncate">#{part.id}</div>
                                            </div>
                                            {part.stock === 0 && (
                                                <div className="absolute inset-0 bg-white/20 flex items-center justify-center rounded-3xl">
                                                    <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">Hết</span>
                                                </div>
                                            )}
                                        </button>
                                    ))
                                }
                            </div>
                            {allParts.filter(p => {
                                const matchesType = openPicker.type === 'shirt' ? (p.type === 'shirt' || p.type === 'set') : p.type === openPicker.type;
                                const g = inferGender(p);
                                const matchesGender = g === openPicker.gender || g === 'unisex';
                                const matchesSearch = p.name.toLowerCase().includes(pickerSearch.toLowerCase()) || p.id.toLowerCase().includes(pickerSearch.toLowerCase());
                                return matchesType && matchesGender && matchesSearch;
                            }).length === 0 && (
                                <div className="py-24 text-center">
                                    <Search className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Không tìm thấy linh kiện nào phù hợp</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};
