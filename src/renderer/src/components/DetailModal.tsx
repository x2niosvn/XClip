import React, { useState } from 'react';
import { X, Copy, Check, Pin, Trash2, Calendar, HardDrive, Laptop } from 'lucide-react';
import { ClipboardItem } from '../../../shared/types';
import { formatTimeAgo } from '../utils/formatters';
import { translations } from '../i18n/translations';

interface DetailModalProps {
  item: ClipboardItem | null;
  onClose: () => void;
  onCopy: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  localDeviceId: string;
  t: typeof translations['en'];
}

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  onClose,
  onCopy,
  onTogglePin,
  onDelete,
  localDeviceId,
  t,
}) => {
  const [copied, setCopied] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    if (item && item.type === 'IMAGE' && item.content) {
      window.xclip?.readImageDataUrl(item.content).then((dataUrl) => {
        if (isMounted && dataUrl) {
          setImageSrc(dataUrl);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [item]);

  if (!item) return null;

  const handleCopy = () => {
    onCopy(item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isRemote = item.source_device_id && item.source_device_id !== localDeviceId;
  const wordCount = item.content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = item.content.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl glass-modal overflow-hidden animate-slide-up border border-zinc-700/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200">
              {item.type} {item.language ? `· ${item.language}` : ''}
            </span>
            {item.is_pinned && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                {t.pinned}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.copied : t.copy}</span>
            </button>

            <button
              onClick={() => onTogglePin(item.id)}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={item.is_pinned ? t.unpin : t.pinToTop}
            >
              <Pin className={`w-4 h-4 ${item.is_pinned ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            <button
              onClick={() => {
                onDelete(item.id);
                onClose();
              }}
              className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
              title={t.delete}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ml-2"
              title={t.closeToTray}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-sm">
          {item.type === 'IMAGE' ? (
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Full clipboard capture"
                  className="max-h-[50vh] max-w-full rounded object-contain shadow-lg"
                />
              ) : (
                <div className="h-40 flex items-center justify-center text-zinc-500 text-xs font-mono">
                  {t.loadingImage}
                </div>
              )}
              <div className="mt-3 text-xs text-zinc-400 font-mono">
                {item.dimensions?.width} × {item.dimensions?.height} px
              </div>
            </div>
          ) : item.type === 'CODE' ? (
            <pre className="font-mono text-xs text-zinc-200 bg-zinc-950 p-4 rounded-lg border border-zinc-800/80 overflow-x-auto whitespace-pre leading-relaxed select-text">
              {item.content}
            </pre>
          ) : item.type === 'URL' ? (
            <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
              <p className="text-cyan-400 font-mono break-all select-text">{item.content}</p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800/80 select-text whitespace-pre-wrap leading-relaxed text-zinc-200">
              {item.content}
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-zinc-950/80 border-t border-zinc-800/80 text-[11px] text-zinc-400 font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-zinc-500" />
              {formatTimeAgo(item.created_at, (t as any)?._lang || 'vi')}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-zinc-500" />
              {charCount} {t.charCount} {wordCount > 0 ? `· ${wordCount} ${t.wordCount}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Laptop className="w-3 h-3 text-zinc-500" />
            <span>{isRemote ? item.source_device_name || 'LAN Peer' : t.thisDevice}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
