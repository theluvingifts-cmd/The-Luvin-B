
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
  costPrice?: number; // ADDED: Giá vốn
  imageUrl: string;
  description: string;
  stock?: number; // Số lượng tồn kho
  colors: string[]; // Danh sách màu: ['black', 'white', 'wood'...]
  order?: number;
}

export interface OutfitColor {
  name: string;
  hex: string;
  imageUrl: string;
  price: number; 
  stock?: number; // undefined = unlimited, 0 = out of stock
}

export interface LegoPart {
  id: string;
  name: string;
  price: number; 
  costPrice?: number; // ADDED: Giá vốn
  imageUrl: string;
  type: 'hair' | 'face' | 'shirt' | 'pants' | 'accessory' | 'pet' | 'hat' | 'set'; // Added 'set'
  widthCm: number;
  heightCm: number;
  colors?: OutfitColor[];
  attach?: { x: number; y: number }; 
  slices?: boolean; 
  dx?: number; 
  dy?: number; 
  stock?: number; // undefined = unlimited, 0 = out of stock
  order?: number; // Position for sorting
  category?: string; // ADDED: Dịp / Danh mục (Ví dụ: Noel, Sinh nhật)
}

// Interface mới cho Background
export interface PresetBackground {
    id: string;
    name: string;
    url: string;
    category: string;
    type: 'square' | 'rectangle'; // Phân loại cho khung vuông hoặc chữ nhật
    order?: number; // Position for sorting
}

export interface LegoCharacterConfig {
  id: number;
  hair?: LegoPart;
  face?: LegoPart;
  shirt?: LegoPart;
  pants?: LegoPart;
  hat?: LegoPart; // Deprecated in UI logic, kept for type safety
  selectedShirtColor?: OutfitColor; 
  selectedPantsColor?: OutfitColor;
  selectedHairColor?: OutfitColor; // Added hair color selection
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
    type: 'accessory' | 'pet' | 'charm' | 'hat'; // Added 'hat'
    x: number; 
    y: number; 
    rotation: number; 
    scale: number; 
    isFlipped?: boolean; // Added for flip functionality
    selectedColor?: OutfitColor; // Added for accessory color variants
}

export interface BackgroundConfig {
  type: 'color' | 'image' | 'upload';
  value: string;
}

export interface FrameConfig {
  frameId: string;
  frameColor?: string; // Changed to string to support dynamic colors from DB
  background: BackgroundConfig;
  characters: LegoCharacterConfig[];
  texts: TextConfig[];
  draggableItems: DraggableItem[];
  previewImageUrl?: string;
  quantity?: number; // Added quantity field
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

  // --- Payment Proof ---
  paymentProofUrl?: string; // Link ảnh chuyển khoản
  paymentProofUploadedAt?: string; // Thời gian up ảnh
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

// --- STAFF & PERMISSIONS ---
export type StaffRole = 'admin' | 'warehouse';

export interface StaffMember {
    email: string;
    role: StaffRole;
    addedAt?: string;
}

// --- THEME SYSTEM INTERFACES ---

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
            primary: string; // Brand Main Color (Pink)
            secondary: string; // Brand Secondary (Cream/Beige)
            text: string; // Main text color
            background: string; // Main background
            accent: string; // Highlights
        };
        typography: {
            headingFont: string;
            bodyFont: string;
            customFontUrl?: string; // Deprecated in favor of uploadedFonts in StoreConfig
        };
        borderRadius: string; // '0px', '4px', '8px', '16px', '9999px'
    };
    sections: {
        header: SectionStyle;
        hero: SectionStyle;
        footer: SectionStyle;
        // Add more sections as needed
    };
}
