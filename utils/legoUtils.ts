
import { LegoPart, LegoCharacterConfig, FrameConfig } from '../types';
import { LEGO_PARTS } from '../constants';

/**
 * Fixes out-of-stock parts in a FrameConfig by replacing them with random alternatives.
 */
export const fixOutOfStockParts = (config: FrameConfig, allParts: Record<string, LegoPart>): FrameConfig => {
    // Helper to get a random alternative part of the same type that is in stock
    const getRandomAlternative = (type: string): LegoPart | undefined => {
        const partsOfType = LEGO_PARTS[type as keyof typeof LEGO_PARTS] || [];
        const inStockParts = partsOfType.filter(p => !p.stock || p.stock > 0);
        if (inStockParts.length > 0) {
            return inStockParts[Math.floor(Math.random() * inStockParts.length)];
        }
        return undefined;
    };

    const newCharacters = config.characters.map(char => {
        const newChar = { ...char };
        const partTypes: (keyof LegoCharacterConfig)[] = ['hair', 'face', 'shirt', 'pants', 'set', 'hat'];
        
        partTypes.forEach(type => {
            const part = newChar[type] as LegoPart | undefined;
            if (part) {
                const refreshedPart = allParts[part.id];
                // If tracked and stock is exactly 0
                if (refreshedPart && refreshedPart.stock === 0) {
                    const alternative = getRandomAlternative(part.type);
                    if (alternative) {
                         (newChar as any)[type] = alternative;
                    }
                }
            }
        });
        return newChar;
    });

    const newDraggables = config.draggableItems.map(item => {
        const part = allParts[item.partId];
        if (part && part.stock === 0) {
            const alternative = getRandomAlternative(part.type);
            if (alternative) {
                return { ...item, partId: alternative.id };
            }
        }
        return item;
    });

    return {
        ...config,
        characters: newCharacters,
        draggableItems: newDraggables
    };
};
