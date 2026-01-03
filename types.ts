
// types.ts

export type Page = 'home' | 'builder' | 'collection' | 'feedback' | 'order-lookup' | 'contact' | 'cart' | 'checkout' | 'order-confirmation' | 'admin' | 'about' | 'warranty' | 'business';

// Added StaffRole type
export type StaffRole = 'admin' | 'warehouse';

// Added BulkPriceTier type
export interface BulkPriceTier {
    quantity: number;
    price: number;
}

// Added CustomerStats type for Admin CRM
export interface CustomerStats {
    phone: string;
    name: string;
    email: string;
    address: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: number;
    orders: Order[];
}

export interface FrameOption {
  id: string;
  name: string;
  frameWidthCm: number;
  frameHeightCm: number;
  backgroundWidthCm: number;
  backgroundHeightCm: number;
  price: number;
  costPrice?: number;
  salePrice?: number;
  saleEndDate?: string;
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
  salePrice?: number;
  saleEndDate?: string;
  imageUrl: string;
  type: 'hair' | 'face' | 'shirt' | 'pants' | 'accessory' | 'pet' | 'hat' | 'set';
  widthCm: number;
  heightCm: number;
  colors?: OutfitColor[];
  bulkPricing?: BulkPriceTier[]; // Use BulkPriceTier
  stock?: number;
  order?: number;
  category?: string;
  isHot?: boolean;
  preventScarf?: boolean;
}

export interface ShapeConfig {
  id: number;
  type: 'rect' | 'circle'; 
  x: number; y: number; width: number; height: number; rotation: number;
  strokeColor: string; fillColor?: string; strokeWidth: number;
  strokeType: 'solid' | 'dashed' | 'dotted'; borderRadius: number;
  lockedPosition?: boolean;
}

export interface TextConfig {
  id: number;
  content: string;
  font: string;
  size: number; 
  color: string;
  x: number; y: number; rotation: number; scale: number; 
  background: boolean;
  textAlign?: 'left' | 'center' | 'right';
  width?: number; 
  lockedPosition?: boolean;
  lockedContent?: boolean;
  fontWeight?: 'normal' | 'bold';
  border?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderColor?: string;
  borderWidth?: number;
}

export interface DraggableItem {
    id: number;
    partId: string; 
    type: 'accessory' | 'pet' | 'charm' | 'hat';
    x: number; y: number; rotation: number; scale: number; 
    isFlipped?: boolean;
    selectedColor?: OutfitColor;
    lockedPosition?: boolean;
    lockedContent?: boolean;
    maskShape?: 'none' | 'circle' | 'rounded' | 'heart' | 'star';
    linkedCharId?: number;
}

export interface BackgroundConfig {
  type: 'color' | 'image' | 'upload';
  value: string;
}

// CẤU CẤU HÌNH FORM TÙY CHỈNH
export interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'image';
    required: boolean;
    placeholder?: string;
}

export interface FrameConfig {
  frameId: string;
  frameColor?: string;
  isRotated?: boolean;
  background: BackgroundConfig;
  characters: LegoCharacterConfig[];
  texts: TextConfig[];
  shapes: ShapeConfig[];
  draggableItems: DraggableItem[];
  previewImageUrl?: string;
  quantity?: number;
  templateId?: string;
  customFormData?: Record<string, string>; // Dữ liệu khách nhập { "field_id": "giá_trị" }
  formFields?: FormField[]; // Cấu hình form đi kèm thiết kế này
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
  x: number; y: number; rotation: number; scale: number; 
}

export interface Order {
  id: string;
  createdAt: number;
  status: string;
  customer: { name: string; phone: string; email: string; address: string; socialLink?: string; };
  delivery: { date: string; notes: string; };
  items: FrameConfig[];
  addGiftBox: boolean;
  shipping: { method: 'standard' | 'express' | 'bookship'; fee: number; };
  payment: { method: 'deposit' | 'full'; };
  totalPrice: number;
  amountToPay: number;
  amountPaid?: number;
  internalNotes?: string;
  isUrgent?: boolean;
  adminDeadline?: string;
  packedBy?: string;
  packedAt?: string;
  trackingCode?: string;
  paymentProofUrl?: string;
  paymentProofUploadedAt?: string;
  discountCode?: string;
  discountAmount?: number;
}

export interface PresetBackground {
    id: string;
    name: string;
    url: string;
    previewUrl?: string;
    category: string;
    type: 'square' | 'rectangle';
    orientation?: 'portrait' | 'landscape';
    order?: number;
    overlayConfig?: {
        texts: TextConfig[];
        draggableItems: DraggableItem[];
        shapes?: ShapeConfig[];
    };
    formFields?: FormField[]; // Cấu hình form riêng cho mẫu nền này
}

export interface CollectionTemplate {
    id: string;
    name: string;
    imageUrl: string;
    config: FrameConfig;
    category?: string; 
    purchaseCount?: number;
}

export interface FeedbackItem {
    id: string;
    name: string;
    text: string;
    imageUrl: string;
}

export interface StaffMember {
    email: string;
    role: StaffRole; // Use StaffRole
    addedAt?: string;
}

export interface Voucher {
    id: string; code: string; type: 'percent' | 'fixed'; value: number; minOrderValue: number; 
    maxUsage?: number; usedCount: number; expiryDate?: string; isActive: boolean; description?: string;
}

export interface CustomFont {
    id: string;
    name: string;
    url: string;
}

export interface SavedAsset {
    id: string; url: string; type: 'background' | 'sticker'; createdAt: number;
}

export interface ThemeConfig {
    global: {
        colors: { primary: string; secondary: string; text: string; background: string; accent: string; };
        typography: { headingFont: string; bodyFont: string; customFontUrl?: string; };
        borderRadius: string;
    };
    sections: {
        header: { backgroundColor?: string; textColor?: string; };
        hero: { backgroundColor?: string; textColor?: string; headingColor?: string; };
        footer: { backgroundColor?: string; textColor?: string; };
    };
}
