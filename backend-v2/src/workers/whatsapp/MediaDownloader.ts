import * as fs from 'fs-extra';
import * as path from 'path';
import { Message, MessageMedia } from 'whatsapp-web.js';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { DatabaseDriver } from '../../db/driver';
import { MediaConverter } from '../../services/MediaConverter';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'media-downloader' }
});

export class MediaDownloader {
  private db: DatabaseDriver;
  private baseDir: string;

  constructor() {
    this.db = DatabaseDriver.getInstance();
    this.baseDir = path.join(config.paths.inbox, 'whatsapp');
    fs.ensureDirSync(this.baseDir);
  }

  /**
   * Download media from a WhatsApp Message
   * @param message The WhatsApp message object
   * @param entityId The ID of the interaction this media belongs to
   */
  public async handleMedia(message: Message, entityId: string): Promise<void> {
    if (!message.hasMedia) return;

    try {
      const media: MessageMedia = await message.downloadMedia();
      if (!media) {
        logger.warn(`Failed to download media for message ${message.id.id}`);
        return;
      }

      // 1. Determine Paths
      // Structure: inbox/whatsapp/{senderNum}/{date}/{filename}
      const senderNum = message.from.replace(/\D/g, '');
      const dateFolder = new Date().toISOString().split('T')[0];
      const targetDir = path.join(this.baseDir, senderNum, dateFolder);
      await fs.ensureDir(targetDir);

      const ext = mime.extension(media.mimetype) || 'bin';
      const filename = media.filename || `${message.id.id}.${ext}`;
      const filePath = path.join(targetDir, filename);

      // 2. Write File
      await fs.writeFile(filePath, media.data, { encoding: 'base64' });
      const stats = await fs.stat(filePath);

      // 3. Register in entity_attachment (Polymorphic)
      await this.db.run(`
        INSERT INTO entity_attachment (
          id,
          entity_type,
          entity_id,
          file_name,
          file_path,
          mime_type,
          size,
          createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        uuidv4(),
        'interaction', // Link to the interaction
        entityId,
        filename,
        filePath,
        media.mimetype,
        stats.size
      ]);

      logger.info(`Saved media: ${filename} for interaction ${entityId}`);

      // 4. Auto-convert images to PDF if configured (Enterprise Feature)
      // This could be driven by Registry settings. For now, we leave it as an available option.
      /*
      if (media.mimetype.startsWith('image/')) {
        const pdfPath = filePath + '.pdf';
        await MediaConverter.getInstance().imageToPdf(filePath, pdfPath);
        // Register PDF as well or replace? Usually just keeping original is safer.
      }
      */

    } catch (error) {
      logger.error('Error handling media download', error);
    }
  }
}
