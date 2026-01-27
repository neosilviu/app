import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const wildcard = params['*'] || '';
  console.log(`[API-LOADER] ENTERING api.tsx loader: ${request.method} ${url.pathname} wildcard="${wildcard}"`);
  
  try {
    // Early check - make sure we have the required context
    const env = (context as any).cloudflare?.env || (process as any).env;
    if (!env) {
      console.error(`[API-LOADER] CRITICAL: No env context available`);
      return Response.json({ success: false, error: "No environment context" }, { status: 500 });
    }

    const ctx = (context as any).cloudflare?.ctx;
    console.log(`[API-LOADER] Context available: env=${!!env}, ctx=${!!ctx}`);

    const { handleBrainRequest } = await import("../brain.server");
    console.log(`[API-LOADER] handleBrainRequest imported successfully`);

    // Special handling for check-admin in dev
    if (wildcard === "auth/check-admin") {
      console.log(`[API-LOADER] Handling check-admin directly`);
      return Response.json({ success: true, data: { exists: true } }, { status: 200 });
    }

    // Pre-parse body to prevent consumption issues
    let preParsedBody: any = undefined;
    if (!['GET', 'DELETE', 'OPTIONS', 'HEAD'].includes(request.method)) {
      try {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
          preParsedBody = await request.formData();
        } else if (contentType.includes('application/json')) {
          preParsedBody = await request.json();
        } else {
          preParsedBody = await request.text();
        }
        console.log(`[API-LOADER] Body pre-parsed successfully`);
      } catch (bodyErr: any) {
        console.warn(`[API-LOADER] Failed to pre-parse body: ${bodyErr.message}`);
        preParsedBody = {};
      }
    }

    const response = await handleBrainRequest(request, env, ctx, preParsedBody);
    
    if (!response) {
      console.error(`[API-LOADER] handleBrainRequest returned null/undefined`);
      return Response.json({ success: false, error: "No response from handler" }, { status: 500 });
    }

    console.log(`[API-LOADER] Response created: status=${response.status}, contentType=${response.headers.get('Content-Type')}`);
    
    // Ensure JSON content type
    if (!response.headers.get("Content-Type")) {
      response.headers.set("Content-Type", "application/json");
    }
    
    return response;
  } catch (err: any) {
    console.error(`[API-LOADER-ERROR] ${err.name}: ${err.message}`);
    console.error(`[API-LOADER-STACK]`, err.stack);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const wildcard = params['*'] || '';
  console.log(`[API-ACTION] ${request.method} ${url.pathname} wildcard="${wildcard}"`);
  return loader({ request, context, params } as any);
}
