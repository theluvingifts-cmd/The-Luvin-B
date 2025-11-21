
import type { FrameOption, LegoPart, FrameConfig, OutfitColor, Order } from './types';


export const FRAME_OPTIONS: FrameOption[] = [
  { id: 'sm', name: '15x15cm', frameWidthCm: 15, frameHeightCm: 15, backgroundWidthCm: 12, backgroundHeightCm: 12, price: 210000, imageUrl: '', description: 'Nhỏ gọn, tinh tế' },
  { id: 'md', name: '14.8x21cm', frameWidthCm: 14.8, frameHeightCm: 21, backgroundWidthCm: 11.8, backgroundHeightCm: 18, price: 220000, imageUrl: '', description: 'Thanh lịch, đứng dáng' },
  { id: 'lg', name: '23x23cm', frameWidthCm: 23, frameHeightCm: 23, backgroundWidthCm: 20, backgroundHeightCm: 20, price: 230000, imageUrl: '', description: 'Sang trọng, ấn tượng' },
];

export const defaultShirtColors: OutfitColor[] = [
    { name: 'Trắng', hex: '#F8F8F8', imageUrl: '', price: 0 },
    { name: 'Đỏ', hex: '#E53E3E', imageUrl: '', price: 10000 },
    { name: 'Xanh', hex: '#3B82F6', imageUrl: '', price: 10000 },
];

export const defaultPantsColors: OutfitColor[] = [
    { name: 'Đen', hex: '#1A202C', imageUrl: '', price: 0 },
    { name: 'Be', hex: '#F5F5DC', imageUrl: '', price: 10000 },
    { name: 'Xám', hex: '#A0AEC0', imageUrl: '', price: 10000 },
];


// Standardized dimensions based on the new specification
const HEAD_W_CM = 1.0;
const HEAD_H_CM = 1.0;
const TORSO_W_CM = 2.5;
const TORSO_H_CM = 1.3;
const LEGS_W_CM = 1.5;
const LEGS_H_CM = 1.6;
const HAT_H_CM = 0.8; // A reasonable height for hats

// Dữ liệu LEGO Parts cơ bản (Fallback nếu DB trống)
export const LEGO_PARTS: {
  hair: LegoPart[];
  face: LegoPart[];
  shirt: LegoPart[];
  pants: LegoPart[];
  hat: LegoPart[];
  accessory: LegoPart[];
  pet: LegoPart[];
} = {
  hair: [],
  face: [],
  shirt: [],
  pants: [],
  hat: [],
  accessory: [],
  pet: [],
};


// ===================================================================================
// BACKGROUNDS (Fallback - Khuyến khích dùng DB)
// ===================================================================================

export const PRESET_BACKGROUNDS_SQUARE: { name: string; url: string; category: string; }[] = [];

export const PRESET_BACKGROUNDS_RECTANGLE: { name: string; url: string; category: string; }[] = [];

export const INITIAL_FRAME_CONFIG: FrameConfig = {
  frameId: 'sm',
  background: { type: 'color', value: '#f4eee8' },
  characters: [],
  texts: [],
  draggableItems: [],
};

const initialTextConfig = {
    id: 1,
    content: 'Our Special Day',
    font: 'Anniversary',
    size: 50,
    color: '#333333',
    x: 50,
    y: 20,
    rotation: -5,
    scale: 1.2,
    background: true,
    textAlign: 'center' as const,
};

export const COLLECTION_TEMPLATES: { id: string; name: string; imageUrl: string; config: FrameConfig }[] = [];

export const FEEDBACK_ITEMS = [];

export const MOCK_ORDERS: Record<string, Order> = {};


export const PRODUCT_HIGHLIGHTS = []

export const GENERAL_ASSETS = {
  hero: '',
  inspire: '',
  giftbox: '',
  vietqr: ''
}
