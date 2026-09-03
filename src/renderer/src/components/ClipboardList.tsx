import React from 'react';
import { Pin, Clock, Inbox } from 'lucide-react';
import { ClipboardItem } from '../../../shared/types';
import { ClipboardCard } from './ClipboardCard';
import { translations } from '../i18n/translations';

interface ClipboardListProps {
  items: ClipboardItem[];
  selectedIndex: number;
  onCopy: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (item: ClipboardItem) => void;
  localDeviceId: string;
  t: typeof translations['en'];
}

export const ClipboardList: React.FC<ClipboardListProps> = ({
  items,
  selectedIndex,
  onCopy,
  onTogglePin,
  onDelete,
  onPreview,
  localDeviceId,
  t,
}) => {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-zinc-300 mb-1">{t.noItems}</p>
        <p className="text-xs text-zinc-500 max-w-xs">
          {t.noItemsDesc}
        </p>
      </div>
    );
  }

  const pinnedItems = items.filter((item) => item.is_pinned);
  const recentItems = items.filter((item) => !item.is_pinned);

  // Global index tracker for keyboard navigation
  let itemCounter = 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* PINNED SECTION */}
      {pinnedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-amber-400/90 mb-2 px-1">
            <Pin className="w-3 h-3 fill-amber-400" />
            <span>{t.pinnedSection} ({pinnedItems.length})</span>
          </div>

          <div className="space-y-2">
            {pinnedItems.map((item) => {
              const currentIdx = itemCounter++;
              const isSelected = currentIdx === selectedIndex;

              return (
                <ClipboardCard
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  onCopy={onCopy}
                  onTogglePin={onTogglePin}
                  onDelete={onDelete}
                  onPreview={onPreview}
                  localDeviceId={localDeviceId}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* RECENT SECTION */}
      {recentItems.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mb-2 px-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span>{t.recentSection} ({recentItems.length})</span>
          </div>

          <div className="space-y-2">
            {recentItems.map((item) => {
              const currentIdx = itemCounter++;
              const isSelected = currentIdx === selectedIndex;

              return (
                <ClipboardCard
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  onCopy={onCopy}
                  onTogglePin={onTogglePin}
                  onDelete={onDelete}
                  onPreview={onPreview}
                  localDeviceId={localDeviceId}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
