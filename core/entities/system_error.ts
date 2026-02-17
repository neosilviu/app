import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * SYSTEM ERROR ENTITY (v3 Modular)
 */
export const system_error: EntityV3<any> = {
  id: 'system_error',
  label: { ro: 'Erori Sistem', en: 'System Errors' },
  labelPlural: { ro: 'Erori Sistem', en: 'System Errors' },
  icon: 'Bug',
  tableName: 'system_error',
  displayField: 'message',
  isSystem: true,
  isGlobal: true,

  // Marketplace Solution Metadata
  solutionId: 'universal-monitoring-shield',
  solutionTitle: { ro: 'Scut Monitorizare Universală', en: 'Universal Monitoring Shield' },
  description: { 
    ro: 'Colectarea și analiza automată a erorilor de sistem cu remediere autonomă AI.', 
    en: 'Automatic collection and analysis of system errors with AI autonomous healing.' 
  },
  category: 'system',
  priority: 1,

  schema: z.object({
    ...BaseSchema,
    message: z.string()
      .describe('ui:width=12;icon=AlertTriangle;searchable=true;label={"ro": "Mesaj Eroare", "en": "Error Message"}'),
    
    path: z.string().optional()
      .describe('ui:width=6;icon=Link;searchable=true;label={"ro": "Cale / Endpoint", "en": "Path / Endpoint"}'),
    
    status: z.number().optional()
      .describe('ui:width=2;icon=Activity;label={"ro": "Status", "en": "Status"}'),
    
    method: z.string().optional()
      .describe('ui:width=2;icon=Zap;label={"ro": "Metodă", "en": "Method"}'),
    
    user: z.string().optional()
      .describe('ui:width=2;icon=User;label={"ro": "Utilizator", "en": "User"}'),
    
    stack: z.string().optional()
      .describe('ui:hidden=true;type=text;label={"ro": "Stivă Apeluri", "en": "Stack Trace"}'),
    
    context: z.string().optional()
      .describe('ui:hidden=true;type=json;label={"ro": "Context Tehnic", "en": "Technical Context"}'),
    
    client_info: z.string().optional()
      .describe('ui:hidden=true;type=json;label={"ro": "Info Client", "en": "Client Info"}'),

    userId: z.string().optional().describe('ui:hidden=true'),
  }),


  features: ['deletable', 'bulk-actions'],

  actions: [
    {
      id: 'log',
      label: 'Log Error',
      handler: async (ctx: any, input: any) => {
        const { db, user, request } = ctx;
        const { message, stack, path: errPath, clientInfo, extra, status } = input;
        
        await db.create('system_error', {
          id: crypto.randomUUID(),
          message: message || "Unknown Client Error",
          stack: stack,
          path: errPath || "client-ui",
          method: "CLIENT",
          status: status || 0,
          userId: user?.id,
          user: user?.name,
          workspaceId: user?.workspaceId,
          context: JSON.stringify({ ...extra, client_source: true }),
          client_info: JSON.stringify({
              ...(clientInfo || {}),
              userAgent: request.headers.get('user-agent'),
              referer: request.headers.get('referer'),
              ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip')
          }),
          createdAt: new Date().toISOString()
        });
        
        return { logged: true };
      }
    },
    {
      id: 'self-heal-all',
      label: { ro: 'Self-Heal (AI)', en: 'Self-Heal (AI)' },
      description: 'Analizează erorile recente și aplică remedierea automată dacă este posibil.',
      icon: 'Zap',
      isGlobal: true,
      input: z.object({
        autoFix: z.boolean().default(false).describe('Aplică remedierea automat dacă încrederea este > 80%')
      }),
      handler: async (ctx: any, input: any) => {
        const { db, env, registry, AiService, v3Entities } = ctx;
        
        // 1. Get recent errors
        const errors = await db.query('SELECT * FROM system_error ORDER BY createdAt DESC LIMIT 20').catch(() => []);

        if (!errors || errors.length === 0) {
          return { message: { ro: "Sistemul este sănătos (0 erori recente).", en: "System is healthy (0 recent errors)." } };
        }

        const ai = new AiService(env, { ai_config: registry.AI_CONFIG, registry, db });
        
        // 2. Initial Analysis
        const errorSummary = errors.map((e: any) => ({ msg: e.message, path: e.path, status: e.status }));
        const analysisPrompt = `Analizează următoarele erori: ${JSON.stringify(errorSummary)}. Propune o soluție tehnică scurtă (fixDescription) și un mesaj de analiză.`;
        
        const analysisRes = await ai.chat(analysisPrompt, [], {
            systemPrompt: "Ești un Senior DevOps expert în Studio App v3. Răspunde DOAR cu un obiect JSON: { \"analysis\": \"...\", \"fixDescription\": \"...\", \"confidence\": 0-100 }",
            response_mime_type: 'application/json'
        });
        
        const analysis = ai.engine.extractJson(analysisRes);

        // 3. Auto-Fix (Level 10 Autonomous Loop)
        let fixResult = null;
        if (input.autoFix && (analysis.confidence || 0) > 80) {
             console.log(`[SELF-HEAL] High confidence (${analysis.confidence}%). Running autonomous fix loop...`);
             fixResult = await ai.runTask(`Execută următoarea remediere pentru a stabiliza sistemul: ${analysis.fixDescription}`, {
                ...ctx,
                v3Entities
             }, {
                maxIterations: 3
             });
        }

        return {
          message: analysis.analysis,
          fixAttempted: !!fixResult,
          fixResult: fixResult?.result || "Analiză finalizată. Remedierile automate necesită confirmare explicită (autoFix=true) sau încredere ridicată (>80%).",
          confidence: analysis.confidence
        };
      }
    },
    {
      id: 'monitor-tunnel',
      label: { ro: 'Monitorizare Tunel (Autonomous)', en: 'Monitor Tunnel (Autonomous)' },
      description: 'Verifică periodic starea tunelului către Local Agent și încearcă repornirea dacă este deconectat.',
      icon: 'Activity',
      isGlobal: true,
      handler: async (ctx: any) => {
        const { db, registry, AiService, env } = ctx;
        
        // 1. Check for recent tunnel errors
        const tunnelErrors = await db.query(
          "SELECT * FROM system_error WHERE (message LIKE '%ECONNREFUSED%' OR message LIKE '%Local Agent unavailable%') AND createdAt > datetime('now', '-10 minutes') LIMIT 500"
        ).catch(() => []);

        if (tunnelErrors.length > 5) {
          const ai = new AiService(env, { ai_config: registry.AI_CONFIG, registry, db });
          
          console.log(`[TUNNEL-MONITOR] Detected ${tunnelErrors.length} tunnel errors. Attempting autonomous fix...`);
          
          const result = await ai.runTask(
            "Detectăm probleme persistente cu Local Agent. Încearcă să resetezi conexiunea sau să notifici administratorul printr-o metodă alternativă.",
            ctx
          );

          return { status: 'fixing', result: result.result };
        }

        return { status: 'healthy', count: tunnelErrors.length };
      }
    }
  ],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'Bug',
    priority: 100
  }
};
