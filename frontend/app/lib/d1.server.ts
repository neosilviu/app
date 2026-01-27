/**
 * Cloudflare D1 Driver for React Router 7
 */

import { resolveCollection, getPrimaryKey } from "./data";
import { dbQueue } from "./db-queue.server";

async function executeWithRetry<T>(fn: () => Promise<T>, retry?: number, sqlForLog?: string, dbForCheckpoint?: any): Promise<T> {
  const isProd = typeof process === 'undefined' || process.env.NODE_ENV === 'production';
  const totalRetries = retry !== undefined ? retry : (isProd ? 3 : 15);
  const currentRetry = retry !== undefined ? retry : totalRetries;

  try {
    // Log the execution start for tracing (Only for WRITE operations or if DEBUG is enabled)
    const isWrite = /^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)/i.test(sqlForLog?.trim() || "");
    const shouldLog = isWrite || (typeof process !== 'undefined' && process.env.DEBUG_SQL === 'true');
    
    if (sqlForLog && shouldLog) {
        console.log(`[D1][executeWithRetry] executing SQL: ${sqlForLog.substring(0,200)}`);
    }
    return await fn();
  } catch (e: any) {
    const msg = (e.message || "").toLowerCase();
    
    // Only retry on genuine locking/busy/timeout conditions.
    const shouldRetry = msg.includes('locked') || msg.includes('busy') || msg.includes('database is locked') || msg.includes('database is busy') || msg.includes('timeout');
    
     if (currentRetry > 0 && shouldRetry) {
        const attempt = totalRetries - currentRetry;
        const delay = isProd ? 500 : Math.min(3000, 200 + (attempt * 400) + (Math.random() * 300));

        // More verbose tracing for debugging lock sources
        const sqlSnippet = sqlForLog ? ` [SQL: ${sqlForLog.substring(0, 100)}...]` : "";
        console.warn(`[D1][retry] ${new Date().toISOString()} - Database busy or locked, retrying in ${Math.round(delay)}ms... (${currentRetry} attempts left)${sqlSnippet}`);

        await new Promise(res => setTimeout(res, delay));
        return executeWithRetry(fn, currentRetry - 1, sqlForLog, dbForCheckpoint);
     }
    throw e;
  }
}

/**
 * Wraps a raw D1 binding to route all calls through the global DbQueue
 * This is CRITICAL for Windows/LocalDev to prevent SQLITE_BUSY when multiple
 * libraries (like better-auth) use the same DB.
 */
export function wrapD1Binding(db: any): any {
    if (!db || db.__isWrapped) return db;

    const wrapStatement = (stmt: any, sql: string) => {
        // Level 8: Improved write detection
        const isWrite = /^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE|PRAGMA)/i.test(sql.trim());
        
        return new Proxy(stmt, {
            get(target, prop, receiver) {
                if (prop === '__rawStmt') return target;
                const original = Reflect.get(target, prop, receiver);
                if (typeof original !== 'function') return original;

                if (['all', 'first', 'run', 'raw', 'values'].includes(prop as string)) {
                    return async (...args: any[]) => {
                        // "run" is always treated as a potential write for D1, 
                        // but we also check the SQL keyword to be safe.
                        const isExecutionWrite = prop === 'run' || isWrite;
                        
                        return executeWithRetry(
                            () => dbQueue.enqueue(() => original.apply(target, args), isExecutionWrite),
                            undefined, 
                            `${prop.toString().toUpperCase()} [${isExecutionWrite ? 'W' : 'R'}] ${sql.substring(0, 50)}`, 
                            db
                        );
                    };
                }

                if (prop === 'bind') {
                    return (...args: any[]) => {
                        const bound = original.apply(target, args);
                        return wrapStatement(bound, sql);
                    };
                }

                return original.bind(target);
            }
        });
    };

    const wrapper = {
        __isWrapped: true,
        prepare(sql: string) {
            return wrapStatement(db.prepare(sql), sql);
        },
        async batch(statements: any[]) {
            // Unwrap statements if they are proxies
            const rawStatements = statements.map(s => s.__rawStmt || s);
            return executeWithRetry(() => dbQueue.enqueue(() => db.batch(rawStatements), true), undefined, "BATCH", db);
        },
        async exec(sql: string) {
            return executeWithRetry(() => dbQueue.enqueue(() => db.exec(sql), true), undefined, "EXEC", db);
        }
    };

    return new Proxy(db, {
        get(target, prop, receiver) {
            if (prop === 'prepare') return wrapper.prepare;
            if (prop === 'batch') return wrapper.batch;
            if (prop === 'exec') return wrapper.exec;
            if (prop === '__isWrapped') return true;
            
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });
}

const columnCache = new Map<string, string[]>();
const pendingColumnFetches = new Map<string, Promise<string[]>>();

export function clearColumnCache(table?: string) {
    if (table) {
        columnCache.delete(resolveCollection(table));
    } else {
        columnCache.clear();
    }
}

export class D1Driver {
  public db: any;
  public rawBinding: any;
  private _isInitialized = false;
  
  // În timpul primelor secunde de la pornire, punem în coadă toate scrierile pentru a preveni blocajele
  private shouldQueueWrites(isWrite = true): boolean {
    return dbQueue.shouldQueue(isWrite);
  }
  
  private async queueWrite<T>(fn: () => Promise<T>, isWrite = true): Promise<T> {
    return dbQueue.enqueue(fn, isWrite);
  }

  constructor(rawBinding: any) {
    this.rawBinding = rawBinding;
    // We provide a wrapped version for external libraries (better-auth)
    this.db = wrapD1Binding(rawBinding);
    // PRAGMAs are managed by Cloudflare D1 environment - skipping local init
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  private getPk(collection: string): string {
    return getPrimaryKey(collection);
  }

  private sanitizeParams(params: any[]): any[] {
    return params.map(p => {
      if (p === undefined) return null;
      if (p && typeof p === 'object' && !(p instanceof Date)) {
        try { return JSON.stringify(p); } catch (e) { return String(p); }
      }
      return p;
    });
  }


  async query(sql: string, params: any[] = []): Promise<any> {
    const safeParams = this.sanitizeParams(params);
    const upperSql = sql.trim().toUpperCase();
    const isWrite = /^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)/i.test(upperSql);
    
    // In development/Windows, queue WRITES to prevent SQLITE_BUSY.
    if (this.shouldQueueWrites(isWrite)) {
      return executeWithRetry(async () => 
        this.queueWrite(async () => {
          const stmt = this.rawBinding.prepare(sql).bind(...safeParams);
          if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA') || upperSql.startsWith('WITH')) {
            const result = await (stmt as any).all();
            return result.results || [];
          } else {
            const result = await (stmt as any).run();
            return result;
          }
        }, isWrite),
        undefined, sql, this.rawBinding
      );
    }
    
    // Fallback for non-queued environments (mostly production)
    if (isWrite) {
      return executeWithRetry(async () => 
        this.queueWrite(async () => {
          const stmt = this.rawBinding.prepare(sql).bind(...safeParams);
          return await (stmt as any).run();
        }, true),
        undefined, sql, this.rawBinding
      );
    }
    
    return executeWithRetry(async () => {
        const queryStart = Date.now();
        const stmt = this.rawBinding.prepare(sql).bind(...safeParams);
        let result: any;
        if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA') || upperSql.startsWith('WITH')) {
            result = await (stmt as any).all();
            result = result.results || [];
        } else {
            result = await (stmt as any).run();
        }
        
        const duration = Date.now() - queryStart;
        if (duration > 500) {
            console.warn(`[D1][SLOW-QUERY] ${duration}ms: ${sql.substring(0, 100)}...`);
        }
        return result;
    }, undefined, sql, this.rawBinding).catch(e => {
        const isTableMissing = e.message.includes('no such table');
        const isSelect = upperSql.startsWith('SELECT');
        if (!(isTableMissing && isSelect)) {
            console.error(`[D1] Query Error: ${e.message}`, { sql });
        }
        throw e;
    });
  }

  async listTables(): Promise<string[]> {
    const result = await this.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%'");
    return result.map((r: any) => r.name);
  }

  async exec(sql: string): Promise<any> {
    // Queue exec (migration) operations during startup to prevent lock contention
    if (this.shouldQueueWrites()) {
      return executeWithRetry(() => this.queueWrite(async () => {
          try {
            const result = await (this.rawBinding as any).exec(sql);
            return result || { count: 1, duration: 0 };
          } catch (e: any) {
            const isMinorError = e?.message?.includes('duration') || e?.message?.includes('undefined') || !e?.message;
            if (!isMinorError) {
               console.error("[D1-EXEC] Fatal error during script execution:", e?.message || e);
            }
            
            const statements = sql
              .split(';')
              .map(s => s.trim())
              .filter(s => s.length > 0 && !s.startsWith('--'));
            
            for (const stmt of statements) {
                try {
                    await (this.rawBinding as any).prepare(stmt).run();
                } catch(err: any) {
                    const isExpectedError = err.message.includes('already exists') || err.message.includes('no such table');
                    if (!isExpectedError) {
                        console.warn("[D1-EXEC] Fallback statement failed:", err.message);
                    }
                }
            }
            return { success: true };
          }
        }, true),
        undefined, "EXEC", this.rawBinding
      );
    }
    
    return executeWithRetry(async () => {
      try {
        const result = await (this.rawBinding as any).exec(sql);
        return result || { count: 1, duration: 0 };
      } catch (e: any) {
        const isMinorError = e?.message?.includes('duration') || e?.message?.includes('undefined') || !e?.message;
        if (!isMinorError) {
           console.error("[D1-EXEC] Fatal error during script execution:", e?.message || e);
        }
        
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const stmt of statements) {
            try {
                await (this.rawBinding as any).prepare(stmt).run();
            } catch(err: any) {
                const isExpectedError = err.message.includes('already exists') || err.message.includes('no such table');
                if (!isExpectedError) {
                    console.warn("[D1-EXEC] Fallback statement failed:", err.message);
                }
            }
        }
        return { success: true };
      }
    }, undefined, "EXEC", this.rawBinding);
  }

  async batch(queries: any[]): Promise<any[]> {
    const start = Date.now();
    try {
      if (queries.length === 0) return [];
      
      // Level 8: Support both raw statements and {sql, params} objects
      const isRawBatch = queries[0] && (typeof queries[0].bind === 'function' || queries[0].__rawStmt);

      // Queue batch operations during startup to prevent lock contention
      if (this.shouldQueueWrites(true)) {
        return executeWithRetry(() => this.queueWrite(async () => {
          const stmts = isRawBatch 
            ? queries.map(q => q.__rawStmt || q)
            : queries.map(q => this.rawBinding.prepare(q.sql).bind(...(this.sanitizeParams(q.params || []))));
          
          const results = await this.rawBinding.batch(stmts);
          console.log(`[D1] Batch executed (${Date.now() - start}ms)`);
          return (results as any[]).map((r: any) => (r as any).results || []);
        }, true),
        undefined, "BATCH", this.rawBinding);
      }
      
      const stmts = isRawBatch 
        ? queries.map(q => q.__rawStmt || q)
        : queries.map(q => this.rawBinding.prepare(q.sql).bind(...(this.sanitizeParams(q.params || []))));

      const results = await executeWithRetry(() => this.rawBinding.batch(stmts), undefined, "BATCH", this.rawBinding);
      console.log(`[D1] Batch executed (${Date.now() - start}ms)`);
      return (results as any[]).map((r: any) => (r as any).results || []);
    } catch (e: any) {
      console.error(`[D1] Batch Error: ${e.message}`);
      throw e;
    }
  }

  async count(collection: string, filters: any = {}): Promise<number> {
    const resolved = resolveCollection(collection);
    let sql = `SELECT COUNT(*) as count FROM "${resolved}" WHERE 1=1`;
    const params: any[] = [];
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      sql += ` AND "${key}" = ?`;
      params.push(value);
    });
    
    try {
        const result = await this.query(sql, params);
        return (result as any)?.[0]?.count || 0;
    } catch (e: any) {
        if (e.message && e.message.includes('no such table')) return 0;
        throw e;
    }
  }

  async get(collection: string, id: string): Promise<any> {
    const resolved = resolveCollection(collection);
    const pk = this.getPk(resolved);
    try {
        const results = await this.query(`SELECT * FROM "${resolved}" WHERE "${pk}" = ? LIMIT 1`, [id]);
        return results[0] || null;
    } catch (e: any) {
        if (e.message && e.message.includes('no such table')) return null;
        throw e;
    }
  }

  async getTableColumns(table: string): Promise<string[]> {
    const resolved = resolveCollection(table);
    if (columnCache.has(resolved)) return columnCache.get(resolved)!;
    
    // Level 8 Optimization: Coalesce parallel schema requests
    if (pendingColumnFetches.has(resolved)) return pendingColumnFetches.get(resolved)!;

    const fetchPromise = (async () => {
        try {
            const result = await this.query(`PRAGMA table_info("${resolved}")`);
            const columns = result.map((r: any) => r.name) || [];
            if (columns.length > 0) {
                columnCache.set(resolved, columns);
            }
            return columns;
        } catch (e: any) {
            return [];
        } finally {
            pendingColumnFetches.delete(resolved);
        }
    })();

    pendingColumnFetches.set(resolved, fetchPromise);
    return fetchPromise;
  }

  async list(collection: string, filters: any = {}, options: any = {}): Promise<any[]> {
    const resolved = resolveCollection(collection);
    const validColumns = await this.getTableColumns(resolved);
    
    let sql = `SELECT * FROM "${resolved}" WHERE 1=1`;
    const params: any[] = [];

    if (filters.where && Array.isArray(filters.where)) {
        filters.where.forEach((cond: any) => {
            if (!cond) return;
            const op = cond.operator || '=';
            if (validColumns.length > 0 && !validColumns.includes(cond.column)) return;
            if (cond.value === null) {
                sql += ` AND "${cond.column}" ${op === '!=' || op === '<>' ? 'IS NOT' : 'IS'} NULL`;
            } else {
                sql += ` AND "${cond.column}" ${op} ?`;
                params.push(cond.value);
            }
        });
        if (filters.limit && !options.limit) options.limit = filters.limit;
        if (filters.offset && !options.offset) options.offset = filters.offset;
        if (filters.sortBy && !options.sortBy) options.sortBy = filters.sortBy;
    } else {
        Object.entries(filters).forEach(([key, value]) => {
            if (value === undefined) return;
            if (validColumns.length > 0 && !validColumns.includes(key)) return;
            if (value === null) {
                sql += ` AND "${key}" IS NULL`;
            } else {
                sql += ` AND "${key}" = ?`;
                params.push(value);
            }
        });
    }

    if (options.sortBy) {
      if (validColumns.length === 0 || validColumns.includes(options.sortBy)) {
        sql += ` ORDER BY "${options.sortBy}" ${options.sortOrder || 'DESC'}`;
      }
    }

    if (options.limit) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset || 0);
    }

    try {
        const results = await this.query(sql, params);
        return results || [];
    } catch (e: any) {
        if (e.message && e.message.includes('no such table')) {
            return [];
        }
        throw e;
    }
  }

  async create(collection: string, data: any): Promise<any> {
    const resolved = resolveCollection(collection);
    const validColumns = await this.getTableColumns(resolved);
    
    // Auto-filter columns
    const filteredData = { ...data };
    if (validColumns.length > 0) {
        Object.keys(filteredData).forEach(k => {
            if (!validColumns.includes(k)) delete filteredData[k];
        });
    }

    const keys = Object.keys(filteredData);
    if (keys.length === 0) return data;
    
    // Safety: wrap columns in quotes
    const sql = `INSERT OR REPLACE INTO "${resolved}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    try {
        await this.query(sql, keys.map(k => filteredData[k]));
        return filteredData;
    } catch (e: any) {
        if (e.message && e.message.includes('no such table')) {
            console.warn(`[D1] Create ignored: Table ${resolved} does not exist.`);
            return data;
        }
        console.error(`[D1] Create Failure on table ${resolved}: ${e.message}`, { sql, dataSnippet: JSON.stringify(filteredData).slice(0, 100) });
        throw e;
    }
  }

  async update(collection: string, id: string, data: any): Promise<any> {
    const resolved = resolveCollection(collection);
    const validColumns = await this.getTableColumns(resolved);
    const pk = this.getPk(resolved);
    
    // Auto-filter columns
    const filteredData = { ...data };
    if (validColumns.length > 0) {
        Object.keys(filteredData).forEach(k => {
            if (!validColumns.includes(k) || k === pk) delete filteredData[k];
        });
    }

    const keys = Object.keys(filteredData);
    if (keys.length === 0) return data;

    const sql = `UPDATE "${resolved}" SET ${keys.map(k => `"${k}" = ?`).join(', ')} WHERE "${pk}" = ?`;
    try {
        await this.query(sql, [...keys.map(k => filteredData[k]), id]);
        return data;
    } catch (e: any) {
        if (e.message && e.message.includes('no such table')) {
            console.warn(`[D1] Update ignored: Table ${resolved} does not exist.`);
            return data;
        }
        throw e;
    }
  }

  async set(collection: string, id: string, data: any): Promise<any> {
    try {
        const existing = await this.get(collection, id);
        const resolved = resolveCollection(collection);
        const pk = this.getPk(resolved);
        
        if (existing) {
            return await this.update(collection, id, data);
        }
        
        const insertData = { ...data };
        if (!insertData[pk]) insertData[pk] = id;
        
        return await this.create(collection, insertData);
    } catch (e: any) {
        if (e.message && e.message.includes('no such table')) {
            console.warn(`[D1] Set ignored: Table ${collection} does not exist.`);
            return { ...data, id };
        }
        throw e;
    }
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const resolved = resolveCollection(collection);
    const pk = this.getPk(resolved);
    await this.query(`DELETE FROM "${resolved}" WHERE "${pk}" = ?`, [id]);
    return true;
  }
}

let dbInstance: D1Driver | null = null;
let lastBoundDb: any = null;

export function getDb(env: any): D1Driver {
  const safeEnv = env || {};
  const d1 = safeEnv.DB || safeEnv.db;

  if (!d1) {
    if (dbInstance && dbInstance.rawBinding && typeof dbInstance.rawBinding.prepare === 'function') {
        return dbInstance;
    }
    console.warn(`[D1] MISSING BINDING 'DB' in env keys: ${Object.keys(safeEnv).join(', ')}. Using mock driver.`);
    return new D1Driver({
      prepare: () => ({
        bind: () => ({ 
          first: async () => null, 
          all: async () => ({ results: [], success: true, meta: {} }), 
          run: async () => ({ success: true, meta: {} }) 
        }),
        first: async () => null,
        all: async () => ({ results: [], success: true, meta: {} }),
        run: async () => ({ success: true, meta: {} })
      }),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 })
    } as any);
  }
  
  // Single Instance
  if (!dbInstance || d1 !== lastBoundDb) {
    // We pass the RAW binding to D1Driver
    dbInstance = new D1Driver(d1);
    lastBoundDb = d1;
  }
  
  return dbInstance;
}
