import { type RouteConfig, route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default (async () => {
    // 1. Get all routes from the routes folder (UI routes)
    const fsRoutes = await flatRoutes({
        ignoredRouteFiles: [
            "**/.*", 
            "**/*.test.*",
            "**/__*",
            "**/api/**", 
            "**/api.*"
        ],
    });

    // 2. Define the main dynamic API route FIRST with higher priority
    // This MUST come before UI routes to intercept /api/* paths
    // React Router v7 processes routes in order, first match wins
    const apiRoutes = [
        // API routes - these must come FIRST and match BEFORE any UI routes
        route("api/*", "routes/api.tsx", { id: "api-catch-all" })
    ];

    // 3. Combine them, putting API at the VERY START
    const finalRoutes = [
        ...apiRoutes,
        ...fsRoutes
    ];

    console.log(`[ROUTES-CONFIG] Total: ${finalRoutes.length}, API: ${apiRoutes.length}`);
    return finalRoutes;
})() as any;
