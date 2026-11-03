# Native Plant Access Map

A source-linked public directory and map of nurseries, growers, seasonal sales, and other ways to find native plants in the United States.

## Build and publish

The project is a Cloudflare Pages Worker with static page assets embedded at build time.

1. Upload the project files to the connected GitHub repository, preserving the flat root layout.
2. Keep the Cloudflare Pages build command as `npm run build` and output directory as `dist`.
3. If the D1 submission workflow is enabled, keep the `DB` D1 binding and the required production variables configured in Cloudflare.
4. Deploy the repository’s `main` branch from Cloudflare Pages.

The build reads `index.html`, `vendors.json`, and `runtime-template.js`, then writes `dist/_worker.js`. It should report the number of directory listings embedded. Do not set the Pages deploy command to `npm run build`; the build command is sufficient.

## Data and community contributions

- `vendors.json` is the public directory seed data.
- `vendors-additions.json` contains the three listings from this audit pass. To merge them by hand, add each object to the `vendors.json` array before its final `]`, with a comma after the previous final object.
- Every listing links to its website and a Google Maps search in the interface. `sources` link to the evidence used for the native-stock description.
- `nativeTier` describes evidence strength: `specialist`, `documented`, or `unverified`.
- `nativeRange` describes catalog breadth: `wide`, `select`, or `unverified` where evidence is insufficient.
- `approx: true` marks an approximate map pin. Seasonal, appointment-only, wholesale, and delivery access is recorded in `access` and `availability`.
- Public suggestions go to the private review queue and are not published until approved.

## Audit files

`AUDIT_PROGRESS.md` explains the scope and limits of the current nationwide pass. The supplied `CITY_AUDIT_CITY_FRAME.csv` contains 824 places. One city-specific discovery search was run for each; captured results and the checklist are in `CITY_AUDIT_SEARCH_RESULTS.csv` and `CITY_AUDIT_CHECKLIST.csv`. City-radius reviews are still pending, so the current pass must not be described as an exhaustive 30-mile audit.

## Privacy and evidence

Field notes are stored in the visitor’s browser. Public reviews are for access context only and do not prove native status. Source links document an offering but do not promise current stock, local provenance, pesticide practices, or suitability for a particular planting site. Confirm current hours and inventory before visiting.

