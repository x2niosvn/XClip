import React, { useState } from 'react';
import {
  X,
  Sliders,
  Clock,
  Wifi,
  Shield,
  Info,
  Check,
  ExternalLink,
  Languages,
} from 'lucide-react';
import { AppSettings, Device } from '../../../shared/types';
import { translations } from '../i18n/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  onClearHistory: () => Promise<boolean>;
  onClearAllData: () => Promise<boolean>;
  trustedDevices: Device[];
  t: typeof translations['en'];
}

type TabType = 'general' | 'clipboard' | 'sync' | 'privacy' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
  onClearAllData,
  trustedDevices,
  t,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleToggle = async (key: keyof AppSettings, current: boolean) => {
    await onUpdateSettings({ [key]: !current });
    showSaveFeedback();
  };

  const handleValueChange = async (key: keyof AppSettings, value: any) => {
    await onUpdateSettings({ [key]: value });
    showSaveFeedback();
  };

  const showSaveFeedback = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1200);
  };

  const st = t.settingsModal;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: st.tabs.general, icon: <Sliders className="w-4 h-4" /> },
    { id: 'clipboard', label: st.tabs.clipboard, icon: <Clock className="w-4 h-4" /> },
    { id: 'sync', label: st.tabs.sync, icon: <Wifi className="w-4 h-4" /> },
    { id: 'privacy', label: st.tabs.privacy, icon: <Shield className="w-4 h-4" /> },
    { id: 'about', label: st.tabs.about, icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-xl h-[520px] rounded-xl glass-modal overflow-hidden animate-slide-up border border-zinc-700/60 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">{st.title}</h2>
            {saveSuccess && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 animate-fade-in">
                <Check className="w-3 h-3" /> {st.saved}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Layout: Sidebar Tabs + Content Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 border-r border-zinc-800 bg-zinc-950/40 p-2 space-y-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                  }`}
                >
                  <span className={active ? 'text-indigo-400' : 'text-zinc-500'}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 text-xs text-zinc-300 space-y-6">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-4 animate-fade-in">
                {/* Language Selector */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-indigo-400" />
                      {st.language}
                    </span>
                    <span className="text-[11px] text-zinc-500">{st.languageDesc}</span>
                  </div>
                  <select
                    value={settings.language || 'vi'}
                    onChange={(e) => handleValueChange('language', e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.startWithWindows}</span>
                    <span className="text-[11px] text-zinc-500">{st.startWithWindowsDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.startWithWindows}
                    onChange={() => handleToggle('startWithWindows', settings.startWithWindows)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.minimizeToTray}</span>
                    <span className="text-[11px] text-zinc-500">{st.minimizeToTrayDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.minimizeToTray}
                    onChange={() => handleToggle('minimizeToTray', settings.minimizeToTray)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-zinc-200 block">{st.globalShortcut}</span>
                      <span className="text-[11px] text-zinc-500">{st.globalShortcutDesc}</span>
                    </div>
                    <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-[11px]">
                      {settings.globalShortcut || 'Ctrl + Shift + V'}
                    </kbd>
                  </div>
                </div>
              </div>
            )}

            {/* CLIPBOARD TAB */}
            {activeTab === 'clipboard' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.maxHistoryItems}</span>
                    <span className="text-[11px] text-zinc-500">{st.maxHistoryItemsDesc}</span>
                  </div>
                  <select
                    value={settings.maxHistoryItems}
                    onChange={(e) => handleValueChange('maxHistoryItems', Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.autoDelete}</span>
                    <span className="text-[11px] text-zinc-500">{st.autoDeleteDesc}</span>
                  </div>
                  <select
                    value={settings.autoDeleteDays}
                    onChange={(e) => handleValueChange('autoDeleteDays', Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value={0}>{st.never}</option>
                    <option value={1}>{st.after24h}</option>
                    <option value={7}>{st.after7d}</option>
                    <option value={30}>{st.after30d}</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.saveImages}</span>
                    <span className="text-[11px] text-zinc-500">{st.saveImagesDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.saveImages}
                    onChange={() => handleToggle('saveImages', settings.saveImages)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.saveFiles}</span>
                    <span className="text-[11px] text-zinc-500">{st.saveFilesDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.saveFiles}
                    onChange={() => handleToggle('saveFiles', settings.saveFiles)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* SYNC TAB */}
            {activeTab === 'sync' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.lanSync}</span>
                    <span className="text-[11px] text-zinc-500">{st.lanSyncDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lanSyncEnabled}
                    onChange={() => handleToggle('lanSyncEnabled', settings.lanSyncEnabled)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.syncImages}</span>
                    <span className="text-[11px] text-zinc-500">{st.syncImagesDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.syncImages}
                    onChange={() => handleToggle('syncImages', settings.syncImages)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.syncFiles}</span>
                    <span className="text-[11px] text-zinc-500">{st.syncFilesDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.syncFiles}
                    onChange={() => handleToggle('syncFiles', settings.syncFiles)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.trustedDevices}</span>
                    <span className="text-[11px] text-zinc-500">{st.trustedDevicesDesc}</span>
                  </div>
                  <span className="font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                    {trustedDevices.length} {st.pairedCount}
                  </span>
                </div>
              </div>
            )}

            {/* PRIVACY TAB */}
            {activeTab === 'privacy' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.excludePasswords}</span>
                    <span className="text-[11px] text-zinc-500">
                      {st.excludePasswordsDesc}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.excludePasswords}
                    onChange={() => handleToggle('excludePasswords', settings.excludePasswords)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">{st.clearOnExit}</span>
                    <span className="text-[11px] text-zinc-500">{st.clearOnExitDesc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.clearOnExit}
                    onChange={() => handleToggle('clearOnExit', settings.clearOnExit)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="pt-2 space-y-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-zinc-200 block">{st.clearHistory}</span>
                      <span className="text-[11px] text-zinc-500">{st.clearHistoryDesc}</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm('Clear all unpinned clipboard items? / Xóa các mục chưa ghim?')) {
                          await onClearHistory();
                        }
                      }}
                      className="px-3 py-1 rounded bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-300 border border-zinc-700 transition-colors"
                    >
                      {st.clearHistoryBtn}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="font-medium text-red-400 block">{st.clearAllData}</span>
                      <span className="text-[11px] text-zinc-500">{st.clearAllDataDesc}</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure? This will wipe all clipboard items, stored images, and trusted device keys.')) {
                          await onClearAllData();
                        }
                      }}
                      className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors"
                    >
                      {st.resetAllBtn}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ABOUT TAB */}
            {activeTab === 'about' && (
              <div className="space-y-4 text-center py-4 animate-fade-in">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mx-auto shadow-glow shadow-indigo-500/25">
                  <span className="text-white font-bold text-lg">XC</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-zinc-100">{t.appTitle}</h3>
                  <p className="text-xs text-indigo-400 font-medium">{t.tagline}</p>
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono">Version 1.0.0 · Windows x64</p>
                </div>

                {/* Author Card */}
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-indigo-500/30 text-left space-y-2.5 max-w-sm mx-auto shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">{st.developer}</span>
                    <span className="text-xs font-semibold text-zinc-100">{st.authorName}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                    <span className="text-[11px] text-zinc-400">GitHub</span>
                    <button
                      onClick={() => window.xclip?.openExternal('https://github.com/x2niosvn')}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                    >
                      <span>x2niosvn (X2NIOS)</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-left text-zinc-400 space-y-2 max-w-sm mx-auto">
                  <p className="text-[11px] leading-relaxed">
                    {st.techStack}
                  </p>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{st.privacyGuarantee}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
