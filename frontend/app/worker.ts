import { createRequestHandler } from "@react-router/cloudflare";
import { handleBrainRequest } from "./brain.server";
// @ts-ignore
import * as build from "../build/server/_worker.js";

const handleRequest = createRequestHandler({ build });

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    const method = request.method;
    const requestId = crypto.randomUUID().slice(0, 8);
    
    console.log(`[WORKER] [${requestId}] ${method} ${url.pathname}`);

    let preParsedBody: any = undefined;

    // 0. Brain API (Central logic) - Handle /api calls FIRST, before React Router
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      try {
        // CRITICAL: Pre-parse body for non-GET requests BEFORE passing to React Router
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            const contentType = request.headers.get('content-type') || '';
            try {
                const cloned = request.clone();
                if (contentType.includes('application/json')) {
                    preParsedBody = await cloned.json();
                    console.log(`[WORKER-BODY-CAPTURE] Parsed JSON body for ${method} ${url.pathname}`);
                } else if (contentType.includes('multipart/form-data')) {
                    const fd = await cloned.formData();
                    preParsedBody = Object.fromEntries(fd.entries());
                    console.log(`[WORKER-BODY-CAPTURE] Parsed FormData body for ${method} ${url.pathname}`);
                } else if (contentType.includes('application/x-www-form-urlencoded')) {
                    const fd = await cloned.formData();
                    preParsedBody = Object.fromEntries(fd.entries());
                    console.log(`[WORKER-BODY-CAPTURE] Parsed URLEncoded body for ${method} ${url.pathname}`);
                } else {
                    const text = await cloned.text();
                    if (text && text.trim()) {
                        try {
                            preParsedBody = JSON.parse(text);
                            console.log(`[WORKER-BODY-CAPTURE] Parsed text/JSON body for ${method} ${url.pathname}`);
                        } catch (e) {
                            preParsedBody = text;
                            console.log(`[WORKER-BODY-CAPTURE] Captured raw text body for ${method} ${url.pathname}`);
                        }
                    }
                }
            } catch (e) {
                console.warn(`[WORKER] Failed to pre-parse body: ${e}`);
            }
        }
        
        const brainResponse = await handleBrainRequest(request, env, ctx, preParsedBody);
        console.log(`[WORKER] [${requestId}] Brain API Response: ${brainResponse.status}`);
        return brainResponse;
      } catch (e: any) {
        console.error(`[WORKER-API-ERROR] [${requestId}] ${e.message}`);
        return new Response(JSON.stringify({ success: false, error: e.message }), { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    try {
      // 1. Serve static assets from Cloudflare Pages
      if (url.pathname.includes('.') && !url.pathname.endsWith('.html')) {
        const assetResponse = await env.ASSETS.fetch(request.clone());
        if (assetResponse.status < 400) {
          return assetResponse;
        }
      }

      // 2. React Router SSR handler (only for non-API routes)
      let handlerContext: any = {
        request,
        env,
        waitUntil: ctx.waitUntil?.bind(ctx),
        passThroughOnException: ctx.passThroughOnException?.bind(ctx) || (() => {}),
        ...ctx
      };
      const response = await (handleRequest as any)(handlerContext);

      console.log(`[WORKER] [${requestId}] Response: ${response.status}`);
      return response;
    } catch (e: any) {
      console.error(`[WORKER] [${requestId}] Error: ${e.message}`, e.stack);
      return new Response(
        `Worker Error: ${e.message}\nStack: ${e.stack}`,
        { status: 500 }
      );
    }
  },
};

