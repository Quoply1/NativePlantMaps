import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const [page, seedText, template, guides, directory, favicon, auditText, logoText] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'vendors.json'), 'utf8'),
  readFile(resolve(root, 'runtime-template.js'), 'utf8'),
  readFile(resolve(root, 'ecoregion-guides.json'), 'utf8'),
  readFile(resolve(root, 'ecoregion-search.json'), 'utf8'),
  readFile(resolve(root, 'favicon.svg'), 'utf8'),
  readFile(resolve(root, 'provider-audit.json'), 'utf8'),
  readFile(resolve(root, 'provider-logos.json'), 'utf8'),
]);
const audit = JSON.parse(auditText);
const logos = JSON.parse(logoText);
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
  const logo = logos[vendor.id];
  const preview = updates.preview ?? (logo?.website === updates.website && logo?.image
    ? { image: logo.image, alt: logo.alt ?? vendor.name + ' logo', type: 'logo', dark: logo.dark === true }
    : undefined);
  return { ...base, ...updates, sources, preview };
});
const guideJson = JSON.stringify(JSON.parse(guides)).replaceAll('<', '\\u003c');
const directoryJson = JSON.stringify(JSON.parse(directory)).replaceAll('<', '\\u003c');
const html = page.replace('__ECOREGION_GUIDES__', () => guideJson).replace('__ECOREGION_DIRECTORY__', () => directoryJson);
const providerAssets = Object.fromEntries(await Promise.all([['beavers-logo.webp', 'image/webp'], ['condursos-logo.png', 'image/png'], ['wild-south-logo.jpg', 'image/jpeg']].map(async ([name, type]) => ['/assets/providers/' + name, { type, data: (await readFile(resolve(root, 'assets/providers', name))).toString('base64') }])));
const worker = template.replace('__PAGE__', () => JSON.stringify(html)).replace('__SEED__', () => JSON.stringify(seed)).replace('__FAVICON__', () => JSON.stringify(favicon)).replace('__PROVIDER_ASSETS__', () => JSON.stringify(providerAssets));
if (worker.includes('__PAGE__') || worker.includes('__SEED__') || worker.includes('__FAVICON__') || worker.includes('__PROVIDER_ASSETS__')) throw new Error('Worker template values were not embedded');
const out = resolve(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(resolve(out, '_worker.js'), worker);
console.log(`Built Cloudflare Pages Worker with ${seed.length} directory listings`);
