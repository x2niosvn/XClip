import React from 'react';
import { Pin, FileText, Code2, Link, Image as ImageIcon, Folder, Layers } from 'lucide-react';

export type FilterCategory = 'ALL' | 'PINNED' | 'TEXT' | 'CODE' | 'URL' | 'IMAGE' | 'FILE';

interface FilterBarProps {
  currentFilter: FilterCategory;
  onSelectFilter: (filter: FilterCategory) => void;
  counts: Record<FilterCategory, number>;
  labels?: Record<FilterCategory, string>;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  currentFilter,
  onSelectFilter,
  counts,
  labels,
}) => {
  const tabs: { id: FilterCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'ALL', label: labels?.ALL || 'All', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'PINNED', label: labels?.PINNED || 'Pinned', icon: <Pin className="w-3.5 h-3.5" /> },
    { id: 'TEXT', label: labels?.TEXT || 'Text', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'CODE', label: labels?.CODE || 'Code', icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: 'URL', label: labels?.URL || 'Links', icon: <Link className="w-3.5 h-3.5" /> },
    { id: 'IMAGE', label: labels?.IMAGE || 'Images', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: 'FILE', label: labels?.FILE || 'Files', icon: <Folder className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-800/60 bg-zinc-950/40 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = currentFilter === tab.id;
        const count = counts[tab.id] || 0;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectFilter(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            <span className={isActive ? 'text-indigo-400' : 'text-zinc-500'}>{tab.icon}</span>
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-900 text-zinc-500'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
