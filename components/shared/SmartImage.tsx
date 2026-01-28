
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
  const isBase64 = src?.startsWith('data:');
  const [isLoaded, setIsLoaded] = useState(isBase64);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
    setIsLoaded(isBase64);
    setError(false);
  }, [src, isBase64]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setError(true);
    if (fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  };

  // Local data doesn't need anonymous crossOrigin
  const imgProps: any = { ...props };
  if (!isBase64) {
      imgProps.crossOrigin = "anonymous";
  }

  if (disableTransition) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          {...imgProps}
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
      {/* Pulse Skeleton Overlay - Only for non-base64 or not loaded */}
      {!isLoaded && !error && !isBase64 && (
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
        {...imgProps}
        src={currentSrc}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          w-full h-full object-contain transition-opacity duration-500 ease-out
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          ${className}
        `}
      />
    </div>
  );
};
