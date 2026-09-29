import React, { useEffect, useMemo, useState } from 'react';
import type { LegoCharacterConfig, LegoPart, OutfitColor } from '../types';
import { CharacterPreview } from '../components/shared/CharacterPreview';
import { SmartImage } from '../components/shared/SmartImage';
import { getPartImageUrl, isPartOutOfStock } from '../utils/pricing';
import { getAllParts } from '../services/productService';
import { getStoreConfig } from '../services/configService';
import { LEGO_PARTS } from '../constants';
import { categorizeParts } from '../utils/helpers';

type LegoPartsMap = {
  hair: LegoPart[];
  face: LegoPart[];
  shirt: LegoPart[];
  pants: LegoPart[];
  hat: LegoPart[];
  accessory: LegoPart[];
  pet: LegoPart[];
  set: LegoPart[];
};

type CharacterPartType = 'hair' | 'face' | 'shirt' | 'pants' | 'set';
type GenderFilter = 'all' | 'male' | 'female';
type ScreenMode = 'character' | 'charm';

type CharmChoice = {
  part: LegoPart;
  quantity: number;
  selectedColor?: OutfitColor;
};

interface QuickSelectionPageProps {
  legoParts?: LegoPartsMap;
  isLoadingParts?: boolean;
  logoUrl?: string;
}

const STORAGE_KEY = 'the_luvin_quick_selection_v1';

const PART_LABELS: Record<CharacterPartType, string> = {
  hair: 'Tóc',
  face: 'Mặt',
  shirt: 'Áo',
  pants: 'Quần',
  set: 'Bộ đồ',
};

const makeEmptyCharacter = (): LegoCharacterConfig => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  x: 50,
  y: 70,
  rotation: 0,
  scale: 1,
});

const getFirstAvailableColor = (part?: LegoPart): OutfitColor | undefined => {
  if (!part?.colors?.length) return undefined;
  return part.colors.find(color => color.stock === undefined || color.stock === null || Number(color.stock) > 0) || part.colors[0];
};

const inferGender = (part: LegoPart): 'male' | 'female' | 'unisex' => {
  if (part.gender) return part.gender;
  const name = `${part.name || ''} ${part.category || ''}`.toLowerCase();
  const femaleKeywords = ['nữ', 'girl', 'cô gái', 'váy', 'đầm', 'tóc dài', 'long hair', 'makeup', 'son', 'búi', 'nơ'];
  const maleKeywords = ['nam', 'boy', 'trai', 'râu', 'vest', 'suit', 'cà vạt', 'tóc ngắn', 'beard'];
  if (femaleKeywords.some(keyword => name.includes(keyword))) return 'female';
  if (maleKeywords.some(keyword => name.includes(keyword))) return 'male';
  return 'unisex';
};

const supportsLego = (part: LegoPart) => !part.supportedProductLines || part.supportedProductLines.includes('lego');

const SelectionBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-[#fff1f4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#cf6e82]">
    {children}
  </span>
);

const ColorPicker: React.FC<{
  part?: LegoPart;
  selectedColor?: OutfitColor;
  onChange: (color: OutfitColor) => void;
  compact?: boolean;
}> = ({ part, selectedColor, onChange, compact = false }) => {
  const colors = (part?.colors || []).filter(color => color.stock === undefined || color.stock === null || Number(color.stock) > 0);
  if (colors.length <= 1) return null;

  return (
    <div className={compact ? 'mt-2 flex flex-wrap gap-1.5' : 'mt-4 rounded-2xl border border-gray-100 bg-white p-3 sm:p-4'}>
      {!compact && <p className="mb-2 text-[11px] font-bold text-gray-500">Chọn màu</p>}
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const active = selectedColor?.name === color.name;
          return (
            <button
              key={`${part?.id}-${color.name}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(color);
              }}
              className={`flex min-h-9 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition ${
                active ? 'border-[#dc8ea0] bg-[#fff1f4] text-[#a84d63]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
              aria-pressed={active}
            >
              <span
                className="h-4 w-4 rounded-full border border-black/10 shadow-inner"
                style={{ backgroundColor: color.hex || '#ffffff' }}
              />
              {!compact && <span>{color.name}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const QuickSelectionPage: React.FC<QuickSelectionPageProps> = ({ legoParts: providedParts, isLoadingParts: providedLoading, logoUrl: providedLogoUrl }) => {
  const [loadedParts, setLoadedParts] = useState<LegoPartsMap>(LEGO_PARTS);
  const [internalLoading, setInternalLoading] = useState(!providedParts);
  const [internalLogoUrl, setInternalLogoUrl] = useState(providedLogoUrl || '');
  const legoParts = providedParts || loadedParts;
  const isLoadingParts = providedParts ? Boolean(providedLoading) : internalLoading;
  const logoUrl = providedLogoUrl || internalLogoUrl;
  const [mode, setMode] = useState<ScreenMode>('character');
  const [characters, setCharacters] = useState<LegoCharacterConfig[]>([makeEmptyCharacter()]);
  const [activeCharacterId, setActiveCharacterId] = useState<LegoCharacterConfig['id'] | null>(null);
  const [activePartType, setActivePartType] = useState<CharacterPartType>('hair');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [charmSearch, setCharmSearch] = useState('');
  const [charmType, setCharmType] = useState<'all' | 'accessory' | 'pet' | 'hat'>('all');
  const [charms, setCharms] = useState<Record<string, CharmChoice>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (providedParts) return;
    let active = true;
    const load = async () => {
      try {
        const [parts, config] = await Promise.all([getAllParts(), getStoreConfig()]);
        if (!active) return;
        if (parts?.length) setLoadedParts(categorizeParts(parts) as LegoPartsMap);
        if (config?.logoUrl) setInternalLogoUrl(config.logoUrl);
      } catch (error) {
        console.error('Cannot load quick selector data:', error);
      } finally {
        if (active) setInternalLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [providedParts]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.characters) && parsed.characters.length) setCharacters(parsed.characters);
        if (parsed.charms && typeof parsed.charms === 'object') setCharms(parsed.charms);
      }
    } catch (error) {
      console.warn('Cannot restore quick selection:', error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!activeCharacterId && characters[0]) setActiveCharacterId(characters[0].id);
    if (activeCharacterId && !characters.some(character => character.id === activeCharacterId)) {
      setActiveCharacterId(characters[0]?.id || null);
    }
  }, [characters, activeCharacterId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ characters, charms }));
    } catch (error) {
      console.warn('Cannot persist quick selection:', error);
    }
  }, [characters, charms, hydrated]);

  const activeCharacter = useMemo(
    () => characters.find(character => character.id === activeCharacterId) || characters[0],
    [characters, activeCharacterId],
  );

  const currentPartsById = useMemo(() => {
    return (Object.values(legoParts) as LegoPart[][]).flat().reduce((acc, part) => {
      acc[part.id] = part;
      return acc;
    }, {} as Record<string, LegoPart>);
  }, [legoParts]);

  useEffect(() => {
    if (!hydrated || isLoadingParts) return;
    const current = (part?: LegoPart) => {
      if (!part) return undefined;
      const fresh = currentPartsById[part.id];
      return fresh && !isPartOutOfStock(fresh) ? fresh : undefined;
    };

    setCharacters(prev => prev.map(character => {
      const hair = current(character.hair);
      const face = current(character.face);
      const set = current(character.set);
      const shirt = set ? undefined : current(character.shirt);
      const pants = set ? undefined : current(character.pants);
      return {
        ...character,
        hair, face, set, shirt, pants,
        selectedHairColor: hair?.colors?.find(color => color.name === character.selectedHairColor?.name) || getFirstAvailableColor(hair),
        selectedShirtColor: shirt?.colors?.find(color => color.name === character.selectedShirtColor?.name) || getFirstAvailableColor(shirt),
        selectedPantsColor: pants?.colors?.find(color => color.name === character.selectedPantsColor?.name) || getFirstAvailableColor(pants),
        selectedSetColor: set?.colors?.find(color => color.name === character.selectedSetColor?.name) || getFirstAvailableColor(set),
      };
    }));

    setCharms(prev => Object.entries(prev).reduce((acc, [id, choice]) => {
      const fresh = currentPartsById[id];
      if (!fresh || isPartOutOfStock(fresh) || !supportsLego(fresh)) return acc;
      acc[id] = {
        ...choice,
        part: fresh,
        selectedColor: fresh.colors?.find(color => color.name === choice.selectedColor?.name) || getFirstAvailableColor(fresh),
      };
      return acc;
    }, {} as Record<string, CharmChoice>));
  }, [currentPartsById, hydrated, isLoadingParts]);

  const visibleCharacterParts = useMemo(() => {
    const list = legoParts[activePartType] || [];
    const search = searchTerm.trim().toLowerCase();
    return list.filter(part => {
      if (isPartOutOfStock(part) || !supportsLego(part)) return false;
      if (genderFilter !== 'all') {
        const gender = inferGender(part);
        if (gender !== 'unisex' && gender !== genderFilter) return false;
      }
      if (!search) return true;
      return part.name.toLowerCase().includes(search) || part.id.toLowerCase().includes(search);
    });
  }, [legoParts, activePartType, genderFilter, searchTerm]);

  const charmParts = useMemo(() => {
    const all = [...(legoParts.accessory || []), ...(legoParts.pet || []), ...(legoParts.hat || [])];
    const search = charmSearch.trim().toLowerCase();
    return all.filter(part => {
      if (isPartOutOfStock(part) || !supportsLego(part)) return false;
      if (charmType !== 'all' && part.type !== charmType) return false;
      if (!search) return true;
      return part.name.toLowerCase().includes(search) || part.id.toLowerCase().includes(search) || (part.category || '').toLowerCase().includes(search);
    });
  }, [legoParts, charmSearch, charmType]);

  const selectedCharacterPart = useMemo(() => {
    if (!activeCharacter) return undefined;
    return activeCharacter[activePartType] as LegoPart | undefined;
  }, [activeCharacter, activePartType]);

  const getSelectedCharacterColor = (character: LegoCharacterConfig | undefined, type: CharacterPartType) => {
    if (!character) return undefined;
    if (type === 'hair') return character.selectedHairColor;
    if (type === 'shirt') return character.selectedShirtColor;
    if (type === 'pants') return character.selectedPantsColor;
    if (type === 'set') return character.selectedSetColor;
    return undefined;
  };

  const setCharacterColor = (type: CharacterPartType, color: OutfitColor) => {
    if (!activeCharacter) return;
    setCharacters(prev => prev.map(character => {
      if (character.id !== activeCharacter.id) return character;
      if (type === 'hair') return { ...character, selectedHairColor: color };
      if (type === 'shirt') return { ...character, selectedShirtColor: color };
      if (type === 'pants') return { ...character, selectedPantsColor: color };
      if (type === 'set') return { ...character, selectedSetColor: color };
      return character;
    }));
  };

  const selectCharacterPart = (part: LegoPart) => {
    if (!activeCharacter) return;
    setCharacters(prev => prev.map(character => {
      if (character.id !== activeCharacter.id) return character;
      const next = { ...character };
      const color = getFirstAvailableColor(part);

      if (part.type === 'set') {
        next.set = part;
        next.shirt = undefined;
        next.pants = undefined;
        next.selectedSetColor = color;
        next.selectedShirtColor = undefined;
        next.selectedPantsColor = undefined;
      } else if (part.type === 'shirt') {
        next.shirt = part;
        next.set = undefined;
        next.selectedShirtColor = color;
        next.selectedSetColor = undefined;
      } else if (part.type === 'pants') {
        next.pants = part;
        next.set = undefined;
        next.selectedPantsColor = color;
        next.selectedSetColor = undefined;
      } else if (part.type === 'hair') {
        next.hair = part;
        next.selectedHairColor = color;
      } else if (part.type === 'face') {
        next.face = part;
      }
      return next;
    }));
  };

  const clearActivePart = () => {
    if (!activeCharacter) return;
    setCharacters(prev => prev.map(character => {
      if (character.id !== activeCharacter.id) return character;
      const next = { ...character };
      if (activePartType === 'hair') {
        next.hair = undefined;
        next.selectedHairColor = undefined;
      } else if (activePartType === 'face') {
        next.face = undefined;
      } else if (activePartType === 'shirt') {
        next.shirt = undefined;
        next.selectedShirtColor = undefined;
      } else if (activePartType === 'pants') {
        next.pants = undefined;
        next.selectedPantsColor = undefined;
      } else if (activePartType === 'set') {
        next.set = undefined;
        next.selectedSetColor = undefined;
      }
      return next;
    }));
  };

  const addCharacter = () => {
    const next = makeEmptyCharacter();
    setCharacters(prev => [...prev, next]);
    setActiveCharacterId(next.id);
    setActivePartType('hair');
    setMode('character');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeCharacter = (id: LegoCharacterConfig['id']) => {
    setCharacters(prev => {
      const filtered = prev.filter(character => character.id !== id);
      return filtered.length ? filtered : [makeEmptyCharacter()];
    });
  };

  const toggleCharm = (part: LegoPart) => {
    setCharms(prev => {
      const next = { ...prev };
      if (next[part.id]) delete next[part.id];
      else next[part.id] = { part, quantity: 1, selectedColor: getFirstAvailableColor(part) };
      return next;
    });
  };

  const updateCharmQuantity = (partId: string, quantity: number) => {
    setCharms(prev => {
      const choice = prev[partId];
      if (!choice) return prev;
      if (quantity <= 0) {
        const next = { ...prev };
        delete next[partId];
        return next;
      }
      return { ...prev, [partId]: { ...choice, quantity: Math.min(20, quantity) } };
    });
  };

  const updateCharmColor = (partId: string, color: OutfitColor) => {
    setCharms(prev => prev[partId]
      ? { ...prev, [partId]: { ...prev[partId], selectedColor: color } }
      : prev,
    );
  };

  const resetAll = () => {
    const next = makeEmptyCharacter();
    setCharacters([next]);
    setActiveCharacterId(next.id);
    setCharms({});
    setSearchTerm('');
    setCharmSearch('');
    setGenderFilter('all');
    setCharmType('all');
    setMode('character');
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
  };

  const selectedCharmList = Object.values(charms) as CharmChoice[];
  const chosenCharacterParts = characters.reduce((count, character) => {
    return count + [character.hair, character.face, character.shirt, character.pants, character.set].filter(Boolean).length;
  }, 0);

  const buildTextSummary = () => {
    const rows: string[] = ['THE LUVIN - LỰA CHỌN NHÂN VẬT & CHARM'];
    characters.forEach((character, index) => {
      rows.push(`\nNhân vật ${index + 1}:`);
      const entries: Array<[string, LegoPart | undefined, OutfitColor | undefined]> = [
        ['Tóc', character.hair, character.selectedHairColor],
        ['Mặt', character.face, undefined],
        ['Bộ', character.set, character.selectedSetColor],
        ['Áo', character.set ? undefined : character.shirt, character.selectedShirtColor],
        ['Quần', character.set ? undefined : character.pants, character.selectedPantsColor],
      ];
      entries.filter(([, part]) => Boolean(part)).forEach(([label, part, color]) => {
        rows.push(`- ${label}: ${part?.name} [${part?.id}]${color ? ` - ${color.name}` : ''}`);
      });
    });
    if (selectedCharmList.length) {
      rows.push('\nCharm / phụ kiện:');
      selectedCharmList.forEach(({ part, quantity, selectedColor }) => {
        rows.push(`- ${part.name} [${part.id}] x${quantity}${selectedColor ? ` - ${selectedColor.name}` : ''}`);
      });
    }
    return rows.join('\n');
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildTextSummary());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      setCopied(false);
    }
  };

  const renderCharacterPartSummary = (character: LegoCharacterConfig) => {
    const rows: Array<{ label: string; part?: LegoPart; color?: OutfitColor }> = [
      { label: 'Tóc', part: character.hair, color: character.selectedHairColor },
      { label: 'Mặt', part: character.face },
      ...(character.set
        ? [{ label: 'Bộ đồ', part: character.set, color: character.selectedSetColor }]
        : [
            { label: 'Áo', part: character.shirt, color: character.selectedShirtColor },
            { label: 'Quần', part: character.pants, color: character.selectedPantsColor },
          ]),
    ];

    return (
      <div className="space-y-1.5 text-xs">
        {rows.map(row => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-gray-400">{row.label}</span>
            {row.part ? (
              <span className="text-right font-semibold text-gray-700">
                {row.part.name}
                <span className="ml-1 font-mono text-[10px] font-bold text-gray-400">[{row.part.id}]</span>
                {row.color && <span className="ml-1 text-[#b05b70]">· {row.color.name}</span>}
              </span>
            ) : (
              <span className="font-medium text-gray-300">Chưa chọn</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (showSummary) {
    return (
      <div className="min-h-screen bg-[#f7f5f3] px-3 py-4 text-gray-900 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(31,28,26,0.08)]">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.24em] text-[#cf6e82]">The Luvin</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Lựa chọn của bạn</h1>
                <p className="mt-2 text-xs font-medium leading-relaxed text-gray-400 sm:text-sm">Chụp màn hình phần này và gửi lại shop để shop lên thiết kế đúng lựa chọn.</p>
              </div>
              {logoUrl && <img src={logoUrl} alt="The Luvin" className="h-10 max-w-[110px] object-contain" />}
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-7">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.12em] text-gray-800">Nhân vật</h2>
                <SelectionBadge>{characters.length} nhân vật</SelectionBadge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {characters.map((character, index) => (
                  <div key={character.id} className="flex gap-4 rounded-2xl border border-gray-100 bg-[#fcfbfa] p-3.5">
                    <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.04]">
                      <CharacterPreview character={character} size="lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs font-black text-gray-900">Nhân vật {index + 1}</p>
                      {renderCharacterPartSummary(character)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.12em] text-gray-800">Charm & phụ kiện</h2>
                <SelectionBadge>{selectedCharmList.reduce((sum, item) => sum + item.quantity, 0)} món</SelectionBadge>
              </div>
              {selectedCharmList.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedCharmList.map(({ part, quantity, selectedColor }) => (
                    <div key={part.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                        <SmartImage src={selectedColor?.imageUrl || getPartImageUrl(part)} alt={part.name} className="h-full w-full" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-gray-800">{part.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-gray-400">{part.id}</p>
                        {selectedColor && <p className="mt-1 text-[10px] font-semibold text-[#b05b70]">Màu: {selectedColor.name}</p>}
                      </div>
                      <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-black text-white">x{quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-xs font-medium text-gray-300">Không chọn charm / phụ kiện</div>
              )}
            </section>
          </div>

          <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white/95 p-3 backdrop-blur sm:p-4">
            <button type="button" onClick={() => setShowSummary(false)} className="min-h-12 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700">← Chỉnh lại</button>
            <button type="button" onClick={copySummary} className="min-h-12 flex-1 rounded-2xl bg-gray-900 px-4 text-sm font-bold text-white">{copied ? '✓ Đã sao chép' : 'Sao chép mã'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f3] pb-28 text-gray-900 sm:pb-10">
      <header className="sticky top-0 z-40 border-b border-black/[0.05] bg-[#f7f5f3]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="The Luvin" className="h-8 max-w-[110px] object-contain sm:h-9" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3c5cf] text-sm font-black text-white">L</div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight sm:text-base">Chọn nhân vật & charm</p>
              <p className="hidden text-[11px] font-medium text-gray-400 sm:block">Chọn mẫu → chụp màn hình → gửi shop</p>
            </div>
          </div>
          <button type="button" onClick={resetAll} className="rounded-xl px-3 py-2 text-[11px] font-bold text-gray-400 transition hover:bg-white hover:text-gray-700">Làm lại</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-4 grid grid-cols-2 rounded-2xl border border-black/[0.05] bg-white p-1 shadow-sm sm:max-w-md">
          <button
            type="button"
            onClick={() => setMode('character')}
            className={`min-h-11 rounded-xl px-4 text-sm font-black transition ${mode === 'character' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
          >
            Nhân vật <span className="ml-1 text-[10px] opacity-70">{characters.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('charm')}
            className={`min-h-11 rounded-xl px-4 text-sm font-black transition ${mode === 'charm' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
          >
            Charm <span className="ml-1 text-[10px] opacity-70">{selectedCharmList.length}</span>
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {mode === 'character' ? (
              <div className="space-y-4">
                <section className="rounded-[24px] border border-black/[0.05] bg-white p-3 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {characters.map((character, index) => {
                      const active = character.id === activeCharacter?.id;
                      return (
                        <button
                          key={character.id}
                          type="button"
                          onClick={() => setActiveCharacterId(character.id)}
                          className={`flex shrink-0 items-center gap-2 rounded-2xl border p-2 pr-3 text-left transition ${active ? 'border-[#e0a0ae] bg-[#fff5f7] shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                        >
                          <div className="flex h-14 w-11 items-center justify-center overflow-hidden rounded-xl bg-white">
                            <CharacterPreview character={character} size="sm" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-gray-800">Nhân vật {index + 1}</p>
                            <p className="mt-0.5 text-[9px] font-bold text-gray-400">{[character.hair, character.face, character.set || character.shirt, character.set ? undefined : character.pants].filter(Boolean).length} phần đã chọn</p>
                          </div>
                        </button>
                      );
                    })}
                    <button type="button" onClick={addCharacter} className="flex min-h-[64px] shrink-0 items-center gap-2 rounded-2xl border border-dashed border-gray-200 px-4 text-xs font-bold text-gray-500 hover:border-[#df9bac] hover:bg-[#fff8fa] hover:text-[#b85d72]">＋ Thêm nhân vật</button>
                  </div>

                  {activeCharacter && characters.length > 1 && (
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={() => removeCharacter(activeCharacter.id)} className="text-[10px] font-bold text-gray-300 hover:text-red-500">Xóa nhân vật này</button>
                    </div>
                  )}
                </section>

                <section className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-3 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#cf6e82]">Bước 1</p>
                        <h2 className="mt-1 text-lg font-black">Chọn từng phần nhân vật</h2>
                      </div>
                      <div className="flex rounded-xl bg-gray-50 p-1">
                        {(['all', 'male', 'female'] as GenderFilter[]).map(gender => (
                          <button
                            key={gender}
                            type="button"
                            onClick={() => setGenderFilter(gender)}
                            className={`min-h-9 rounded-lg px-3 text-[10px] font-black transition ${genderFilter === gender ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                          >
                            {gender === 'all' ? 'Tất cả' : gender === 'male' ? 'Nam' : 'Nữ'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {(Object.keys(PART_LABELS) as CharacterPartType[]).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setActivePartType(type);
                            setSearchTerm('');
                          }}
                          className={`min-h-10 shrink-0 rounded-xl px-4 text-xs font-black transition ${activePartType === type ? 'bg-[#fff0f3] text-[#b7556b] ring-1 ring-[#e8b1bd]' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        >
                          {PART_LABELS[type]}
                          {selectedCharacterPart?.type === type && <span className="ml-1.5">✓</span>}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative min-w-0 flex-1">
                        <input
                          value={searchTerm}
                          onChange={event => setSearchTerm(event.target.value)}
                          placeholder={`Tìm ${PART_LABELS[activePartType].toLowerCase()} theo tên hoặc mã...`}
                          className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-10 text-xs font-semibold outline-none transition focus:border-[#e3a5b3] focus:bg-white focus:ring-2 focus:ring-[#f9dbe2]"
                        />
                        {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600">×</button>}
                      </div>
                      {selectedCharacterPart && (
                        <button type="button" onClick={clearActivePart} className="min-h-11 shrink-0 rounded-xl border border-gray-200 px-3 text-[10px] font-bold text-gray-400 hover:text-red-500">Bỏ chọn</button>
                      )}
                    </div>

                    <ColorPicker
                      part={selectedCharacterPart}
                      selectedColor={getSelectedCharacterColor(activeCharacter, activePartType)}
                      onChange={color => setCharacterColor(activePartType, color)}
                    />
                  </div>

                  <div className="p-3 sm:p-5">
                    {isLoadingParts ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                        {Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[0.82] animate-pulse rounded-2xl bg-gray-100" />)}
                      </div>
                    ) : visibleCharacterParts.length ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                        {visibleCharacterParts.map(part => {
                          const selected = selectedCharacterPart?.id === part.id;
                          return (
                            <button
                              key={part.id}
                              type="button"
                              onClick={() => selectCharacterPart(part)}
                              className={`group relative overflow-hidden rounded-2xl border p-1.5 text-left transition active:scale-[0.98] ${selected ? 'border-[#db8fa1] bg-[#fff5f7] shadow-sm ring-1 ring-[#f5ccd5]' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}
                            >
                              {selected && <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-black text-white">✓</span>}
                              <div className="aspect-square overflow-hidden rounded-xl bg-gray-50">
                                <SmartImage src={getPartImageUrl(part)} alt={part.name} className="h-full w-full" />
                              </div>
                              <div className="px-1 pb-1 pt-2">
                                <p className="line-clamp-2 min-h-[30px] text-[10px] font-bold leading-[1.35] text-gray-700 sm:text-[11px]">{part.name}</p>
                                <p className="mt-1 truncate font-mono text-[9px] font-bold text-gray-300">{part.id}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                        <p className="text-sm font-bold text-gray-400">Không tìm thấy mẫu phù hợp</p>
                        <button type="button" onClick={() => { setSearchTerm(''); setGenderFilter('all'); }} className="mt-2 text-xs font-bold text-[#c76c81]">Xóa bộ lọc</button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <section className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm">
                <div className="border-b border-gray-100 p-3 sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#cf6e82]">Bước 2</p>
                  <h2 className="mt-1 text-lg font-black">Chọn charm & phụ kiện</h2>
                  <p className="mt-1 text-xs font-medium text-gray-400">Chạm để chọn. Chạm lại để bỏ chọn.</p>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {([
                      ['all', 'Tất cả'],
                      ['accessory', 'Charm'],
                      ['pet', 'Thú cưng'],
                      ['hat', 'Mũ'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCharmType(value)}
                        className={`min-h-10 shrink-0 rounded-xl px-4 text-xs font-black transition ${charmType === value ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-3">
                    <input
                      value={charmSearch}
                      onChange={event => setCharmSearch(event.target.value)}
                      placeholder="Tìm charm theo tên hoặc mã..."
                      className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-10 text-xs font-semibold outline-none transition focus:border-[#e3a5b3] focus:bg-white focus:ring-2 focus:ring-[#f9dbe2]"
                    />
                    {charmSearch && <button type="button" onClick={() => setCharmSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600">×</button>}
                  </div>
                </div>

                <div className="p-3 sm:p-5">
                  {isLoadingParts ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                      {Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[0.82] animate-pulse rounded-2xl bg-gray-100" />)}
                    </div>
                  ) : charmParts.length ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                      {charmParts.map(part => {
                        const choice = charms[part.id];
                        const selected = Boolean(choice);
                        return (
                          <div key={part.id} className={`relative overflow-hidden rounded-2xl border p-1.5 transition ${selected ? 'border-[#db8fa1] bg-[#fff5f7] shadow-sm ring-1 ring-[#f5ccd5]' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
                            <button type="button" onClick={() => toggleCharm(part)} className="block w-full text-left active:scale-[0.98]">
                              {selected && <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-black text-white">✓</span>}
                              <div className="aspect-square overflow-hidden rounded-xl bg-gray-50">
                                <SmartImage src={choice?.selectedColor?.imageUrl || getPartImageUrl(part)} alt={part.name} className="h-full w-full" />
                              </div>
                              <div className="px-1 pt-2">
                                <p className="line-clamp-2 min-h-[30px] text-[10px] font-bold leading-[1.35] text-gray-700 sm:text-[11px]">{part.name}</p>
                                <p className="mt-1 truncate font-mono text-[9px] font-bold text-gray-300">{part.id}</p>
                              </div>
                            </button>

                            {choice && (
                              <div className="mt-2 border-t border-[#f3d9df] px-1 pt-2">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-bold text-gray-400">Số lượng</span>
                                  <div className="flex items-center rounded-lg border border-gray-200 bg-white">
                                    <button type="button" onClick={() => updateCharmQuantity(part.id, choice.quantity - 1)} className="h-7 w-7 text-sm font-bold text-gray-500">−</button>
                                    <span className="min-w-5 text-center text-[10px] font-black">{choice.quantity}</span>
                                    <button type="button" onClick={() => updateCharmQuantity(part.id, choice.quantity + 1)} className="h-7 w-7 text-sm font-bold text-gray-500">+</button>
                                  </div>
                                </div>
                                <ColorPicker part={part} selectedColor={choice.selectedColor} onChange={color => updateCharmColor(part.id, color)} compact />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                      <p className="text-sm font-bold text-gray-400">Không tìm thấy charm phù hợp</p>
                      <button type="button" onClick={() => { setCharmSearch(''); setCharmType('all'); }} className="mt-2 text-xs font-bold text-[#c76c81]">Xóa bộ lọc</button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-3">
              <div className="rounded-[24px] border border-black/[0.05] bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#cf6e82]">Đang chọn</p>
                    <h3 className="mt-1 text-base font-black">Xem nhanh</h3>
                  </div>
                  <SelectionBadge>{chosenCharacterParts + selectedCharmList.length} lựa chọn</SelectionBadge>
                </div>

                <div className="space-y-3">
                  {characters.map((character, index) => (
                    <div key={character.id} className="flex gap-3 rounded-2xl bg-[#faf9f8] p-3">
                      <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                        <CharacterPreview character={character} size="md" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-[11px] font-black">Nhân vật {index + 1}</p>
                        {renderCharacterPartSummary(character)}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedCharmList.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Charm đã chọn</p>
                    <div className="space-y-2">
                      {selectedCharmList.slice(0, 5).map(({ part, quantity }) => (
                        <div key={part.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate font-semibold text-gray-600">{part.name}</span>
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-black text-gray-500">x{quantity}</span>
                        </div>
                      ))}
                      {selectedCharmList.length > 5 && <p className="text-[10px] font-bold text-gray-300">+ {selectedCharmList.length - 5} mẫu khác</p>}
                    </div>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => setShowSummary(true)} className="min-h-14 w-full rounded-2xl bg-gray-900 px-5 text-sm font-black text-white shadow-lg shadow-black/10 transition hover:bg-black active:scale-[0.99]">Xem tóm tắt để chụp →</button>
              <p className="px-3 text-center text-[10px] font-medium leading-relaxed text-gray-400">Trang này chỉ dùng để chọn mẫu. Không tạo đơn hàng và không tính giá.</p>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/[0.06] bg-white/95 p-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1 pl-1">
            <p className="text-[10px] font-bold text-gray-400">Đã chọn</p>
            <p className="truncate text-xs font-black text-gray-800">{characters.length} nhân vật · {selectedCharmList.reduce((sum, item) => sum + item.quantity, 0)} charm</p>
          </div>
          <button type="button" onClick={() => setShowSummary(true)} className="min-h-12 shrink-0 rounded-2xl bg-gray-900 px-5 text-xs font-black text-white shadow-lg">Tóm tắt để chụp</button>
        </div>
      </div>
    </div>
  );
};

export default QuickSelectionPage;
