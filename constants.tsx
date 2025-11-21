
import type { FrameOption, LegoPart, FrameConfig, OutfitColor, Order } from './types';

// GIÁ VÀ KÍCH THƯỚC CỐ ĐỊNH (Logic cốt lõi)
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

// Standardized dimensions
const HEAD_W_CM = 1.0;
const HEAD_H_CM = 1.0;
const TORSO_W_CM = 2.5;
const TORSO_H_CM = 1.3;
const LEGS_W_CM = 1.5;
const LEGS_H_CM = 1.6;
const HAT_H_CM = 0.8;

// EMPTY INITIAL DATA (Will be populated by Firebase or Seed)
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

export const PRESET_BACKGROUNDS_SQUARE: { name: string; url: string; category: string; }[] = [];
export const PRESET_BACKGROUNDS_RECTANGLE: { name: string; url: string; category: string; }[] = [];

export const INITIAL_FRAME_CONFIG: FrameConfig = {
  frameId: 'sm',
  background: { type: 'color', value: '#f4eee8' },
  characters: [],
  texts: [],
  draggableItems: [],
};

export const COLLECTION_TEMPLATES: { id: string; name: string; imageUrl: string; config: FrameConfig }[] = [];

export const FEEDBACK_ITEMS = [];

export const MOCK_ORDERS: Record<string, Order> = {};

export const PRODUCT_HIGHLIGHTS = [
    {id: 1, name: 'Khung Kỷ niệm Ngày cưới', collection: 'Bộ sưu tập Tình yêu', imageUrl: '' },
    {id: 2, name: 'Khung Tốt nghiệp', collection: 'Bộ sưu tập Dấu ấn', imageUrl: '' },
    {id: 3, name: 'Khung Gia đình', collection: 'Bộ sưu tập Gia đình', imageUrl: '' },
    {id: 4, name: 'Khung Sinh nhật Vui vẻ', collection: 'Bộ sưu tập Mừng tuổi mới', imageUrl: '' },
];

export const GENERAL_ASSETS = {
  hero: '',
  inspire: '',
  giftbox: '',
  vietqr: ''
};
