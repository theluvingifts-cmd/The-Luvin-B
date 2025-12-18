
export type Page = 'home' | 'builder' | 'collection' | 'cart' | 'checkout' | 'order-confirmation' | 'order-lookup' | 'admin' | 'about' | 'warranty' | 'business' | 'marketing' | 'customers' | 'design' | 'quotation';

export type StaffRole = 'admin' | 'warehouse';

export interface BulkPriceTier {
    quantity: number;
    price: number;
}

export interface OutfitColor {
    name: string;
    hex: string;
    imageUrl?: string;
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
    type: string;
    widthCm: number;
    heightCm: number;
    isHot?: boolean;
    colors?: OutfitColor[];
    category?: string;
    bulkPricing?: BulkPriceTier[];
    preventScarf?: boolean;
    order?: number;
    stock?: number;
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
    background?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    width: number;
    lockedPosition?: boolean;
    lockedContent?: boolean;
    fontWeight?: 'normal' | 'bold';
    border?: boolean;
    borderColor?: string;
    borderWidth?: number;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
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
    lockedContent?: boolean;
    maskShape?: 'none' | 'circle' | 'rounded' | 'heart' | 'star';
}

export interface ShapeConfig {
    id: number;
    type: 'rect';
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
    isRotated?: boolean;
    previewImageUrl?: string;
    quantity?: number;
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
    items: FrameConfig[];
    totalPrice: number;
    amountToPay: number;
    amountPaid?: number;
    status: string;
    createdAt: number;
    delivery: {
        date: string;
        notes: string;
    };
    shipping: {
        method: 'standard' | 'express' | 'bookship';
        fee: number;
    };
    payment: {
        method: 'deposit' | 'full';
    };
    addGiftBox: boolean;
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

export interface StaffMember {
    email: string;
    role: StaffRole;
    addedAt: string;
}

export interface SavedAsset {
    id: string;
    url: string;
    type: 'background' | 'sticker';
    createdAt: number;
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

export interface QuoteItem {
    id: string;
    name: string;
    type: 'frame' | 'part' | 'other';
    quantity: number;
    unitPrice: number;
    total: number;
    imageUrl?: string;
}

export interface QuotationData {
    customerName: string;
    companyName?: string;
    address?: string;
    phone?: string;
    date: string;
    validUntil: string;
    items: QuoteItem[];
    taxPercent: number;
    shippingFee: number;
    discountPercent: number;
    note: string;
}
