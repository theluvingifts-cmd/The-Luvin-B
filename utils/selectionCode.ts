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

type EncodedCharacter = [
  string, number,
  string,
  string, number,
  string, number,
  string, number
];

type EncodedCharm = [string, number, number];

type SelectionPayload = {
  v: 1;
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

export const encodeSelectionCode = (
  characters: LegoCharacterConfig[],
  charms: SelectionCharmInput[]
) => {
  const payload: SelectionPayload = {
    v: 1,
    c: characters.map(character => [
      character.hair?.id || '', getColorIndex(character.hair, character.selectedHairColor),
      character.face?.id || '',
      character.set?.id || '', getColorIndex(character.set, character.selectedSetColor),
      character.set ? '' : (character.shirt?.id || ''), character.set ? -1 : getColorIndex(character.shirt, character.selectedShirtColor),
      character.set ? '' : (character.pants?.id || ''), character.set ? -1 : getColorIndex(character.pants, character.selectedPantsColor),
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

  if (!payload || payload.v !== 1 || !Array.isArray(payload.c) || !Array.isArray(payload.a)) {
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
    const hair = resolve(row[0]);
    const face = resolve(row[2]);
    const set = resolve(row[3]);
    const shirt = set ? undefined : resolve(row[5]);
    const pants = set ? undefined : resolve(row[7]);

    return {
      id: `decoded-${index + 1}`,
      hair,
      face,
      set,
      shirt,
      pants,
      selectedHairColor: getColorAt(hair, row[1]),
      selectedSetColor: getColorAt(set, row[4]),
      selectedShirtColor: getColorAt(shirt, row[6]),
      selectedPantsColor: getColorAt(pants, row[8]),
      x: 50,
      y: 70,
      rotation: 0,
      scale: 1,
    };
  });

  const charms: DecodedSelectionCharm[] = payload.a.flatMap(row => {
    const part = resolve(row[0]);
    if (!part) return [];
    return [{
      part,
      quantity: Math.max(1, Math.min(99, Number(row[1]) || 1)),
      selectedColor: getColorAt(part, row[2]),
    }];
  });

  return {
    characters,
    charms,
    missingIds: Array.from(missing),
  };
};
