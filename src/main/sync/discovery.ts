import { Bonjour, Service } from 'bonjour-service';
import os from 'os';
import { Device } from '../../shared/types';
import { logger } from '../logger';

export class DeviceDiscovery {
  private bonjour: Bonjour | null = null;
  private publishedService: Service | null = null;
  private localDeviceId: string;
  private localDeviceName: string;
  private localPort: number;
  private discoveredDevices: Map<string, Device> = new Map();
  private onDevicesUpdatedCallback?: (devices: Device[]) => void;

  constructor(localDeviceId: string, localDeviceName: string, localPort: number) {
    this.localDeviceId = localDeviceId;
    this.localDeviceName = localDeviceName;
    this.localPort = localPort;
  }

  public start(onDevicesUpdated?: (devices: Device[]) => void): void {
    this.onDevicesUpdatedCallback = onDevicesUpdated;

    try {
      this.bonjour = new Bonjour();

      // 1. Publish own service on LAN
      this.publishedService = this.bonjour.publish({
        name: `xclip-${this.localDeviceId.slice(0, 8)}`,
        type: 'xclip',
        port: this.localPort,
        txt: {
          deviceId: this.localDeviceId,
          deviceName: this.localDeviceName,
          version: '1.0.0',
        },
      });

      logger.info(`LAN discovery started. Advertising as ${this.localDeviceName} (${this.localDeviceId}) on port ${this.localPort}`);

      // 2. Browse for other XClip instances
      const browser = this.bonjour.find({ type: 'xclip' }, (service: any) => {
        this.handleServiceFound(service);
      });

      browser.on('down', (service: any) => {
        this.handleServiceDown(service);
      });
    } catch (err) {
      logger.error('Failed to start mDNS / Bonjour discovery', err);
    }
  }

  public stop(): void {
    try {
      if (this.publishedService) {
        this.publishedService.stop();
        this.publishedService = null;
      }
      if (this.bonjour) {
        this.bonjour.destroy();
        this.bonjour = null;
      }
      logger.info('LAN discovery stopped');
    } catch (err) {
      logger.error('Error stopping Bonjour discovery', err);
    }
  }

  private handleServiceFound(service: any): void {
    try {
      const txt = service.txt || {};
      const peerDeviceId = txt.deviceId || service.name;
      const peerDeviceName = txt.deviceName || service.name || 'Unknown XClip Device';

      // Ignore self
      if (peerDeviceId === this.localDeviceId) {
        return;
      }

      // Find suitable IPv4 address
      const ip = (service.addresses || []).find((addr: string) => addr.includes('.') && !addr.startsWith('127.')) || service.host || service.referer?.address || '127.0.0.1';
      const port = service.port || 38721;

      const device: Device = {
        id: peerDeviceId,
        name: peerDeviceName,
        ip,
        port,
        status: 'available',
        is_trusted: false,
        last_seen: Date.now(),
      };

      this.discoveredDevices.set(peerDeviceId, device);
      logger.info(`Device discovered: ${peerDeviceName} (${peerDeviceId}) at ${ip}:${port}`);

      if (this.onDevicesUpdatedCallback) {
        this.onDevicesUpdatedCallback(this.getDiscoveredDevices());
      }
    } catch (err) {
      logger.error('Error handling discovered service', err);
    }
  }

  private handleServiceDown(service: any): void {
    try {
      const txt = service.txt || {};
      const peerDeviceId = txt.deviceId || service.name;
      if (this.discoveredDevices.has(peerDeviceId)) {
        const dev = this.discoveredDevices.get(peerDeviceId)!;
        dev.status = 'disconnected';
        logger.info(`Device disconnected/offline: ${dev.name} (${dev.id})`);
        if (this.onDevicesUpdatedCallback) {
          this.onDevicesUpdatedCallback(this.getDiscoveredDevices());
        }
      }
    } catch (err) {
      logger.error('Error handling service down', err);
    }
  }

  public getDiscoveredDevices(): Device[] {
    return Array.from(this.discoveredDevices.values());
  }

  public getDeviceById(id: string): Device | undefined {
    return this.discoveredDevices.get(id);
  }

  public updateDeviceStatus(id: string, status: Device['status']): void {
    const dev = this.discoveredDevices.get(id);
    if (dev) {
      dev.status = status;
      if (this.onDevicesUpdatedCallback) {
        this.onDevicesUpdatedCallback(this.getDiscoveredDevices());
      }
    }
  }
}
