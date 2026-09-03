import { contextBridge, ipcRenderer } from 'electron';
import { XClipAPI, ClipboardItem, Device, AppSettings } from '../shared/types';

const api: XClipAPI = {
  // Clipboard
  getItems: (query?: string, type?: string, pinnedOnly?: boolean) => {
    return ipcRenderer.invoke('get-items', query, type, pinnedOnly);
  },
  copyToClipboard: (id: string) => {
    return ipcRenderer.invoke('copy-to-clipboard', id);
  },
  togglePin: (id: string) => {
    return ipcRenderer.invoke('toggle-pin', id);
  },
  deleteItem: (id: string) => {
    return ipcRenderer.invoke('delete-item', id);
  },
  clearHistory: () => {
    return ipcRenderer.invoke('clear-history');
  },
  readImageDataUrl: (filePath: string) => {
    return ipcRenderer.invoke('read-image-data-url', filePath);
  },
  openExternal: (url: string) => {
    return ipcRenderer.invoke('open-external', url);
  },

  // Monitoring
  toggleMonitoring: (paused?: boolean) => {
    return ipcRenderer.invoke('toggle-monitoring', paused);
  },
  getMonitoringStatus: () => {
    return ipcRenderer.invoke('get-monitoring-status');
  },

  // Devices & Pairing
  getDiscoveredDevices: () => {
    return ipcRenderer.invoke('get-discovered-devices');
  },
  getTrustedDevices: () => {
    return ipcRenderer.invoke('get-trusted-devices');
  },
  requestPairing: (deviceId: string) => {
    return ipcRenderer.invoke('request-pairing', deviceId);
  },
  confirmPairing: (deviceId: string, code: string) => {
    return ipcRenderer.invoke('confirm-pairing', deviceId, code);
  },
  cancelPairing: (deviceId: string) => {
    return ipcRenderer.invoke('cancel-pairing', deviceId);
  },
  removeDevice: (deviceId: string) => {
    return ipcRenderer.invoke('remove-device', deviceId);
  },
  getLocalDeviceInfo: () => {
    return ipcRenderer.invoke('get-local-device-info');
  },

  // Settings
  getSettings: () => {
    return ipcRenderer.invoke('get-settings');
  },
  updateSettings: (settings: Partial<AppSettings>) => {
    return ipcRenderer.invoke('update-settings', settings);
  },
  clearAllData: () => {
    return ipcRenderer.invoke('clear-all-data');
  },

  // Window actions
  hideWindow: () => {
    return ipcRenderer.invoke('hide-window');
  },
  minimizeWindow: () => {
    return ipcRenderer.invoke('minimize-window');
  },
  closeWindow: () => {
    return ipcRenderer.invoke('close-window');
  },

  // Events
  onClipboardChanged: (callback: (item: ClipboardItem) => void) => {
    const handler = (_: any, item: ClipboardItem) => callback(item);
    ipcRenderer.on('clipboard-changed', handler);
    return () => {
      ipcRenderer.removeListener('clipboard-changed', handler);
    };
  },

  onMonitoringChanged: (callback: (paused: boolean) => void) => {
    const handler = (_: any, paused: boolean) => callback(paused);
    ipcRenderer.on('monitoring-changed', handler);
    return () => {
      ipcRenderer.removeListener('monitoring-changed', handler);
    };
  },

  onDevicesChanged: (callback: (devices: Device[]) => void) => {
    const handler = (_: any, devices: Device[]) => callback(devices);
    ipcRenderer.on('devices-changed', handler);
    return () => {
      ipcRenderer.removeListener('devices-changed', handler);
    };
  },

  onPairingRequested: (callback: (data: { deviceId: string; deviceName: string; code: string }) => void) => {
    const handler = (_: any, data: { deviceId: string; deviceName: string; code: string }) => callback(data);
    ipcRenderer.on('pairing-requested', handler);
    return () => {
      ipcRenderer.removeListener('pairing-requested', handler);
    };
  },

  onPairingCompleted: (callback: (data: { deviceId: string; deviceName: string; success: boolean }) => void) => {
    const handler = (_: any, data: { deviceId: string; deviceName: string; success: boolean }) => callback(data);
    ipcRenderer.on('pairing-completed', handler);
    return () => {
      ipcRenderer.removeListener('pairing-completed', handler);
    };
  },

  onToast: (callback: (data: { type: 'info' | 'success' | 'warning' | 'error'; message: string }) => void) => {
    const handler = (_: any, data: { type: 'info' | 'success' | 'warning' | 'error'; message: string }) => callback(data);
    ipcRenderer.on('toast', handler);
    return () => {
      ipcRenderer.removeListener('toast', handler);
    };
  },
};

contextBridge.exposeInMainWorld('xclip', api);
