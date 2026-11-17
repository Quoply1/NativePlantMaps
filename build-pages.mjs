import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const [page, seedText, template, guides, directory, favicon, auditText] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'vendors.json'), 'utf8'),
  readFile(resolve(root, 'runtime-template.js'), 'utf8'),
  readFile(resolve(root, 'ecoregion-guides.json'), 'utf8'),
  readFile(resolve(root, 'ecoregion-search.json'), 'utf8'),
  readFile(resolve(root, 'favicon.svg'), 'utf8'),
  readFile(resolve(root, 'provider-audit.json'), 'utf8'),
]);
const audit = JSON.parse(auditText);
const seed = JSON.parse(seedText).map(vendor => {
  const check = audit.providers[vendor.id];
  if (!check) return vendor;
  const { original, ...updates } = check;
  if (original !== vendor.website) return vendor;
  const base = { ...vendor };
  delete base.preview;
  const sources = (updates.sources ?? vendor.sources ?? []).flatMap(source => {
    const check = audit.sources[source.url];
    if (check === 'broken') return [];
    if (source.url === original && original !== updates.website && updates.websiteStatus !== 'unverified') return [];
    if (check === 'unverified' || !check) return [{ ...source, verificationPending: true }];
    return [{ ...source, url: check === 'verified' ? source.url : check }];
  });
  return { ...base, ...updates, sources };
});
const guideJson = JSON.stringify(JSON.parse(guides)).replaceAll('<', '\\u003c');
const directoryJson = JSON.stringify(JSON.parse(directory)).replaceAll('<', '\\u003c');
const html = page.replace('__ECOREGION_GUIDES__', () => guideJson).replace('__ECOREGION_DIRECTORY__', () => directoryJson);
const worker = template.replace('__PAGE__', () => JSON.stringify(html)).replace('__SEED__', () => JSON.stringify(seed)).replace('__FAVICON__', () => JSON.stringify(favicon));
if (worker.includes('__PAGE__') || worker.includes('__SEED__') || worker.includes('__FAVICON__')) throw new Error('Worker template values were not embedded');
const out = resolve(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(resolve(out, '_worker.js'), worker);
console.log(`Built Cloudflare Pages Worker with ${seed.length} directory listings`);
