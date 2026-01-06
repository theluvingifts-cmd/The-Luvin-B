
// types.ts

export type Page = 'home' | 'builder' | 'collection' | 'catalog' | 'feedback' | 'order-lookup' | 'contact' | 'cart' | 'checkout' | 'order-confirmation' | 'admin' | 'about' | 'warranty' | 'business';

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
  colors: string[];
  stock: number;
  order?: number;
}

export interface OutfitColor {
  name: string;
  hex: string;
  imageUrl: string;
  price: number;
  stock?: number;
}

export interface BulkPriceTier {
  quantity: number;
  price: number;
}

export interface LegoPart {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  salePrice?: number;
  saleEndDate?: string;
  imageUrl: string;
  type: 'hair' | 'face' | 'shirt' | 'pants' | 'hat' | 'accessory' | 'pet' | 'set';
  category?: string;
  widthCm: number;
  heightCm: number;
  isHot?: boolean;
  colors?: OutfitColor[];
  stock?: number;
  order?: number;
  bulkPricing?: BulkPriceTier[];
  preventScarf?: boolean;
}

export interface LegoCharacterConfig {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  hair?: LegoPart;
  face?: LegoPart;
  shirt?: LegoPart;
  pants?: LegoPart;
  hat?: LegoPart;
  selectedShirtColor?: OutfitColor;
  selectedPantsColor?: OutfitColor;
  selectedHairColor?: OutfitColor;
  customPrintPrice?: number;
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
  width: number;
  fontWeight?: string;
  border?: boolean;
  borderWidth?: number;
  borderStyle?: string;
  borderColor?: string;
  lockedContent?: boolean;
  lockedPosition?: boolean;
}

export interface DraggableItem {
  id: number;
  partId: string;
  type: 'accessory' | 'pet' | 'hat' | 'charm';
  x: number;
  y: number;
  rotation: number;
  scale: number;
  isFlipped?: boolean;
  selectedColor?: OutfitColor;
  linkedCharId?: number;
  lockedPosition?: boolean;
  maskShape?: 'circle' | 'rounded' | 'heart' | 'star';
}

export interface ShapeConfig {
  id: number;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fillColor?: string;
  strokeColor: string;
  strokeWidth: number;
  strokeType: 'solid' | 'dashed' | 'dotted';
  borderRadius: number;
  lockedPosition?: boolean;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'image';
  required: boolean;
  placeholder?: string;
}

export interface FrameConfig {
  frameId: string;
  frameColor: string;
  background: {
    type: 'color' | 'image' | 'upload';
    value: string;
  };
  characters: LegoCharacterConfig[];
  texts: TextConfig[];
  draggableItems: DraggableItem[];
  shapes: ShapeConfig[];
  previewImageUrl?: string;
  templateId?: string;
  isRotated?: boolean;
  quantity?: number;
  formFields?: FormField[];
  customFormData?: Record<string, string>;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  socialLink?: string;
}

export interface Order {
  id: string;
  customer: CustomerInfo;
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
  amountPaid?: number;
  status: string;
  createdAt: number;
  internalNotes?: string;
  isUrgent?: boolean;
  adminDeadline?: string;
  packedBy?: string;
  packedAt?: string;
  paymentProofUrl?: string;
  paymentProofUploadedAt?: string;
  trackingCode?: string;
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
  orientation: 'portrait' | 'landscape';
  order?: number;
  overlayConfig?: {
    texts: TextConfig[];
    draggableItems: DraggableItem[];
    shapes: ShapeConfig[];
  };
  formFields?: FormField[];
}

export interface CollectionTemplate {
  id: string;
  name: string;
  imageUrl: string;
  category?: string;
  config: FrameConfig;
  purchaseCount?: number;
}

export interface FeedbackItem {
  id: string;
  name: string;
  text: string;
  imageUrl: string;
}

export interface CustomFont {
  id: string;
  name: string;
  url: string;
}

export interface StaffMember {
  email: string;
  role: 'admin' | 'warehouse';
  addedAt: string;
}

export type StaffRole = 'admin' | 'warehouse';

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
      customFontUrl: string;
    };
    borderRadius: string;
  };
  sections: {
    header: {
      backgroundColor: string;
      textColor: string;
    };
    hero: {
      backgroundColor: string;
      textColor: string;
      headingColor: string;
    };
    footer: {
      backgroundColor: string;
      textColor: string;
    };
  };
}

export interface Voucher {
  id: string;
  code: string;
  type: 'fixed' | 'percent';
  value: number;
  minOrderValue: number;
  maxUsage?: number;
  usedCount: number;
  expiryDate?: string;
  isActive: boolean;
  description?: string;
}

export interface SavedAsset {
  id: string;
  url: string;
  type: 'background' | 'sticker';
  createdAt: number;
}

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
