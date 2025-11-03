#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const shouldSkip = (() => {`n  // Auto-skip on Vercel`n  if (process.env.VERCEL) return true;
  const value = process.env.SKIP_FRONTEND_PREBUILD;
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
})();

if (shouldSkip) {
  console.log('[prebuild] SKIP_FRONTEND_PREBUILD set – skipping Python reconcile step.');
  process.exit(0);
}

const pythonCommand = process.env.PYTHON_CMD || process.env.PYTHON || 'python';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const args = ['-m', 'bi.reconcile.run', 'artifacts/p09.parquet', 'artifacts/p10.parquet', 'bi/semantic/metrics.yml'];

console.log(`[prebuild] Running ${pythonCommand} ${args.join(' ')}`);

const result = spawnSync(pythonCommand, args, {
  stdio: 'inherit',
  cwd: frontendRoot
});

if (result.error) {
  console.error('[prebuild] Failed to start Python process:', result.error.message);
  process.exit(1);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
