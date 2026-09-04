import React, { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  navigateText?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  onKeyDown,
  placeholder = 'Search clipboard...',
  navigateText = 'navigate',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus search bar on mount
    inputRef.current?.focus();

    // Listen for custom focus-search event from preload
    const handleFocusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener('focus-search', handleFocusSearch);
    return () => {
      window.removeEventListener('focus-search', handleFocusSearch);
    };
  }, []);

  return (
    <div className="relative flex items-center px-4 py-2.5 bg-zinc-950/60 border-b border-zinc-800/80">
      <Search className="w-4 h-4 text-zinc-500 absolute left-7 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full bg-zinc-900/80 text-zinc-100 placeholder-zinc-500 text-sm pl-9 pr-24 py-2 rounded-lg border border-zinc-800/80 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all"
      />

      {value && (
        <button
          onClick={onClear}
          className="absolute right-7 p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
