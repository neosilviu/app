import { betterAuth } from "better-auth";
import { cloudflare } from "better-auth-cloudflare";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { wrapD1Binding, getDb } from "./d1.server";
import { getRegistry } from "./registry";

let _cachedAuth: any = null;

export const getAuth = (env: any, request?: Request) => {
    const registry = getRegistry();
    const authConfig = registry?.AUTH_CONFIG || {};

    // Enterprise Level 10: Unified Transactional Database Binding
    // Always use the globally wrapped DB from getDb to ensure 
    // serialization (DbQueue) works across all libraries (Better-Auth, D1Driver, etc.)
    const driver = getDb(env);
    const d1Binding = driver.db;
    
    // Check if origin changed (Enterprise Level 10: Dynamic Origin & Multi-Domain Shield)
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
    if (!baseURL) baseURL = '';

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
        
        // Level 10: Seamlessly patch D1Dialect to stop the Kysely "outdated driver" warning.
        // We intercept the driver and connection execution to transform the result BEFORE Kysely sees it.
        const dialect = new D1Dialect({ database: d1Binding as any });
        const originalCreateDriver = dialect.createDriver.bind(dialect);
        
        dialect.createDriver = () => {
            const driver = originalCreateDriver();
            const originalAcquireConnection = driver.acquireConnection.bind(driver);
            
            driver.acquireConnection = async () => {
                const connection = await originalAcquireConnection();
                const originalExecuteQuery = connection.executeQuery.bind(connection);
                
                connection.executeQuery = async <R>(compiledQuery: any): Promise<any> => {
                    const result = await originalExecuteQuery(compiledQuery);
                    const casted = result as any;
                    if (casted && casted.numUpdatedOrDeletedRows !== undefined) {
                        // Transform to the new expected numAffectedRows
                        if (casted.numAffectedRows === undefined) {
                            (casted as any).numAffectedRows = BigInt(casted.numUpdatedOrDeletedRows || 0);
                        }
                        // Remove the old property to satisfy Kysely's check
                        const dummy = casted.numUpdatedOrDeletedRows;
                        delete (casted as any).numUpdatedOrDeletedRows; 
                    }
                    return casted;
                };
                return connection;
            };
            return driver;
        };

        const db = new Kysely<any>({ dialect });

        console.log("[AUTH-INIT] Running betterAuth constructor...");
        const auth = betterAuth({
            database: {
                provider: "sqlite",
                db: db,
            },
            secret: env?.BETTER_AUTH_SECRET || '',
            baseURL,
            logger: {
                disabled: false,
                level: "error",
            },
            emailAndPassword: { 
                enabled: authConfig.strategies?.local?.enabled ?? true,
                autoSignIn: true,
                minPasswordLength: authConfig.strategies?.local?.passwordMinLength ?? 8,
                maxPasswordLength: 128
            },
            user: {
                additionalFields: {
                    role: { type: "string" as any, required: false, defaultValue: "user" },
                    workspaceId: { type: "string" as any, required: false, defaultValue: authConfig.defaultWorkspaceId || "system" }
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

    // Enterprise Level 10: Headless Auth Protocol (Token-First Resolution)
    // Support Bearer Token directly from Header for non-browser/internal clients
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token) {
            const internalSession = await auth.api.getSession({
                headers: {
                    cookie: `better-auth.session_token=${token}`
                }
            });
            if (internalSession) {
                return {
                    ...internalSession.user,
                    sub: internalSession.user.id,
                    role: (internalSession.user as any).role || 'user',
                    workspaceId: (internalSession.user as any).workspaceId
                };
            }
        }
    }
  } catch (e: any) {
    console.error('[AUTH-VERIFY] Verification failed:', e.message);
  }

  return null;
}
