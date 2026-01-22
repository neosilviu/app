import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { exec, execSync } from 'child_process';
import winston from 'winston';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { RegistryManager } from '../core/registry';
import { WorkerManager } from '../core/WorkerManager';
import { DatabaseDriver } from '../db/driver';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'socket-manager' }
});

function formatDuration(seconds: number) {
    if (isNaN(seconds) || seconds < 0) return '0s';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);

    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export class SocketManager {
  private static instance: SocketManager;
  private io: Server | null = null;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public initialize(httpServer: HttpServer): void {
    if (this.io) return;

    this.io = new Server(httpServer, {
      path: '/api/socket.io',
      cors: {
        origin: (origin, callback) => {
          // Robust origin matching for Enterprise Level 8
          if (!origin || 
              origin.includes('aemdpc.ro') || 
              origin.includes('localhost') || 
              origin.includes('127.0.0.1') || 
              origin.includes('192.168.') || 
              origin.includes('10.0.') || 
              origin.includes('172.')) {
            callback(null, true);
          } else {
            console.warn(`[SOCKET-CORS-REJECT] Client Origin: ${origin}`);
            callback(null, false); 
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
      },
      allowEIO3: true,
      transports: ['websocket', 'polling']
    });

    this.setupNamespaces();
    
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Basic System Handlers
      socket.on('system:ping', (data, callback) => {
        if (typeof callback === 'function') callback({ success: true, timestamp: Date.now() });
      });

      socket.on('system:info', (data, callback) => {
        if (typeof callback === 'function') {
          callback({
            success: true,
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: {
              free: os.freemem(),
              total: os.totalmem()
            },
            uptime: os.uptime(),
            nodeVersion: process.version
          });
        }
      });

      socket.on('system:get-settings', async (data, callback) => {
        if (typeof callback === 'function') {
            try {
              const registry = RegistryManager.getInstance().get();
              callback({ success: true, settings: registry.system });
            } catch (e: any) {
              callback({ success: false, error: e.message });
            }
        }
      });

      socket.on('system:update-setting', async (data, callback) => {
        if (typeof callback === 'function') {
          const { key, value } = data;
          if (!key) return callback({ success: false, error: 'Key is required' });
          
          try {
            const success = await RegistryManager.getInstance().updateSetting(key, value);
            callback({ success });
            
            // Notify all clients that settings changed
            if (success) {
              this.io?.emit('system:settings-updated', { key, value });
              
              // Trigger worker refresh if it's a worker-related setting
              if (key === 'enable_workers' || key.startsWith('worker_') || key.startsWith('system.enable_workers')) {
                WorkerManager.getInstance().refreshState().catch(err => {
                  logger.error('Failed to refresh workers after setting update', err);
                });
              }
            }
          } catch (e: any) {
            callback({ success: false, error: e.message });
          }
        }
      });

      socket.on('workspace:update-settings', async (data, callback) => {
        if (typeof callback === 'function') {
          const { settings } = data;
          if (!settings) return callback({ success: false, error: 'Settings object is required' });

          try {
            const success = await RegistryManager.getInstance().updateSettings(settings);
            callback({ success });

            if (success) {
              this.io?.emit('system:settings-updated', { bulk: true });
              // Refresh workers if needed (always for bulk for safety)
              WorkerManager.getInstance().refreshState().catch(err => {
                logger.error('Failed to refresh workers after bulk update', err);
              });
            }
          } catch (e: any) {
            callback({ success: false, error: e.message });
          }
        }
      });

      socket.on('system:get-constants', async (data, callback) => {
        if (typeof callback === 'function') {
          try {
            const registry = RegistryManager.getInstance().get();
            callback({ success: true, constants: registry.constants });
          } catch (e: any) {
            callback({ success: false, error: e.message });
          }
        }
      });

      socket.on('system:detect-engines', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const registry = RegistryManager.getInstance().get();
        const engines: any = {
          libreoffice: { installed: false, path: null },
          microsoft: { installed: false, path: 'COM' }
        };

        try {
          if (process.platform === 'win32') {
            const commonPaths = [
              registry.system?.libreoffice_path,
              'C:\\Program file\\LibreOffice\\program\\soffice.exe',
              'C:\\Program file (x86)\\LibreOffice\\program\\soffice.exe'
            ].filter(Boolean);

            for (const p of commonPaths) {
              if (await fs.pathExists(p)) {
                engines.libreoffice.installed = true;
                engines.libreoffice.path = p;
                break;
              }
            }

            // Simple check for Microsoft Office via COM
            try {
              execSync('powershell -Command "New-Object -ComObject Word.Application" -ErrorAction Stop', { stdio: 'ignore', timeout: 3000 });
              engines.microsoft.installed = true;
            } catch (e) {}
          } else {
            try {
              execSync('libreoffice --version', { stdio: 'ignore' });
              engines.libreoffice.installed = true;
              engines.libreoffice.path = 'libreoffice';
            } catch (e) {}
          }
          callback({ success: true, engines });
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('system:test-engine', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { type } = data;
        const registry = RegistryManager.getInstance().get();

        try {
          if (type === 'libreoffice') {
            const cmd = registry.system?.libreoffice_path || (process.platform === 'win32' ? '"C:\\Program file\\LibreOffice\\program\\soffice.exe"' : 'libreoffice');
            // Add timeout to prevent hang
            exec(`"${cmd}" --version`, { timeout: 10000 }, (error, stdout) => {
                if (error) return callback({ success: false, error: `Eroare testare: ${error.message}` });
                callback({ success: true, message: `LibreOffice funcționează: ${stdout.trim()}` });
            });
          } else if (type === 'microsoft') {
            if (process.platform !== 'win32') return callback({ success: false, error: 'Microsoft Office COM is only for Windows' });
            exec('powershell -Command "$word = New-Object -ComObject Word.Application; $word.Quit()"', { timeout: 10000 }, (error) => {
                if (error) return callback({ success: false, error: `Eroare testare Microsoft Office: ${error.message}` });
                callback({ success: true, message: 'Microsoft Office (Word COM) este gata de utilizare.' });
            });
          } else {
            callback({ success: false, error: 'Motor necunoscut' });
          }
        } catch (e: any) {
          callback({ success: false, error: `Eroare testare: ${e.message}` });
        }
      });

      // --- DB Handlers (Bridge) ---
      socket.on('db:get', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { collection, id } = data;
        if (!collection || !id) return callback({ success: false, error: 'Collection and ID are required' });

        try {
          const db = DatabaseDriver.getInstance();
          const item = await db.getById(collection, id);
          callback({ success: true, data: item });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('db:list', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { collection, filters, options, page, pageSize } = data;
        if (!collection) return callback({ success: false, error: 'Collection is required' });

        try {
          const db = DatabaseDriver.getInstance();
          const mergedOptions = { ...options, page: page || options?.page, pageSize: pageSize || options?.pageSize };
          const items = await db.list(collection, filters || {}, mergedOptions);
          callback({ success: true, data: items || [] });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('db:save', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { collection, item } = data;
        const payload = item || data.data; // compatible with both formats
        if (!collection || !payload) return callback({ success: false, error: 'Collection and payload are required' });

        try {
            const db = DatabaseDriver.getInstance();
            const result = await db.save(collection, payload);
            callback({ success: true, id: result.id, data: result });
        } catch (e: any) {
            callback({ success: false, error: e.message });
        }
      });

      socket.on('db:create', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { collection, item, data: payload } = data;
        const itemToSave = item || payload;
        try {
          const db = DatabaseDriver.getInstance();
          const result = await db.save(collection, itemToSave);
          callback({ success: true, data: result });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('db:update', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { collection, id, item, data: payload } = data;
        const itemToSave = { ...(item || payload), id };
        try {
          const db = DatabaseDriver.getInstance();
          const result = await db.save(collection, itemToSave);
          callback({ success: true, data: result });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('db:delete', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { collection, id } = data;
        if (!collection || !id) return callback({ success: false, error: 'Collection and ID are required' });

        try {
          const db = DatabaseDriver.getInstance();
          await db.delete(collection, id);
          callback({ success: true });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('db:query', async (data, callback) => {
        if (typeof callback !== 'function') return;
        const { sql, params } = data;
        if (!sql) return callback({ success: false, error: 'SQL query is required' });

        try {
          const db = DatabaseDriver.getInstance();
          const results = await db.query(sql, params || []);
          callback({ success: true, data: results });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      // --- Monitoring Handlers ---
      socket.on('monitoring:local', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const stats = {
            env: process.env.NODE_ENV || 'development',
            cpu: {
              load: 'N/A', // Simplified for now
              brand: os.cpus()[0]?.model || 'Unknown CPU',
              cores: os.cpus().length
            },
            memory: {
              percentage: `${Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)}%`,
              used: `${Math.round((os.totalmem() - os.freemem())/1024/1024/1024*10)/10} GB`,
              total: `${Math.round(os.totalmem()/1024/1024/1024*10)/10} GB`
            },
            os: {
              uptime: formatDuration(os.uptime()),
              platform: os.platform(),
              distro: os.type(),
              arch: os.arch()
            },
            node: {
              version: process.version,
              memory: process.memoryUsage()
            }
          };
          callback({ success: true, data: stats });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('monitoring:db', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const db = DatabaseDriver.getInstance();
          const tablesRes = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
          const tableNames = tablesRes.map((r: any) => r.name);

          const tableData = await Promise.all(tableNames.map(async (table) => {
            try {
              const countRes = await db.get(`SELECT COUNT(*) as count FROM "${table}"`);
              
              // NEW: Get last 5 items for preview if requested
              let recent = [];
              if (data?.withRecent) {
                try {
                  recent = await db.query(`SELECT * FROM "${table}" ORDER BY id DESC LIMIT 5`);
                } catch (e) {
                  // Fallback if no 'id' column
                  recent = await db.query(`SELECT * FROM "${table}" LIMIT 5`);
                }
              }

              return { table, counts: { local: countRes.count, remote: 0 }, recent };
            } catch (e) {
              return { table, counts: { local: 0, remote: 0 } };
            }
          }));

          callback({
            success: true,
            data: {
              type: 'sqlite',
              path: 'local_db.sqlite',
              tables: tableData,
              size: 0, // Placeholder
              mode: 'local'
            }
          });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('monitoring:storage', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const registry = RegistryManager.getInstance().get();
          const inboxRelativePath = registry.system?.local_inbox_path || './local-inbox';
          const inboxPath = path.resolve(process.cwd(), inboxRelativePath);
          let file = 0;
          let size = 0;

          if (await fs.pathExists(inboxPath)) {
            const list = await fs.readdir(inboxPath);
            file = list.length;
            // Simple size sum for first level
            for (const f of list) {
              try {
                const s = await fs.stat(path.join(inboxPath, f));
                size += s.size;
              } catch(e) {}
            }
          }

          callback({
            success: true,
            data: {
              inbox: {
                path: inboxPath,
                file,
                size
              }
            }
          });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('monitoring:settings:get', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const registry = RegistryManager.getInstance().get();
          callback({
            success: true,
            data: {
              system: registry.system,
              constants: registry.constants
            }
          });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('monitoring:workers', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const statuses = WorkerManager.getInstance().getStatuses();
          const workerStatus: any = {};

          Object.entries(statuses).forEach(([name, status]) => {
            workerStatus[name] = {
              status,
              startTime: new Date().toISOString(), // Mock for now
              health: status === 'RUNNING' ? 'OK' : 'OFF'
            };
          });

          callback({
            success: true,
            data: {
              workerStatus,
              health: Object.values(statuses).some(s => s === 'RUNNING') ? 'HEALTHY' : 'IDLE'
            }
          });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('printing:get-config', async (data, callback) => {
        if (typeof callback === 'function') {
          try {
            const registry = RegistryManager.getInstance().get();
            const configDir = registry.system?.local_config_path || './backend/config';

            const printingConfigPath = path.join(process.cwd(), configDir, 'printing.json');
            let pConfig: any = {};
            if (fs.existsSync(printingConfigPath)) {
                pConfig = await fs.readJson(printingConfigPath);
            }

            callback({ success: true, config: pConfig });
          } catch (e: any) {
            callback({ success: false, error: e.message });
          }
        }
      });

      // --- Inbox Handlers ---
      socket.on('inbox:list', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const db = DatabaseDriver.getInstance();
          const filters = data.filters || {};
          if (data.status) filters.status = data.status;
          
          const notification = await db.list('inbox_notification', filters, { 
            page: data.page || 1, 
            pageSize: data.pageSize || 50,
            sortBy: 'createdAt',
            sortOrder: 'DESC'
          });
          callback({ success: true, data: notification });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('inbox:get-file', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const db = DatabaseDriver.getInstance();
          const file = await db.list('entity_attachment', { entity_id: data.notificationId });
          callback({ success: true, data: file });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('inbox:update-status', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const { id, status } = data;
          const db = DatabaseDriver.getInstance();
          await db.run(`UPDATE "inbox_notification" SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
          callback({ success: true });
          // Broadcast to all clients
          if (this.io) this.io.emit('inbox:notification-updated', { id, status });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('inbox:delete', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const db = DatabaseDriver.getInstance();
          await db.delete('inbox_notification', data.id);
          callback({ success: true });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      // --- file Handlers ---
      socket.on('file:list', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const db = DatabaseDriver.getInstance();
          const query = data.query || '';
          const page = data.page || 1;
          const pageSize = data.pageSize || 100;
          
          let sql = `SELECT * FROM "entity_attachment" WHERE 1=1`;
          const params: any[] = [];
          
          if (query) {
            sql += ` AND (filename LIKE ? OR file_path LIKE ?)`;
            params.push(`%${query}%`, `%${query}%`);
          }
          
          sql += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
          params.push(pageSize, (page - 1) * pageSize);
          
          const items = await db.query(sql, params);
          callback({ success: true, data: items || [] });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('file:update-metadata', async (data, callback) => {
        if (typeof callback !== 'function') return;
        try {
          const db = DatabaseDriver.getInstance();
          const { fullPath, notes, contactId } = data;
          // Store metadata in a simple way or update an existing attachment record
          callback({ success: true, notes, contactId });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    logger.info('✅ Socket.IO initialized');
  }

  private setupNamespaces() {
    if (!this.io) return;

    // WhatsApp Namespace
    this.io.of('/whatsapp').on('connection', (socket) => {
      logger.info(`WhatsApp Client connected: ${socket.id}`);
      // Send initial status if needed
    });

    // Gmail Namespace
    this.io.of('/gmail').on('connection', (socket) => {
      logger.info(`Gmail Client connected: ${socket.id}`);
    });
  }

  /**
   * Emit a global event
   */
  public emit(event: string, data: any): void {
    if (!this.io) {
      logger.warn('Socket.IO not initialized, cannot emit');
      return;
    }
    this.io.emit(event, data);
  }

  /**
   * Emit to a specific namespace
   */
  public emitToNamespace(namespace: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.of(namespace).emit(event, data);
  }

  /**
   * Get IO instance
   */
  public getIO(): Server | null {
    return this.io;
  }
}

