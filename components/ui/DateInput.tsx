
import React from 'react';

interface DateInputProps {
  value: string; // Expected format: YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
}

export const DateInput: React.FC<DateInputProps> = ({ 
  value, 
  onChange, 
  className = "", 
  label,
  placeholder = "Chọn ngày...",
  required,
  min 
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Format YYYY-MM-DD to DD/MM/YYYY for display
  const getDisplayDate = (dateStr: string) => {
    if (!dateStr) return placeholder;
    try {
      // Input date is always YYYY-MM-DD
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parts[2];
        const month = parts[1];
        const year = parts[0];
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // If the click is on the container but not on the input itself (though input is absolute)
    // we try to trigger the picker.
    try {
      if (inputRef.current) {
        if (typeof (inputRef.current as any).showPicker === 'function') {
          (inputRef.current as any).showPicker();
        } else {
          inputRef.current.focus();
        }
      }
    } catch (err) {
      console.warn('showPicker not supported', err);
    }
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-gray-700 block mb-1">
          {label} {required && <span className="text-red-500">*</span>}
          <span className="text-[10px] text-gray-400 font-normal ml-2">(Ngày/Tháng/Năm)</span>
        </label>
      )}
      <div 
        className="relative group cursor-pointer"
        onClick={handleContainerClick}
      >
        <input 
          ref={inputRef}
          type="date" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-30 block"
          style={{ 
            fontSize: '16px', // Precents zooming on iOS
            border: 'none',
            outline: 'none',
            background: 'transparent'
          }}
          onClick={(e) => e.stopPropagation()} // Let the native input handle its own click
        />
        <div className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm flex justify-between items-center h-10 group-hover:border-gray-400 transition-colors z-10 relative">
          <span className={value ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {getDisplayDate(value)}
          </span>
          <svg 
            className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
