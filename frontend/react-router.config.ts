import type { Config } from "@react-router/dev/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export default {
  // Server-side render by default
  ssr: true,
  serverBuildFile: "_worker.js",
  serverModuleFormat: "esm",
  buildEnd({ reactRouterConfig }) {
    if (process.env.NODE_ENV === "production" || process.env.GITHUB_ACTIONS) {
      console.log("  [Build] Bundling Cloudflare Worker entry point...");
      const workerPath = path.join(process.cwd(), "app", "worker.ts");
      const outputPath = path.join(reactRouterConfig.buildDirectory, "client", "_worker.js");
      
      try {
        const banner = "import { MessageChannel } from 'node:worker_threads'; globalThis.MessageChannel = globalThis.MessageChannel || MessageChannel;";
        execSync(`npx esbuild ${workerPath} --bundle --minify --format=esm --outfile=${outputPath} --platform=browser --conditions=worker,workerd,browser --target=esnext --external:node:* --banner:js="${banner}" --log-level=error`, { stdio: 'inherit' });
        
        // Function to calculate directory size
        const getDirSize = (dir: string): number => {
          const file = fs.readdirSync(dir, { withFileTypes: true });
          const paths = file.map(file => {
            const p = path.join(dir, file.name);
            if (file.isDirectory()) return getDirSize(p);
            if (file.isFile()) return fs.statSync(p).size;
            return 0;
          });
          return paths.reduce((acc, size) => acc + size, 0);
        };

        // Calculate and display statistics
        const clientDir = path.join(reactRouterConfig.buildDirectory, "client");
        const clientSizeBytes = getDirSize(clientDir);
        const workerStats = fs.statSync(outputPath);
        const workerSizeBytes = workerStats.size;

        const clientMB = (clientSizeBytes / (1024 * 1024)).toFixed(2);
        const workerMB = (workerSizeBytes / (1024 * 1024)).toFixed(2);
        
        // ANSI Colors
        const green = "\x1b[32m";
        const yellow = "\x1b[33m";
        const red = "\x1b[31m";
        const cyan = "\x1b[36m";
        const reset = "\x1b[0m";
        const bold = "\x1b[1m";

        const getStatusColor = (mb: string, warning: number, critical: number) => {
          const val = parseFloat(mb);
          if (val > critical) return red;
          if (val > warning) return yellow;
          return green;
        };

        const clientColor = getStatusColor(clientMB, 10, 20); // Warning at 10MB, Critical at 20MB
        const workerColor = getStatusColor(workerMB, 5, 9);   // Warning at 5MB, Critical at 9MB (CF limit is ~10MB)

        console.log(`\n  ${bold}${cyan}📊 Build Statistics:${reset}`);
        console.log(`  ${bold}└─ Total Client Assets:${reset} ${clientColor}${clientMB} MB${reset} ${parseFloat(clientMB) > 10 ? "⚠️" : "✅"}`);
        console.log(`  ${bold}└─ Cloudflare Worker:  ${reset} ${workerColor}${workerMB} MB${reset} ${parseFloat(workerMB) > 5 ? "⚠️" : "✅"}`);
        console.log(`  ${bold}└─ Final Bundle Path: ${reset} ${path.relative(process.cwd(), outputPath)}\n`);

        if (parseFloat(workerMB) > 9) {
          console.log(`  ${red}${bold}CRITICAL: Worker size is near Cloudflare limit (10MB)!${reset}\n`);
        }
      } catch (e: any) {
        console.error("  [Build] Failed to bundle worker:", e.message);
        process.exit(1);
      }
    }
  },
} satisfies Config;

