export type Page = 'home' | 'builder' | 'collection' | 'cart' | 'checkout' | 'order-confirmation' | 'order-lookup' | 'admin' | 'about' | 'warranty' | 'business' | 'marketing' | 'customers' | 'design';

export interface LegoPart {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  type: 'hair' | 'face' | 'shirt' | 'pants' | 'hat' | 'accessory' | 'pet' | 'set';
  widthCm: number;
  heightCm: number;
  isHot?: boolean;
  colors?: OutfitColor[];
  order?: number;
  stock?: number;
  category?: string;
  costPrice?: number;
  salePrice?: number;
  saleEndDate?: string;
  bulkPricing?: BulkPriceTier[];
  preventScarf?: boolean;
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
  colors: string[];
  stock: number;
  order?: number;
  costPrice?: number;
  salePrice?: number;
  saleEndDate?: string;
}

export interface BackgroundConfig {
  type: 'color' | 'image' | 'upload';
  value: string;
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
  width?: number;
  lockedPosition?: boolean;
  lockedContent?: boolean;
}

export interface ShapeConfig {
  id: number;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeType: 'solid' | 'dashed';
  borderRadius: number;
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

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'image';
  required: boolean;
  placeholder?: string;
  limit?: number;
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
  customFormData?: Record<string, string | string[]>;
}

export interface Order {
  id: string;
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
  formFields?: FormField[];
  overlayConfig?: {
    texts: TextConfig[];
    draggableItems: DraggableItem[];
    shapes: ShapeConfig[];
  };
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

export type StaffRole = 'admin' | 'warehouse';

export interface StaffMember {
  email: string;
  role: StaffRole;
  addedAt: string;
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

export interface SavedAsset {
  id: string;
  url: string;
  type: 'background' | 'sticker';
  createdAt: number;
}

export interface Voucher {
  id: string;
  code: string;
  type: 'fixed' | 'percent';
  value: number;
  minOrderValue: number;
  maxUsage: number;
  usedCount: number;
  expiryDate: string;
  isActive: boolean;
  description: string;
}

export interface CustomerStats {
  phone: string;
  name: string;
  email?: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: number;
  orders: Order[];
}