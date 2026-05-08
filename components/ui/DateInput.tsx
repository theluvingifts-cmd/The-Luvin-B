
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
  // Format YYYY-MM-DD to DD/MM/YYYY for display
  const getDisplayDate = (dateStr: string) => {
    if (!dateStr) return placeholder;
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-gray-700 block mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative group">
        <input 
          type="date" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
          style={{ appearance: 'none' }}
        />
        <div className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm flex justify-between items-center h-10 group-hover:border-gray-400 transition-colors">
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
