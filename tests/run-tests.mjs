import { spawnSync } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDir, '..');
const outputDir = path.join(rootDir, '.test-dist');
const entries = (await readdir(testsDir))
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => path.join(testsDir, name));

await rm(outputDir, { recursive: true, force: true });

await build({
  entryPoints: entries,
  outdir: outputDir,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: 'inline',
  logLevel: 'warning',
});

const compiledTests = entries.map((entry) =>
  path.join(outputDir, path.basename(entry).replace(/\.ts$/, '.js')),
);
const result = spawnSync(process.execPath, ['--test', ...compiledTests], {
  cwd: rootDir,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
