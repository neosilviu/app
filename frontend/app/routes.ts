import { type RouteConfig, route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default (async () => {
    // 1. Get all routes from the routes folder
    const fsRoutes = await flatRoutes({
        ignoredRouteFiles: [
            "**/.*", 
            "**/api/**", 
            "**/api.*"
        ],
    });

    // 2. Define the main dynamic API route
    // We use multiple patterns to ensure we catch all depths and outrank UI routes
    // Giving unique IDs for each route definition to avoid React Router errors
    const apiRoutes = [
        route("api/:p1/:p2/:p3/:p4", "routes/api.tsx", { id: "api-4" }),
        route("api/:p1/:p2/:p3", "routes/api.tsx", { id: "api-3" }),
        route("api/:p1/:p2", "routes/api.tsx", { id: "api-2" }),
        route("api/:p1", "routes/api.tsx", { id: "api-1" }),
        route("api/*", "routes/api.tsx", { id: "api-splat" })
    ];

    // 3. Combine them, putting API at the VERY START
    const finalRoutes = [
        ...apiRoutes,
        ...fsRoutes
    ];

    console.log(`[ROUTES] Total routes: ${finalRoutes.length}, API routes: ${apiRoutes.length}`);
    return finalRoutes;
})() as any;
