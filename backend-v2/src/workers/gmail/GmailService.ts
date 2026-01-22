import { google } from 'googleapis';
import { DatabaseDriver } from '../../db/driver';
import { RegistryManager } from '../../core/registry';
import { SocketManager } from '../../services/SocketManager';
import { AttachmentProcessor } from './AttachmentProcessor';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'gmail-service' }
});

export class GmailService {
  private db: DatabaseDriver;
  private socket: SocketManager;
  private attachmentProcessor: AttachmentProcessor;
  private oauth2Client: any;
  private isListening: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.db = DatabaseDriver.getInstance();
    this.socket = SocketManager.getInstance();
    this.attachmentProcessor = new AttachmentProcessor();
  }

  public async initialize(): Promise<void> {
    // 1. Load Credentials from DB/Registry
    // Assuming we store client_id/secret in registry (system settings)
    const registry = RegistryManager.getInstance().get();
    const system = registry.system as any;
    
    // Fallback or load from DB if not in registry
    // In V1 this was often in a checks file, here we try to be cleaner.
    // For now we assume they are passed via Env or System Settings
    const clientId = system.gmail_client_id || process.env.GMAIL_CLIENT_ID;
    const clientSecret = system.gmail_client_secret || process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = system.gmail_redirect_uri || 'http://localhost:3000/oauth2callback';

    if (!clientId || !clientSecret) {
      logger.warn('Gmail Credentials missing. Skipping initialization.');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // 2. Load Tokens
    // We assume a 'settings' table or similar where we stored the tokens JSON
    try {
      const tokenRow = await this.db.get("SELECT value FROM system_setting WHERE key = 'gmail_tokens'");
      if (tokenRow && tokenRow.value) {
        const tokens = JSON.parse(tokenRow.value);
        this.oauth2Client.setCredentials(tokens);
        logger.info('Gmail Credentials loaded.');
        this.startPolling();
      } else {
        logger.warn('Gmail Tokens not found. Auth required.');
        this.socket.emitToNamespace('/gmail', 'status', { status: 'needs_auth', authUrl: this.generateAuthUrl() });
      }
    } catch (e) {
      logger.error('Error loading Gmail tokens', e);
    }
  }

  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isListening = false;
    logger.info('Gmail Service Stopped');
  }

  private generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify']
    });
  }

  private startPolling() {
    if (this.isListening) return;
    this.isListening = true;
    
    logger.info('Starting Gmail Polling...');
    // Poll every 60s (or config)
    this.pollInterval = setInterval(() => this.checkNewEmails(), 60000);
    this.checkNewEmails(); // Initial check
  }

  private async checkNewEmails() {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      // Get 'INBOX' messages that are not 'TRAITE' (custom label) or just UNREAD
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread label:INBOX', 
        maxResults: 10
      });

      const messages = res.data.messages;
      if (messages && messages.length > 0) {
        logger.info(`Found ${messages.length} new emails.`);
        
        for (const msgStub of messages) {
          await this.processMessage(gmail, msgStub.id!);
        }
      }
    } catch (error) {
      logger.error('Error checking emails', error);
    }
  }

  private async processMessage(gmail: any, messageId: string) {
    try {
      const msg = await gmail.users.messages.get({ userId: 'me', id: messageId });
      const payload = msg.data.payload;
      if (!payload) return;

      const headers = payload.headers;
      const subject = headers?.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
      const from = headers?.find((h: any) => h.name === 'From')?.value || 'Unknown';
      const senderEmail = from.match(/<(.+)>/)?.[1] || from;

      // 1. Resolve Contact
      const contactId = await this.resolveContact(senderEmail, from);

      // 2. Extract Body (snippet for now, full body logic is complex with parts)
      const snippet = msg.data.snippet;

      // 3. Store Interaction
      const interactionId = uuidv4();
      await this.db.run(`
        INSERT INTO interaction (
          id, type, direction, channel_id, contact_id, status, content, metadata_json, createdAt
        ) VALUES (?, 'email', 'inbound', ?, ?, 'received', ?, ?, CURRENT_TIMESTAMP)
      `, [
        interactionId,
        senderEmail,
        contactId,
        snippet,
        JSON.stringify({ subject, messageId })
      ]);

      // 4. Process Attachments
      const parts = payload.parts || [];
      await this.attachmentProcessor.processAttachments(gmail, messageId, parts, interactionId, senderEmail);

      // 5. Mark as Read (Remove UNREAD label)
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { removeLabelIds: ['UNREAD'] }
      });

      logger.info(`Processed email from ${senderEmail}: ${subject}`);
      this.socket.emitToNamespace('/gmail', 'email-received', { subject, from });

    } catch (error) {
      logger.error(`Error processing message ${messageId}`, error);
    }
  }

  private async resolveContact(email: string, fullName: string): Promise<string> {
    const existing = await this.db.get('SELECT id FROM contact WHERE email = ?', [email]);
    if (existing) return existing.id;

    const newId = uuidv4();
    await this.db.run(`
      INSERT INTO contact (id, firstName, email, source, createdAt)
      VALUES (?, ?, ?, 'gmail_auto', CURRENT_TIMESTAMP)
    `, [newId, fullName, email]);
    
    return newId;
  }
}

