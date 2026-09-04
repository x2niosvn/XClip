import React from 'react';
import { Settings, Laptop, Play, Pause, Minus, X, Languages } from 'lucide-react';
import { Device } from '../../../shared/types';
import { translations, Language } from '../i18n/translations';

interface HeaderProps {
  devices: Device[];
  isMonitoringPaused: boolean;
  onToggleMonitoring: () => void;
  onOpenDevices: () => void;
  onOpenSettings: () => void;
  onMinimize: () => void;
  onClose: () => void;
  currentLang: Language;
  onToggleLang: () => void;
  t: typeof translations['en'];
}

export const Header: React.FC<HeaderProps> = ({
  devices,
  isMonitoringPaused,
  onToggleMonitoring,
  onOpenDevices,
  onOpenSettings,
  onMinimize,
  onClose,
  currentLang,
  onToggleLang,
  t,
}) => {
  const pairedDevices = devices.filter((d) => d.status === 'paired' || d.is_trusted);
  const availableDevices = devices.filter((d) => d.status === 'available');
  const hasConnectedPeers = pairedDevices.length > 0;

  return (
    <header className="drag-region flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/90 select-none">
      {/* App Branding */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-glow shadow-indigo-500/25 border border-indigo-500/30 flex items-center justify-center bg-zinc-900 flex-shrink-0">
          <img src="/icon.png" alt="XClip Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-zinc-100 tracking-tight leading-none">{t.appTitle}</h1>
          </div>
          <p className="text-[11px] text-zinc-400 leading-none mt-0.5">{t.tagline}</p>
        </div>
      </div>

      {/* Middle Status Pill */}
      <div className="no-drag flex items-center gap-2">
        <button
          onClick={onOpenDevices}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 text-zinc-300"
          title={t.devicesAndSync}
        >
          {hasConnectedPeers ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle"></span>
              <span className="text-zinc-200">{t.lanConnected}</span>
              <span className="text-emerald-400 text-[10px] font-mono">({pairedDevices.length})</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full border border-zinc-500"></span>
              <span className="text-zinc-400">
                {availableDevices.length > 0 ? `${availableDevices.length} ${t.peersFound}` : t.noPairedDevices}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Control Actions */}
      <div className="no-drag flex items-center gap-1">
        {/* Quick Language Toggle */}
        <button
          onClick={onToggleLang}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors"
          title={currentLang === 'vi' ? 'Chuyển sang English' : 'Switch to Tiếng Việt'}
        >
          <Languages className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono uppercase font-bold text-[10px]">{currentLang}</span>
        </button>

        <button
          onClick={onToggleMonitoring}
          className="p-1.5 rounded-md hover:bg-zinc-800/80 transition-colors"
          title={isMonitoringPaused ? t.resumeMonitoring : t.pauseMonitoring}
        >
          <Pause
            className={`w-4 h-4 transition-colors ${
              isMonitoringPaused ? 'text-rose-500 fill-rose-500' : 'text-emerald-400 fill-emerald-400'
            }`}
          />
        </button>

        <button
          onClick={onOpenDevices}
          className="relative p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
          title={t.devicesAndSync}
        >
          <Laptop className="w-4 h-4" />
          {availableDevices.length > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
          title={t.settings}
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-zinc-800 mx-1"></div>

        <button
          onClick={onMinimize}
          className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
          title={t.minimize}
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition-colors"
          title={t.closeToTray}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
