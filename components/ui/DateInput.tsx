
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
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState("");

  // Format YYYY-MM-DD to DD/MM/YYYY
  const formatToDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Sync local input with value prop
  React.useEffect(() => {
    if (value) {
      setInputValue(formatToDisplay(value));
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ""); // Keep only digits
    
    // Auto-insert slashes for DD/MM/YYYY
    if (val.length > 2 && val.length <= 4) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    } else if (val.length > 4) {
      val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4, 8)}`;
    }
    
    const finalVal = val.slice(0, 10);
    setInputValue(finalVal);

    // Sync with parent ISO format (YYYY-MM-DD)
    const parts = finalVal.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const iso = `${year}-${month}-${day}`;
      
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        onChange(iso);
      }
    }
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (hiddenInputRef.current) {
        if (typeof (hiddenInputRef.current as any).showPicker === 'function') {
          (hiddenInputRef.current as any).showPicker();
        } else {
          hiddenInputRef.current.focus();
        }
      }
    } catch (err) {
      console.warn('Native picker not supported', err);
    }
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {label && (
        <label className="text-xs font-bold text-gray-700 uppercase mb-1.5 flex items-center">
          {label} {required && <span className="text-red-500 ml-0.5">*</span>}
          <span className="text-[10px] text-gray-400 font-normal ml-2 tracking-wider">(Ngày/Tháng/Năm)</span>
        </label>
      )}
      <div className="relative group h-11 w-full">
        {/* Visible Text Input for Manual Entry */}
        <input 
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="VD: 01/06/2026"
          required={required}
          maxLength={10}
          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm h-11 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 outline-none transition-all pr-12 font-medium"
        />

        {/* Hidden Native Date Input triggered by icon */}
        <input 
          ref={hiddenInputRef}
          type="date" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          min={min}
          className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
        />

        {/* Calendar Icon Button - Triggers picker */}
        <button
          type="button"
          onClick={handleIconClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-900 group-hover:text-gray-600"
          title="Mở lịch chọn ngày"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
