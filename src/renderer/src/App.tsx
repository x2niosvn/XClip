import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ClipboardItem, Device, AppSettings } from '../../shared/types';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { FilterBar, FilterCategory } from './components/FilterBar';
import { ClipboardList } from './components/ClipboardList';
import { DetailModal } from './components/DetailModal';
import { DevicesModal } from './components/DevicesModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { translations, Language } from './i18n/translations';

export const App: React.FC = () => {
  // --- States ---
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Hardware & Network states
  const [devices, setDevices] = useState<Device[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<Device[]>([]);
  const [localInfo, setLocalInfo] = useState<{ id: string; name: string; port: number }>({
    id: '',
    name: 'Windows-PC',
    port: 38721,
  });

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    language: 'vi',
    startWithWindows: false,
    minimizeToTray: true,
    globalShortcut: 'CommandOrControl+Shift+V',
    maxHistoryItems: 500,
    autoDeleteDays: 0,
    saveImages: true,
    saveFiles: false,
    lanSyncEnabled: true,
    syncImages: true,
    syncFiles: false,
    excludePasswords: true,
    clearOnExit: false,
    isMonitoringPaused: false,
    hasCompletedOnboarding: true,
  });
  const [isMonitoringPaused, setIsMonitoringPaused] = useState(false);

  // Current language and translations object
  const currentLang: Language = settings.language || 'vi';
  const t = useMemo(() => {
    const base = translations[currentLang] || translations.vi;
    return { ...base, _lang: currentLang };
  }, [currentLang]);

  // Modals
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ClipboardItem | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [incomingPairing, setIncomingPairing] = useState<{
    deviceId: string;
    deviceName: string;
    code: string;
  } | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'info' | 'success' | 'warning' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Initial Data Fetching ---
  const loadData = useCallback(async () => {
    if (!window.xclip) return;

    try {
      const [fetchedItems, fetchedSettings, fetchedDiscovered, fetchedTrusted, fetchedLocal] =
        await Promise.all([
          window.xclip.getItems(),
          window.xclip.getSettings(),
          window.xclip.getDiscoveredDevices(),
          window.xclip.getTrustedDevices(),
          window.xclip.getLocalDeviceInfo(),
        ]);

      setItems(fetchedItems || []);
      setSettings(fetchedSettings);
      setIsMonitoringPaused(fetchedSettings.isMonitoringPaused);
      setDevices(fetchedDiscovered || []);
      setTrustedDevices(fetchedTrusted || []);
      setLocalInfo(fetchedLocal);

      if (!fetchedSettings.hasCompletedOnboarding) {
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();

    if (!window.xclip) return;

    // Subscriptions
    const unsubClipboard = window.xclip.onClipboardChanged((newItem) => {
      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.id === newItem.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = newItem;
          return updated.sort((a, b) => (b.updated_at || b.created_at) - (a.updated_at || a.created_at));
        }
        return [newItem, ...prev];
      });
    });

    const unsubMonitoring = window.xclip.onMonitoringChanged((paused) => {
      setIsMonitoringPaused(paused);
    });

    const unsubDevices = window.xclip.onDevicesChanged((allDevices) => {
      setDevices(allDevices);
      window.xclip.getTrustedDevices().then(setTrustedDevices);
    });

    const unsubPairingReq = window.xclip.onPairingRequested((data) => {
      setIncomingPairing(data);
      setIsDevicesModalOpen(true);
    });

    const unsubPairingComp = window.xclip.onPairingCompleted((data) => {
      if (data.success) {
        addToast('success', `${t.toasts.devicePaired} (${data.deviceName})`);
        window.xclip.getTrustedDevices().then(setTrustedDevices);
      } else {
        addToast('error', `${t.toasts.pairingFailed}: ${data.deviceName}`);
      }
    });

    const unsubToast = window.xclip.onToast((data) => {
      addToast(data.type, data.message);
    });

    return () => {
      unsubClipboard();
      unsubMonitoring();
      unsubDevices();
      unsubPairingReq();
      unsubPairingComp();
      unsubToast();
    };
  }, [loadData, addToast, t]);

  // --- Filtering & Counters ---
  const counts = useMemo(() => {
    const res: Record<FilterCategory, number> = {
      ALL: items.length,
      PINNED: items.filter((i) => i.is_pinned).length,
      TEXT: items.filter((i) => i.type === 'TEXT').length,
      CODE: items.filter((i) => i.type === 'CODE').length,
      URL: items.filter((i) => i.type === 'URL').length,
      IMAGE: items.filter((i) => i.type === 'IMAGE').length,
      FILE: items.filter((i) => i.type === 'FILE').length,
    };
    return res;
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;

    // Filter by Category
    if (filterCategory === 'PINNED') {
      list = list.filter((i) => i.is_pinned);
    } else if (filterCategory !== 'ALL') {
      list = list.filter((i) => i.type === filterCategory);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.content.toLowerCase().includes(q) ||
          i.preview.toLowerCase().includes(q) ||
          (i.language && i.language.toLowerCase().includes(q)) ||
          (i.source_device_name && i.source_device_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [items, filterCategory, searchQuery]);

  // Reset keyboard selected index when filter or search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filterCategory, searchQuery]);

  // --- Actions ---
  const handleCopy = async (id: string) => {
    if (!window.xclip) return;
    const ok = await window.xclip.copyToClipboard(id);
    if (ok) {
      addToast('success', t.toasts.copied);
    }
  };

  const handleTogglePin = async (id: string) => {
    if (!window.xclip) return;
    await window.xclip.togglePin(id);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_pinned: !i.is_pinned } : i))
    );
  };

  const handleDelete = async (id: string) => {
    if (!window.xclip) return;
    await window.xclip.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    addToast('info', t.toasts.itemDeleted);
  };

  const handleClearHistory = async () => {
    if (!window.xclip) return false;
    const ok = await window.xclip.clearHistory();
    if (ok) {
      setItems((prev) => prev.filter((i) => i.is_pinned));
      addToast('info', t.toasts.historyCleared);
    }
    return ok;
  };

  const handleClearAllData = async () => {
    if (!window.xclip) return false;
    const ok = await window.xclip.clearAllData();
    if (ok) {
      setItems([]);
      setTrustedDevices([]);
      addToast('warning', t.toasts.allDataReset);
    }
    return ok;
  };

  const handleRemoveDevice = async (id: string) => {
    if (!window.xclip) return false;
    const ok = await window.xclip.removeDevice(id);
    if (ok) {
      setTrustedDevices((prev) => prev.filter((d) => d.id !== id));
      const [allDiscovered, allTrusted] = await Promise.all([
        window.xclip.getDiscoveredDevices(),
        window.xclip.getTrustedDevices(),
      ]);
      setDevices(allDiscovered || []);
      setTrustedDevices(allTrusted || []);
      addToast('info', (t.toasts as any).deviceRemoved || 'Device removed');
    }
    return ok;
  };

  const handleToggleMonitoring = async () => {
    if (!window.xclip) return;
    const next = await window.xclip.toggleMonitoring();
    setIsMonitoringPaused(next);
    addToast('info', next ? t.toasts.monitoringPaused : t.toasts.monitoringResumed);
  };

  const handleUpdateSettings = async (updates: Partial<AppSettings>) => {
    if (!window.xclip) return settings;
    const updated = await window.xclip.updateSettings(updates);
    setSettings(updated);
    return updated;
  };

  const handleToggleLang = async () => {
    const nextLang: Language = currentLang === 'vi' ? 'en' : 'vi';
    await handleUpdateSettings({ language: nextLang });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isOnboardingOpen || isDevicesModalOpen || isSettingsModalOpen || detailItem) {
      if (e.key === 'Escape') {
        setIsDevicesModalOpen(false);
        setIsSettingsModalOpen(false);
        setDetailItem(null);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleCopy(filteredItems[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (searchQuery) {
        setSearchQuery('');
      } else {
        window.xclip?.hideWindow();
      }
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden outline-none select-none"
    >
      {/* Top Header */}
      <Header
        devices={devices}
        isMonitoringPaused={isMonitoringPaused}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenDevices={() => setIsDevicesModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onMinimize={() => window.xclip?.minimizeWindow()}
        onClose={() => window.xclip?.closeWindow()}
        currentLang={currentLang}
        onToggleLang={handleToggleLang}
        t={t}
      />

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery('')}
        onKeyDown={handleKeyDown}
        placeholder={t.searchPlaceholder}
        navigateText={t.navigate}
      />

      {/* Filter Category Bar */}
      <FilterBar
        currentFilter={filterCategory}
        onSelectFilter={setFilterCategory}
        counts={counts}
        labels={{
          ALL: t.tabs.all,
          PINNED: t.tabs.pinned,
          TEXT: t.tabs.text,
          CODE: t.tabs.code,
          URL: t.tabs.links,
          IMAGE: t.tabs.images,
          FILE: t.tabs.files,
        }}
      />

      {/* Clipboard Items List */}
      <ClipboardList
        items={filteredItems}
        selectedIndex={selectedIndex}
        onSelectIndex={setSelectedIndex}
        onCopy={handleCopy}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
        onPreview={setDetailItem}
        localDeviceId={localInfo.id}
        t={t}
      />

      {/* Full Detail / Preview Modal */}
      <DetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onCopy={handleCopy}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
        localDeviceId={localInfo.id}
        t={t}
      />

      {/* Sync & Devices Modal */}
      <DevicesModal
        isOpen={isDevicesModalOpen}
        onClose={() => setIsDevicesModalOpen(false)}
        discoveredDevices={devices}
        trustedDevices={trustedDevices}
        localInfo={localInfo}
        onInitiatePairing={(id) => window.xclip.requestPairing(id)}
        onConfirmPairing={(id, code) => window.xclip.confirmPairing(id, code)}
        onCancelPairing={(id) => window.xclip.cancelPairing(id)}
        onRemoveDevice={handleRemoveDevice}
        incomingPairing={incomingPairing}
        onDismissIncomingPairing={() => setIncomingPairing(null)}
        t={t}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClearHistory={handleClearHistory}
        onClearAllData={handleClearAllData}
        trustedDevices={trustedDevices}
        t={t}
      />

      {/* First-Run Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={async ({ enableLanSync }) => {
          setIsOnboardingOpen(false);
          await handleUpdateSettings({
            hasCompletedOnboarding: true,
            lanSyncEnabled: enableLanSync,
          });
        }}
        t={t}
      />

      {/* Toast Feedback */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
