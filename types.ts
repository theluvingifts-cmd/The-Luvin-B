
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
  stock?: number; // undefined = unlimited, 0 = out of stock
}

// Interface mới cho Background
export interface PresetBackground {
    id: string;
    name: string;
    url: string;
    category: string;
    type: 'square' | 'rectangle'; // Phân loại cho khung vuông hoặc chữ nhật
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
    isFlipped?: boolean; // Added for flip functionality
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

// Thông tin vận đơn từ bên thứ 3
export interface ShippingDetails {
    carrier: 'VTP' | 'SPX' | 'OTHER'; // Viettel Post, Shopee Express, Khác
    trackingCode: string; // Mã vận đơn
    status: string; // Trạng thái bên ĐVVC
    codAmount: number; // Tiền thu hộ
    fee: number; // Phí ship thực tế
    weight?: number; // Gram
    dimensions?: { l: number, w: number, h: number }; // cm
    createdAt: string;
}

export interface Order {
  id: string;
  createdAt: number; // Timestamp chính xác khi tạo đơn
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
  
  // --- Admin Fields ---
  internalNotes?: string; // Ghi chú nội bộ của Admin
  isUrgent?: boolean;     // Cờ đánh dấu đơn gấp thủ công
  adminDeadline?: string; // Deadline do admin đặt
  
  // --- Warehouse Fields ---
  packedBy?: string;      // Email người đóng gói
  packedAt?: string;      // Thời gian đóng gói ISO string
  
  // --- 3rd Party Shipping ---
  shippingDetails?: ShippingDetails;
}

// NEW INTERFACES FOR DYNAMIC CONTENT
export interface CollectionTemplate {
    id: string;
    name: string;
    imageUrl: string;
    config: FrameConfig;
}

export interface FeedbackItem {
    id: string;
    name: string;
    text: string;
    imageUrl: string;
}
