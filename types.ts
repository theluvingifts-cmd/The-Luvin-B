
// types.ts

export type Page = 'home' | 'builder' | 'collection' | 'lego-collection' | 'gallery-collection' | 'feedback' | 'order-lookup' | 'contact' | 'cart' | 'checkout' | 'order-confirmation' | 'admin' | 'about' | 'warranty' | 'business' | 'ctv' | 'catalog';

export type StaffRole = 'admin' | 'warehouse';

export interface BulkPriceTier {
    quantity: number;
    price: number;
}

export interface CustomerStats {
    phone: string;
    name: string;
    email: string;
    address: string;
    province?: string;
    district?: string;
    ward?: string;
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
  supportedProductLines?: ('lego' | 'gallery')[];
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
  bulkPricing?: BulkPriceTier[]; 
  stock?: number;
  gender?: 'male' | 'female' | 'unisex';
  order?: number;
  category?: string;
  isHot?: boolean;
  purchaseCount?: number;
  orders?: number;
  preventScarf?: boolean;
  supportedProductLines?: ('lego' | 'gallery')[];
}

export interface ShapeConfig {
  id: number;
  type: 'rect' | 'circle'; 
  x: number; y: number; width: number; height: number; rotation: number;
  strokeColor: string; fillColor?: string; strokeWidth: number;
  strokeType: 'solid' | 'dashed' | 'dotted'; borderRadius: number;
  lockedPosition?: boolean;
  opacity?: number;
  isHidden?: boolean;
  linkedFieldId?: string;
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
  linkedFieldId?: string;
  opacity?: number;
  isHidden?: boolean;
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
    frameUrl?: string; // URL for the museum frame image (overlay)
    linkedCharId?: number;
    opacity?: number;
    isHidden?: boolean;
    linkedFieldId?: string;
}

export interface BackgroundConfig {
  type: 'color' | 'image' | 'upload' | 'preset';
  value: string;
}

export interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'image' | 'select' | 'color' | 'number';
    required: boolean;
    placeholder?: string;
    options?: { label: string; value: string }[];
    min?: number;
    max?: number;
    step?: number;
    helpText?: string;
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
  productLine?: 'lego' | 'gallery';
  previewImageUrl?: string;
  quantity?: number;
  price?: number;
  templateId?: string;
  isSimpleMode?: boolean;
  isMuseumStyle?: boolean;
  customFormData?: Record<string, string>; 
  formFields?: FormField[]; 
  galleryOptions?: {
      photoFrameCount?: number;
      lightCount?: number;
  };
}

export interface LegoCharacterConfig {
  id: number | string;
  hair?: LegoPart;
  face?: LegoPart;
  shirt?: LegoPart;
  pants?: LegoPart;
  hat?: LegoPart;
  set?: LegoPart;
  selectedShirtColor?: OutfitColor; 
  selectedPantsColor?: OutfitColor;
  selectedHairColor?: OutfitColor;
  selectedHatColor?: OutfitColor;
  selectedSetColor?: OutfitColor;
  customPrintOption?: 'none' | 'standard' | 'premium';
  customPrintPrice?: number;
  x: number; y: number; rotation: number; scale: number; 
  opacity?: number;
  isHidden?: boolean;
  lockedPosition?: boolean;
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
    province?: string;
    district?: string;
    ward?: string;
    note?: string;
    socialLink?: string; 
    demoContact?: string; 
  };
  delivery: { date: string; notes: string; };
  items: FrameConfig[];
  extraCharms?: LegoPart[];
  addGiftBox: boolean;
  addLight: boolean;
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
  referredBy?: string;
  commissionAmount?: number;
  commissionPaid?: boolean;
  imagesCleaned?: boolean;
  countedInStats?: boolean; 
  thankYouEmailSent?: boolean; // Flag to prevent duplicate thank you emails
  source?: 'collection' | 'builder';
  templateId?: string;
  templateName?: string;
  templateOrderCounted?: boolean;
}

export interface SavedDesign {
    id: string;
    ctvUid: string;
    name: string;
    config: FrameConfig;
    createdAt: number;
}

export interface Collaborator {
    uid: string;
    email: string;
    phone?: string;
    fullName?: string;
    referralCode: string;
    status: 'pending' | 'active' | 'suspended';
    createdAt: number;
    designs?: SavedDesign[];
    customCommissionRate?: number;
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
    formFields?: FormField[]; 
}

export interface CollectionTemplate {
    id: string;
    name: string;
    imageUrl: string;
    config: FrameConfig;
    category?: string; 
    fakeOrderCount?: number;
    realOrderCount?: number;
    purchaseCount?: number;
    orders?: number;
    price?: number;
    salePrice?: number;
    saleEndDate?: string;
    description?: string;
    isSimple?: boolean;
    isHot?: boolean;
    isNew?: boolean;
    productLine?: 'lego' | 'gallery';
    order?: number;
    stock?: number;
    galleryOptions?: {
        photoFrameCount?: number;
        lightCount?: number;
        showPhotoOptions?: boolean;
        showLightOptions?: boolean;
    };
}

export interface FeedbackItem {
    id: string;
    name: string;
    text: string;
    imageUrl: string;
}

export interface StaffMember {
    email: string;
    role: StaffRole; 
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
