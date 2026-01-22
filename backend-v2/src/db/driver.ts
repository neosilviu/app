import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import crypto from 'crypto';
import { config } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: config.logLevel,
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'db-driver' }
});

export class DatabaseDriver {
  private db: Database | null = null;
  private static instance: DatabaseDriver;

  private constructor() {}

  public static getInstance(): DatabaseDriver {
    if (!DatabaseDriver.instance) {
      DatabaseDriver.instance = new DatabaseDriver();
    }
    return DatabaseDriver.instance;
  }

  /**
   * Connect to the SQLite database
   */
  public async connect(): Promise<void> {
    if (this.db) return;

    try {
      logger.info(`Connecting to database at ${config.dbPath}...`);
      this.db = await open({
        filename: config.dbPath,
        driver: sqlite3.Database
      });
      
      // Enable WAL mode for concurrency and performance on Windows
      await this.db.run('PRAGMA journal_mode = WAL;');
      await this.db.run('PRAGMA synchronous = NORMAL;');
      await this.db.run('PRAGMA busy_timeout = 3000;');
      await this.db.run('PRAGMA wal_autocheckpoint = 100;');
      await this.db.run('PRAGMA foreign_keys = ON;');
      
      logger.info('✅ Database connected and configured (WAL mode)');
    } catch (error) {
      logger.error('Database connection failed', error);
      throw error;
    }
  }

  /**   * Close the database connection
   */
  public async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('Database connection closed.');
    }
  }

  /**   * Get the raw database instance
   */
  public getDb(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Execute a query returning multiple rows
   */
  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.getDb().all<T[]>(sql, params);
  }

  /**
   * Execute a query returning a single row
   */
  public async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return this.getDb().get<T>(sql, params);
  }

  /**
   * Execute an INSERT/UPDATE/DELETE
   */
  public async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    const result = await this.getDb().run(sql, params);
    return { lastID: result.lastID, changes: result.changes };
  }

  /**
   * Execute multiple statements in a transaction
   */
  public async transaction(callback: (db: Database) => Promise<void>): Promise<void> {
    const db = this.getDb();
    await db.run('BEGIN TRANSACTION');
    try {
      await callback(db);
      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  // --- High-level CRUD Helpers (compatible with Legacy) ---
  
  public async list<T = any>(collection: string, filters: any = {}, options: any = {}): Promise<T[]> {
    let sql = `SELECT * FROM "${collection}"`;
    const params: any[] = [];
    const where: string[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        where.push(`"${key}" = ?`);
        params.push(value);
      }
    });

    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }

    if (options.sortBy) {
      sql += ` ORDER BY "${options.sortBy}" ${options.sortOrder || 'DESC'}`;
    } else {
        sql += ` ORDER BY createdAt DESC`;
    }

    if (options.pageSize) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(options.pageSize, ((options.page || 1) - 1) * options.pageSize);
    }

    return this.query<T>(sql, params);
  }

  public async getById<T = any>(collection: string, id: string): Promise<T | undefined> {
    return this.get<T>(`SELECT * FROM "${collection}" WHERE id = ?`, [id]);
  }

  public async save(collection: string, item: any): Promise<{ id: string }> {
    // Enterprise Level 8: Standardized UUID v4
    const id = item.id || (crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    const columns = Object.keys(item).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
    const values = columns.map(k => item[k]);

    if (item.id) {
      // Check if exists
      const existing = await this.getById(collection, item.id);
      if (existing) {
          const setClause = columns.map(c => `"${c}" = ?`).join(', ');
          await this.run(`UPDATE "${collection}" SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [...values, item.id]);
          return { id: item.id };
      }
    }

    // Insert
    const allCols = ['id', ...columns, 'createdAt', 'updatedAt'];
    const placeholders = allCols.map(() => '?').join(', ');
    const now = new Date().toISOString();
    await this.run(`INSERT INTO "${collection}" (${allCols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`, 
        [id, ...values, now, now]);
    
    return { id };
  }

  public async delete(collection: string, id: string): Promise<void> {
    await this.run(`DELETE FROM "${collection}" WHERE id = ?`, [id]);
  }
}
