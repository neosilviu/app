import { type RouteConfig, route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default (async () => {
    // 1. Explicitly define API route at higher priority than dynamic segments
    const apiRoutes: any[] = [
        route("api/*", "routes/api.$.tsx")
    ];

    // 2. FS Routes (UI)
    const fsRoutes = await flatRoutes({
        ignoredRouteFiles: ["**/api.$.tsx"] // Avoid duplicates
    });

    console.log(`[ROUTES-CONFIG] Priority API: ${apiRoutes.length}, UI: ${fsRoutes.length}`);
    
    return [
        ...apiRoutes,
        ...fsRoutes
    ];
})() as any;
