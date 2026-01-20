
import React from 'react';

interface LogoProps {
  url?: string;
  onClick?: () => void;
  className?: string;
  textClassName?: string;
}

/**
 * Logo component handles branding consistency.
 * If url is provided, it renders an image. 
 * Otherwise, it falls back to styled brand text.
 */
export const Logo: React.FC<LogoProps> = ({ 
  url, 
  onClick, 
  className = "h-10", 
  textClassName = "text-xl" 
}) => {
  const brandContent = url ? (
    <img 
      src={url} 
      alt="The Luvin" 
      className={`${className} object-contain transition-opacity duration-300`} 
    />
  ) : (
    <span className={`font-heading ${textClassName} font-bold text-primary tracking-tight`}>
      The Luvin
    </span>
  );

  return (
    <div 
      className={`inline-flex items-center ${onClick ? 'cursor-pointer' : ''}`} 
      onClick={onClick}
    >
      {brandContent}
    </div>
  );
};
