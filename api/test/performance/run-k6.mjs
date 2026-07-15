import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const performanceDir = resolve(import.meta.dirname);
const k6Dir = resolve(performanceDir, 'k6');
const defaultScript = 'login.load.js';
const scriptName = process.env.K6_SCRIPT ?? defaultScript;
const scriptPath = resolve(k6Dir, scriptName);

if (!existsSync(scriptPath)) {
  console.error(
    `Unknown K6_SCRIPT "${scriptName}". Expected a file under ${k6Dir}.`,
  );
  process.exit(1);
}

const result = spawnSync('k6', ['run', scriptPath], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
