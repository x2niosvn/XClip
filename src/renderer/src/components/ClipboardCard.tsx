import React, { useState } from 'react';
import {
  Pin,
  FileText,
  Code2,
  Link as LinkIcon,
  Image as ImageIcon,
  Folder,
  Copy,
  Check,
  Trash2,
  Maximize2,
  Laptop,
} from 'lucide-react';
import { ClipboardItem } from '../../../shared/types';
import { formatTimeAgo } from '../utils/formatters';
import { translations } from '../i18n/translations';

interface ClipboardCardProps {
  item: ClipboardItem;
  isSelected: boolean;
  onCopy: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (item: ClipboardItem) => void;
  localDeviceId: string;
  t?: typeof translations['en'];
}

const imageCache = new Map<string, string>();

export const ClipboardCard: React.FC<ClipboardCardProps> = ({
  item,
  isSelected,
  onCopy,
  onTogglePin,
  onDelete,
  onPreview,
  localDeviceId,
  t,
}) => {
  const [copied, setCopied] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>(() => {
    if (item.type === 'IMAGE' && item.content) {
      return imageCache.get(item.content) || '';
    }
    return '';
  });

  React.useEffect(() => {
    let isMounted = true;
    if (item.type === 'IMAGE' && item.content) {
      if (imageCache.has(item.content)) {
        setImageSrc(imageCache.get(item.content)!);
        return;
      }
      window.xclip?.readImageDataUrl(item.content).then((dataUrl) => {
        if (isMounted && dataUrl) {
          imageCache.set(item.content, dataUrl);
          setImageSrc(dataUrl);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [item.type, item.content]);

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(item.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreview(item);
  };

  // Type icon & style helper
  const getTypeBadge = () => {
    switch (item.type) {
      case 'URL':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
            <LinkIcon className="w-3 h-3" /> URL
          </span>
        );
      case 'CODE':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
            <Code2 className="w-3 h-3" /> {item.language || 'Code'}
          </span>
        );
      case 'IMAGE':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
            <ImageIcon className="w-3 h-3" /> Image
          </span>
        );
      case 'FILE':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
            <Folder className="w-3 h-3" /> File
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 bg-zinc-800 border border-zinc-700/60 px-1.5 py-0.5 rounded">
            <FileText className="w-3 h-3" /> Text
          </span>
        );
    }
  };

  const isRemote = item.source_device_id && item.source_device_id !== localDeviceId;

  return (
    <div
      onClick={() => onCopy(item.id)}
      className={`group relative flex flex-col p-3 rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'bg-zinc-800/90 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
          : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80 hover:border-zinc-700/80'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          {getTypeBadge()}

          {item.is_pinned && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
              <Pin className="w-2.5 h-2.5 fill-amber-300" /> {t?.pinned || 'Pinned'}
            </span>
          )}

          {isRemote && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono">
              <Laptop className="w-2.5 h-2.5" />
              {item.source_device_name || 'LAN Peer'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500">
            {formatTimeAgo(item.updated_at || item.created_at, (t as any)?._lang || 'vi')}
          </span>

          {/* Action Buttons (visible on hover or when selected) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopyClick}
              className={`p-1 rounded transition-colors ${
                copied ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title={t?.copied || 'Copy to clipboard'}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handlePinClick}
              className={`p-1 rounded transition-colors ${
                item.is_pinned
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title={item.is_pinned ? t?.unpin || 'Unpin' : t?.pinToTop || 'Pin to top'}
            >
              <Pin className={`w-3.5 h-3.5 ${item.is_pinned ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              onClick={handlePreviewClick}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={t?.preview || 'Preview full content'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleDeleteClick}
              className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
              title={t?.delete || 'Delete item'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="text-xs text-zinc-300 leading-relaxed font-normal overflow-hidden break-words">
        {item.type === 'IMAGE' ? (
          <div className="flex items-center gap-3 py-1">
            <div className="w-16 h-12 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Clipboard preview"
                  className="max-h-full max-w-full object-contain rounded"
                />
              ) : (
                <ImageIcon className="w-5 h-5 text-zinc-600 animate-pulse" />
              )}
            </div>
            <div className="text-zinc-400 font-mono text-[11px]">
              {item.preview}
              {item.dimensions && (
                <span className="block text-zinc-500 text-[10px]">
                  {item.dimensions.width} × {item.dimensions.height} px
                </span>
              )}
            </div>
          </div>
        ) : item.type === 'CODE' ? (
          <pre className="font-mono text-[11px] text-zinc-300 bg-zinc-950/80 p-2 rounded border border-zinc-800/60 overflow-x-hidden whitespace-pre-wrap line-clamp-3">
            {item.preview}
          </pre>
        ) : item.type === 'URL' ? (
          <p className="text-cyan-400 hover:underline font-mono text-[11px] truncate">
            {item.content}
          </p>
        ) : (
          <p className="line-clamp-2 text-zinc-200">
            {item.preview}
          </p>
        )}
      </div>

      {/* Keyboard enter cue if selected */}
      {isSelected && (
        <div className="absolute right-3 bottom-2 flex items-center gap-1 text-[10px] text-indigo-400 font-mono">
          <kbd className="px-1 py-0.2 rounded bg-zinc-900 border border-indigo-500/50 text-indigo-300">↵</kbd>
          <span>{t?.copy || 'copy'}</span>
        </div>
      )}
    </div>
  );
};
