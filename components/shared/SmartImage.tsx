
import React, { useState, useEffect } from 'react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  disableTransition?: boolean;
}

/**
 * SmartImage handles loading states with a skeleton pulse,
 * smooth fade-in transitions, and error fallback logic.
 */
export const SmartImage: React.FC<SmartImageProps> = ({ 
  src, 
  alt, 
  className = "", 
  fallbackSrc = "https://placehold.co/400x500?text=Image+Not+Found",
  loading = "lazy",
  disableTransition = false,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
    setIsLoaded(false);
    setError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setError(true);
    if (fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  };

  if (disableTransition) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          {...props}
          src={currentSrc}
          alt={alt}
          loading={loading}
          onError={handleError}
          className={`w-full h-full object-contain ${className}`}
        />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      {/* Pulse Skeleton Overlay */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 animate-pulse">
          <svg 
            className="w-6 h-6 text-gray-200 animate-spin" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Actual Image with Enhanced Transitions */}
      <img
        {...props}
        src={currentSrc}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          w-full h-full object-contain transition-all duration-700 ease-out
          ${isLoaded 
            ? 'opacity-100 scale-100 blur-0 grayscale-0' 
            : 'opacity-0 scale-95 blur-sm grayscale-[0.5]'}
          ${className}
        `}
      />
    </div>
  );
};
