// Node test runner: loads the site's classic scripts into one vm context
// (window === the context), then every tests/*.test.js. No dependencies.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = [
  'core/ns', 'core/sources', 'core/store', 'scenario/rng', 'scenario/swings', 'scenario/gen',
  'scenario/sessions', 'scenario/confluence', 'scenario/library', 'scenario/system', 'scenario/annotate', 'scenario/grade',
  'chart/scale', 'chart/render', 'chart/overlays', 'chart/chart', 'core/layout', 'core/motion',
].map((p) => `assets/js/${p}.js`);

const results = { passed: 0, failed: 0 };
const queue = [];

const ctx = vm.createContext({ console });
ctx.window = ctx;
ctx.readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
ctx.listRootHtml = () => fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
ctx.test = (name, fn) => queue.push({ name, fn });
ctx.eq = (a, b, msg) => {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg ? msg + ': ' : ''}expected ${sb}, got ${sa}`);
};
ctx.ok = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy value'); };
ctx.near = (a, b, eps = 1e-9, msg) => {
  if (!(Math.abs(a - b) <= eps)) throw new Error(`${msg ? msg + ': ' : ''}expected ${a} ~ ${b} (eps ${eps})`);
};

function load(file, label) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: label });
}

for (const rel of SCRIPTS) {
  const f = path.join(ROOT, rel);
  if (fs.existsSync(f)) load(f, rel);
}

const testFiles = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).sort();
for (const tf of testFiles) {
  try {
    load(path.join(ROOT, 'tests', tf), `tests/${tf}`);
  } catch (e) {
    results.failed++;
    console.log(`FAIL ${tf} (load): ${e.message}`);
  }
}

for (const { name, fn } of queue) {
  try {
    fn();
    results.passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    results.failed++;
    console.log(`FAIL ${name}\n     ${e.message}`);
  }
}

console.log(`${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
