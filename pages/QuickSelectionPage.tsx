import React, { useEffect, useMemo, useState } from 'react';
import type { LegoCharacterConfig, LegoPart, OutfitColor } from '../types';
import { CharacterPreview } from '../components/shared/CharacterPreview';
import { SmartImage } from '../components/shared/SmartImage';
import { formatCurrency, getEffectivePrice, getPartImageUrl, isPartOutOfStock } from '../utils/pricing';
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

const STORAGE_KEY = 'the_luvin_quick_selection_v3';

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

const isUsablePart = (part?: LegoPart) => Boolean(part && !isPartOutOfStock(part) && supportsLego(part));

const pickPreferredPants = (list: LegoPart[] = []) => {
  const available = list.filter(isUsablePart);
  if (!available.length) return undefined;

  const normalize = (value = '') => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const score = (part: LegoPart) => {
    const text = normalize(`${part.name || ''} ${part.category || ''}`);
    if (text.includes('chan dai') || text.includes('long leg') || text.includes('long-leg') || text.includes('legs long')) return 100;
    if (text.includes('chan thap') || text.includes('chan ngan') || text.includes('short leg') || text.includes('short-leg')) return -100;
    if (text.includes('dai') || text.includes('long')) return 20;
    return 0;
  };

  return [...available].sort((a, b) => score(b) - score(a))[0];
};

const makeSampleCharacter = (parts: LegoPartsMap): LegoCharacterConfig => {
  const pick = (list: LegoPart[] = []) => list.find(isUsablePart);
  const hair = pick(parts.hair);
  const face = pick(parts.face);
  const shirt = pick(parts.shirt);
  const pants = pickPreferredPants(parts.pants);

  return {
    ...makeEmptyCharacter(),
    hair,
    face,
    shirt,
    pants,
    selectedHairColor: getFirstAvailableColor(hair),
    selectedShirtColor: getFirstAvailableColor(shirt),
    selectedPantsColor: getFirstAvailableColor(pants),
  };
};

const applyQuickSelectorTypography = (config: any) => {
  const bodyFont = config?.theme?.global?.typography?.bodyFont || 'Montserrat';
  const cleanBodyFont = String(bodyFont).replace(/['"]/g, '');
  document.documentElement.style.setProperty('--font-body', `'${cleanBodyFont}'`);

  const fonts = Array.isArray(config?.uploadedFonts) ? config.uploadedFonts : [];
  if (fonts.length) {
    const styleId = 'quick-selector-uploaded-fonts';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.innerHTML = fonts.map((font: any) => {
      const safeName = String(font.name || '').replace(/[^a-zA-Z0-9\s-]/g, '');
      return safeName && font.url
        ? `@font-face{font-family:'${safeName}';src:url('${font.url}');font-weight:100 900;font-style:normal;font-display:swap;}`
        : '';
    }).join('\n');
  }
};

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

const getPartDisplayPrice = (part?: LegoPart, selectedColor?: OutfitColor, quantity = 1) => {
  if (!part) return 0;
  const base = getEffectivePrice(part, quantity, part.bulkPricing);
  return base + (selectedColor?.price || 0);
};

const PriceLabel: React.FC<{ part?: LegoPart; selectedColor?: OutfitColor; quantity?: number; compact?: boolean }> = ({ part, selectedColor, quantity = 1, compact = false }) => {
  if (!part) return null;
  const price = getPartDisplayPrice(part, selectedColor, quantity);
  return (
    <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-extrabold ${price > 0 ? 'text-[#b8566d]' : 'text-gray-400'}`}>
      {price > 0 ? `+${formatCurrency(price)}` : formatCurrency(0)}
    </span>
  );
};

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

  const compactLayout = colors.length > 5
    ? 'grid grid-cols-5 gap-2 sm:flex sm:flex-wrap'
    : 'flex flex-wrap gap-2';

  return (
    <div className={compact ? 'w-full' : 'mt-4 rounded-2xl border border-gray-100 bg-white p-3 sm:p-4'}>
      {!compact && <p className="mb-2 text-[11px] font-bold text-gray-500">Chọn màu</p>}
      <div className={compact ? compactLayout : 'flex flex-wrap gap-2'}>
        {colors.map((color) => {
          const active = selectedColor?.name === color.name;
          return (
            <button
              key={`${part?.id}-${color.name}`}
              type="button"
              title={color.name}
              onClick={(event) => {
                event.stopPropagation();
                onChange(color);
              }}
              className={`${compact ? 'h-10 w-10 justify-self-start px-0 py-0 sm:h-9 sm:w-9' : 'min-h-9 px-2.5 py-1.5'} flex items-center justify-center gap-2 rounded-xl border text-[11px] font-bold transition ${
                active ? 'border-[#dc8ea0] bg-[#fff1f4] text-[#a84d63] ring-1 ring-[#f4cbd4]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
              aria-label={`Chọn màu ${color.name}`}
              aria-pressed={active}
            >
              <span
                className={`${compact ? 'h-5 w-5' : 'h-4 w-4'} rounded-full border border-black/10 shadow-inner`}
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
  const [restoredSavedSelection, setRestoredSavedSelection] = useState(false);
  const [seededDefaults, setSeededDefaults] = useState(false);

  useEffect(() => {
    if (providedParts) return;
    let active = true;
    const load = async () => {
      try {
        const [parts, config] = await Promise.all([getAllParts(), getStoreConfig()]);
        if (!active) return;
        if (parts?.length) setLoadedParts(categorizeParts(parts) as LegoPartsMap);
        if (config?.logoUrl) setInternalLogoUrl(config.logoUrl);
        applyQuickSelectorTypography(config);
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
        const hasCharacters = Array.isArray(parsed.characters) && parsed.characters.length > 0;
        const hasCharms = parsed.charms && typeof parsed.charms === 'object' && Object.keys(parsed.charms).length > 0;
        if (hasCharacters) setCharacters(parsed.characters);
        if (parsed.charms && typeof parsed.charms === 'object') setCharms(parsed.charms);
        if (hasCharacters || hasCharms) setRestoredSavedSelection(true);
      }
    } catch (error) {
      console.warn('Cannot restore quick selection:', error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || isLoadingParts || seededDefaults || restoredSavedSelection) return;
    const sample = makeSampleCharacter(legoParts);
    setCharacters([sample]);
    setActiveCharacterId(sample.id);
    setSeededDefaults(true);
  }, [hydrated, isLoadingParts, seededDefaults, restoredSavedSelection, legoParts]);

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
        if (!next.pants) {
          const fallbackPants = pickPreferredPants(legoParts.pants || []);
          next.pants = fallbackPants;
          next.selectedPantsColor = getFirstAvailableColor(fallbackPants);
        }
      } else if (part.type === 'pants') {
        next.pants = part;
        next.set = undefined;
        next.selectedPantsColor = color;
        next.selectedSetColor = undefined;
        if (!next.shirt) {
          const fallbackShirt = (legoParts.shirt || []).find(isUsablePart);
          next.shirt = fallbackShirt;
          next.selectedShirtColor = getFirstAvailableColor(fallbackShirt);
        }
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
    const next = makeSampleCharacter(legoParts);
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
    const next = makeSampleCharacter(legoParts);
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
        const priceText = label === 'Bộ' && part ? ` - ${formatCurrency(getPartDisplayPrice(part, color))}` : '';
        rows.push(`- ${label}: ${part?.name} [${part?.id}]${color ? ` - ${color.name}` : ''}${priceText}`);
      });
    });
    if (selectedCharmList.length) {
      rows.push('\nCharm / phụ kiện:');
      selectedCharmList.forEach(({ part, quantity, selectedColor }) => {
        rows.push(`- ${part.name} [${part.id}] x${quantity}${selectedColor ? ` - ${selectedColor.name}` : ''} - ${formatCurrency(getPartDisplayPrice(part, selectedColor, quantity))}`);
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
    const rows: Array<{ label: string; part?: LegoPart; color?: OutfitColor; showPrice?: boolean }> = [
      { label: 'Tóc', part: character.hair, color: character.selectedHairColor },
      { label: 'Mặt', part: character.face },
      ...(character.set
        ? [{ label: 'Bộ đồ', part: character.set, color: character.selectedSetColor, showPrice: true }]
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
                {row.showPrice && <span className="ml-1 text-[#b05b70]">· {formatCurrency(getPartDisplayPrice(row.part, row.color))}</span>}
              </span>
            ) : (
              <span className="font-medium text-gray-300">Chưa chọn</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const activeCharacterIndex = Math.max(0, characters.findIndex(character => character.id === activeCharacter?.id));
  const activeCharacterPartCount = activeCharacter
    ? [activeCharacter.hair, activeCharacter.face, activeCharacter.set || activeCharacter.shirt, activeCharacter.set ? undefined : activeCharacter.pants].filter(Boolean).length
    : 0;
  const selectedCharmQuantity = selectedCharmList.reduce((sum, item) => sum + item.quantity, 0);

  if (showSummary) {
    return (
      <div className="quick-selector min-h-screen bg-[#f6f4f2] px-3 py-4 font-body text-gray-900 sm:px-6 sm:py-8">
        <style>{`.quick-selector h1,.quick-selector h2,.quick-selector h3,.quick-selector h4,.quick-selector h5,.quick-selector h6{font-family:var(--font-body)!important}`}</style>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[26px] border border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(31,28,26,0.08)]">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c96c81]">The Luvin</p>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Lựa chọn của bạn</h1>
                <p className="mt-1.5 max-w-lg text-xs font-medium leading-relaxed text-gray-400">Chụp màn hình phần này và gửi lại shop. Tên và mã linh kiện đã được ghi sẵn để shop làm đúng mẫu.</p>
              </div>
              {logoUrl && <img src={logoUrl} alt="The Luvin" className="h-9 max-w-[100px] object-contain" />}
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-gray-900">Nhân vật</h2>
                <SelectionBadge>{characters.length} nhân vật</SelectionBadge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {characters.map((character, index) => (
                  <div key={character.id} className="rounded-2xl border border-gray-100 bg-[#fbfaf9] p-3.5">
                    <div className="flex gap-4">
                      <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.04]">
                        <div className="scale-110"><CharacterPreview character={character} size="lg" /></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-xs font-extrabold text-gray-900">Nhân vật {index + 1}</p>
                        {renderCharacterPartSummary(character)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-gray-900">Charm & phụ kiện</h2>
                <SelectionBadge>{selectedCharmQuantity} món</SelectionBadge>
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
                        <div className="mt-1"><PriceLabel part={part} selectedColor={selectedColor} quantity={quantity} compact /></div>
                      </div>
                      <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-extrabold text-white">x{quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 py-7 text-center text-xs font-medium text-gray-300">Không chọn charm / phụ kiện</div>
              )}
            </section>
          </div>

          <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white/95 p-3 backdrop-blur sm:p-4">
            <button type="button" onClick={() => setShowSummary(false)} className="min-h-12 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700">← Chỉnh lại</button>
            <button type="button" onClick={copySummary} className="min-h-12 flex-1 rounded-2xl bg-[#111827] px-4 text-sm font-bold text-white">{copied ? '✓ Đã sao chép' : 'Sao chép mã'}</button>
          </div>
        </div>
      </div>
    );
  }

  const activeTypeLabel = PART_LABELS[activePartType];
  const activeSelectedColor = getSelectedCharacterColor(activeCharacter, activePartType);

  return (
    <div className="quick-selector min-h-screen bg-[#f6f4f2] pb-24 font-body text-gray-900 lg:pb-8">
      <style>{`.quick-selector h1,.quick-selector h2,.quick-selector h3,.quick-selector h4,.quick-selector h5,.quick-selector h6{font-family:var(--font-body)!important}.quick-selector *{font-family:var(--font-body)}`}</style>

      <header className="sticky top-0 z-50 border-b border-black/[0.05] bg-[#f6f4f2]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="The Luvin" className="h-7 max-w-[88px] object-contain" />
            ) : (
              <span className="text-xs font-extrabold tracking-[0.08em] text-[#c96c81]">THE LUVIN</span>
            )}
            <div className="h-5 w-px bg-black/10" />
            <p className="truncate text-sm font-extrabold text-gray-800">Chọn nhân vật & charm</p>
          </div>
          <button type="button" onClick={resetAll} className="shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-bold text-gray-400 hover:bg-white hover:text-gray-700">Làm lại</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
        <div className="mb-3 grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/[0.04] sm:max-w-[420px]">
          <button
            type="button"
            onClick={() => setMode('character')}
            className={`min-h-11 rounded-xl px-4 text-sm font-extrabold transition ${mode === 'character' ? 'bg-[#111827] text-white shadow-sm' : 'text-gray-400'}`}
          >
            Nhân vật <span className="ml-1 text-[10px] opacity-70">{characters.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('charm')}
            className={`min-h-11 rounded-xl px-4 text-sm font-extrabold transition ${mode === 'charm' ? 'bg-[#111827] text-white shadow-sm' : 'text-gray-400'}`}
          >
            Charm <span className="ml-1 text-[10px] opacity-70">{selectedCharmQuantity}</span>
          </button>
        </div>

        {mode === 'character' ? (
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <aside className="lg:sticky lg:top-[72px]">
              <div className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400">Đang chỉnh</p>
                    <p className="text-sm font-extrabold text-gray-900">Nhân vật {activeCharacterIndex + 1}</p>
                  </div>
                  <span className="rounded-full bg-[#fff0f3] px-2.5 py-1 text-[10px] font-extrabold text-[#b8566d]">{activeCharacterPartCount}/4 phần</span>
                </div>

                <div className="grid grid-cols-[142px_1fr] items-center gap-3 p-3 sm:grid-cols-[160px_1fr] sm:p-4 lg:block">
                  <div className="flex h-[182px] items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-b from-[#fff8f9] to-[#f8f5f3] ring-1 ring-black/[0.04] sm:h-[196px] lg:h-[250px]">
                    {isLoadingParts ? (
                      <div className="h-36 w-24 animate-pulse rounded-2xl bg-white/80" />
                    ) : activeCharacter ? (
                      <div className="scale-[1.18] lg:scale-[1.35]"><CharacterPreview character={activeCharacter} size="lg" /></div>
                    ) : null}
                  </div>

                  <div className="min-w-0 lg:mt-4">
                    <div className="space-y-2">
                      {([
                        ['Tóc', activeCharacter?.hair],
                        ['Mặt', activeCharacter?.face],
                        [activeCharacter?.set ? 'Bộ' : 'Áo', activeCharacter?.set || activeCharacter?.shirt],
                        ['Quần', activeCharacter?.set ? undefined : activeCharacter?.pants],
                      ] as Array<[string, LegoPart | undefined]>).map(([label, part]) => (
                        <div key={label} className="flex items-center gap-2 text-[11px]">
                          <span className="w-9 shrink-0 font-semibold text-gray-400">{label}</span>
                          <span className={`min-w-0 truncate font-bold ${part ? 'text-gray-700' : 'text-gray-300'}`}>{part?.name || 'Chưa chọn'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 p-3">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {characters.map((character, index) => (
                      <button
                        key={character.id}
                        type="button"
                        onClick={() => setActiveCharacterId(character.id)}
                        className={`h-10 min-w-10 shrink-0 rounded-xl text-xs font-extrabold transition ${character.id === activeCharacter?.id ? 'bg-[#111827] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                      >
                        {index + 1}
                      </button>
                    ))}
                    <button type="button" onClick={addCharacter} className="h-10 shrink-0 rounded-xl border border-dashed border-gray-300 px-3 text-[11px] font-bold text-gray-500 hover:border-[#d997a7] hover:text-[#b8566d]">＋ Thêm</button>
                    {activeCharacter && characters.length > 1 && (
                      <button type="button" onClick={() => removeCharacter(activeCharacter.id)} className="ml-auto h-10 shrink-0 rounded-xl px-2 text-[10px] font-bold text-gray-300 hover:text-red-500">Xóa</button>
                    )}
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => setShowSummary(true)} className="mt-3 hidden min-h-[52px] w-full rounded-2xl bg-[#111827] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-black/10 lg:block">Xem tóm tắt để chụp →</button>
            </aside>

            <section className="min-w-0 overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm">
              <div className="border-b border-gray-100 p-3 sm:p-4">
                <div className="grid grid-cols-5 gap-1 rounded-2xl bg-gray-50 p-1">
                  {(Object.keys(PART_LABELS) as CharacterPartType[]).map(type => {
                    const selectedPart = activeCharacter?.[type] as LegoPart | undefined;
                    const selected = type === 'set' ? Boolean(activeCharacter?.set) : Boolean(selectedPart);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => { setActivePartType(type); setSearchTerm(''); }}
                        className={`relative min-h-11 rounded-xl px-1 text-[11px] font-extrabold transition sm:text-xs ${activePartType === type ? 'bg-white text-[#b8566d] shadow-sm ring-1 ring-black/[0.04]' : 'text-gray-500'}`}
                      >
                        {PART_LABELS[type]}
                        {selected && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#d77e92]" />}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-[94px_minmax(0,1fr)] gap-2 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
                  <select
                    value={genderFilter}
                    onChange={event => setGenderFilter(event.target.value as GenderFilter)}
                    className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-bold text-gray-600 outline-none focus:border-[#d997a7]"
                    aria-label="Lọc giới tính"
                  >
                    <option value="all">Tất cả</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                  <div className="relative min-w-0">
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder={`Tìm ${activeTypeLabel.toLowerCase()}...`}
                      className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 pr-9 text-xs font-semibold outline-none transition focus:border-[#d997a7] focus:ring-2 focus:ring-[#f9dbe2]"
                    />
                    {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-gray-300">×</button>}
                  </div>
                  {selectedCharacterPart && (
                    <button type="button" onClick={clearActivePart} className="col-span-2 min-h-10 rounded-xl border border-gray-200 px-3 text-[10px] font-bold text-gray-400 hover:text-red-500 sm:col-span-1 sm:min-h-11">Bỏ {activeTypeLabel.toLowerCase()}</button>
                  )}
                </div>

                {selectedCharacterPart && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#faf8f7] px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400">Đang chọn {activeTypeLabel.toLowerCase()}</p>
                      <p className="mt-0.5 truncate text-xs font-extrabold text-gray-700">{selectedCharacterPart.name}</p>
                      {activeSelectedColor && <p className="mt-0.5 truncate text-[10px] font-bold text-[#b8566d]">Màu: {activeSelectedColor.name}</p>}
                    </div>
                    {activePartType === 'set' && <PriceLabel part={selectedCharacterPart} selectedColor={activeSelectedColor} />}
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-4">
                {isLoadingParts ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[0.82] animate-pulse rounded-2xl bg-gray-100" />)}
                  </div>
                ) : visibleCharacterParts.length ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                    {visibleCharacterParts.map(part => {
                      const selected = selectedCharacterPart?.id === part.id;
                      const selectedColor = selected ? getSelectedCharacterColor(activeCharacter, activePartType) : undefined;
                      const availableColors = (part.colors || []).filter(color => color.stock === undefined || color.stock === null || Number(color.stock) > 0);
                      const canPickColorHere = selected && availableColors.length > 1 && activePartType !== 'face';
                      const displayColor = selectedColor || getFirstAvailableColor(part);
                      return (
                        <React.Fragment key={part.id}>
                          <button
                            type="button"
                            onClick={() => selectCharacterPart(part)}
                            className={`group relative overflow-hidden rounded-2xl border p-1.5 text-left transition active:scale-[0.98] ${selected ? 'border-[#d9899d] bg-[#fff5f7] shadow-sm ring-1 ring-[#f4cbd4]' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}
                          >
                            {selected && <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#111827] text-[10px] font-extrabold text-white">✓</span>}
                            <div className="aspect-square overflow-hidden rounded-xl bg-[#f8f7f6]">
                              <SmartImage src={selected && displayColor?.imageUrl ? displayColor.imageUrl : getPartImageUrl(part)} alt={part.name} className="h-full w-full" />
                            </div>
                            <p className="line-clamp-2 min-h-[34px] px-1 pt-2 text-[10px] font-bold leading-[1.35] text-gray-700 sm:text-[11px]">{part.name}</p>
                            {activePartType === 'set' && (
                              <div className="px-1 pb-1 pt-0.5"><PriceLabel part={part} selectedColor={displayColor} compact /></div>
                            )}
                            {canPickColorHere && (
                              <p className="px-1 pb-1 pt-0.5 text-[9px] font-extrabold text-[#b8566d]">Màu: {selectedColor?.name || displayColor?.name}</p>
                            )}
                          </button>

                          {canPickColorHere && (
                            <div className="col-span-3 rounded-2xl border border-[#f0d5dc] bg-[#fffafb] p-3 shadow-sm sm:col-span-4 md:col-span-5 xl:col-span-6">
                              <div className="mb-2.5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold text-gray-400">Chọn màu cho</p>
                                  <p className="truncate text-xs font-extrabold text-gray-800">{part.name}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  {selectedColor && <p className="text-[10px] font-extrabold text-[#b8566d]">{selectedColor.name}</p>}
                                  {activePartType === 'set' && <PriceLabel part={part} selectedColor={selectedColor || displayColor} compact />}
                                </div>
                              </div>
                              <ColorPicker part={part} selectedColor={selectedColor} onChange={color => setCharacterColor(activePartType, color)} compact />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center">
                    <p className="text-sm font-bold text-gray-400">Không tìm thấy mẫu phù hợp</p>
                    <button type="button" onClick={() => { setSearchTerm(''); setGenderFilter('all'); }} className="mt-2 text-xs font-bold text-[#c76c81]">Xóa bộ lọc</button>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
            <aside className="lg:sticky lg:top-[72px]">
              <div className="rounded-[24px] border border-black/[0.05] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400">Đã chọn</p>
                    <p className="text-base font-extrabold text-gray-900">{selectedCharmQuantity} charm</p>
                  </div>
                  <span className="rounded-full bg-[#fff0f3] px-2.5 py-1 text-[10px] font-extrabold text-[#b8566d]">{selectedCharmList.length} mẫu</span>
                </div>

                {selectedCharmList.length ? (
                  <div className="mt-4 space-y-2">
                    {selectedCharmList.map(({ part, quantity, selectedColor }) => (
                      <div key={part.id} className="flex items-center gap-2 rounded-xl bg-[#faf9f8] p-2">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white">
                          <SmartImage src={selectedColor?.imageUrl || getPartImageUrl(part)} alt={part.name} className="h-full w-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold text-gray-700">{part.name}</p>
                          <PriceLabel part={part} selectedColor={selectedColor} quantity={quantity} compact />
                        </div>
                        <span className="text-[10px] font-extrabold text-gray-500">x{quantity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-gray-200 py-8 text-center text-xs font-medium text-gray-300">Chưa chọn charm</div>
                )}
              </div>
              <button type="button" onClick={() => setShowSummary(true)} className="mt-3 hidden w-full rounded-2xl bg-[#111827] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-black/10 lg:block">Xem tóm tắt để chụp →</button>
            </aside>

            <section className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm">
              <div className="border-b border-gray-100 p-3 sm:p-4">
                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                  <select
                    value={charmType}
                    onChange={event => setCharmType(event.target.value as 'all' | 'accessory' | 'pet' | 'hat')}
                    className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-bold text-gray-600 outline-none focus:border-[#d997a7]"
                  >
                    <option value="all">Tất cả</option>
                    <option value="accessory">Charm</option>
                    <option value="pet">Thú cưng</option>
                    <option value="hat">Mũ</option>
                  </select>
                  <div className="relative">
                    <input
                      value={charmSearch}
                      onChange={event => setCharmSearch(event.target.value)}
                      placeholder="Tìm charm..."
                      className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 pr-9 text-xs font-semibold outline-none transition focus:border-[#d997a7] focus:ring-2 focus:ring-[#f9dbe2]"
                    />
                    {charmSearch && <button type="button" onClick={() => setCharmSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-gray-300">×</button>}
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4">
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
                        <div key={part.id} className={`relative overflow-hidden rounded-2xl border p-1.5 transition ${selected ? 'border-[#d9899d] bg-[#fff5f7] shadow-sm ring-1 ring-[#f4cbd4]' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
                          <button type="button" onClick={() => toggleCharm(part)} className="block w-full text-left active:scale-[0.98]">
                            {selected && <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#111827] text-[10px] font-extrabold text-white">✓</span>}
                            <div className="aspect-square overflow-hidden rounded-xl bg-[#f8f7f6]">
                              <SmartImage src={choice?.selectedColor?.imageUrl || getPartImageUrl(part)} alt={part.name} className="h-full w-full" />
                            </div>
                            <p className="line-clamp-2 min-h-[34px] px-1 pt-2 text-[10px] font-bold leading-[1.35] text-gray-700 sm:text-[11px]">{part.name}</p>
                            <div className="px-1 pb-1 pt-0.5">
                              <PriceLabel part={part} selectedColor={choice?.selectedColor || getFirstAvailableColor(part)} quantity={choice?.quantity || 1} compact />
                            </div>
                          </button>

                          {choice && (
                            <div className="mt-1.5 border-t border-[#f3d9df] pt-1.5">
                              <div className="flex items-center justify-center rounded-xl bg-white ring-1 ring-black/[0.05]">
                                <button type="button" onClick={() => updateCharmQuantity(part.id, choice.quantity - 1)} className="h-8 w-8 text-sm font-bold text-gray-500">−</button>
                                <span className="min-w-6 text-center text-[10px] font-extrabold">{choice.quantity}</span>
                                <button type="button" onClick={() => updateCharmQuantity(part.id, choice.quantity + 1)} className="h-8 w-8 text-sm font-bold text-gray-500">+</button>
                              </div>
                              <div className="mt-2"><ColorPicker part={part} selectedColor={choice.selectedColor} onChange={color => updateCharmColor(part.id, color)} compact /></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center">
                    <p className="text-sm font-bold text-gray-400">Không tìm thấy charm phù hợp</p>
                    <button type="button" onClick={() => { setCharmSearch(''); setCharmType('all'); }} className="mt-2 text-xs font-bold text-[#c76c81]">Xóa bộ lọc</button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/[0.06] bg-white/95 p-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1 pl-1">
            <p className="text-[10px] font-semibold text-gray-400">Đã chọn</p>
            <p className="truncate text-xs font-extrabold text-gray-800">{characters.length} nhân vật · {selectedCharmQuantity} charm</p>
          </div>
          <button type="button" onClick={() => setShowSummary(true)} className="min-h-12 shrink-0 rounded-2xl bg-[#111827] px-5 text-xs font-extrabold text-white shadow-lg">Tóm tắt để chụp</button>
        </div>
      </div>
    </div>
  );
};

export default QuickSelectionPage;
