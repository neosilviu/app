import { AiService } from '../frontend/app/lib/services';
import { AVAILABLE_V3_ENTITIES } from '../core/entities/index';
import { DatabaseDriver } from '../backend-v2/src/db/driver';
import dotenv from 'dotenv';
import path from 'path';

// Load env for AI keys
dotenv.config({ path: path.resolve(__dirname, '../.dev/.env.v2-dev') });

async function benchmark() {
    console.log("🚀 Starting Autonomous Task Benchmark...");
    
    // 1. Setup Mock Context
    const dbDriver = DatabaseDriver.getInstance();
    await dbDriver.connect();
    
    // Create a mock context as expected by runTask
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
            query: async (sql: string, params: any[]) => dbDriver.query(sql, params)
        },
        user: { id: 'admin', workspaceId: 'system', email: 'admin@studio.app' },
        registry: {
            AI_CONFIG: {
                activeProviders: ['google'],
                defaultProvider: 'google',
                google: {
                    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
                    model: 'gemini-1.5-flash',
                    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
                }
            }
        },
        env: process.env,
        v3Entities: AVAILABLE_V3_ENTITIES
    };

    const ai = new AiService(process.env, { ai_config: ctx.registry.AI_CONFIG });

    // 2. Define complex multi-step task
    const complexTask = "Crează un lead nou numit 'Big Enterprise Project'. Apoi convertește-l într-o oportunitate și, în cele din urmă, crează un task pentru oportunitatea respectivă cu titlul 'Suna clientul pentru detalii'.";

    console.log(`[BENCHMARK] Task: "${complexTask}"`);

    try {
        const result = await ai.runTask(complexTask, ctx, { maxIterations: 5 });
        console.log("\n✅ Benchmark Finished Successfully!");
        console.log("Result:", result.result);
        console.log("Iterations:", result.iterations);
        
        // Final status report
        const leads = await dbDriver.query("SELECT * FROM lead WHERE title = 'Big Enterprise Project'");
        const deals = await dbDriver.query("SELECT * FROM deal WHERE title = 'Big Enterprise Project'");
        const tasks = await dbDriver.query("SELECT * FROM task WHERE title = 'Suna clientul pentru detalii'");
        
        console.log("\n--- Verification Report ---");
        console.log(`Leads created: ${leads.length} (Status: ${leads[0]?.status})`);
        console.log(`Deals created: ${deals.length} (Status: ${deals[0]?.status})`);
        console.log(`Tasks created: ${tasks.length}`);
        
    } catch (e: any) {
        console.error("\n❌ Benchmark Failed:", e.message);
        if (e.stack) console.error(e.stack);
    } finally {
        await dbDriver.disconnect();
    }
}

benchmark();
