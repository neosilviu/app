
import { AI_CONFIG } from '../registry-baseline.ts';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keys: Record<string, string> = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
};

const TEST_RESULTS_DIR = path.join(__dirname, 'results');
if (!fs.existsSync(TEST_RESULTS_DIR)) fs.mkdirSync(TEST_RESULTS_DIR);

const logger = {
    log: (msg: string) => {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        console.log(line);
        fs.appendFileSync(path.join(TEST_RESULTS_DIR, 'latest.log'), line + '\n');
    },
    error: (msg: string, err?: any) => {
        const line = `[${new Date().toLocaleTimeString()}] ERR: ${msg} ${err?.message || ''}`;
        console.error(line);
        fs.appendFileSync(path.join(TEST_RESULTS_DIR, 'latest.log'), line + '\n');
    }
};

// Simulation of the AiEngine logic for standalone testing
async function callProvider(providerName: string, config: any, model: string, prompt: string, history: any[] = []) {
    let url = config.baseUrl || "";
    const providerKey = providerName.toUpperCase();
    const apiKey = keys[`${providerKey}_API_KEY`] || keys[providerKey] || process.env[`${providerKey}_API_KEY`] || config.apiKey || "";
    const accountId = keys[`CLOUDFLARE_ACCOUNT_ID`] || process.env[`CLOUDFLARE_ACCOUNT_ID`] || config.accountId || "";

    // Global placeholder replacement
    url = url.replace(/{{model}}/g, model).replace(/{{accountId}}/g, accountId);

    // Normalization
    if (url.startsWith('http')) {
        const protocolMatch = url.match(/^(https?):\/\//);
        if (protocolMatch) {
            const protocol = protocolMatch[1];
            let rest = url.substring(protocol.length + 3);
            const queryParts = rest.split('?');
            queryParts[0] = queryParts[0].replace(/\/+/g, '/').replace(/\/$/, '');
            url = protocol + '://' + queryParts.join('?');
        }
    }

    const headers: any = {
        'Content-Type': 'application/json',
        'User-Agent': 'Studio-App-Test-Runner'
    };

    if (providerName === 'gemini') {
        headers['x-goog-api-key'] = apiKey;
    } else if (providerName === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    logger.log(`>> Testing ${providerName} | Model: ${model}`);
    
    try {
        let start = Date.now();
        let response: any;
        let body: any = {};
        let finalUrl = url;

        if (config.type === 'google-v1beta' || providerName === 'gemini') {
            // Level 10: Improved logic for Gemini URL and Fallbacks
            let base = url.split('?')[0].replace(/\/$/, '');
            if (!base.includes('/v1')) base += '/v1beta';

            const constructGeminiUrl = (baseUrl: string) => {
                let u = baseUrl;
                // If it already has the model replaced (via global replacement), it might contain the model name but no colon
                if (!u.includes(':')) {
                    if (!u.includes('/models/')) {
                        const cleanModel = String(model).startsWith('models/') ? String(model).substring(7) : model;
                        u += `/models/${cleanModel}:generateContent`;
                    } else {
                        u = u.replace(/\/+$/, '') + ':generateContent';
                    }
                }
                if (!u.includes('key=')) u += (u.includes('?') ? '&' : '?') + `key=${apiKey}`;
                return u;
            };

            finalUrl = constructGeminiUrl(base);
            
            body = {
                contents: [
                    ...history.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    })),
                    { role: 'user', parts: [{ text: prompt }] }
                ],
                generationConfig: { temperature: 0.7, maxOutputTokens: 100 }
            };

            start = Date.now();
            try {
                response = await axios.post(finalUrl, body, { headers, timeout: 15000 });
            } catch (e: any) {
                // Version Fallback: v1beta -> v1
                if (e.response?.status === 404 && base.includes('/v1beta')) {
                    const v1Base = base.replace('/v1beta', '/v1');
                    const v1Url = constructGeminiUrl(v1Base);
                    logger.log(`[RETRY] Gemini v1beta 404, trying v1...`);
                    response = await axios.post(v1Url, body, { headers, timeout: 15000 });
                } else {
                    throw e;
                }
            }
        } else {
            if (config.type === 'cloudflare-rpc') {
                body = { 
                    messages: [
                        ...history,
                        { role: 'user', content: prompt }
                    ] 
                };
            } else {
                let technicalName = model;
                // GitHub/Azure specific model name extraction
                if (providerName === 'github' && model.includes('/models/')) {
                    const parts = model.split('/models/');
                    technicalName = parts[1].split('/')[0];
                }

                if (!finalUrl.includes('/chat/completions') && !finalUrl.includes('?')) {
                    finalUrl = finalUrl.replace(/\/+$/, '') + '/chat/completions';
                }
                body = {
                    model: technicalName,
                    messages: [
                        ...history,
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 100
                };
            }
            start = Date.now();
            response = await axios.post(finalUrl, body, { headers, timeout: 15000 });
        }

        const duration = Date.now() - start;

        let resultText = "";
        if (config.type === 'google-v1beta' || providerName === 'gemini') {
            resultText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else if (config.type === 'cloudflare-rpc') {
            resultText = response.data.result?.response || response.data.result?.text;
        } else {
            resultText = response.data.choices?.[0]?.message?.content;
        }

        if (resultText) {
            logger.log(`[PASS] ${providerName} (${model}) response: "${resultText.substring(0, 50)}..." [${duration}ms]`);
            return { success: true, model, duration, text: resultText };
        } else {
            throw new Error("Empty response from provider");
        }
    } catch (e: any) {
        const status = e.response?.status;
        const errData = e.response?.data;
        const msg = JSON.stringify(errData) || e.message;
        logger.error(`[FAIL] ${providerName} (${model}): Status ${status} - ${msg}`);
        return { success: false, model, error: msg };
    }
}

async function startTests() {
    logger.log("=== STARTING AI PROVIDER TEST SUITE ===");
    const testTargets = [
        { provider: 'openai', model: 'gpt-4o-mini' },
        { provider: 'gemini', model: 'gemini-1.5-flash' },
        { provider: 'cloudflare', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        { provider: 'github', model: 'azureml://registries/azureml-meta/models/Meta-Llama-3.1-70B-Instruct/versions/1' },
        { provider: 'groq', model: 'llama-3.1-8b-instant' }
    ];

    const results: any[] = [];
    
    for (const target of testTargets) {
        const { provider, model } = target;
        const config = (AI_CONFIG.providers as any)[provider];
        
        if (!config) {
            logger.error(`Skipping ${provider}: Not found in registry-baseline`);
            continue;
        }

        // 1. Single Turn Test
        const start1 = Date.now();
        const res1 = await callProvider(provider, config, model, "Explain what a CRM is in one sentence.");
        const duration1 = Date.now() - start1;

        // 2. Multi-Turn / Conversation Test
        let res2: any = { success: false, text: "N/A" };
        let duration2 = 0;
        
        if (res1.success) {
            const history = [
                { role: 'user', content: "My name is StudioAgent. Remember it." },
                { role: 'assistant', content: "Got it, I will remember you as StudioAgent." }
            ];
            const start2 = Date.now();
            res2 = await callProvider(provider, config, model, "What is my name? Answer with only the name.", history);
            duration2 = Date.now() - start2;
            
            // Context Recall Validation
            if (res2.success && !res2.text?.toLowerCase().includes("studioagent")) {
                res2.success = false;
                res2.error = `Context Lost: Model replied "${res2.text}" instead of recalling name.`;
            }
        }

        results.push({
            provider,
            model: model.length > 40 ? '...' + model.substring(model.length - 37) : model,
            conn: res1.success ? '✅' : '❌',
            conv: res2.success ? '✅' : '❌',
            latency: `${duration1 + duration2}ms`,
            error: res1.error || res2.error || '-'
        });
    }

    logger.log("=== TEST SUITE FINISHED ===");
    console.table(results);
}

startTests().catch(e => logger.error("Fatal test runner error", e));
