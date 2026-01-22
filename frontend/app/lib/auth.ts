import { createAuthClient } from "better-auth/react";
import { getLocalAgentUrl } from "./services";

/**
 * AUTH CLIENT
 * Level 8: Points to the Brain (Cloudflare Worker) by default.
 * If Needed, the local agent can be used by overriding getLocalAgentUrl.
 */
export const authClient = createAuthClient({
    // Always use the full origin in the browser to satisfy Better-Auth's URL requirement.
    // This allows the frontend to work independently of the Node.js backend agent.
    baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:5000",
    fetchOptions: {
        credentials: "include"
    }
});
