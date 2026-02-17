import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';

// Prefer env token, then interactive TTY, then existing wrangler OAuth session
const hasTokenEnv = Boolean(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_EMAIL);
const isInteractive = Boolean(process.stdin.isTTY);
let canRun = hasTokenEnv || isInteractive;

if (!canRun) {
  // last-resort: check if `wrangler whoami` is already authenticated on the machine
  try {
    const whoami = spawnSync('npx', ['wrangler', 'whoami'], { encoding: 'utf8' });
    if (whoami.status === 0) canRun = true;
  } catch (err) {
    /* ignore */
  }
}

if (!canRun) {
  console.log('[dev-wrangler] Skipping `wrangler pages dev` — no CLOUDFLARE_API_TOKEN, non-interactive, and no existing wrangler session.');
  console.log('[dev-wrangler] To enable wrangler dev, run: `npx wrangler login` or set CLOUDFLARE_API_TOKEN in your env.');
  process.exit(0);
}

// Prefer static Pages dev on Windows (avoids known esbuild/wrk async assertion on Win)
const preferStaticOnWin = process.platform === 'win32';
if (preferStaticOnWin) {
  console.log('[dev-wrangler] Running Pages static dev by default on Windows (avoids proxy bundling issues)');
  const fallback = spawn('npx', ['wrangler', 'pages', 'dev', './build/client'], { stdio: 'inherit' });
  fallback.on('exit', fc => process.exit(fc ?? 0));
  fallback.on('error', err => { console.error('[dev-wrangler] Static fallback failed:', err); process.exit(1); });
} else {
  console.log('[dev-wrangler] Starting wrangler pages dev --proxy 5173 (will fallback to static build on failure)');
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
