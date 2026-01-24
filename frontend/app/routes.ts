import { type RouteConfig, route, index } from "@react-router/dev/routes";
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
    // Use :p0 to :p6 to catch up to 6 segments of API paths
    // This matches paths like: /api/action/entity-history/type/id
    const apiRoutes = [
        route("api/:p0/:p1/:p2/:p3/:p4/:p5", "routes/api.$.tsx", { id: "api-6" }),
        route("api/:p0/:p1/:p2/:p3/:p4", "routes/api.$.tsx", { id: "api-5" }),
        route("api/:p0/:p1/:p2/:p3", "routes/api.$.tsx", { id: "api-4" }),
        route("api/:p0/:p1/:p2", "routes/api.$.tsx", { id: "api-3" }),
        route("api/:p0/:p1", "routes/api.$.tsx", { id: "api-2" }),
        route("api/:p0", "routes/api.$.tsx", { id: "api-1" })
    ];

    // 3. Combine them, putting API at the VERY START
    const finalRoutes = [
        ...apiRoutes,
        ...fsRoutes
    ];

    console.log(`[ROUTES] Total routes: ${finalRoutes.length}, API routes: ${apiRoutes.length}`);
    return finalRoutes;
})() as any;
