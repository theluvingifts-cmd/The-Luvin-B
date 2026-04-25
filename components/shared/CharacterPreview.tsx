
import React from 'react';
import { LegoCharacterConfig } from '../../types';

interface CharacterPreviewProps {
    character: LegoCharacterConfig;
    hideHat?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const CharacterPreview: React.FC<CharacterPreviewProps> = ({ character, hideHat, size = 'md' }) => {
    const { shirt, pants, hair, face, set, hat } = character;
    const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
    const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
    const setImageUrl = character.selectedSetColor?.imageUrl || set?.imageUrl;
    const hairImageUrl = character.selectedHairColor?.imageUrl || hair?.imageUrl;
    const hatImageUrl = character.selectedHatColor?.imageUrl || hat?.imageUrl;
    const faceImageUrl = face?.imageUrl;

    const partStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none'
    };

    const sizeClasses = {
        sm: 'w-12 h-16',
        md: 'w-16 h-24',
        lg: 'w-24 h-36'
    };

    return (
        <div className={`relative ${sizeClasses[size]} bg-white rounded-lg shadow-sm border border-pink-100 p-1 flex items-center justify-center overflow-hidden flex-shrink-0`}>
            <div className="relative w-full h-full">
                {!set && pantsImageUrl && <img src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} referrerPolicy="no-referrer" />}
                {!set && shirtImageUrl && <img src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} referrerPolicy="no-referrer" />}
                {set && setImageUrl && <img src={setImageUrl} alt="set" style={{ ...partStyle, zIndex: 2 }} referrerPolicy="no-referrer" />}
                {faceImageUrl && <img src={faceImageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} referrerPolicy="no-referrer" />}
                {hairImageUrl && <img src={hairImageUrl} alt="hair" style={{ ...partStyle, zIndex: 4 }} referrerPolicy="no-referrer" />}
                {hatImageUrl && !hideHat && <img src={hatImageUrl} alt="hat" style={{ ...partStyle, zIndex: 5 }} referrerPolicy="no-referrer" />}
            </div>
        </div>
    );
};
