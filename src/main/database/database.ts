import path from 'path';
import fs from 'fs';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { ClipboardItem, Device, AppSettings } from '../../shared/types';
import { logger } from '../logger';

export class DatabaseManager {
  private db: SqlJsDatabase | null = null;
  private dataDir: string = '';
  private dbPath: string = '';
  private persistDebounceTimer: NodeJS.Timeout | null = null;

  public async init(dataDir: string): Promise<void> {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'database.sqlite');

    // Ensure parent directories exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const imagesDir = path.join(dataDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    const filesDir = path.join(dataDir, 'files');
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }

    try {
      const SQL = await initSqlJs();

      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
      }

      this.migrate();
      this.persistImmediate();
      logger.info('Database initialized at: ' + this.dbPath);
    } catch (err) {
      logger.error('Database error during initialization', err);
      throw err;
    }
  }

  private persistImmediate(): void {
    if (!this.db || !this.dbPath) return;
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    } catch (err) {
      logger.error('Failed to write database to disk', err);
    }
  }

  private schedulePersist(): void {
    if (this.persistDebounceTimer) return;
    this.persistDebounceTimer = setTimeout(() => {
      this.persistDebounceTimer = null;
      this.persistImmediate();
    }, 150);
  }

  public close(): void {
    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }
    if (this.db) {
      this.persistImmediate();
      try {
        this.db.close();
      } catch {}
      this.db = null;
    }
  }

  private migrate(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS clipboard_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        preview TEXT NOT NULL,
        hash TEXT NOT NULL,
        language TEXT,
        dimensions TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source_device_id TEXT NOT NULL,
        source_device_name TEXT,
        is_pinned INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_clipboard_created ON clipboard_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_clipboard_hash ON clipboard_items(hash);
      CREATE INDEX IF NOT EXISTS idx_clipboard_pinned ON clipboard_items(is_pinned);
      CREATE INDEX IF NOT EXISTS idx_clipboard_deleted ON clipboard_items(is_deleted);
      CREATE INDEX IF NOT EXISTS idx_clipboard_type ON clipboard_items(type);

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ip TEXT NOT NULL,
        port INTEGER NOT NULL,
        status TEXT NOT NULL,
        shared_secret TEXT,
        is_trusted INTEGER DEFAULT 0,
        last_seen INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  public insertItem(item: {
    id: string;
    type: ClipboardItem['type'];
    content: string;
    preview: string;
    hash: string;
    language?: string;
    dimensions?: { width: number; height: number };
    source_device_id: string;
    source_device_name?: string;
    is_pinned?: boolean;
  }): ClipboardItem {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const dimensionsStr = item.dimensions ? JSON.stringify(item.dimensions) : null;
    const isPinned = item.is_pinned ? 1 : 0;

    this.db.run(
      `INSERT INTO clipboard_items (
        id, type, content, preview, hash, language, dimensions,
        created_at, updated_at, source_device_id, source_device_name,
        is_pinned, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        item.id,
        item.type,
        item.content,
        item.preview,
        item.hash,
        item.language || null,
        dimensionsStr,
        now,
        now,
        item.source_device_id,
        item.source_device_name || null,
        isPinned,
      ]
    );

    this.schedulePersist();

    return {
      id: item.id,
      type: item.type,
      content: item.content,
      preview: item.preview,
      hash: item.hash,
      language: item.language,
      dimensions: item.dimensions,
      created_at: now,
      updated_at: now,
      source_device_id: item.source_device_id,
      source_device_name: item.source_device_name,
      is_pinned: !!item.is_pinned,
      is_deleted: false,
    };
  }

  public findRecentByHash(hash: string): ClipboardItem | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(
      'SELECT * FROM clipboard_items WHERE hash = ? AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1'
    );
    stmt.bind([hash]);

    let item: ClipboardItem | null = null;
    if (stmt.step()) {
      item = this.mapRowToItem(stmt.getAsObject());
    }
    stmt.free();
    return item;
  }

  public touchItem(id: string): void {
    if (!this.db) return;
    const now = Date.now();
    this.db.run('UPDATE clipboard_items SET updated_at = ? WHERE id = ?', [now, id]);
    this.schedulePersist();
  }

  public getItems(query?: string, type?: string, pinnedOnly?: boolean, limit: number = 100): ClipboardItem[] {
    if (!this.db) return [];

    let sql = 'SELECT * FROM clipboard_items WHERE is_deleted = 0';
    const params: any[] = [];

    if (pinnedOnly) {
      sql += ' AND is_pinned = 1';
    }

    if (type && type !== 'ALL') {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (query && query.trim()) {
      sql += ' AND (content LIKE ? OR preview LIKE ? OR language LIKE ?)';
      const term = `%${query.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const results: ClipboardItem[] = [];
    while (stmt.step()) {
      results.push(this.mapRowToItem(stmt.getAsObject()));
    }
    stmt.free();

    return results;
  }

  public getItemById(id: string): ClipboardItem | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM clipboard_items WHERE id = ?');
    stmt.bind([id]);

    let item: ClipboardItem | null = null;
    if (stmt.step()) {
      item = this.mapRowToItem(stmt.getAsObject());
    }
    stmt.free();
    return item;
  }

  public togglePin(id: string): boolean {
    if (!this.db) return false;
    const item = this.getItemById(id);
    if (!item) return false;
    const newPinned = item.is_pinned ? 0 : 1;
    this.db.run('UPDATE clipboard_items SET is_pinned = ? WHERE id = ?', [newPinned, id]);
    this.schedulePersist();
    return true;
  }

  public deleteItem(id: string): boolean {
    if (!this.db) return false;
    this.db.run('UPDATE clipboard_items SET is_deleted = 1 WHERE id = ?', [id]);
    this.schedulePersist();
    return true;
  }

  public clearHistory(): boolean {
    if (!this.db) return false;
    this.db.run('UPDATE clipboard_items SET is_deleted = 1 WHERE is_pinned = 0');
    this.schedulePersist();
    return true;
  }

  public purgeOldItems(days: number): number {
    if (!this.db || days <= 0) return 0;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    this.db.run('UPDATE clipboard_items SET is_deleted = 1 WHERE is_pinned = 0 AND updated_at < ?', [cutoff]);
    this.schedulePersist();
    return 1;
  }

  public enforceMaxItems(maxItems: number): void {
    if (!this.db || maxItems <= 0) return;
    this.db.run(
      `UPDATE clipboard_items
       SET is_deleted = 1
       WHERE id IN (
         SELECT id FROM clipboard_items
         WHERE is_pinned = 0 AND is_deleted = 0
         ORDER BY updated_at DESC
         LIMIT -1 OFFSET ?
       )`,
      [maxItems]
    );
    this.schedulePersist();
  }

  // Devices table
  public getTrustedDevices(): Device[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM devices WHERE is_trusted = 1');
    const rows: Device[] = [];

    while (stmt.step()) {
      const r: any = stmt.getAsObject();
      rows.push({
        id: r.id,
        name: r.name,
        ip: r.ip,
        port: Number(r.port),
        status: r.status,
        shared_secret: r.shared_secret,
        is_trusted: !!r.is_trusted,
        last_seen: Number(r.last_seen),
      });
    }
    stmt.free();
    return rows;
  }

  public saveDevice(device: Device): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO devices (id, name, ip, port, status, shared_secret, is_trusted, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         ip = excluded.ip,
         port = excluded.port,
         status = excluded.status,
         shared_secret = COALESCE(excluded.shared_secret, devices.shared_secret),
         is_trusted = excluded.is_trusted,
         last_seen = excluded.last_seen`,
      [
        device.id,
        device.name,
        device.ip,
        device.port,
        device.status,
        device.shared_secret || null,
        device.is_trusted ? 1 : 0,
        device.last_seen || Date.now(),
      ]
    );
    this.schedulePersist();
  }

  public removeDevice(deviceId: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM devices WHERE id = ?', [deviceId]);
    this.schedulePersist();
  }

  // Settings table
  public getSettings(): AppSettings {
    const defaultSettings: AppSettings = {
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
      hasCompletedOnboarding: false,
    };

    if (!this.db) return defaultSettings;

    const stmt = this.db.prepare('SELECT key, value FROM settings');
    const result: any = { ...defaultSettings };

    while (stmt.step()) {
      const row: any = stmt.getAsObject();
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    stmt.free();

    return result as AppSettings;
  }

  public getSettingRaw(key: string): string | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind([key]);
    let val: string | null = null;
    if (stmt.step()) {
      const r: any = stmt.getAsObject();
      val = r.value;
    }
    stmt.free();
    return val;
  }

  public updateSettings(updates: Partial<AppSettings> | Record<string, any>): AppSettings {
    if (!this.db) throw new Error('Database not initialized');

    for (const [k, v] of Object.entries(updates)) {
      this.db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [k, JSON.stringify(v)]
      );
    }

    this.schedulePersist();
    return this.getSettings();
  }

  public clearAllData(): void {
    if (!this.db) return;
    this.db.run('DELETE FROM clipboard_items; DELETE FROM devices;');
    this.schedulePersist();

    // Clean up images folder
    const imagesDir = path.join(this.dataDir, 'images');
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir);
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(imagesDir, f));
        } catch {}
      }
    }
  }

  private mapRowToItem(r: any): ClipboardItem {
    let dimensions: { width: number; height: number } | undefined;
    if (r.dimensions) {
      try {
        dimensions = JSON.parse(r.dimensions);
      } catch {}
    }

    return {
      id: r.id,
      type: r.type as ClipboardItem['type'],
      content: r.content,
      preview: r.preview,
      hash: r.hash,
      language: r.language || undefined,
      dimensions,
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
      source_device_id: r.source_device_id,
      source_device_name: r.source_device_name || undefined,
      is_pinned: !!Number(r.is_pinned),
      is_deleted: !!Number(r.is_deleted),
    };
  }
}
