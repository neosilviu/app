import { AsyncLocalStorage } from "node:async_hooks";

const dbLockContext = new AsyncLocalStorage<boolean>();

class DbQueue {
    private writeQueue: Promise<any> = Promise.resolve();
    private activeCount = 0;
    private batchBuffer: Array<{ fn: () => Promise<any>, resolve: (value: any) => void, reject: (error: any) => void }> = [];
    private batchTimeout: NodeJS.Timeout | null = null;

    private processBatch() {
        if (this.batchBuffer.length === 0) return;
        
        const batch = [...this.batchBuffer];
        this.batchBuffer = [];
        
        // Process batch sequentially but with minimal delay between operations
        const processSequentially = async () => {
            for (const item of batch) {
                try {
                    const result = await item.fn();
                    item.resolve(result);
                } catch (error) {
                    item.reject(error);
                }
                // Small delay to prevent overwhelming
                if (batch.length > 5) {
                    await new Promise(resolve => setTimeout(resolve, 2));
                }
            }
        };
        
        this.writeQueue = this.writeQueue.then(() => processSequentially());
    }

    // Level 8: Improved queue logic
    shouldQueue(isWrite = true): boolean {
        // ONLY queue in local development on Windows
        // In production (Cloudflare), D1 handles its own concurrency
        const isWinDev = typeof process !== 'undefined' && (process.env.NODE_ENV === 'development' || process.platform === 'win32');
        if (typeof process === 'undefined' || !isWinDev) return false; 
        
        // Enterprise Level 8: Only queue WRITES. SQLite supports concurrent readers.
        // Queueing reads creates unnecessary bottlenecks during page loads.
        return isWrite === true; 
    }

    async enqueue<T>(fn: () => Promise<T>, isWrite = true): Promise<T> {
        if (!this.shouldQueue(isWrite)) {
            return fn();
        }

        // Re-entrancy support: if we're already holding the lock in this call stack, just run the function
        if (dbLockContext.getStore()) {
            return fn();
        }

        // Level 8: Batch registry operations to reduce contention
        const fnString = fn.toString();
        const isRegistryOp = fnString.includes('registry') || fnString.includes('SYSTEM_SETTING');
        
        if (isRegistryOp && this.batchBuffer.length < 10) {
            // Add to batch buffer
            return new Promise<T>((resolve, reject) => {
                this.batchBuffer.push({ fn, resolve, reject });
                
                // Schedule batch processing with a small delay
                if (this.batchTimeout) clearTimeout(this.batchTimeout);
                this.batchTimeout = setTimeout(() => {
                    this.batchTimeout = null;
                    this.processBatch();
                }, 10); // 10ms batch window
            });
        }

        this.activeCount++;
        const queueId = Math.random().toString(36).substring(7);
        
        // Level 8: Suppress high contention warnings on Windows Dev
        // The queueing mechanism itself is working as intended to prevent SQLite locks.
        // Only log if queue exceeds a critical threshold (e.g., > 100 tasks)
        if (this.activeCount > 100) {
            console.warn(`[DB-QUEUE][${queueId}] CRITICAL contention: ${this.activeCount} tasks in queue. Consider reducing concurrent requests.`);
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
                // Level 8: Add micro-delay to prevent queue bursts from overwhelming SQLite
                if (this.activeCount > 10) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
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

// Cleanup batch timeout on process exit
if (typeof process !== 'undefined') {
    process.on('exit', () => {
        if (dbQueue['batchTimeout']) {
            clearTimeout(dbQueue['batchTimeout']);
        }
    });
}

