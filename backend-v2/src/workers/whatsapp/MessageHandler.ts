import { Message } from 'whatsapp-web.js';
import { DatabaseDriver } from '../../db/driver';
import { RegistryManager } from '../../core/registry';
import { SocketManager } from '../../services/SocketManager';
import { MediaDownloader } from './MediaDownloader';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'message-handler' }
});

export class MessageHandler {
  private db: DatabaseDriver;
  private registry: RegistryManager;
  private socket: SocketManager;
  private mediaDownloader: MediaDownloader;

  constructor() {
    this.db = DatabaseDriver.getInstance();
    this.registry = RegistryManager.getInstance();
    this.socket = SocketManager.getInstance();
    this.mediaDownloader = new MediaDownloader();
  }

  public async handle(msg: Message): Promise<void> {
    try {
      // 1. Resolve Contact (Upsert)
      const contactId = await this.resolveContact(msg);

      // 2. Create Interaction Record
      const interactionId = uuidv4();
      
      // Explicitly define values to avoid key-order issues with Object.values
      const type = 'whatsapp';
      const direction = 'inbound';
      const channel_id = msg.from;
      const status = 'received';
      const content = msg.body;
      const metadata_json = JSON.stringify({
          messageId: msg.id.id,
          timestamp: msg.timestamp,
          hasMedia: msg.hasMedia,
          senderName: (msg as any)._data?.notifyName || msg.from
      });
      const createdAt = new Date().toISOString();

      await this.db.run(`
        INSERT INTO interaction (id, type, direction, channel_id, contact_id, status, content, metadata_json, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [interactionId, type, direction, channel_id, contactId, status, content, metadata_json, createdAt]);

      logger.info(`Stored interaction ${interactionId} from ${msg.from}`);

      // 3. Handle Media
      if (msg.hasMedia) {
        await this.mediaDownloader.handleMedia(msg, interactionId);
      }

      // 4. Emit Event
      this.socket.emitToNamespace('/whatsapp', 'message-stored', {
        id: interactionId,
        type,
        direction,
        channel_id,
        contact_id: contactId,
        status,
        content,
        metadata_json,
        createdAt,
        contactName: (msg as any)._data?.notifyName
      });

      // 5. Trigger Auto-Responses / Flows (Future Phase)
      // verifyFlowState(interactionId)

    } catch (error) {
      logger.error('Failed to handle incoming message', error);
    }
  }

  /**
   * Find or Create Contact based on phone number
   */
  private async resolveContact(msg: Message): Promise<string> {
    const phoneNumber = msg.from.replace(/\D/g, '');
    
    // Check if exists
    const existing = await this.db.get('SELECT id FROM contact WHERE phone = ? OR phone_secondary = ?', [phoneNumber, phoneNumber]);
    
    if (existing) {
      return existing.id;
    }

    // Create new
    const newId = uuidv4();
    const name = (msg as any)._data?.notifyName || `WhatsApp User ${phoneNumber.substr(-4)}`;
    
    // Using fields defined in registry-baseline.ts for contact
    await this.db.run(`
      INSERT INTO contact (id, name, phone, createdAt)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [newId, name, phoneNumber]);

    return newId;
  }
}

