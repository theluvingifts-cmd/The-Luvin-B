
export type Page = 'home' | 'builder' | 'collection' | 'cart' | 'checkout' | 'order-confirmation' | 'order-lookup' | 'admin' | 'about' | 'warranty' | 'business' | 'marketing' | 'customers' | 'design' | 'quotation';

export interface LegoPart {
    id: string;
    name: string;
    price: number;
    costPrice?: number;
    salePrice?: number;
    saleEndDate?: string;
    imageUrl: string;
    type: 'hair' | 'face' | 'shirt' | 'pants' | 'hat' | 'accessory' | 'pet' | 'set';
    widthCm: number;
    heightCm: number;
    colors?: OutfitColor[];
    category?: string;
    bulkPricing?: BulkPriceTier[];
    isHot?: boolean;
    order?: number;
    stock?: number;
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
    costPrice?: number;
    salePrice?: number;
    saleEndDate?: string;
    imageUrl: string;
    description: string;
    colors: string[];
    stock: number;
    order?: number;
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
    shapes?: ShapeConfig[];
    isRotated?: boolean;
    previewImageUrl?: string;
    quantity?: number;
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
    fontWeight?: 'normal' | 'bold';
    border?: boolean;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    borderWidth?: number;
    borderColor?: string;
    lockedPosition?: boolean;
    lockedContent?: boolean;
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
    maskShape?: 'none' | 'circle' | 'rounded' | 'heart' | 'star';
    lockedPosition?: boolean;
    lockedContent?: boolean;
    linkedCharId?: number;
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
    strokeType: 'solid' | 'dashed' | 'dotted';
    borderRadius: number;
    lockedPosition?: boolean;
}

export interface Order {
    id: string;
    customer: {
        name: string;
        phone: string;
        email: string;
        address: string;
        socialLink?: string;
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
    createdAt: number;
    status: string;
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
    orientation?: 'portrait' | 'landscape';
    order?: number;
    overlayConfig?: {
        texts?: TextConfig[];
        draggableItems?: DraggableItem[];
        shapes?: ShapeConfig[];
    };
}

export interface CollectionTemplate {
    id: string;
    name: string;
    imageUrl: string;
    category?: string;
    config: FrameConfig;
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

export type StaffRole = 'admin' | 'warehouse';

export interface StaffMember {
    email: string;
    role: StaffRole;
    addedAt: string;
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
    email: string;
    address: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: number;
    orders: Order[];
}

export interface SavedAsset {
    id: string;
    url: string;
    type: 'background' | 'sticker';
    createdAt: number;
}

export interface QuoteItem {
    id: string;
    name: string;
    type: 'frame' | 'part';
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface QuotationData {
    customerName: string;
    companyName: string;
    address: string;
    phone: string;
    date: string;
    validUntil: string;
    items: QuoteItem[];
    taxPercent: number;
    shippingFee: number;
    discountPercent: number;
    note: string;
}
