import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process";
import path from "node:path";
import { EventEmitter } from "node:events";

// Silence MaxListenersExceededWarning globally during dev/hmr
if (typeof process !== 'undefined') {
  process.setMaxListeners(100);
  EventEmitter.defaultMaxListeners = 100;
}

let memoizedVersion: string | null = null;
const getVersion = () => {
  if (memoizedVersion) return memoizedVersion;
  try {
    const hash = execSync("git rev-parse --short HEAD", { stdio: 'pipe' }).toString().trim();
    const date = new Date().toISOString();
    memoizedVersion = JSON.stringify({
      version: "2.0.0",
      hash: hash,
      date: date
    });
  } catch (e) {
    const date = new Date().toISOString();
    memoizedVersion = JSON.stringify({
      version: "2.0.0",
      hash: "dev",
      date: date
    });
  }
  return memoizedVersion;
};

export default defineConfig(({ command }) => ({
  envDir: "../",
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  optimizeDeps: {
    include: [
      "lucide-react",
      "framer-motion",
      "axios",
      "socket.io-client",
      "react-i18next",
      "i18next",
      "clsx",
      "tailwind-merge"
    ],
    exclude: ["@react-router/node"]
  },
  plugins: [
    command === 'serve' ? cloudflareDevProxy({
      configPath: path.resolve("wrangler.toml"),
    }) : undefined,
    reactRouter(),
    tailwindcss(), 
    tsconfigPaths()
  ].filter(Boolean) as any,
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
  esbuild: {
    target: "esnext", // Faster compilation
    legalComments: 'none',
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        // Silence "default" is not exported warnings for shared CJS file
        if (
          warning.code === 'MISSING_EXPORT' && 
          (warning.message.includes('"default"') || warning.message.includes('is not exported by')) &&
          (warning.exporter?.includes('lib/core') || warning.exporter?.includes('global-registry.baseline.js'))
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('framer-motion')) return 'animations';
            if (id.includes('socket.io-client')) return 'socket-vendor';
            if (id.includes('radix-ui')) return 'ui-vendor';
            return 'vendor';
          }
        }
      }
    }
  },
  server: {
    host: true, // Permite accesul extern (ex: 192.168.2.3)
    port: 8788,
    strictPort: true,
    warmup: {
      clientFiles: ["./app/root.tsx", "./app/routes/**/*"],
    },
    watch: {
      usePolling: false,
      ignored: ["**/node_modules/**", "**/backend/**", "**/logs/**", "**/backups/**", "**/whatsapp_session/**", "**/local-inbox/**", "**/.dev-logs/**"],
    },
    hmr: {
      clientPort: 8788,
      overlay: false, // Disable error overlay for smoother experience on heavy loads
    },
    proxy: {
      "/api/socket.io": {
        target: "http://127.0.0.1:4001",
        ws: true,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err: any, _req, _res) => {
            if (err.code === 'ECONNREFUSED') {
              // Silence noisy logs in dev when local agent is offline
              return;
            }
            console.warn('[VITE-PROXY-ERR]', err.message);
          });
        }
      },
      "/api-local": {
        target: "http://127.0.0.1:4001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-local/, ""),
        configure: (proxy, _options) => {
          proxy.on('error', (err: any, _req, _res) => {
            if (err.code === 'ECONNREFUSED') return;
            console.warn('[VITE-PROXY-ERR-LOCAL]', err.message);
          });
        }
      },
      // Proxy /api/auth/* to Brain handler (React Router will handle via api/*) 
      // Do NOT proxy to backend - Better-Auth is integrated into Brain handler
      // NOTE: vite proxy won't touch it, React Router wildcard will catch it
      
      // Proxy legacy APIs to backend, but EXCLUDE new RR7 routes + auth
      // This regex matches /api/ followed by anything EXCEPT the listed RR7 routes
      // REMOVED: Proxy to backend-v2 abandoned, all API calls go to Worker
    }
  },
}));
 

