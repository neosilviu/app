import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AiService } from '../../frontend/app/lib/services';
import { AVAILABLE_V3_ENTITIES } from './index';
import { DatabaseDriver } from '../../backend-v2/src/db/driver';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.dev/.env.v2-dev') });

describe('Autonomous Task Benchmarking', () => {
    let dbDriver: DatabaseDriver;

    beforeAll(async () => {
        dbDriver = DatabaseDriver.getInstance();
        await dbDriver.connect();

        // Ensure tables exist for benchmark
        await dbDriver.run(`CREATE TABLE IF NOT EXISTS lead (id TEXT PRIMARY KEY, workspaceId TEXT, title TEXT, contactId TEXT, description TEXT, status TEXT, estimatedValue REAL, createdAt DATETIME, updatedAt DATETIME, deletedAt DATETIME)`);
        await dbDriver.run(`CREATE TABLE IF NOT EXISTS deal (id TEXT PRIMARY KEY, workspaceId TEXT, title TEXT, contactId TEXT, value REAL, currency TEXT, status TEXT, expectedCloseDate DATETIME, createdAt DATETIME, updatedAt DATETIME, deletedAt DATETIME)`);
        await dbDriver.run(`CREATE TABLE IF NOT EXISTS task (id TEXT PRIMARY KEY, workspaceId TEXT, title TEXT, description TEXT, contactId TEXT, status TEXT, priority TEXT, dueDate DATETIME, assignedTo TEXT, parentTaskId TEXT, createdAt DATETIME, updatedAt DATETIME, deletedAt DATETIME)`);
        
        await dbDriver.run(`DELETE FROM lead`);
        await dbDriver.run(`DELETE FROM deal`);
        await dbDriver.run(`DELETE FROM task`);
    });

    afterAll(async () => {
        await dbDriver.disconnect();
    });

    it('should execute a multi-step Lead -> Deal -> Task flow', async () => {
        const ctx = {
            db: {
                get: async (table: string, id: string) => dbDriver.get(`SELECT * FROM ${table} WHERE id = ?`, [id]),
                create: async (table: string, data: any) => {
                    const keys = Object.keys(data);
                    const values = Object.values(data);
                    const placeholders = keys.map(() => '?').join(', ');
                    await dbDriver.run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
                },
                update: async (table: string, id: string, data: any) => {
                    const keys = Object.keys(data);
                    const values = Object.values(data);
                    const setClause = keys.map(k => `${k} = ?`).join(', ');
                    await dbDriver.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, id]);
                },
                query: async (sql: string, params: any[] = []) => dbDriver.query(sql, params)
            },
            user: { id: 'admin', workspaceId: 'system', email: 'admin@studio.app' },
            registry: {
                AI_CONFIG: {
                    activeProviders: ['google'],
                    defaultProvider: 'google',
                    providers: {
                        google: {
                            apiKey: "AIzaSyATCnVSr7PPxKMMf_Nldk31zZI0FZI_mRk",
                            defaultModel: 'gemini-1.5-flash',
                            baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
                        }
                    }
                }
            },
            env: process.env,
            v3Entities: AVAILABLE_V3_ENTITIES
        };

        const ai = new AiService(process.env, { ai_config: ctx.registry.AI_CONFIG });
        
        // Mocking the AI Chat to simulate the autonomous flow
        let callCount = 0;
        vi.spyOn(ai, 'chat').mockImplementation(async (prompt: string, history: any[] = []) => {
            callCount++;
            if (callCount === 1) {
                // First step: Create Lead
                return {
                    tool_calls: [{
                        id: 'call_1',
                        function: {
                            name: 'lead__create',
                            arguments: JSON.stringify({ input: { title: 'Benchmark Enterprise' } })
                        }
                    }]
                };
            }
            if (callCount === 2) {
                // Second step: Convert to Deal
                const prevResultRaw = history.find(h => h.role === 'tool' && h.name === 'lead__create')?.content;
                const prevResult = prevResultRaw ? JSON.parse(prevResultRaw) : null;
                const leadId = prevResult?.id || 'mock-lead-id';

                return {
                    tool_calls: [{
                        id: 'call_2',
                        function: {
                            name: 'lead__convert-to-deal',
                            arguments: JSON.stringify({ id: leadId })
                        }
                    }]
                };
            }
            if (callCount === 3) {
                // Third step: Create Task
                const prevResultRaw = history.find(h => h.role === 'tool' && h.name === 'lead__convert-to-deal')?.content;
                const prevResult = prevResultRaw ? JSON.parse(prevResultRaw) : null;
                const dealId = prevResult?.dealId || 'mock-deal-id';

                return {
                    tool_calls: [{
                        id: 'call_3',
                        function: {
                            name: 'deal__create-task',
                            arguments: JSON.stringify({ id: dealId, input: { title: 'Follow-up Benchmark' } })
                        }
                    }]
                };
            }
            return "Task completed successfully!";
        });

        const complexTask = "Crează un lead nou numit 'Benchmark Enterprise'. Apoi convertește-l într-o oportunitate și crează un task numit 'Follow-up Benchmark'.";

        console.log(`[BENCHMARK] Starting task: "${complexTask}"`);
        
        const result: any = await ai.runTask(complexTask, ctx, { maxIterations: 5 });
        
        console.log("[BENCHMARK] AI Result:", result.result);
        expect(result.success).toBe(true);

        // Verification
        const lead = await dbDriver.get("SELECT * FROM lead WHERE title = 'Benchmark Enterprise'");
        expect(lead).toBeDefined();
        expect(lead.status).toBe('qualified');

        const deal = await dbDriver.get("SELECT * FROM deal WHERE title = 'Benchmark Enterprise'");
        expect(deal).toBeDefined();

        const task = await dbDriver.get("SELECT * FROM task WHERE title = 'Follow-up Benchmark'");
        expect(task).toBeDefined();

        console.log("✅ Benchmark flow verified successfully.");
    }, 60000); // Higher timeout for AI
});
