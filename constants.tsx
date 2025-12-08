
import type { FrameOption, LegoPart, FrameConfig, OutfitColor, Order } from './types';


export const FRAME_OPTIONS: FrameOption[] = [
  { id: 'lg', name: '23x23cm', frameWidthCm: 23, frameHeightCm: 23, backgroundWidthCm: 20, backgroundHeightCm: 20, price: 230000, imageUrl: '', description: 'Sang trọng, ấn tượng', colors: ['black', 'white'], stock: 100 },
  { id: 'sm', name: '15x15cm', frameWidthCm: 15, frameHeightCm: 15, backgroundWidthCm: 12, backgroundHeightCm: 12, price: 210000, imageUrl: '', description: 'Nhỏ gọn, tinh tế', colors: ['black', 'white'], stock: 100 },
  { id: 'md', name: '14.8x21cm', frameWidthCm: 14.8, frameHeightCm: 21, backgroundWidthCm: 11.8, backgroundHeightCm: 18, price: 220000, imageUrl: '', description: 'Thanh lịch, đứng dáng', colors: ['black', 'white'], stock: 100 },
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

// Dữ liệu LEGO Parts cơ bản (Fallback rỗng để tránh load ảnh cũ)
export const LEGO_PARTS: {
  hair: LegoPart[];
  face: LegoPart[];
  shirt: LegoPart[];
  pants: LegoPart[];
  hat: LegoPart[];
  accessory: LegoPart[];
  pet: LegoPart[];
  set: LegoPart[]; // Added set category
} = {
  hair: [],
  face: [],
  shirt: [],
  pants: [],
  hat: [],
  accessory: [
      { id: 'acc1', name: 'Hoa', price: 10000, imageUrl: 'https://cdn-icons-png.flaticon.com/512/346/346167.png', type: 'accessory', widthCm: 1, heightCm: 1, isHot: true },
      { id: 'acc2', name: 'Túi', price: 15000, imageUrl: 'https://cdn-icons-png.flaticon.com/512/2855/2855589.png', type: 'accessory', widthCm: 1, heightCm: 1 },
      { id: 'acc3', name: 'Bóng bay', price: 12000, imageUrl: 'https://cdn-icons-png.flaticon.com/512/2412/2412845.png', type: 'accessory', widthCm: 1.2, heightCm: 1.5, isHot: true }
  ],
  pet: [
      { id: 'pet1', name: 'Corgi', price: 20000, imageUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png', type: 'pet', widthCm: 1.5, heightCm: 1.5, isHot: true }
  ],
  set: [], 
};


// ===================================================================================
// BACKGROUNDS (Rỗng - Load từ DB)
// ===================================================================================

export const PRESET_BACKGROUNDS_SQUARE: { name: string; url: string; category: string; }[] = [];

export const PRESET_BACKGROUNDS_RECTANGLE: { name: string; url: string; category: string; }[] = [];

export const INITIAL_FRAME_CONFIG: FrameConfig = {
  frameId: 'lg',
  frameColor: 'white', // Default frame color
  background: { type: 'color', value: '#ffffff' }, // Changed default to white
  characters: [],
  texts: [],
  draggableItems: [],
};

export const COLLECTION_TEMPLATES: { id: string; name: string; imageUrl: string; config: FrameConfig }[] = [];

export const FEEDBACK_ITEMS = [];

export const MOCK_ORDERS: Record<string, Order> = {};

export const PRODUCT_HIGHLIGHTS = []

export const GENERAL_ASSETS = {
  hero: '',
  inspire: '',
  giftbox: 'https://cdn-icons-png.flaticon.com/512/4530/4530625.png', // Icon hộp quà nhẹ
  vietqr: '',
  watermark: 'https://res.cloudinary.com/dbdqd93km/image/upload/v1763705477/ce3r3dzdpp2gn5nv3jdx.png' // Thay link ảnh watermark của bạn vào đây
}
