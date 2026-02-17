import { createAuthClient } from "better-auth/react";
import { getLocalAgentUrl } from "./services";

/**
 * AUTH CLIENT - Enterprise Level 10 Hybrid Infrastructure
 * Defaults to Cloudflare Worker (The Brain) with dynamic Local Agent fallback capabilities.
 */
export const authClient = createAuthClient({
    // Always use the full origin in the browser to satisfy Better-Auth's URL requirement.
    // This allows the frontend to work independently of the Node.js backend agent.
    baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:5000",
    fetchOptions: {
        credentials: "include"
    }
});

// Compact exports (app-v3 pattern) for easier hooks usage
export const { signIn, signUp, signOut, useSession } = authClient;
