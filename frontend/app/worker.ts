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

    try {
      // 0. Brain API (Central logic) - Handle /api calls directly
      if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
        const brainResponse = await handleBrainRequest(request, env);
        console.log(`[WORKER] [${requestId}] Brain API Response: ${brainResponse.status}`);
        return brainResponse;
      }

      // 1. Serve static assets from Cloudflare Pages
      if (url.pathname.includes('.') && !url.pathname.endsWith('.html')) {
        const assetResponse = await env.ASSETS.fetch(request.clone());
        if (assetResponse.status < 400) {
          return assetResponse;
        }
      }

      // 2. React Router SSR handler
      const response = await (handleRequest as any)({
        request,
        env,
        waitUntil: ctx.waitUntil?.bind(ctx),
        passThroughOnException: ctx.passThroughOnException?.bind(ctx) || (() => {}),
        ...ctx
      });

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

