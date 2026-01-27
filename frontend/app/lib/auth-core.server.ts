import { betterAuth } from "better-auth";
import { cloudflare } from "better-auth-cloudflare";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { wrapD1Binding, getDb } from "./d1.server";

let _cachedAuth: any = null;

export const getAuth = (env: any, request?: Request) => {
    // Level 8: Always use the globally wrapped DB from getDb to ensure 
    // serialization (DbQueue) works across all libraries (Better-Auth, D1Driver, etc.)
    const driver = getDb(env);
    const d1Binding = driver.db;
    
    // Check if origin changed (Enterprise Level 8: Dynamic Origin Support)
    let currentOrigin = '';
    if (request) {
        try { currentOrigin = new URL(request.url).origin; } catch (e) {}
    }
    
    if (_cachedAuth && _cachedAuth.__hasValidDB && (!_cachedAuth.__origin || _cachedAuth.__origin === currentOrigin)) {
        return _cachedAuth;
    }

    if (!d1Binding) {
        throw new Error("[AUTH-INIT] Critical: D1 Database binding 'DB' not found in environment. Better-Auth cannot start.");
    }

    let baseURL = env?.BETTER_AUTH_URL || currentOrigin;
    if (!baseURL) baseURL = 'http://localhost:8788';

    console.log(`[AUTH-INIT] Initializing Better-Auth at ${baseURL} (Singleton mode)`);
    const initStart = Date.now();

    const originalError = console.error;
    const suppressedPatterns = ['User not found', 'no results'];
    const wrappedConsoleError = (...args: any[]) => {
        const message = args.join(' ');
        const isSuppressed = suppressedPatterns.some(pattern => message.includes(pattern));
        if (!isSuppressed) {
            originalError(...args);
        }
    };

    try {
        console.groupCollapsed?.("[AUTH-INIT]");
        console.error = wrappedConsoleError as any;
        
        console.log("[AUTH-INIT] Creating Kysely DB...");
        const db = new Kysely<any>({
            dialect: new D1Dialect({ database: d1Binding as any }),
            plugins: [
                {
                    transformQuery: (args: any) => args.node,
                    transformResult: (args: any) => {
                        const result = args.result;
                        if (result && (result as any).numUpdatedOrDeletedRows !== undefined && result.numAffectedRows === undefined) {
                            // Map deprecated property to new one to satisfy Kysely's internal checks
                            result.numAffectedRows = BigInt((result as any).numUpdatedOrDeletedRows);
                        }
                        return Promise.resolve(result);
                    }
                } as any
            ]
        });

        console.log("[AUTH-INIT] Running betterAuth constructor...");
        const auth = betterAuth({
            database: {
                provider: "sqlite",
                db: db,
            },
            secret: env?.BETTER_AUTH_SECRET || "o6E7vjY9vWxN8pM5vDxN1mL4pT2vB0nQ",
            baseURL,
            logger: {
                disabled: false,
                level: "error",
            },
            emailAndPassword: { 
                enabled: true,
                autoSignIn: true,
                minPasswordLength: 8,
                maxPasswordLength: 128
            },
            user: {
                additionalFields: {
                    role: { type: "string", required: false, defaultValue: "user" },
                    workspaceId: { type: "string", required: false }
                }
            },
            plugins: [
                cloudflare({
                    autoDetectIpAddress: false,
                    geolocationTracking: false,
                })
            ]
        });
        
        (auth as any).__hasValidDB = true; // Mark as successfully initialized with DB
        (auth as any).__origin = currentOrigin;
        console.error = originalError; 
        console.log(`[AUTH-INIT] Initialization successful in ${Date.now() - initStart}ms`);
        console.groupEnd?.();
        _cachedAuth = auth;
        return auth;
    } catch (e: any) {
        console.error = originalError;
        console.error(`[AUTH-INIT] Better-Auth initialization FAILED in ${Date.now() - initStart}ms:`, e.message);
        throw e;
    }
};

/**
 * AUTH SERVER UTILS
 */
export async function verifyAuth(request: Request, env: any) {
  const safeEnv = env || {};
  const apiKeyHeader = request.headers.get('x-api-key');
  const authHeader = request.headers.get('authorization');
  const masterKey = safeEnv.API_KEY;
  
  try {
    const auth = getAuth(safeEnv, request);
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (session) {
      return {
        ...session.user,
        sub: session.user.id,
        role: (session.user as any).role || 'user',
        workspaceId: (session.user as any).workspaceId
      };
    }
  } catch (e: any) {
    console.error('[AUTH-VERIFY] Verification failed:', e.message);
  }

  return null;
}
