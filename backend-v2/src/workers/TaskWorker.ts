import { TaskService } from './task/TaskService';
import { SocketManager } from '../services/SocketManager';
import { DatabaseDriver } from '../db/driver';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { worker: 'task-main' }
});

export class TaskWorker {
  private service: TaskService;
  private socket: SocketManager;
  private db: DatabaseDriver;

  constructor() {
    this.service = new TaskService();
    this.socket = SocketManager.getInstance();
    this.db = DatabaseDriver.getInstance();
  }

  public start(): void {
    logger.info('Starting Task Worker (Print/Convert/Extract)...');
    
    // Listen for socket events
    const io = this.socket.getIO();
    if (io) {
        io.on('connection', (socket: any) => {
            // We could listen to specific namespace too
            socket.on('task:print', async (data: any) => {
                const { filePath, printer } = data;
                const success = await this.service.printDocument(filePath, printer);
                socket.emit('task:print:result', { success });
            });
        });
    }

    // Also poll DB queue if we implemented one (print_job)
    // this.pollQueue();
  }
}

