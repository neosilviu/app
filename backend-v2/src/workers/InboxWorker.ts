import { InboxManager } from './inbox/InboxManager';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { worker: 'inbox-main' }
});

export class InboxWorker {
  private manager: InboxManager;

  constructor() {
    this.manager = new InboxManager();
  }

  public async start(): Promise<void> {
    logger.info('Starting Inbox Worker...');
    await this.manager.start();
  }

  public stop(): void {
    logger.info('Stopping Inbox Worker...');
    this.manager.stop();
  }
}
