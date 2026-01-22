import { Client, LocalAuth } from 'whatsapp-web.js';
import { RegistryManager } from '../../core/registry';
import { DatabaseDriver } from '../../db/driver';
import { SocketManager } from '../../services/SocketManager';
import { QRHandler } from './QRHandler';
import { MessageHandler } from './MessageHandler';
import winston from 'winston';
import * as path from 'path';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'whatsapp-service' }
});

export class WhatsAppService {
  private client: Client;
  private qrHandler: QRHandler;
  private messageHandler: MessageHandler;
  private isReady: boolean = false;
  private isInitializing: boolean = false;
  private isDestroyed: boolean = false;
  
  constructor() {
    this.qrHandler = new QRHandler();
    this.messageHandler = new MessageHandler();
    
    // Initialize Client with LocalAuth for session persistence
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'studio-app-session',
        dataPath: path.join(__dirname, '../../../../whatsapp_session') // Adjust path to project root
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.setupListeners();
  }

  public async initialize(): Promise<void> {
    if (this.isInitializing || this.isReady) return;
    this.isInitializing = true;
    this.isDestroyed = false;
    
    logger.info('Initializing WhatsApp Client...');
    try {
      await this.client.initialize();
    } catch (error: any) {
      if (this.isDestroyed) {
        logger.warn('WhatsApp Client initialization was interrupted by destruction.');
      } else {
        logger.error('Failed to initialize WhatsApp Client', error);
      }
    } finally {
      this.isInitializing = false;
    }
  }

  public async destroy(): Promise<void> {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.isReady = false;
    
    logger.info('Destroying WhatsApp Client...');
    try {
      if (this.client) {
        // We catch errors here because if initialize() is still running,
        // destroy() might trigger race conditions in puppeteer
        await this.client.destroy().catch(e => {
            logger.warn('Caught expected error during WhatsApp client destruction:', e.message);
        });
      }
    } catch (e) {
      logger.error('Error destroying WhatsApp client', e);
    }
  }

  private setupListeners(): void {
    this.client.on('qr', (qr) => {
      logger.info('QR Code received');
      this.qrHandler.handle(qr);
    });

    this.client.on('ready', () => {
      logger.info('✅ WhatsApp Client is ready!');
      this.isReady = true;
      SocketManager.getInstance().emitToNamespace('/whatsapp', 'status', { status: 'ready' });
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp Authenticated');
      SocketManager.getInstance().emitToNamespace('/whatsapp', 'status', { status: 'authenticated' });
    });

    this.client.on('auth_failure', (msg) => {
      logger.error(`Authentication failure: ${msg}`);
      SocketManager.getInstance().emitToNamespace('/whatsapp', 'status', { status: 'auth_failure', error: msg });
    });

    this.client.on('message', async (msg) => {
      await this.handleIncomingMessage(msg);
    });
  }

  private async handleIncomingMessage(msg: any): Promise<void> {
    // 1. Log raw message
    logger.info(`Message from ${msg.from}: ${msg.body.substring(0, 50)}...`);
    
    // 2. Delegate to MessageHandler
    await this.messageHandler.handle(msg);
  }

  public async sendMessage(to: string, body: string): Promise<boolean> {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready');
    }
    try {
      await this.client.sendMessage(to, body);
      return true;
    } catch (error) {
      logger.error('Failed to send message', error);
      return false;
    }
  }
}
