import { GmailService } from './gmail/GmailService';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { worker: 'gmail-main' }
});

export class GmailWorker {
  private service: GmailService;

  constructor() {
    this.service = new GmailService();
  }

  public async start(): Promise<void> {
    logger.info('Starting Gmail Worker...');
    try {
      await this.service.initialize();
    } catch (err) {
      logger.error('Failed to start Gmail Worker', err);
    }
  }

  public stop(): void {
    logger.info('Stopping Gmail Worker...');
    this.service.stop();
  }
}
