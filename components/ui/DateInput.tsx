import React from 'react';

interface DateInputProps {
  value: string; // YYYY-MM-DD
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
  className = '',
  label,
  required,
  min
}) => {
  return (
    <div className={`relative flex flex-col ${className}`}>
      {label && (
        <label className="text-xs font-bold text-gray-700 uppercase mb-1.5 flex items-center">
          {label} {required && <span className="text-red-500 ml-0.5">*</span>}
          <span className="text-[10px] text-gray-400 font-normal ml-2 tracking-wider">
            (Ngày/Tháng/Năm)
          </span>
        </label>
      )}

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        required={required}
        aria-label={label || 'Chọn ngày'}
        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm h-11 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 outline-none transition-all font-medium cursor-pointer text-gray-700"
      />
    </div>
  );
};
