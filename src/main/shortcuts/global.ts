import { globalShortcut } from 'electron';
import { logger } from '../logger';

export class ShortcutManager {
  private currentShortcut: string = '';
  private onTriggerCallback?: () => void;

  public register(shortcut: string, onTrigger: () => void): boolean {
    this.onTriggerCallback = onTrigger;
    this.unregister();

    try {
      const success = globalShortcut.register(shortcut, () => {
        if (this.onTriggerCallback) {
          this.onTriggerCallback();
        }
      });

      if (success) {
        this.currentShortcut = shortcut;
        logger.info(`Registered global shortcut: ${shortcut}`);
        return true;
      } else {
        logger.warn(`Failed to register global shortcut: ${shortcut}`);
        return false;
      }
    } catch (err) {
      logger.error(`Error registering shortcut ${shortcut}`, err);
      return false;
    }
  }

  public unregister(): void {
    if (this.currentShortcut) {
      globalShortcut.unregister(this.currentShortcut);
      this.currentShortcut = '';
    }
  }

  public unregisterAll(): void {
    globalShortcut.unregisterAll();
  }
}
