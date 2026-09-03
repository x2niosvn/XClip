import { clipboard, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseManager } from '../database/database';
import { classifyText, computeHash } from './classifier';
import { ClipboardItem } from '../../shared/types';
import { logger } from '../logger';

export class ClipboardWatcher {
  private db: DatabaseManager;
  private dataDir: string;
  private localDeviceId: string;
  private localDeviceName: string;
  private intervalId: NodeJS.Timeout | null = null;
  private isPaused: boolean = false;
  private lastHash: string = '';
  private suppressedHashes: Set<string> = new Set();
  private onNewItemCallback?: (item: ClipboardItem) => void;
  private pollIntervalMs: number = 400;

  constructor(db: DatabaseManager, dataDir: string, localDeviceId: string, localDeviceName: string) {
    this.db = db;
    this.dataDir = dataDir;
    this.localDeviceId = localDeviceId;
    this.localDeviceName = localDeviceName;
  }

  public start(onNewItem?: (item: ClipboardItem) => void): void {
    this.onNewItemCallback = onNewItem;
    const settings = this.db.getSettings();
    this.isPaused = settings.isMonitoringPaused;

    // Seed initial lastHash with whatever is currently in clipboard to avoid initial duplicate on boot
    this.seedInitialState();

    this.intervalId = setInterval(() => {
      this.checkClipboard();
    }, this.pollIntervalMs);

    logger.info('Clipboard watcher started' + (this.isPaused ? ' (PAUSED)' : ''));
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Clipboard watcher stopped');
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.db.updateSettings({ isMonitoringPaused: paused });
    logger.info(`Clipboard watcher monitoring ${paused ? 'PAUSED' : 'RESUMED'}`);
  }

  public isMonitoringPaused(): boolean {
    return this.isPaused;
  }

  public suppressNextHash(hash: string): void {
    this.suppressedHashes.add(hash);
    // Cleanup after 3 seconds
    setTimeout(() => {
      this.suppressedHashes.delete(hash);
    }, 3000);
  }

  private seedInitialState(): void {
    try {
      const text = clipboard.readText();
      if (text) {
        this.lastHash = computeHash(text);
        return;
      }
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        const buffer = image.toPNG();
        this.lastHash = computeHash(buffer);
      }
    } catch {
      // Ignore initial seed errors
    }
  }

  private checkClipboard(): void {
    if (this.isPaused) return;

    try {
      // 1. Check for Image in clipboard first
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        this.processImage(image);
        return;
      }

      // 2. Check for Text / URL / Code / File paths
      const text = clipboard.readText();
      if (text && text.trim().length > 0) {
        this.processText(text);
        return;
      }
    } catch (err) {
      logger.error('Error during clipboard polling check', err);
    }
  }

  private processText(text: string): void {
    const hash = computeHash(text);

    if (hash === this.lastHash) return;

    if (this.suppressedHashes.has(hash)) {
      this.lastHash = hash;
      this.suppressedHashes.delete(hash);
      return;
    }

    this.lastHash = hash;

    const settings = this.db.getSettings();
    const classification = classifyText(text);

    // Heuristic password check
    if (settings.excludePasswords && classification.isPotentialPassword) {
      logger.info('Excluded potential password or secret token from clipboard history');
      return;
    }

    // Check if recent entry in DB has the same hash to prevent duplicates
    const recent = this.db.findRecentByHash(hash);
    if (recent) {
      // Update timestamp to bring it to top without creating duplicate row
      this.db.touchItem(recent.id);
      recent.updated_at = Date.now();
      if (this.onNewItemCallback) {
        this.onNewItemCallback(recent);
      }
      return;
    }

    const id = crypto.randomUUID();
    const item = this.db.insertItem({
      id,
      type: classification.type,
      content: text,
      preview: classification.preview,
      hash,
      language: classification.language,
      source_device_id: this.localDeviceId,
      source_device_name: this.localDeviceName,
      is_pinned: false,
    });

    if (settings.maxHistoryItems > 0) {
      this.db.enforceMaxItems(settings.maxHistoryItems);
    }

    if (this.onNewItemCallback) {
      this.onNewItemCallback(item);
    }
  }

  private processImage(image: Electron.NativeImage): void {
    const settings = this.db.getSettings();
    if (!settings.saveImages) return;

    const buffer = image.toPNG();
    const hash = computeHash(buffer);

    if (hash === this.lastHash) return;

    if (this.suppressedHashes.has(hash)) {
      this.lastHash = hash;
      this.suppressedHashes.delete(hash);
      return;
    }

    this.lastHash = hash;

    const recent = this.db.findRecentByHash(hash);
    if (recent) {
      this.db.touchItem(recent.id);
      recent.updated_at = Date.now();
      if (this.onNewItemCallback) {
        this.onNewItemCallback(recent);
      }
      return;
    }

    const id = crypto.randomUUID();
    const filename = `${id}.png`;
    const imagePath = path.join(this.dataDir, 'images', filename);

    try {
      fs.writeFileSync(imagePath, buffer);
      const size = image.getSize();

      const item = this.db.insertItem({
        id,
        type: 'IMAGE',
        content: imagePath,
        preview: `Image (${size.width} × ${size.height})`,
        hash,
        dimensions: { width: size.width, height: size.height },
        source_device_id: this.localDeviceId,
        source_device_name: this.localDeviceName,
        is_pinned: false,
      });

      if (settings.maxHistoryItems > 0) {
        this.db.enforceMaxItems(settings.maxHistoryItems);
      }

      if (this.onNewItemCallback) {
        this.onNewItemCallback(item);
      }
    } catch (err) {
      logger.error('Failed to save clipboard image to disk', err);
    }
  }

  public copyItemToSystem(item: ClipboardItem): boolean {
    try {
      if (item.type === 'IMAGE') {
        if (fs.existsSync(item.content)) {
          const nativeImg = nativeImage.createFromPath(item.content);
          const buf = nativeImg.toPNG();
          const hash = computeHash(buf);
          this.suppressNextHash(hash);
          clipboard.writeImage(nativeImg);
          this.lastHash = hash;
          return true;
        }
        return false;
      } else {
        const hash = computeHash(item.content);
        this.suppressNextHash(hash);
        clipboard.writeText(item.content);
        this.lastHash = hash;
        return true;
      }
    } catch (err) {
      logger.error('Failed to write item back to system clipboard', err);
      return false;
    }
  }
}
