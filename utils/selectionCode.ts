import type { LegoCharacterConfig, LegoPart, OutfitColor } from '../types';

export interface SelectionCharmInput {
  part: LegoPart;
  quantity: number;
  selectedColor?: OutfitColor;
}

export interface DecodedSelectionCharm {
  part: LegoPart;
  quantity: number;
  selectedColor?: OutfitColor;
}

export interface DecodedSelection {
  characters: LegoCharacterConfig[];
  charms: DecodedSelectionCharm[];
  missingIds: string[];
}

type EncodedCharacter = Array<string | number>;
type EncodedCharm = [string, number, number];

type SelectionPayload = {
  v: 1 | 2;
  c: EncodedCharacter[];
  a: EncodedCharm[];
};

const PREFIX = 'TLV1';

const getColorIndex = (part?: LegoPart, color?: OutfitColor) => {
  if (!part?.colors?.length || !color) return -1;
  const exact = part.colors.findIndex(item => item.name === color.name && item.imageUrl === color.imageUrl);
  if (exact >= 0) return exact;
  return part.colors.findIndex(item => item.name === color.name);
};

const getColorAt = (part: LegoPart | undefined, index: number) => {
  if (!part?.colors?.length || index < 0) return undefined;
  return part.colors[index];
};

const printOptionToCode = (option?: LegoCharacterConfig['customPrintOption']) => {
  if (option === 'standard') return 1;
  if (option === 'premium') return 2;
  return 0;
};

const printCodeToOption = (value: number): LegoCharacterConfig['customPrintOption'] => {
  if (value === 1) return 'standard';
  if (value === 2) return 'premium';
  return 'none';
};

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const checksum = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-7);
};

const asString = (value: string | number | undefined) => typeof value === 'string' ? value : '';
const asNumber = (value: string | number | undefined, fallback = -1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const encodeSelectionCode = (
  characters: LegoCharacterConfig[],
  charms: SelectionCharmInput[]
) => {
  const payload: SelectionPayload = {
    v: 2,
    c: characters.map(character => [
      character.hair?.id || '', getColorIndex(character.hair, character.selectedHairColor),
      character.face?.id || '',
      character.set?.id || '', getColorIndex(character.set, character.selectedSetColor),
      character.set ? '' : (character.shirt?.id || ''), character.set ? -1 : getColorIndex(character.shirt, character.selectedShirtColor),
      character.set ? '' : (character.pants?.id || ''), character.set ? -1 : getColorIndex(character.pants, character.selectedPantsColor),
      printOptionToCode(character.customPrintOption),
      Math.max(0, Math.round(Number(character.customPrintPrice) || 0)),
    ]),
    a: charms.map(choice => [
      choice.part.id,
      Math.max(1, Math.min(99, Math.round(choice.quantity || 1))),
      getColorIndex(choice.part, choice.selectedColor),
    ]),
  };

  const body = toBase64Url(JSON.stringify(payload));
  return `${PREFIX}-${checksum(body)}-${body}`;
};

export const decodeSelectionCode = (rawCode: string, parts: LegoPart[]): DecodedSelection => {
  const code = rawCode.trim().replace(/\s+/g, '');
  const match = code.match(/^TLV1-([A-Z0-9]{7})-([A-Za-z0-9_-]+)$/i);
  if (!match) throw new Error('Mã không đúng định dạng TLV1.');

  const expectedChecksum = match[1].toUpperCase();
  const body = match[2];
  if (checksum(body) !== expectedChecksum) {
    throw new Error('Mã bị thiếu hoặc sai ký tự. Hãy copy lại nguyên mã từ khách.');
  }

  let payload: SelectionPayload;
  try {
    payload = JSON.parse(fromBase64Url(body));
  } catch (error) {
    throw new Error('Không thể đọc mã lựa chọn này.');
  }

  if (!payload || (payload.v !== 1 && payload.v !== 2) || !Array.isArray(payload.c) || !Array.isArray(payload.a)) {
    throw new Error('Phiên bản mã lựa chọn không được hỗ trợ.');
  }

  const partMap = parts.reduce((acc, part) => {
    acc[part.id] = part;
    return acc;
  }, {} as Record<string, LegoPart>);

  const missing = new Set<string>();
  const resolve = (id: string) => {
    if (!id) return undefined;
    const part = partMap[id];
    if (!part) missing.add(id);
    return part;
  };

  const characters: LegoCharacterConfig[] = payload.c.map((row, index) => {
    const hair = resolve(asString(row[0]));
    const face = resolve(asString(row[2]));
    const set = resolve(asString(row[3]));
    const shirt = set ? undefined : resolve(asString(row[5]));
    const pants = set ? undefined : resolve(asString(row[7]));
    const customPrintOption = payload.v >= 2 ? printCodeToOption(asNumber(row[9], 0)) : 'none';
    const customPrintPrice = customPrintOption === 'none' ? 0 : Math.max(0, asNumber(row[10], 0));

    return {
      id: `decoded-${index + 1}`,
      hair,
      face,
      set,
      shirt,
      pants,
      selectedHairColor: getColorAt(hair, asNumber(row[1])),
      selectedSetColor: getColorAt(set, asNumber(row[4])),
      selectedShirtColor: getColorAt(shirt, asNumber(row[6])),
      selectedPantsColor: getColorAt(pants, asNumber(row[8])),
      customPrintOption,
      customPrintPrice,
      x: 50,
      y: 70,
      rotation: 0,
      scale: 1,
    };
  });

  const charms: DecodedSelectionCharm[] = payload.a.flatMap(row => {
    const part = resolve(asString(row[0]));
    if (!part) return [];
    return [{
      part,
      quantity: Math.max(1, Math.min(99, asNumber(row[1], 1) || 1)),
      selectedColor: getColorAt(part, asNumber(row[2])),
    }];
  });

  return {
    characters,
    charms,
    missingIds: Array.from(missing),
  };
};
