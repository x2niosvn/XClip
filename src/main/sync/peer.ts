import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import crypto from 'crypto';
import { DatabaseManager } from '../database/database';
import { Device, ClipboardItem, SyncMessageEnvelope } from '../../shared/types';
import { generatePairingCode, generateRandomSecret, encryptPayload, decryptPayload } from './crypto';
import { logger } from '../logger';

export class PeerSyncEngine {
  private db: DatabaseManager;
  private localDeviceId: string;
  private localDeviceName: string;
  private localPort: number;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;

  // Active outgoing connections to paired peers: deviceId -> WebSocket
  private peerSockets: Map<string, WebSocket> = new Map();
  // Active incoming connections: socket -> deviceId
  private incomingSockets: Map<WebSocket, string> = new Map();

  // Active pairing sessions: deviceId -> session info
  private pendingPairings: Map<string, {
    code: string;
    secret: string;
    isInitiator: boolean;
    peerName: string;
    socket?: WebSocket;
  }> = new Map();

  // Processed message IDs to prevent loops
  private processedMessageIds: Set<string> = new Set();

  // Callbacks
  private onRemoteItemCallback?: (item: ClipboardItem) => void;
  private onPairingRequestCallback?: (data: { deviceId: string; deviceName: string; code: string }) => void;
  private onPairingCompleteCallback?: (data: { deviceId: string; deviceName: string; success: boolean }) => void;
  private onDevicesUpdatedCallback?: () => void;

  constructor(db: DatabaseManager, localDeviceId: string, localDeviceName: string, localPort: number) {
    this.db = db;
    this.localDeviceId = localDeviceId;
    this.localDeviceName = localDeviceName;
    this.localPort = localPort;
  }

  public start(callbacks: {
    onRemoteItem?: (item: ClipboardItem) => void;
    onPairingRequest?: (data: { deviceId: string; deviceName: string; code: string }) => void;
    onPairingComplete?: (data: { deviceId: string; deviceName: string; success: boolean }) => void;
    onDevicesUpdated?: () => void;
  }): void {
    this.onRemoteItemCallback = callbacks.onRemoteItem;
    this.onPairingRequestCallback = callbacks.onPairingRequest;
    this.onPairingCompleteCallback = callbacks.onPairingComplete;
    this.onDevicesUpdatedCallback = callbacks.onDevicesUpdated;

    try {
      this.server = http.createServer();
      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws: WebSocket, req) => {
        const clientIp = req.socket.remoteAddress || 'unknown';
        logger.info(`Incoming WebSocket connection from ${clientIp}`);

        ws.on('message', (raw: Buffer) => {
          this.handleIncomingMessage(ws, raw.toString('utf-8'));
        });

        ws.on('close', () => {
          const deviceId = this.incomingSockets.get(ws);
          if (deviceId) {
            this.incomingSockets.delete(ws);
            logger.warn(`Peer disconnected: ${deviceId}`);
            if (this.onDevicesUpdatedCallback) this.onDevicesUpdatedCallback();
          }
        });

        ws.on('error', (err) => {
          logger.error('Incoming WebSocket error', err);
        });
      });

      this.server.listen(this.localPort, '0.0.0.0', () => {
        logger.info(`P2P Sync Engine listening on port ${this.localPort}`);
      });

      // Connect to already paired devices from database
      this.connectToTrustedDevices();
    } catch (err) {
      logger.error('Failed to start P2P sync server', err);
    }
  }

  public stop(): void {
    try {
      for (const [_, ws] of this.peerSockets) {
        try { ws.close(); } catch {}
      }
      this.peerSockets.clear();

      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }
      if (this.server) {
        this.server.close();
        this.server = null;
      }
      logger.info('P2P Sync Engine stopped');
    } catch (err) {
      logger.error('Error stopping P2P sync engine', err);
    }
  }

  public connectToTrustedDevices(): void {
    const trusted = this.db.getTrustedDevices();
    for (const dev of trusted) {
      this.connectToPeer(dev);
    }
  }

  public connectToPeer(device: Device): void {
    if (this.peerSockets.has(device.id)) {
      const existing = this.peerSockets.get(device.id);
      if (existing && existing.readyState === WebSocket.OPEN) {
        return;
      }
    }

    try {
      const wsUrl = `ws://${device.ip}:${device.port}`;
      logger.info(`Connecting to paired peer: ${device.name} at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        this.peerSockets.set(device.id, ws);
        logger.info(`Peer connected: ${device.name} (${device.id})`);
        
        // Send heartbeat / identify
        const identifyMsg: SyncMessageEnvelope = {
          type: 'HEARTBEAT',
          message_id: crypto.randomUUID(),
          source_device_id: this.localDeviceId,
          source_device_name: this.localDeviceName,
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(identifyMsg));

        if (this.onDevicesUpdatedCallback) this.onDevicesUpdatedCallback();
      });

      ws.on('message', (raw: Buffer) => {
        this.handleIncomingMessage(ws, raw.toString('utf-8'));
      });

      ws.on('close', () => {
        this.peerSockets.delete(device.id);
        logger.warn(`Connection closed to peer: ${device.name}`);
        if (this.onDevicesUpdatedCallback) this.onDevicesUpdatedCallback();
      });

      ws.on('error', (err) => {
        // Peer may be offline
        logger.warn(`Could not connect to peer ${device.name}: ${err.message}`);
      });
    } catch (err) {
      logger.error(`Error connecting to peer ${device.name}`, err);
    }
  }

  // --- Pairing Flow ---

  public async initiatePairing(device: Device): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      const code = generatePairingCode();
      const secret = generateRandomSecret();

      const wsUrl = `ws://${device.ip}:${device.port}`;
      const ws = new WebSocket(wsUrl);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ success: false, error: 'Pairing request timed out' });
        }, 15000);

        ws.on('open', () => {
          this.pendingPairings.set(device.id, {
            code,
            secret,
            isInitiator: true,
            peerName: device.name,
            socket: ws,
          });

          const msg: SyncMessageEnvelope = {
            type: 'PAIR_REQUEST',
            message_id: crypto.randomUUID(),
            source_device_id: this.localDeviceId,
            source_device_name: this.localDeviceName,
            timestamp: Date.now(),
            plaintext: {
              code,
              secret,
            },
          };

          ws.send(JSON.stringify(msg));
          clearTimeout(timeout);
          resolve({ success: true, code });
        });

        ws.on('message', (raw: Buffer) => {
          this.handleIncomingMessage(ws, raw.toString('utf-8'));
        });

        ws.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ success: false, error: `Connection failed: ${err.message}` });
        });
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public confirmPairing(deviceId: string, enteredCode: string): boolean {
    const session = this.pendingPairings.get(deviceId);
    if (!session) {
      logger.warn(`Cannot confirm pairing: no session for device ${deviceId}`);
      return false;
    }

    const cleanEntered = enteredCode.replace(/\s+/g, '');
    const cleanExpected = session.code.replace(/\s+/g, '');

    if (cleanEntered !== cleanExpected) {
      logger.warn(`Pairing code mismatch for device ${deviceId}`);
      return false;
    }

    // Code matched! Send PAIR_ACCEPT
    if (session.socket && session.socket.readyState === WebSocket.OPEN) {
      const msg: SyncMessageEnvelope = {
        type: 'PAIR_ACCEPT',
        message_id: crypto.randomUUID(),
        source_device_id: this.localDeviceId,
        source_device_name: this.localDeviceName,
        timestamp: Date.now(),
      };
      session.socket.send(JSON.stringify(msg));
    }

    // Save device to trusted devices in SQLite
    this.db.saveDevice({
      id: deviceId,
      name: session.peerName,
      ip: '',
      port: 0,
      status: 'paired',
      shared_secret: session.secret,
      is_trusted: true,
      last_seen: Date.now(),
    });

    this.pendingPairings.delete(deviceId);
    logger.info(`Device paired successfully: ${session.peerName} (${deviceId})`);

    if (this.onPairingCompleteCallback) {
      this.onPairingCompleteCallback({ deviceId, deviceName: session.peerName, success: true });
    }
    if (this.onDevicesUpdatedCallback) {
      this.onDevicesUpdatedCallback();
    }

    return true;
  }

  public cancelPairing(deviceId: string): void {
    const session = this.pendingPairings.get(deviceId);
    if (session) {
      if (session.socket && session.socket.readyState === WebSocket.OPEN) {
        const msg: SyncMessageEnvelope = {
          type: 'PAIR_REJECT',
          message_id: crypto.randomUUID(),
          source_device_id: this.localDeviceId,
          source_device_name: this.localDeviceName,
          timestamp: Date.now(),
        };
        try { session.socket.send(JSON.stringify(msg)); } catch {}
      }
      this.pendingPairings.delete(deviceId);
    }
  }

  // --- Broadcast Clipboard Item to Paired Peers ---

  public broadcastClipboardItem(item: ClipboardItem): void {
    const settings = this.db.getSettings();
    if (!settings.lanSyncEnabled) return;

    if (item.type === 'IMAGE' && !settings.syncImages) return;
    if (item.type === 'FILE' && !settings.syncFiles) return;

    const trustedDevices = this.db.getTrustedDevices();
    if (trustedDevices.length === 0) return;

    const messageId = crypto.randomUUID();
    this.processedMessageIds.add(messageId);

    // Prepare serializable item payload
    const payload = {
      id: item.id,
      type: item.type,
      content: item.content,
      preview: item.preview,
      hash: item.hash,
      language: item.language,
      dimensions: item.dimensions,
      created_at: item.created_at,
      source_device_id: this.localDeviceId,
      source_device_name: this.localDeviceName,
    };

    for (const dev of trustedDevices) {
      if (!dev.shared_secret) continue;

      let ws = this.peerSockets.get(dev.id);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        // Try connecting
        this.connectToPeer(dev);
        ws = this.peerSockets.get(dev.id);
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          const encrypted = encryptPayload(payload, dev.shared_secret);
          const env: SyncMessageEnvelope = {
            type: 'CLIPBOARD_SYNC',
            message_id: messageId,
            source_device_id: this.localDeviceId,
            source_device_name: this.localDeviceName,
            timestamp: Date.now(),
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            auth_tag: encrypted.auth_tag,
          };
          ws.send(JSON.stringify(env));
        } catch (err) {
          logger.error(`Failed to encrypt and send clipboard item to ${dev.name}`, err);
        }
      }
    }
  }

  // --- Message Dispatcher ---

  private handleIncomingMessage(ws: WebSocket, raw: string): void {
    try {
      const msg = JSON.parse(raw) as SyncMessageEnvelope;

      if (!msg || !msg.type || !msg.message_id) return;

      // Duplicate message prevention
      if (this.processedMessageIds.has(msg.message_id)) return;
      this.processedMessageIds.add(msg.message_id);

      // Keep recent message ID set bounded
      if (this.processedMessageIds.size > 2000) {
        const arr = Array.from(this.processedMessageIds).slice(1000);
        this.processedMessageIds = new Set(arr);
      }

      switch (msg.type) {
        case 'HEARTBEAT':
          this.incomingSockets.set(ws, msg.source_device_id);
          break;

        case 'PAIR_REQUEST':
          this.handlePairRequest(ws, msg);
          break;

        case 'PAIR_ACCEPT':
          this.handlePairAccept(ws, msg);
          break;

        case 'PAIR_REJECT':
          this.handlePairReject(msg);
          break;

        case 'CLIPBOARD_SYNC':
          this.handleClipboardSync(msg);
          break;
      }
    } catch (err) {
      logger.error('Error handling incoming sync message', err);
    }
  }

  private handlePairRequest(ws: WebSocket, msg: SyncMessageEnvelope): void {
    logger.info(`Received PAIR_REQUEST from ${msg.source_device_name} (${msg.source_device_id})`);
    const { code, secret } = msg.plaintext || {};

    if (!code || !secret) {
      logger.warn('Invalid PAIR_REQUEST payload: missing code or secret');
      return;
    }

    this.pendingPairings.set(msg.source_device_id, {
      code,
      secret,
      isInitiator: false,
      peerName: msg.source_device_name,
      socket: ws,
    });

    if (this.onPairingRequestCallback) {
      this.onPairingRequestCallback({
        deviceId: msg.source_device_id,
        deviceName: msg.source_device_name,
        code,
      });
    }
  }

  private handlePairAccept(_ws: WebSocket, msg: SyncMessageEnvelope): void {
    logger.info(`Received PAIR_ACCEPT from ${msg.source_device_name} (${msg.source_device_id})`);
    const session = this.pendingPairings.get(msg.source_device_id);
    if (!session) return;

    // Initiator now finalizes pairing
    this.db.saveDevice({
      id: msg.source_device_id,
      name: msg.source_device_name,
      ip: '',
      port: 0,
      status: 'paired',
      shared_secret: session.secret,
      is_trusted: true,
      last_seen: Date.now(),
    });

    this.pendingPairings.delete(msg.source_device_id);

    if (this.onPairingCompleteCallback) {
      this.onPairingCompleteCallback({
        deviceId: msg.source_device_id,
        deviceName: msg.source_device_name,
        success: true,
      });
    }
    if (this.onDevicesUpdatedCallback) {
      this.onDevicesUpdatedCallback();
    }
  }

  private handlePairReject(msg: SyncMessageEnvelope): void {
    logger.warn(`Received PAIR_REJECT from ${msg.source_device_name} (${msg.source_device_id})`);
    this.pendingPairings.delete(msg.source_device_id);
    if (this.onPairingCompleteCallback) {
      this.onPairingCompleteCallback({
        deviceId: msg.source_device_id,
        deviceName: msg.source_device_name,
        success: false,
      });
    }
  }

  private handleClipboardSync(msg: SyncMessageEnvelope): void {
    const settings = this.db.getSettings();
    if (!settings.lanSyncEnabled) return;

    // Prevent echoing own device messages
    if (msg.source_device_id === this.localDeviceId) return;

    // Find trusted device and shared secret
    const trustedDevices = this.db.getTrustedDevices();
    const peer = trustedDevices.find((d) => d.id === msg.source_device_id);
    if (!peer || !peer.shared_secret) {
      logger.warn(`Rejected clipboard sync from untrusted or missing device: ${msg.source_device_id}`);
      return;
    }

    if (!msg.ciphertext || !msg.iv || !msg.auth_tag) {
      logger.warn('Corrupted clipboard sync message: missing ciphertext or crypto parameters');
      return;
    }

    try {
      const decrypted = decryptPayload(
        {
          ciphertext: msg.ciphertext,
          iv: msg.iv,
          auth_tag: msg.auth_tag,
        },
        peer.shared_secret
      );

      // Check type filters
      if (decrypted.type === 'IMAGE' && !settings.syncImages) return;
      if (decrypted.type === 'FILE' && !settings.syncFiles) return;

      // Check if duplicate already exists locally
      const existing = this.db.findRecentByHash(decrypted.hash);
      if (existing) {
        this.db.touchItem(existing.id);
        return;
      }

      // Insert item into local database
      const item = this.db.insertItem({
        id: decrypted.id || crypto.randomUUID(),
        type: decrypted.type,
        content: decrypted.content,
        preview: decrypted.preview,
        hash: decrypted.hash,
        language: decrypted.language,
        dimensions: decrypted.dimensions,
        source_device_id: decrypted.source_device_id || msg.source_device_id,
        source_device_name: decrypted.source_device_name || msg.source_device_name,
        is_pinned: false,
      });

      logger.info(`Received synced clipboard item (${item.type}) from ${msg.source_device_name}`);

      if (this.onRemoteItemCallback) {
        this.onRemoteItemCallback(item);
      }
    } catch (err) {
      logger.error('Failed to decrypt or parse remote clipboard payload', err);
    }
  }
}
