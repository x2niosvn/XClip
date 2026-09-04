import { spawn } from 'child_process';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function start() {
  console.log('[XClip Dev] Starting Vite dev server...');
  const viteServer = await createServer({
    configFile: path.resolve(rootDir, 'vite.config.ts'),
    mode: 'development',
  });
  await viteServer.listen();
  const address = viteServer.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  console.log(`[XClip Dev] Vite dev server running at http://localhost:${port}`);

  console.log('[XClip Dev] Compiling Main and Preload TypeScript...');
  await runCommand('npx.cmd tsc -p tsconfig.main.json');
  await runCommand('npx.cmd tsc -p tsconfig.preload.json');

  console.log('[XClip Dev] Launching Electron...');
  const env = {
    ...process.env,
    VITE_DEV_SERVER_URL: `http://localhost:${port}`,
    NODE_ENV: 'development',
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  };

  const electronProcess = spawn('npx.cmd electron .', {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: true,
  });

  electronProcess.on('close', (code) => {
    console.log(`[XClip Dev] Electron process exited with code ${code}`);
    viteServer.close();
    process.exit(0);
  });
}

function runCommand(commandLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(commandLine, { cwd: rootDir, stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command "${commandLine}" failed with code ${code}`));
    });
  });
}

start().catch((err) => {
  console.error('[XClip Dev] Error starting dev server:', err);
  process.exit(1);
});
