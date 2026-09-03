export type ClipboardType = 'TEXT' | 'URL' | 'CODE' | 'IMAGE' | 'FILE';

export interface ClipboardItem {
  id: string;
  type: ClipboardType;
  content: string;
  preview: string;
  hash: string;
  language?: string;
  dimensions?: { width: number; height: number };
  created_at: number;
  updated_at: number;
  source_device_id: string;
  source_device_name?: string;
  is_pinned: boolean;
  is_deleted: boolean;
}

export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: 'available' | 'pairing' | 'paired' | 'disconnected';
  shared_secret?: string;
  is_trusted: boolean;
  last_seen: number;
}

export interface PairingSession {
  targetDeviceId: string;
  targetDeviceName: string;
  code: string;
  sharedSecret: string;
  isInitiator: boolean;
  timestamp: number;
}

export interface AppSettings {
  language: 'en' | 'vi';
  startWithWindows: boolean;
  minimizeToTray: boolean;
  globalShortcut: string;
  maxHistoryItems: number;
  autoDeleteDays: number; // 0 = never, 1, 7, 30
  saveImages: boolean;
  saveFiles: boolean;
  lanSyncEnabled: boolean;
  syncImages: boolean;
  syncFiles: boolean;
  excludePasswords: boolean;
  clearOnExit: boolean;
  isMonitoringPaused: boolean;
  hasCompletedOnboarding: boolean;
}

export interface SyncMessageEnvelope {
  type: 'PAIR_REQUEST' | 'PAIR_ACCEPT' | 'PAIR_REJECT' | 'CLIPBOARD_SYNC' | 'HEARTBEAT';
  message_id: string;
  source_device_id: string;
  source_device_name: string;
  timestamp: number;
  iv?: string;
  auth_tag?: string;
  ciphertext?: string;
  plaintext?: any;
}

export interface XClipAPI {
  // Clipboard
  getItems: (query?: string, type?: string, pinnedOnly?: boolean) => Promise<ClipboardItem[]>;
  copyToClipboard: (id: string) => Promise<boolean>;
  togglePin: (id: string) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;
  readImageDataUrl: (filePath: string) => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  
  // Monitoring
  toggleMonitoring: (paused?: boolean) => Promise<boolean>;
  getMonitoringStatus: () => Promise<boolean>;

  // Devices & Pairing
  getDiscoveredDevices: () => Promise<Device[]>;
  getTrustedDevices: () => Promise<Device[]>;
  requestPairing: (deviceId: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  confirmPairing: (deviceId: string, code: string) => Promise<boolean>;
  cancelPairing: (deviceId: string) => Promise<boolean>;
  removeDevice: (deviceId: string) => Promise<boolean>;
  getLocalDeviceInfo: () => Promise<{ id: string; name: string; port: number }>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  clearAllData: () => Promise<boolean>;

  // Window actions
  hideWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Events
  onClipboardChanged: (callback: (item: ClipboardItem) => void) => () => void;
  onMonitoringChanged: (callback: (paused: boolean) => void) => () => void;
  onDevicesChanged: (callback: (devices: Device[]) => void) => () => void;
  onPairingRequested: (callback: (data: { deviceId: string; deviceName: string; code: string }) => void) => () => void;
  onPairingCompleted: (callback: (data: { deviceId: string; deviceName: string; success: boolean }) => void) => () => void;
  onToast: (callback: (data: { type: 'info' | 'success' | 'warning' | 'error'; message: string }) => void) => () => void;
}

declare global {
  interface Window {
    xclip: XClipAPI;
  }
}
