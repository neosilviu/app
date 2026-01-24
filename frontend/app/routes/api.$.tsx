import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { handleBrainRequest } from "../brain.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    const env = (context as any).cloudflare?.env || (process as any).env;
    const ctx = (context as any).cloudflare?.ctx;
    const response = await handleBrainRequest(request, env, ctx);
    
    // Force JSON content type if it's missing
    if (!response.headers.get("Content-Type")) {
      response.headers.set("Content-Type", "application/json");
    }
    
    return response;
  } catch (err: any) {
    console.error(`[DYNAMIC-API] Error:`, err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  return loader({ request, context } as any);
}
