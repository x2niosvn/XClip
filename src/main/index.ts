import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { logger } from './logger';
import { DatabaseManager } from './database/database';
import { ClipboardWatcher } from './clipboard/watcher';
import { DeviceDiscovery } from './sync/discovery';
import { PeerSyncEngine } from './sync/peer';
import { ShortcutManager } from './shortcuts/global';
import { TrayManager } from './tray/tray';
import { AppSettings, ClipboardItem } from '../shared/types';

// Parse CLI arguments for multi-instance support (e.g. testing on 1 PC)
const profileArg = process.argv.find((arg) => arg.startsWith('--profile='));
const profileName = profileArg ? profileArg.split('=')[1] : (process.env.XCLIP_PROFILE || '');

const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const customPort = portArg ? parseInt(portArg.split('=')[1], 10) : undefined;

if (profileName) {
  const customUserData = path.join(app.getPath('appData'), `xclip-${profileName}`);
  app.setPath('userData', customUserData);
}

// Enforce single instance per profile
const gotTheLock = profileName ? true : app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Core Services
const db = new DatabaseManager();
let watcher: ClipboardWatcher;
let discovery: DeviceDiscovery;
let peerSync: PeerSyncEngine;
const shortcuts = new ShortcutManager();
const tray = new TrayManager();

let localDeviceId: string = '';
let localDeviceName: string = '';
const localPort: number = customPort || (profileName ? 38722 : 38721);

async function bootstrap(): Promise<void> {
  // 1. Data Directory
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  logger.init(dataDir);
  logger.info('XClip starting up...');

  // 2. Database Init
  await db.init(dataDir);

  // 3. Identity Setup
  const baseHostname = os.hostname() || 'Windows-PC';
  localDeviceName = profileName ? `${baseHostname} (${profileName})` : baseHostname;
  const settings = db.getSettings();

  // Load or generate persistent device ID
  const rawDeviceId = db.getSettingRaw('localDeviceId');
  if (rawDeviceId) {
    try {
      localDeviceId = JSON.parse(rawDeviceId);
    } catch {
      localDeviceId = rawDeviceId;
    }
  } else {
    localDeviceId = `xclip-${crypto.randomBytes(4).toString('hex')}`;
    db.updateSettings({ localDeviceId });
  }

  logger.info(`XClip Identity: ${localDeviceName} (${localDeviceId})`);

  // 4. Clipboard Watcher
  watcher = new ClipboardWatcher(db, dataDir, localDeviceId, localDeviceName);

  // 5. Discovery & Sync
  discovery = new DeviceDiscovery(localDeviceId, localDeviceName, localPort);
  peerSync = new PeerSyncEngine(db, localDeviceId, localDeviceName, localPort);

  // 6. Create Main Window
  createMainWindow();

  // 7. Start Services
  startServices(settings);

  // 8. Auto-delete expired items on launch
  if (settings.autoDeleteDays > 0) {
    const purged = db.purgeOldItems(settings.autoDeleteDays);
    if (purged > 0) {
      logger.info(`Purged ${purged} old clipboard items (> ${settings.autoDeleteDays} days)`);
    }
  }

  // 9. Windows login item
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: settings.startWithWindows,
      openAsHidden: true,
    });
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 640,
    minWidth: 540,
    minHeight: 460,
    frame: false,
    show: false,
    backgroundColor: '#18181b',
    icon: path.join(app.getAppPath(), 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Forward renderer console logs and errors to main logger
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (message.includes('Electron Security Warning')) return;
    if (level >= 2) {
      logger.error(`[Renderer Error] ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error(`[Renderer Load Failed] ${errorCode}: ${errorDescription} (${validatedURL})`);
  });

  // Enable F12 DevTools toggle in development
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        mainWindow?.webContents.toggleDevTools();
      }
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      const settings = db.getSettings();
      if (settings.minimizeToTray) {
        e.preventDefault();
        mainWindow?.hide();
        return;
      }
    }
  });

  // Second instance launched -> show window
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function showAndFocusWindow(): void {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('focus-search');
}

function startServices(settings: AppSettings): void {
  // Start Watcher
  watcher.start((item: ClipboardItem) => {
    // Notify renderer
    mainWindow?.webContents.send('clipboard-changed', item);
    // Broadcast to LAN peers
    peerSync.broadcastClipboardItem(item);
  });

  // Start Discovery
  if (settings.lanSyncEnabled) {
    discovery.start((devices) => {
      mainWindow?.webContents.send('devices-changed', devices);
    });
  }

  // Start Peer Sync Engine
  peerSync.start({
    onRemoteItem: (item) => {
      mainWindow?.webContents.send('clipboard-changed', item);
    },
    onPairingRequest: (data) => {
      showAndFocusWindow();
      mainWindow?.webContents.send('pairing-requested', data);
      showNotification('Pairing Request', `${data.deviceName} wants to pair. Code: ${data.code}`);
    },
    onPairingComplete: (data) => {
      mainWindow?.webContents.send('pairing-completed', data);
      if (data.success) {
        showNotification('Device Paired', `${data.deviceName} is now trusted for local sync.`);
      }
    },
    onDevicesUpdated: () => {
      mainWindow?.webContents.send('devices-changed', discovery.getDiscoveredDevices());
    },
  });

  // Global Shortcut (Ctrl + Shift + V)
  const shortcutKey = settings.globalShortcut || 'CommandOrControl+Shift+V';
  shortcuts.register(shortcutKey, () => {
    if (mainWindow?.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      showAndFocusWindow();
    }
  });

  // Tray
  tray.init(
    {
      onOpen: () => showAndFocusWindow(),
      onShowHistory: () => {
        showAndFocusWindow();
        mainWindow?.webContents.send('navigate-to', 'history');
      },
      onShowDevices: () => {
        showAndFocusWindow();
        mainWindow?.webContents.send('navigate-to', 'devices');
      },
      onShowSettings: () => {
        showAndFocusWindow();
        mainWindow?.webContents.send('navigate-to', 'settings');
      },
      onTogglePause: (paused) => {
        watcher.setPaused(paused);
        mainWindow?.webContents.send('monitoring-changed', paused);
      },
      onQuit: () => {
        quitApplication();
      },
    },
    settings.isMonitoringPaused
  );
}

function showNotification(title: string, body: string): void {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: `XClip — ${title}`, body }).show();
    }
  } catch {}
}

function quitApplication(): void {
  isQuitting = true;
  const settings = db.getSettings();
  if (settings.clearOnExit) {
    db.clearHistory();
  }
  watcher.stop();
  discovery.stop();
  peerSync.stop();
  shortcuts.unregisterAll();
  tray.destroy();
  db.close();
  app.quit();
}

// --- IPC Handlers ---

ipcMain.handle('get-items', async (_e, query?: string, type?: string, pinnedOnly?: boolean) => {
  return db.getItems(query, type, pinnedOnly);
});

ipcMain.handle('copy-to-clipboard', async (_e, id: string) => {
  const item = db.getItemById(id);
  if (!item) return false;
  return watcher.copyItemToSystem(item);
});

ipcMain.handle('toggle-pin', async (_e, id: string) => {
  return db.togglePin(id);
});

ipcMain.handle('delete-item', async (_e, id: string) => {
  return db.deleteItem(id);
});

ipcMain.handle('clear-history', async () => {
  return db.clearHistory();
});

ipcMain.handle('read-image-data-url', async (_e, filePath: string) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      const data = await fs.promises.readFile(filePath);
      return `data:image/png;base64,${data.toString('base64')}`;
    }
  } catch (err) {
    logger.error('Failed to read image data URL', err);
  }
  return null;
});

ipcMain.handle('open-external', async (_e, targetUrl: string) => {
  try {
    if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
      await shell.openExternal(targetUrl);
    }
  } catch (err) {
    logger.error('Failed to open external url', err);
  }
});

ipcMain.handle('toggle-monitoring', async (_e, paused?: boolean) => {
  const next = paused !== undefined ? paused : !watcher.isMonitoringPaused();
  watcher.setPaused(next);
  tray.setMonitoringPaused(next);
  mainWindow?.webContents.send('monitoring-changed', next);
  return next;
});

ipcMain.handle('get-monitoring-status', async () => {
  return watcher.isMonitoringPaused();
});

ipcMain.handle('get-discovered-devices', async () => {
  return discovery.getDiscoveredDevices();
});

ipcMain.handle('get-trusted-devices', async () => {
  return db.getTrustedDevices();
});

ipcMain.handle('request-pairing', async (_e, deviceId: string) => {
  const dev = discovery.getDeviceById(deviceId);
  if (!dev) return { success: false, error: 'Device not found' };
  return peerSync.initiatePairing(dev);
});

ipcMain.handle('confirm-pairing', async (_e, deviceId: string, code: string) => {
  return peerSync.confirmPairing(deviceId, code);
});

ipcMain.handle('cancel-pairing', async (_e, deviceId: string) => {
  peerSync.cancelPairing(deviceId);
  return true;
});

ipcMain.handle('remove-device', async (_e, deviceId: string) => {
  db.removeDevice(deviceId);
  discovery.updateDeviceStatus(deviceId, 'available');
  peerSync.disconnectPeer(deviceId);
  mainWindow?.webContents.send('devices-changed', discovery.getDiscoveredDevices());
  return true;
});

ipcMain.handle('get-local-device-info', async () => {
  return { id: localDeviceId, name: localDeviceName, port: localPort };
});

ipcMain.handle('get-settings', async () => {
  return db.getSettings();
});

ipcMain.handle('update-settings', async (_e, updates: Partial<AppSettings>) => {
  const updated = db.updateSettings(updates);

  if (updates.globalShortcut !== undefined) {
    shortcuts.register(updated.globalShortcut, () => {
      if (mainWindow?.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        showAndFocusWindow();
      }
    });
  }

  if (updates.startWithWindows !== undefined && app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: updated.startWithWindows,
      openAsHidden: true,
    });
  }

  return updated;
});

ipcMain.handle('clear-all-data', async () => {
  db.clearAllData();
  return true;
});

ipcMain.handle('hide-window', async () => {
  mainWindow?.hide();
});

ipcMain.handle('minimize-window', async () => {
  mainWindow?.minimize();
});

ipcMain.handle('close-window', async () => {
  const settings = db.getSettings();
  if (settings.minimizeToTray) {
    mainWindow?.hide();
  } else {
    quitApplication();
  }
});

// App Lifecycle
app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  const settings = db.getSettings();
  if (!settings.minimizeToTray || process.platform !== 'win32') {
    quitApplication();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
