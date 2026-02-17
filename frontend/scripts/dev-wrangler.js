import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';

// Prefer env token, then interactive TTY, then existing wrangler OAuth session
const hasTokenEnv = Boolean(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_EMAIL);
const isInteractive = Boolean(process.stdin.isTTY);
let canRun = hasTokenEnv || isInteractive;

if (!canRun) {
  // last-resort: check for an authenticated wrangler session in PATH or via npx
  try {
    const wranglerWhoami = spawnSync('wrangler', ['whoami'], { encoding: 'utf8' });
    if (wranglerWhoami && wranglerWhoami.status === 0) {
      canRun = true;
    }
  } catch (err) {
    /* ignore */
  }

  if (!canRun) {
    try {
      const npxWhoami = spawnSync('npx', ['wrangler', 'whoami'], { encoding: 'utf8' });
      if (npxWhoami && npxWhoami.status === 0) canRun = true;
    } catch (err) {
      /* ignore */
    }
  }
}

if (!canRun) {
  console.info('[dev-wrangler] Wrangler proxy-mode skipped — no authentication available (CLOUDFLARE_API_TOKEN or interactive session). Using static Pages dev fallback; no action required for local dev.');
  console.info('[dev-wrangler] To enable proxy-mode: run `npx wrangler login` or set CLOUDFLARE_API_TOKEN in your environment.');
  process.exit(0);
}

const hasNpx = (() => {
  try { return spawnSync('npx', ['--version'], { encoding: 'utf8' }).status === 0; } catch { return false; }
})();

// Prefer static Pages dev on Windows (avoids known esbuild/wrk async assertion on Win).
// Allow opt-in override via DEV_WRANGLER_FORCE_PROXY to force proxy-mode on Windows.
const isWin = process.platform === 'win32';
const forceProxy = Boolean(process.env.DEV_WRANGLER_FORCE_PROXY);
const preferStaticOnWin = isWin && !forceProxy;
if (isWin && forceProxy) console.info('[dev-wrangler] DEV_WRANGLER_FORCE_PROXY=true — forcing proxy-mode on Windows (opt-in).');
if (preferStaticOnWin) {
  console.info('[dev-wrangler] Running Pages static dev on Windows (proxy-mode disabled to avoid bundler issues).');
  if (!hasNpx) {
    console.info('[dev-wrangler] `npx` not available — skipping Pages static fallback. To enable proxy/static Pages dev, ensure `npx` is in PATH or set CLOUDFLARE_API_TOKEN and use `wrangler` directly.');
    process.exit(0);
  }
  const fallback = spawn('npx', ['wrangler', 'pages', 'dev', './build/client'], { stdio: 'inherit' });
  fallback.on('exit', fc => process.exit(fc ?? 0));
  fallback.on('error', err => { console.error('[dev-wrangler] Static fallback failed:', err); process.exit(1); });
} else {
  console.info('[dev-wrangler] Attempting `wrangler pages dev --proxy 5173` (will fallback to static build on failure).');
  let proxyCmd = spawn('npx', ['wrangler', 'pages', 'dev', '--proxy', '5173'], { stdio: 'inherit' });

proxyCmd.on('exit', (code) => {
  if (code === 0) return process.exit(0);
  console.warn('[dev-wrangler] `wrangler pages dev --proxy` failed (exit ' + code + '). Attempting fallback: build frontend then run `wrangler pages dev ./build/client`.');

  try {
    // If this script is already running inside the `frontend` package (npm --prefix used by caller),
    // run `npm run build` locally; otherwise use --prefix to target the frontend folder.
    const useLocal = existsSync('package.json');
    const buildArgs = useLocal ? ['run', 'build'] : ['run', 'build', '--prefix', 'frontend'];
    const build = spawnSync('npm', buildArgs, { stdio: 'inherit' });
    if (build.status !== 0) {
      console.error('[dev-wrangler] Frontend build failed. Aborting fallback.');
      return process.exit(code ?? 1);
    }

    if (!hasNpx) {
      console.info('[dev-wrangler] `npx` not available — skipping Pages static fallback after build. Frontend built successfully, but Wrangler is not found in PATH.');
      return process.exit(0);
    }

    const fallback = spawn('npx', ['wrangler', 'pages', 'dev', './build/client'], { stdio: 'inherit' });
    fallback.on('exit', fc => process.exit(fc ?? 0));
    fallback.on('error', err => { console.error('[dev-wrangler] Fallback failed:', err); process.exit(1); });
  } catch (err) {
    console.error('[dev-wrangler] Fallback encountered an error:', err);
    process.exit(1);
  }
});

proxyCmd.on('error', err => { console.error('[dev-wrangler] failed to start wrangler (proxy):', err); process.exit(1); });
  }
