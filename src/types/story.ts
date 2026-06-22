
import { CollectionTemplate } from '../../types';

export type StoryStyle = 'classic' | 'magazine' | 'minimal' | 'addons';

export interface StoryAdjustments {
    brandingY: number;
    imageY: number;
    imageScale: number;
    contentY: number;
    priceY: number;
    noteY: number;
    
    // Advanced features
    customName?: string;
    customPrice?: number;
    customNote?: string;
    
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
    
    hideNote?: boolean;
    hideBranding?: boolean;
    hidePrice?: boolean;
    hideSpecs?: boolean;
    
    fontSizeScale?: number;
    opacity?: number;
}

export const INITIAL_ADJUSTMENTS: StoryAdjustments = {
    brandingY: 0,
    imageY: 0,
    imageScale: 1,
    contentY: 0,
    priceY: 0,
    noteY: 0,
    fontSizeScale: 1,
    opacity: 1
};
