import fs from 'fs';
import path from 'path';
import { app } from 'electron';

class Logger {
  private logFilePath: string = '';
  private initialized: boolean = false;

  public init(dataDir: string): void {
    try {
      const logsDir = path.join(dataDir, 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      this.logFilePath = path.join(logsDir, 'xclip.log');
      this.initialized = true;
      this.info('Logger initialized. Log path: ' + this.logFilePath);
    } catch (err) {
      console.error('Failed to initialize logger:', err);
    }
  }

  private write(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] ${message}\n`;

    if (level === 'ERROR') {
      console.error(formatted.trim());
    } else if (level === 'WARN') {
      console.warn(formatted.trim());
    } else {
      console.log(formatted.trim());
    }

    if (this.initialized && this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, formatted, 'utf-8');
      } catch {
        // Silently fallback if file write fails
      }
    }
  }

  public info(message: string): void {
    this.write('INFO', message);
  }

  public warn(message: string): void {
    this.write('WARN', message);
  }

  public error(message: string, error?: any): void {
    const errText = error ? ` - ${error.stack || error.message || error}` : '';
    this.write('ERROR', `${message}${errText}`);
  }
}

export const logger = new Logger();
