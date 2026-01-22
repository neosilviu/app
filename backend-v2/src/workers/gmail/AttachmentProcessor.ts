import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import mime from 'mime-types';
import { DatabaseDriver } from '../../db/driver';
import { config } from '../../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'gmail-attachment-processor' }
});

export class AttachmentProcessor {
  private db: DatabaseDriver;
  private baseDir: string;

  constructor() {
    this.db = DatabaseDriver.getInstance();
    this.baseDir = path.join(config.paths.inbox, 'gmail');
    fs.ensureDirSync(this.baseDir);
  }

  public async processAttachments(gmail: any, messageId: string, parts: any[], entityId: string, senderEmail: string): Promise<void> {
    if (!parts || parts.length === 0) return;

    // Use current date for folder structure
    const dateFolder = new Date().toISOString().split('T')[0];
    const safeSender = senderEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const targetDir = path.join(this.baseDir, safeSender, dateFolder);
    await fs.ensureDir(targetDir);

    for (const part of parts) {
      if (part.filename && part.body && part.body.attachmentId) {
        try {
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId
          });

          const data = attachment.data.data;
          if (data) {
            const buffer = Buffer.from(data, 'base64');
            const filePath = path.join(targetDir, part.filename);
            
            await fs.writeFile(filePath, buffer);
            const stats = await fs.stat(filePath);

            // Register in entity_attachment
            await this.db.run(`
              INSERT INTO entity_attachment (
                id, entity_type, entity_id, file_name, file_path, mime_type, size, createdAt
              ) VALUES (?, 'interaction', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
              uuidv4(),
              entityId,
              part.filename,
              filePath,
              part.mimeType || mime.lookup(part.filename) || 'application/octet-stream',
              stats.size
            ]);

            logger.info(`Saved attachment: ${part.filename} (${stats.size} bytes)`);
          }
        } catch (error) {
          logger.error(`Failed to download attachment ${part.filename}`, error);
        }
      }
    }
  }
}
