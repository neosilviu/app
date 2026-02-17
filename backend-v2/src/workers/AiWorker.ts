import winston from 'winston';
import { DatabaseDriver } from '../db/driver';
import { RegistryManager } from '../core/registry';
import { AiService } from '../../../frontend/app/lib/services';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'ai-worker' }
});

export class AiWorker {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('🚀 Autonomous AI Worker started.');

    // Poll for pending AI tasks every 30 seconds
    this.interval = setInterval(() => this.pollAndExecute(), 30000);
    this.pollAndExecute(); // Run immediately on start
  }

  public stop() {
    this.isRunning = false;
    if (this.interval) clearInterval(this.interval);
    logger.info('🛑 Autonomous AI Worker stopped.');
  }

  private async pollAndExecute() {
    const db = DatabaseDriver.getInstance();
    const registry = RegistryManager.getInstance().get();

    try {
      // 1. Find pending AI tasks
      const tasks = await db.query<any>('SELECT * FROM ai_task WHERE status = ? LIMIT 1', ['pending']);
      if (tasks.length === 0) return;

      const task = tasks[0];
      logger.info(`[AI-AGENT] Found job: ${task.prompt}`);

      // 2. Mark as running
      await db.run('UPDATE ai_task SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', ['running', task.id]);

      // 3. Initialize AI Service
      const env = process.env;
      const ai = new AiService(env, { 
          ai_config: registry.AI_CONFIG || registry.AI_PROMPT || {},
          v3Entities: (global as any).AVAILABLE_V3_ENTITIES // We need to ensure these are avail on backend
      });

      // 4. Create Execution Context for the agent
      const ctx = {
          db: {
              get: (t: string, id: string) => db.getById(t, id),
              query: (sql: string, params: any[]) => db.query(sql, params),
              create: (t: string, d: any) => db.run(`INSERT INTO ${t} (id, createdAt) VALUES (?, ?)`, [d.id || crypto.randomUUID(), new Date().toISOString()]), // Simplified
              update: (t: string, id: string, d: any) => db.run(`UPDATE ${t} SET title = ? WHERE id = ?`, [d.title, id]) // Simplified
          },
          user: { id: 'ai-agent', workspaceId: 'system', name: 'Studio AI Agent' },
          registry,
          env,
          v3Entities: (global as any).AVAILABLE_V3_ENTITIES
      };

      // 5. Run Task
      const result = await ai.runTask(task.prompt, ctx, { maxIterations: 10 });

      // 6. Update task result
      await db.run('UPDATE ai_task SET status = ?, result = ?, iterations = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
          result.success ? 'completed' : 'failed',
          result.result || result.error,
          result.iterations || 0,
          task.id
      ]);

      logger.info(`[AI-AGENT] Job ${task.id} ${result.success ? 'completed' : 'failed'}`);
    } catch (err: any) {
      logger.error('[AI-AGENT] Execution error:', err);
    }
  }
}
