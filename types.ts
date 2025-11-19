// types.ts

// Danh sách các trang
export type Page = 'home' | 'builder' | 'collection' | 'feedback' | 'order-lookup' | 'contact' | 'cart' | 'checkout' | 'order-confirmation' | 'admin';

export interface FrameOption {
  id: string;
  name: string;
  frameWidthCm: number;
  frameHeightCm: number;
  backgroundWidthCm: number;
  backgroundHeightCm: number;
  price: number;
  imageUrl: string;
  description: string;
}

export interface OutfitColor {
  name: string;
  hex: string;
  imageUrl: string;
  price: number; 
}

export interface LegoPart {
  id: string;
  name: string;
  price: number; 
  imageUrl: string;
  type: 'hair' | 'face' | 'shirt' | 'pants' | 'accessory' | 'pet' | 'hat';
  widthCm: number;
  heightCm: number;
  colors?: OutfitColor[];
  attach?: { x: number; y: number }; 
  slices?: boolean; 
  dx?: number; 
  dy?: number; 
}

export interface LegoCharacterConfig {
  id: number;
  hair?: LegoPart;
  face?: LegoPart;
  shirt?: LegoPart;
  pants?: LegoPart;
  hat?: LegoPart;
  selectedShirtColor?: OutfitColor; 
  selectedPantsColor?: OutfitColor;
  customPrintPrice?: number;
  x: number; 
  y: number; 
  rotation: number; 
  scale: number; 
  previousHair?: LegoPart; 
}

export interface TextConfig {
  id: number;
  content: string;
  font: string;
  size: number; 
  color: string;
  x: number; 
  y: number; 
  rotation: number; 
  scale: number; 
  background: boolean;
  textAlign?: 'left' | 'center' | 'right';
  width?: number; 
}

export interface DraggableItem {
    id: number;
    partId: string; 
    type: 'accessory' | 'pet' | 'charm';
    x: number; 
    y: number; 
    rotation: number; 
    scale: number; 
}

export interface BackgroundConfig {
  type: 'color' | 'image' | 'upload';
  value: string;
}

export interface FrameConfig {
  frameId: string;
  background: BackgroundConfig;
  characters: LegoCharacterConfig[];
  texts: TextConfig[];
  draggableItems: DraggableItem[];
  previewImageUrl?: string;
}

export interface Order {
  id: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  delivery: {
    date: string;
    notes: string;
  };
  items: FrameConfig[];
  addGiftBox: boolean;
  shipping: {
    method: 'standard' | 'express' | 'bookship';
    fee: number;
  };
  payment: {
    method: 'deposit' | 'full';
  };
  totalPrice: number;
  amountToPay: number;
  
  // --- MỚI THÊM ---
  internalNotes?: string; // Ghi chú nội bộ của Admin
  isUrgent?: boolean;     // Cờ đánh dấu đơn gấp thủ công
  // ... (các phần trên giữ nguyên)

export interface Order {
  id: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  delivery: {
    date: string;
    notes: string;
  };
  items: FrameConfig[];
  addGiftBox: boolean;
  shipping: {
    method: 'standard' | 'express' | 'bookship';
    fee: number;
  };
  payment: {
    method: 'deposit' | 'full';
  };
  totalPrice: number;
  amountToPay: number;
  
  // Ghi chú nội bộ & Cờ gấp
  internalNotes?: string; 
  isUrgent?: boolean;
  
  // --- MỚI THÊM: Deadline do Admin tự đặt ---
  adminDeadline?: string; 
}
}