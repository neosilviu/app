const { spawn } = require('child_process');
const path = require('path');

function run(cmd, args) {
  const ps = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: process.cwd() });
  ps.on('exit', (code) => {
    if (code !== 0) process.exit(code);
  });
  return ps;
}

(async function main() {
  const tsCmd = `node --loader ts-node/esm ${path.join('frontend','app','hono-dev.ts')}`;
  try {
    console.log('Attempting to run Hono via ts-node/esm...');
    const p = run('node', ['--loader', 'ts-node/esm', path.join('frontend','app','hono-dev.ts')]);
    p.on('error', (err) => {
      console.error('ts-node execution failed:', err.message || err);
      fallback();
    });
  } catch (err) {
    console.error('ts-node start error:', err && (err.message || err));
    fallback();
  }

  function fallback() {
    const distPath = path.join('dist-hono','frontend','app','hono-dev.js');
    console.log('Falling back to runtime JS at', distPath);
    run('node', [distPath]);
  }
})();
