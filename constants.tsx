
import type { FrameOption, LegoPart, FrameConfig, OutfitColor, Order, CollectionTemplate } from './types';


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
  hair: [
    { id: 'hair-1', name: 'Tóc Nam 1', type: 'hair', price: 20000, imageUrl: 'https://placehold.co/200x200?text=Hair+1', stock: 100, widthCm: 0, heightCm: 0 },
    { id: 'hair-2', name: 'Tóc Nữ 1', type: 'hair', price: 20000, imageUrl: 'https://placehold.co/200x200?text=Hair+2', stock: 100, widthCm: 0, heightCm: 0 },
  ],
  face: [
    { id: 'face-1', name: 'Mặt Cười', type: 'face', price: 10000, imageUrl: 'https://placehold.co/200x200?text=Face+1', stock: 100, widthCm: 0, heightCm: 0 },
    { id: 'face-2', name: 'Mặt Ngầu', type: 'face', price: 10000, imageUrl: 'https://placehold.co/200x200?text=Face+2', stock: 100, widthCm: 0, heightCm: 0 },
  ],
  shirt: [
    { id: 'shirt-1', name: 'Áo Trơn', type: 'shirt', price: 30000, imageUrl: 'https://placehold.co/200x200?text=Shirt+1', colors: defaultShirtColors, stock: 100, widthCm: 0, heightCm: 0 },
  ],
  pants: [
    { id: 'pants-1', name: 'Quần Trơn', type: 'pants', price: 20000, imageUrl: 'https://placehold.co/200x200?text=Pants+1', colors: defaultPantsColors, stock: 100, widthCm: 0, heightCm: 0 },
  ],
  hat: [],
  accessory: [],
  pet: [],
  set: [], 
};


// ===================================================================================
// BACKGROUNDS (Rỗng - Load từ DB)
// ===================================================================================

export const PRESET_BACKGROUNDS_SQUARE: { name: string; url: string; category: string; }[] = [
  { name: 'Trắng tinh khôi', url: '#ffffff', category: 'Basic' },
  { name: 'Xám thanh lịch', url: '#f3f4f6', category: 'Basic' },
  { name: 'Hồng pastel', url: '#fce7f3', category: 'Basic' },
  { name: 'Xanh mint', url: '#ecfdf5', category: 'Basic' },
];

export const PRESET_BACKGROUNDS_RECTANGLE: { name: string; url: string; category: string; }[] = [
  { name: 'Trắng tinh khôi', url: '#ffffff', category: 'Basic' },
  { name: 'Xám thanh lịch', url: '#f3f4f6', category: 'Basic' },
  { name: 'Hồng pastel', url: '#fce7f3', category: 'Basic' },
  { name: 'Xanh mint', url: '#ecfdf5', category: 'Basic' },
];

export const INITIAL_FRAME_CONFIG: FrameConfig = {
  frameId: 'lg',
  frameColor: 'white', // Default frame color
  background: { type: 'color', value: '#ffffff' }, // Changed default to white
  characters: [],
  texts: [],
  draggableItems: [],
  shapes: [], // Initialize shapes array
};

/**
 * COLLECTION_TEMPLATES is used as a fallback when no templates are fetched from the database.
 * Explicitly type it as CollectionTemplate[] to ensure the category property is recognized.
 */
export const COLLECTION_TEMPLATES: CollectionTemplate[] = [
  {
    id: 'template-1',
    name: 'Mẫu Kỷ Niệm',
    category: 'Love',
    imageUrl: 'https://placehold.co/400x600?text=Template+1',
    config: INITIAL_FRAME_CONFIG
  }
];

export const FEEDBACK_ITEMS = [
  {
    id: 'fb-1',
    name: 'Nguyễn Văn A',
    text: 'Sản phẩm rất đẹp, đóng gói cẩn thận. Sẽ ủng hộ shop tiếp!',
    imageUrl: 'https://placehold.co/100x100?text=User+1'
  },
  {
    id: 'fb-2',
    name: 'Trần Thị B',
    text: 'Giao hàng nhanh, nhân viên tư vấn nhiệt tình. 5 sao!',
    imageUrl: 'https://placehold.co/100x100?text=User+2'
  }
];

export const MOCK_ORDERS: Record<string, Order> = {};

export const PRODUCT_HIGHLIGHTS = []

export const GENERAL_ASSETS = {
  hero: '',
  inspire: '',
  giftbox: 'https://firebasestorage.googleapis.com/v0/b/the-luvin.firebasestorage.app/o/uploads%2F1766048421302_063vyq_b1a21245_e6e4_4087_bef7_890329278810.jpg?alt=media&token=e7da2f4e-00d3-4f49-b60f-11b21ae161c4', // Icon hộp quà nhẹ
  vietqr: '',
  watermark: '' // Thay link ảnh watermark của bạn vào đây
}
