import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { logger } from '../logger';

export interface TrayCallbacks {
  onOpen: () => void;
  onShowHistory: () => void;
  onShowDevices: () => void;
  onShowSettings: () => void;
  onTogglePause: (paused: boolean) => void;
  onQuit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private callbacks: TrayCallbacks | null = null;
  private isPaused: boolean = false;

  public init(callbacks: TrayCallbacks, isInitiallyPaused: boolean = false): void {
    this.callbacks = callbacks;
    this.isPaused = isInitiallyPaused;

    try {
      const icon = this.createTrayIcon();
      this.tray = new Tray(icon);
      this.tray.setToolTip('XClip — Clipboard. Synced locally.');

      this.updateMenu();

      this.tray.on('click', () => {
        if (this.callbacks) {
          this.callbacks.onOpen();
        }
      });

      this.tray.on('double-click', () => {
        if (this.callbacks) {
          this.callbacks.onOpen();
        }
      });

      logger.info('System tray initialized');
    } catch (err) {
      logger.error('Failed to initialize system tray', err);
    }
  }

  public setMonitoringPaused(paused: boolean): void {
    this.isPaused = paused;
    this.updateMenu();
    if (this.tray) {
      this.tray.setToolTip(
        `XClip — Clipboard. Synced locally. ${paused ? '(Monitoring Paused)' : ''}`
      );
    }
  }

  private updateMenu(): void {
    if (!this.tray || !this.callbacks) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'XClip',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open XClip',
        click: () => this.callbacks?.onOpen(),
      },
      {
        label: 'Clipboard History',
        click: () => this.callbacks?.onShowHistory(),
      },
      {
        label: 'Sync Devices',
        click: () => this.callbacks?.onShowDevices(),
      },
      {
        label: 'Settings',
        click: () => this.callbacks?.onShowSettings(),
      },
      { type: 'separator' },
      {
        label: this.isPaused ? '▶ Resume Clipboard Monitoring' : '⏸ Pause Clipboard Monitoring',
        type: 'checkbox',
        checked: this.isPaused,
        click: () => {
          const next = !this.isPaused;
          this.setMonitoringPaused(next);
          this.callbacks?.onTogglePause(next);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit XClip',
        click: () => this.callbacks?.onQuit(),
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private createTrayIcon(): Electron.NativeImage {
    // Attempt to load from assets
    const assetIconPath = path.join(app.getAppPath(), 'assets', 'icon.png');
    try {
      const img = nativeImage.createFromPath(assetIconPath);
      if (!img.isEmpty()) {
        return img.resize({ width: 16, height: 16 });
      }
    } catch {}

    // Fallback: create a 16x16 crisp indigo icon using 1x1 base64 PNG data URL
    const icon16x16Base64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZklEQVR42mNkQAO/fzP8J4S/f//PIISVlaEw7AxcgY2N4T+yICtUCgRgbGSFMAyv3zD8x2cGvAAmhk8v4AohBvD5BbwABjGYYhAwbACmg/5jA9gMAwMDCyF70Zl4E7qR7AYMBiM/AwB45S5hQ/k3/wAAAABJRU5ErkJggg==';
    return nativeImage.createFromDataURL(icon16x16Base64);
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
