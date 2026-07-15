
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [isHovered, setIsHovered] = useState(false);

  const brandContent = url ? (
    <div className={`${className} flex items-center justify-center overflow-visible`}>
      <img 
        src={url} 
        alt="The Luvin" 
        style={{ height: '100%', width: 'auto', minWidth: '40px' }}
        className="object-contain transition-opacity duration-300" 
      />
    </div>
  ) : (
    <span className={`font-heading ${textClassName} font-bold text-primary tracking-tight`}>
      The Luvin
    </span>
  );

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div 
        className={`logo-truus inline-flex items-center ${onClick ? 'cursor-pointer' : ''}`} 
        onClick={onClick}
        whileHover={{
          rotate: [0, -8, 7, -6, 4, -2, 0],
          transition: {
            duration: 0.32,
            ease: "easeInOut"
          }
        }}
      >
        {brandContent}
      </motion.div>

      {/* "to home" badge matching the user's screenshot */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8, rotate: -5 }}
            animate={{ opacity: 1, y: -16, scale: 1, rotate: -3 }}
            exit={{ opacity: 0, y: 10, scale: 0.8, rotate: -5 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute -top-2 -right-8 z-50 bg-[#f4cbff] text-gray-900 text-[10px] md:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-md pointer-events-none whitespace-nowrap border border-pink-200/60"
            style={{ originX: 0, originY: 1 }}
          >
            to home
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

