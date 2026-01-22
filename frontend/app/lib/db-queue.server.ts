import { AsyncLocalStorage } from "node:async_hooks";

const dbLockContext = new AsyncLocalStorage<boolean>();

class DbQueue {
    private writeQueue: Promise<any> = Promise.resolve();
    private activeCount = 0;

    // Level 8: Improved queue logic
    shouldQueue(isWrite = true): boolean {
        // ONLY queue in local development on Windows
        // In production (Cloudflare), D1 handles its own concurrency
        const isWinDev = typeof process !== 'undefined' && (process.env.NODE_ENV === 'development' || process.platform === 'win32');
        if (typeof process === 'undefined' || !isWinDev) return false; 
        
        return true; 
    }

    async enqueue<T>(fn: () => Promise<T>, isWrite = true): Promise<T> {
        if (!this.shouldQueue(isWrite)) {
            return fn();
        }

        // Re-entrancy support: if we're already holding the lock in this call stack, just run the function
        if (dbLockContext.getStore()) {
            return fn();
        }

        this.activeCount++;
        const queueId = Math.random().toString(36).substring(7);
        if (this.activeCount > 5) {
            console.warn(`[DB-QUEUE][${queueId}] High contention: ${this.activeCount} task in queue`);
        }

        const wrapped = async () => {
            const start = Date.now();
            try {
                const res = await dbLockContext.run(true, fn as any);
                const duration = Date.now() - start;
                if (duration > 500) {
                    console.log(`[DB-QUEUE][${queueId}] Slow task finished: ${duration}ms (isWrite=${isWrite})`);
                }
                return res;
            } finally {
                this.activeCount--;
            }
        };

        const next = this.writeQueue.then(() => wrapped());
        this.writeQueue = (async () => {
            try { await next; } catch (e) { /* swallow error in chain */ }
        })();
        return next as Promise<T>;
    }
}

export const dbQueue = new DbQueue();

