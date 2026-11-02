# Native Plant Access Map

A public, source-linked directory of native-plant nurseries, growers, seasonal sales, and community sources. This update includes 156 listings representing all 50 states. Pins can be approximate, native inventory changes, and state coverage does not mean every community has a listing.

## Update the existing GitHub repository

This package intentionally uses a **flat root layout**. Upload and replace these files directly in the root of the existing `Quoply1/Test` repository:

- `index.html`
- `vendors.json`
- `runtime-template.js`
- `build-pages.mjs`
- `package.json`
- `0000_community_submissions.sql`
- `.gitignore`
- `README.md`

Do not upload the containing folder as a nested directory. Cloudflare's build command is `npm run build`; build output is `dist`. The build script reads all three source files from the repository root.

## Cloudflare Pages build

For the existing `nativeplantmaps.pages.dev` project, use root directory `/`, build command `npm run build`, and build output directory `dist`. There are no runtime package dependencies. If the dashboard has a separate deploy command, leave it blank for this Pages build.

## Enable public submissions and editor review

The public listing and map work from the embedded seed data without D1. Community submissions and moderation need a D1 database:

1. Create a Cloudflare D1 database.
2. In its SQL console, run `0000_community_submissions.sql` from this repository.
3. In the Pages project's **Settings → Bindings**, add a D1 binding named `DB` and select that database.
4. Add the runtime variable `NATIVE_ADMIN_EMAIL` with the email address that Cloudflare Access will use for the editor.
5. In Cloudflare Zero Trust → Access → Applications, create a self-hosted application for `nativeplantmaps.pages.dev` and restrict `/admin*` and `/api/admin/*` to the editor email.
6. Redeploy and verify that a visitor can submit a suggestion, while `/admin` and `/api/admin/*` reject visitors without editor access.

The worker checks Cloudflare Access's `cf-access-authenticated-user-email` header and compares it with `NATIVE_ADMIN_EMAIL`. Never put access credentials or tokens in repository files. If D1 is not bound, suggestions show a clear temporary-unavailable response; public seed listings still load.

## Evidence and coverage

A documented native offering can come from the seller's catalog or a relevant state, extension, conservation, or native-plant organization. “Native specialist” means native plants are a core focus. “Documented native stock” means a native selection is documented within a broader business. “Wide selection” and “Select native stock” are qualitative summaries of visible catalogs, not live counts. A seller's claim or directory entry is linked for visitors to check; availability, provenance, and local nativity should be confirmed directly.
