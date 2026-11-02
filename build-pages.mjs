import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const [page, seedText, template] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'vendors.json'), 'utf8'),
  readFile(resolve(root, 'runtime-template.js'), 'utf8'),
]);

const seed = JSON.parse(seedText);
const worker = template
  .replace('__PAGE__', JSON.stringify(page))
  .replace('__SEED__', JSON.stringify(seed));

if (worker.includes('__PAGE__') || worker.includes('__SEED__')) {
  throw new Error('Worker template values were not embedded');
}

const out = resolve(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(resolve(out, '_worker.js'), worker);
console.log(`Built Cloudflare Pages Worker with ${seed.length} directory listings`);
