import { WhatsAppService } from './whatsapp/WhatsAppService';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { worker: 'whatsapp-main' }
});

export class WhatsAppWorker {
  private service: WhatsAppService;

  constructor() {
    this.service = new WhatsAppService();
  }

  public async start(): Promise<void> {
    logger.info('Starting WhatsApp Worker...');
    try {
      await this.service.initialize();
    } catch (error) {
      logger.error('Fatal error starting WhatsApp Worker', error);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping WhatsApp Worker...');
    await this.service.destroy();
  }
}
