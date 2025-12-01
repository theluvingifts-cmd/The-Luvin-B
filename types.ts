
// types.ts

// Danh sách các trang
export type Page = 'home' | 'builder' | 'collection' | 'feedback' | 'order-lookup' | 'contact' | 'cart' | 'checkout' | 'order-confirmation' | 'admin' | 'about' | 'warranty' | 'business';

export interface FrameOption {
  id: string;
  name: string;
  frameWidthCm: number;
  frameHeightCm: number;
  backgroundWidthCm: number;
  backgroundHeightCm: number;
  price: number;
  costPrice?: number;
  imageUrl: string;
  description: string;
  stock?: number;
  colors: string[];
  order?: number;
}

export interface OutfitColor {
  name: string;
  hex: string;
  imageUrl: string;
  price: number; 
  stock?: number;
}

export interface LegoPart {
  id: string;
  name: string;
  price: number; 
  costPrice?: number;
  imageUrl: string;
  type: 'hair' | 'face' | 'shirt' | 'pants' | 'accessory' | 'pet' | 'hat' | 'set';
  widthCm: number;
  heightCm: number;
  colors?: OutfitColor[];
  attach?: { x: number; y: number }; 
  slices?: boolean; 
  dx?: number; 
  dy?: number; 
  stock?: number;
  order?: number;
  category?: string;
  isHot?: boolean;
}

export interface PresetBackground {
    id: string;
    name: string;
    url: string;
    category: string;
    type: 'square' | 'rectangle';
    order?: number;
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
  selectedHairColor?: OutfitColor;
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
    type: 'accessory' | 'pet' | 'charm' | 'hat';
    x: number; 
    y: number; 
    rotation: number; 
    scale: number; 
    isFlipped?: boolean;
    selectedColor?: OutfitColor;
}

export interface BackgroundConfig {
  type: 'color' | 'image' | 'upload';
  value: string;
}

export interface FrameConfig {
  frameId: string;
  frameColor?: string;
  background: BackgroundConfig;
  characters: LegoCharacterConfig[];
  texts: TextConfig[];
  draggableItems: DraggableItem[];
  previewImageUrl?: string;
  quantity?: number;
}

export interface Order {
  id: string;
  createdAt: number;
  status: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    socialLink?: string; // Link liên hệ (FB/Insta/Zalo)
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
  amountToPay: number; // Initially the intended amount to pay (COD or Deposit)
  amountPaid?: number; // Actual amount received/confirmed by admin
  
  // --- Admin Fields ---
  internalNotes?: string;
  isUrgent?: boolean;
  adminDeadline?: string;
  packedBy?: string;
  packedAt?: string;
  trackingCode?: string; // Mã vận đơn

  // --- Payment Proof ---
  paymentProofUrl?: string;
  paymentProofUploadedAt?: string;

  // --- Discounts ---
  discountCode?: string; // Mã giảm giá đã dùng
  discountAmount?: number; // Số tiền được giảm
}

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

export type StaffRole = 'admin' | 'warehouse';

export interface StaffMember {
    email: string;
    role: StaffRole;
    addedAt?: string;
}

// --- VOUCHERS ---
export interface Voucher {
    id: string;
    code: string; // Mã nhập vào (VD: SALE10)
    type: 'percent' | 'fixed'; // percent (%) hoặc fixed (số tiền)
    value: number; // 10 (nếu %) hoặc 20000 (nếu fixed)
    minOrderValue: number; // Đơn tối thiểu để dùng
    maxUsage?: number; // Giới hạn số lượt dùng toàn hệ thống
    usedCount: number; // Số lượt đã dùng
    expiryDate?: string; // Ngày hết hạn (ISO string)
    isActive: boolean;
    description?: string;
}

// --- CRM / CUSTOMERS ---
export interface CustomerStats {
    phone: string; // Key chính để định danh
    name: string;
    email?: string;
    address?: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: number;
    orders: Order[]; // Danh sách các đơn đã đặt
}

export interface CustomFont {
    id: string;
    name: string;
    url: string;
}

export interface SectionStyle {
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
    headingColor?: string;
    paddingTop?: string;
    paddingBottom?: string;
}

export interface ThemeConfig {
    global: {
        colors: {
            primary: string;
            secondary: string;
            text: string;
            background: string;
            accent: string;
        };
        typography: {
            headingFont: string;
            bodyFont: string;
            customFontUrl?: string;
        };
        borderRadius: string;
    };
    sections: {
        header: SectionStyle;
        hero: SectionStyle;
        footer: SectionStyle;
    };
}