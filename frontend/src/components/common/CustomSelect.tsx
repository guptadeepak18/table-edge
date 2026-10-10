import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption<T = string | number> {
  value: T;
  label: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
}

interface CustomSelectProps<T = string | number> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function CustomSelect<T = string | number>({
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  className = 'w-full',
  buttonClassName = '',
  menuClassName = '',
  disabled = false,
  size = 'md',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicked outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg min-h-[34px]',
    md: 'px-3.5 py-2 text-xs sm:text-sm rounded-xl min-h-[42px]',
    lg: 'px-4 py-2.5 text-sm rounded-xl min-h-[48px]',
  };

  return (
    <div ref={containerRef} className={`relative w-full block text-left ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 bg-[#0a120e] border border-white/15 hover:border-emerald-500/50 focus:border-[#00ff87] text-white font-medium shadow-sm transition cursor-pointer select-none outline-none disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses[size]} ${buttonClassName} ${
          isOpen ? 'border-[#00ff87] ring-1 ring-[#00ff87]/30 bg-[#0e1913]' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          {selectedOption ? (
            <>
              <span className="truncate text-white font-semibold">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${selectedOption.badgeColor || 'bg-emerald-950/60 text-[#00ff87] border border-emerald-500/30'}`}>
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400 font-normal truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#00ff87]' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-1.5 w-full max-h-[320px] overflow-y-auto z-50 bg-[#080f0b] border border-emerald-500/40 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.9)] p-1 text-left backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={String(opt.value)}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition select-none text-xs sm:text-sm ${
                  isSelected
                    ? 'bg-[#00ff87]/15 text-[#00ff87] font-bold'
                    : 'text-gray-200 hover:bg-white/[0.08] hover:text-white font-medium'
                }`}
              >
                <div className="flex flex-col pr-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate ${isSelected ? 'text-[#00ff87]' : 'text-gray-100'}`}>{opt.label}</span>
                    {opt.badge && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${opt.badgeColor || 'bg-emerald-950/60 text-[#00ff87] border border-emerald-500/30'}`}>
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <span className="text-[11px] text-gray-400 font-normal mt-0.5 leading-snug">
                      {opt.description}
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#00ff87] shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
