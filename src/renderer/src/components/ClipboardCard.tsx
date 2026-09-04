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
  ExternalLink,
} from 'lucide-react';
import { ClipboardItem } from '../../../shared/types';
import { formatTimeAgo } from '../utils/formatters';
import { translations } from '../i18n/translations';

interface ClipboardCardProps {
  item: ClipboardItem;
  isSelected: boolean;
  onSelect?: () => void;
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
  onSelect,
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

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'URL' && window.xclip?.openExternal) {
      window.xclip.openExternal(item.content);
    }
  };

  const isRemote = item.source_device_id && item.source_device_id !== localDeviceId;

  // Extract domain for URL
  const getDomain = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'link';
    }
  };

  // Badge by type
  const getTypeBadge = () => {
    switch (item.type) {
      case 'URL':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
            <LinkIcon className="w-3 h-3" /> URL
          </span>
        );
      case 'CODE':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-mono">
            <Code2 className="w-3 h-3" /> {item.language || 'Code'}
          </span>
        );
      case 'IMAGE':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
            <ImageIcon className="w-3 h-3" /> {t?.tabs?.images || 'Image'}
          </span>
        );
      case 'FILE':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
            <Folder className="w-3 h-3" /> {t?.tabs?.files || 'File'}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 rounded-md">
            <FileText className="w-3 h-3" /> {t?.tabs?.text || 'Text'}
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect?.()}
      className={`group relative flex flex-col p-3.5 rounded-xl transition-all duration-150 cursor-pointer overflow-hidden border ${
        isSelected
          ? 'bg-zinc-900/95 border-indigo-500/70 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
          : item.is_pinned
          ? 'bg-zinc-900/60 hover:bg-zinc-900/90 border-amber-500/25 hover:border-amber-500/40 shadow-sm'
          : 'bg-zinc-900/40 hover:bg-zinc-900/80 border-zinc-800/70 hover:border-zinc-700/80'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {getTypeBadge()}

          {item.is_pinned && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-md">
              <Pin className="w-2.5 h-2.5 fill-amber-300" />
              <span>{t?.pinned || 'Pinned'}</span>
            </span>
          )}

          {isRemote && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
              <Laptop className="w-2.5 h-2.5" />
              <span>{item.source_device_name || 'LAN Peer'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-mono tracking-tight">
            {formatTimeAgo(item.updated_at || item.created_at, (t as any)?._lang || 'vi')}
          </span>

          {/* Floating Actions on Hover / Selected */}
          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg bg-zinc-950/90 border border-zinc-800 shadow-md backdrop-blur-sm transition-all duration-150 ${
              isSelected || copied ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'
            }`}
          >
            {item.type === 'URL' && (
              <button
                onClick={handleOpenUrl}
                className="p-1 rounded-md hover:bg-sky-500/20 text-zinc-400 hover:text-sky-300 transition-colors"
                title="Open in browser / Mở trên trình duyệt"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleCopyClick}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium'
                  : 'bg-zinc-800/90 hover:bg-indigo-600 hover:text-white text-zinc-200 border border-zinc-700/60'
              }`}
              title={copied ? t?.copied || 'Copied' : t?.copy || 'Copy to clipboard'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-medium">{copied ? (t?.copied || 'Đã chép') : (t?.copy || 'Sao chép')}</span>
            </button>

            <button
              onClick={handlePinClick}
              className={`p-1 rounded-md transition-colors ${
                item.is_pinned
                  ? 'text-amber-400 bg-amber-500/15'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title={item.is_pinned ? t?.unpin || 'Unpin' : t?.pinToTop || 'Pin to top'}
            >
              <Pin className={`w-3.5 h-3.5 ${item.is_pinned ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              onClick={handlePreviewClick}
              className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={t?.preview || 'Preview full content'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleDeleteClick}
              className="p-1 rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
              title={t?.delete || 'Delete item'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Preview based on Type */}
      <div className="text-xs text-zinc-300 leading-relaxed font-normal">
        {item.type === 'IMAGE' ? (
          <div className="flex items-start gap-3 py-1">
            <div className="w-24 h-16 rounded-lg bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group/img">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Clipboard preview"
                  className="max-h-full max-w-full object-contain rounded transition-transform group-hover/img:scale-105 duration-200"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-zinc-600 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 font-medium truncate mb-1">
                {item.preview || 'Hình ảnh từ Clipboard'}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/50">PNG/JPG</span>
                <span>{item.char_count ? `${Math.round(item.char_count / 1024)} KB` : ''}</span>
              </div>
            </div>
          </div>
        ) : item.type === 'CODE' ? (
          <div className="rounded-lg bg-zinc-950/90 border border-zinc-800/70 p-2.5 overflow-hidden">
            <pre className="font-mono text-[11px] text-emerald-400/90 overflow-x-hidden line-clamp-3 leading-snug">
              {item.preview}
            </pre>
          </div>
        ) : item.type === 'URL' ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-sky-500/5 border border-sky-500/10 hover:bg-sky-500/10 transition-colors">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 uppercase font-semibold">
              {getDomain(item.content)}
            </span>
            <p className="text-sky-400 font-mono text-[11px] truncate flex-1 hover:underline">
              {item.content}
            </p>
          </div>
        ) : (
          <p className="line-clamp-2 text-zinc-200 text-xs leading-relaxed break-words font-normal">
            {item.preview}
          </p>
        )}
      </div>
    </div>
  );
};
