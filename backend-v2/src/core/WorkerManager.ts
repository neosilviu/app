import winston from 'winston';
import { RegistryManager } from './registry';
import { WhatsAppWorker } from '../workers/WhatsAppWorker';
import { GmailWorker } from '../workers/GmailWorker';
import { InboxWorker } from '../workers/InboxWorker';
import { TaskWorker } from '../workers/TaskWorker';
import { AiWorker } from '../workers/AiWorker';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'worker-manager' }
});

export class WorkerManager {
  private static instance: WorkerManager;
  private whatsappWorker: WhatsAppWorker | null = null;
  private gmailWorker: GmailWorker | null = null;
  private inboxWorker: InboxWorker | null = null;
  private taskWorker: TaskWorker | null = null;
  private aiWorker: AiWorker | null = null;

  private constructor() {}

  public static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  public async refreshState(): Promise<void> {
    const instanceId = process.env.NODE_APP_INSTANCE ? parseInt(process.env.NODE_APP_INSTANCE, 10) : 0;
    const isPrimary = instanceId === 0;
    const registry = RegistryManager.getInstance();
    
    // Level 8: Check both singular and plural for backward compatibility
    const enableWorkers = registry.get('system.enable_worker') === true || registry.get('system.enable_workers') === true;
    
    logger.info(`Refreshing worker states (Enabled: ${enableWorkers}, Primary: ${isPrimary})`);

    // 1. Task Worker (Stateless/Event-based) - Runs on all if enabled
    if (enableWorkers) {
      if (!this.taskWorker) {
        this.taskWorker = new TaskWorker();
        this.taskWorker.start(); // This one is usually fire-and-forget but let's see
        logger.info('  - Task Worker started.');
      }
    } else {
      if (this.taskWorker) {
          this.taskWorker = null;
          logger.info('  - Task Worker disabled (needs restart to fully kill in this version).');
      }
    }

    // Stateful Workers only on Primary
    if (isPrimary) {
      // WhatsApp
      const waEnabled = enableWorkers && registry.get('system.worker_whatsapp_enabled') === true;
      if (waEnabled && !this.whatsappWorker) {
        this.whatsappWorker = new WhatsAppWorker();
        // Fire and forget but tracked in the service
        this.whatsappWorker.start().catch(err => logger.error('WA Start error', err));
        logger.info('  - WhatsApp Worker started.');
      } else if (!waEnabled && this.whatsappWorker) {
        await this.whatsappWorker.stop();
        this.whatsappWorker = null;
        logger.info('  - WhatsApp Worker stopped.');
      }

      // Gmail
      const gmailEnabled = enableWorkers && registry.get('system.worker_gmail_enabled') === true;
      if (gmailEnabled && !this.gmailWorker) {
        this.gmailWorker = new GmailWorker();
        this.gmailWorker.start().catch(err => logger.error('Gmail Start error', err));
        logger.info('  - Gmail Worker started.');
      } else if (!gmailEnabled && this.gmailWorker) {
        this.gmailWorker.stop();
        this.gmailWorker = null;
        logger.info('  - Gmail Worker stopped.');
      }

      // Inbox/Indexer
      const indexerEnabled = enableWorkers && registry.get('system.worker_indexer_enabled') === true;
      if (indexerEnabled && !this.inboxWorker) {
        this.inboxWorker = new InboxWorker();
        this.inboxWorker.start().catch(err => logger.error('Inbox Start error', err));
        logger.info('  - Inbox Worker started.');
      } else if (!indexerEnabled && this.inboxWorker) {
        this.inboxWorker.stop();
        this.inboxWorker = null;
        logger.info('  - Inbox Worker stopped.');
      }

      // AI Orchestrator (Full Control)
      const aiEnabled = enableWorkers && (registry.get('system.ai_agent_enabled') !== false);
      if (aiEnabled && !this.aiWorker) {
        this.aiWorker = new AiWorker();
        this.aiWorker.start().catch(err => logger.error('AI Worker Start error', err));
        logger.info('  - AI Autonomous Worker started.');
      } else if (!aiEnabled && this.aiWorker) {
        this.aiWorker.stop();
        this.aiWorker = null;
        logger.info('  - AI Autonomous Worker stopped.');
      }
    }
  }

  public getStatuses(): any {
    return {
      whatsapp: this.whatsappWorker ? 'RUNNING' : 'STOPPED',
      gmail: this.gmailWorker ? 'RUNNING' : 'STOPPED',
      inbox: this.inboxWorker ? 'RUNNING' : 'STOPPED',
      task: this.taskWorker ? 'RUNNING' : 'STOPPED',
      ai: this.aiWorker ? 'RUNNING' : 'STOPPED'
    };
  }
}
