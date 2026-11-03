# Security Hardening Report — Cappuccino Studiox

**Site:** Cappuccino Studiox portfolio (static site + Netlify Functions)
**Repository folder:** `portfolio-netlify-upload`
**Review date:** 29 October 2026
**Review type:** white-box source review + local dynamic testing
**Status:** remediation applied on disk; deployment-side items remain manual (see §6)

---

## 1. Executive summary

The site was a static portfolio that also exposed a JSON API (`netlify/functions/api.js`, mirrored for local development by `server.mjs`). The most serious problems were **authorisation**, not the static front end:

| # | Severity | Headline finding | Status |
|---|----------|------------------|--------|
| F-01 | Critical | Admin password hardcoded in client JS (literal redacted — see §6.5) | Fixed |
| F-02 | Critical | Every write endpoint (projects, config, bookings, waitlist, upload) was callable by anyone | Fixed |
| F-03 | High | `Access-Control-Allow-Origin: *` on the API | Fixed |
| F-04 | High | No CSP, no HSTS, no clickjacking defence, no framing/referrer policy | Fixed |
| F-05 | High | `publish = "."` served `server.mjs`, `netlify/**`, `node_modules/**`, `docs/**` and the raw booking/waitlist JSON | Fixed |
| F-06 | High | Unauthenticated, uncapped uploads with unsanitised filenames (dev server) | Fixed (prod upload now 501) |
| F-07 | Medium | Unbounded JSON bodies | Fixed |
| F-08 | Medium | Public forms had no bot protection at all | Fixed (honeypot + rate limit) |
| F-09 | Medium | `escapeHtml()` did not escape quotes → attribute-injection sink across admin/render code | Fixed |
| F-10 | Medium | Stored `javascript:` / `data:` URLs could reach `href`, `src` and `iframe.src` | Fixed |
| F-11 | Medium | 500 responses echoed internal error messages | Fixed |
| F-12 | Medium | Project ids flowed into paths/URLs without a shape check | Fixed |
| F-13 | Low | Third-party script (PDF.js from cdnjs) | Fixed (vendored) |
| F-14 | Low | Missing `Referrer-Policy`, `Permissions-Policy`, `nosniff`-adjacent hardening | Fixed |
| F-15 | Low | Admin/editor pages cacheable and indexable | Fixed |
| F-16 | Low | `.gitignore` did not cover `.env` / key material | Fixed |
| F-17 | Info | No source maps shipped, no `eval`/`new Function`/`document.write` | Verified clean |
| F-18 | Info | Dependency audit clean (`npm audit` → 0 vulnerabilities) | Verified |

**Residual risk after remediation is concentrated in three places** and cannot be closed by editing files in this repo: (a) the single shared admin token model, (b) `style-src 'unsafe-inline'` (the site has no build step to hash or extract inline styles), and (c) bot mitigation beyond the honeypot/rate-limit speed bump. See §5.

---

## 2. Phase 1 — Discovery

### 2.1 Stack as found

| Layer | Implementation | Notes |
|-------|----------------|-------|
| Hosting | Netlify, `[build] publish = "."` | The publish root is the repository root — everything not explicitly denied is public |
| API | `netlify/functions/api.js` (single function, path router) | Data in Netlify Blobs (`netlify/lib/blobStore.js`) |
| Local dev | `server.mjs` (Express 5) | Parallel implementation of the same routes, plus a static server and multer uploads |
| Front end | Static HTML + ES modules under `js/` | Six pages carried inline `<script>` blocks; two pages used inline `onclick=` |
| Storage in browser | IndexedDB + `localStorage` cache | Never a security boundary, treated as untrusted input where it re-enters rendering |
| Auth | Admin password embedded in `js/pages/index.js` | Verified client-side only |

### 2.2 Entry points reviewed

| Entry point | Method | Consumers | Trust level of input |
|-------------|--------|-----------|----------------------|
| `/api/local/projects` | GET / POST | `project-files`, `content-management`, `project-edit` | Admin for writes |
| `/api/local/projects/:id` | GET / PUT / DELETE | project pages, editor | id from URL |
| `/api/project-files-config` | GET / POST | `project-files`, `admin` | Admin for writes |
| `/api/availability` | GET | booking modal | none |
| `/api/bookings` | POST / GET / PATCH / DELETE | booking form, `admin` | Public write, admin read/mutate |
| `/api/waitlist` | POST / GET | waitlist form, `admin` | Public write, admin read |
| `/api/upload` | POST | `project-edit` | Admin |
| `/api/admin/session` | GET | `js/adminSession.js` | Admin (added in this pass) |

### 2.3 Observations that shaped the plan

1. **PII is stored server-side.** `src/data/bookings.json` and `src/data/waitlist.json` hold names/e-mails. With `publish = "."`, a raw GET of those paths returned the file. That made "deny list" work mandatory, not cosmetic.
2. **The admin UI is a static page.** Any secret it contains is public by definition, so authentication had to move server-side.
3. **There is no build step.** CSP therefore had to be satisfiable by hand: inline `<script>` had to be extracted, and inline `style` had to be tolerated (`'unsafe-inline'`) because the pages carry hundreds of `style=""` attributes and inline `<style>` blocks.
4. **Two server implementations must stay in sync.** Every control added to `api.js` was mirrored in `server.mjs`, otherwise local testing would give false confidence.
5. **The site is mounted at `/cappuccinostudiox` in production** (`netlify.toml` prefix rewrites). Every deny rule and path check therefore exists in both prefixed and unprefixed form.

---

## 3. Phase 2 — Remediation

### 3.1 F-01 (Critical) — Hardcoded admin password

**Was:** `js/pages/index.js` contained `const ADMIN_PASSWORD = '<the password>'` and compared the typed value in the browser. Anyone could read it from the JS bundle.

**Now:**

* `js/adminSession.js` (new, loaded by `admin.html` and `project-edit.html`) asks the operator for the token, keeps it in `sessionStorage` for the tab only, and attaches it as `X-Admin-Token` on same-origin `/api/*` requests through a `window.fetch` wrapper.
* `netlify/lib/adminAuth.js` verifies the token server-side with `crypto.timingSafeEqual`, accepting `X-Admin-Token` or `Authorization: Bearer …`, from `ADMIN_TOKEN` (falling back to `BOOKINGS_ADMIN_TOKEN`).
* The literal is gone from `js/pages/index.js`; the only remaining mention is a comment pointing at `js/adminSession.js`.

**Operator action:** set `ADMIN_TOKEN` in Netlify (§6.1). Until it is set, the Netlify Function answers admin routes with `503` (`admin is not configured`) rather than silently allowing access. The local dev server is the documented exception: unset token + loopback request is allowed so `npm run dev` stays usable.

### 3.2 F-02 (Critical) — Write endpoints were unauthenticated

**Was:** `POST/PUT/DELETE /api/local/projects`, `POST /api/project-files-config`, `POST/PATCH/DELETE /api/bookings`, `GET /api/bookings`, `GET /api/waitlist` and `POST /api/upload` accepted anonymous callers. A stranger could rewrite the portfolio, cancel bookings, or read every booking e-mail address.

**Now:** `requireAdmin()` guards every one of those routes in `api.js` (generic `401`) and `requireAdmin` middleware does the same in `server.mjs`. Public surfaces are deliberately limited to `GET` project/config/availability and `POST bookings` / `POST waitlist`. A new `GET /api/admin/session` exists only as a token probe for the admin UI and returns no data.

### 3.3 F-03 (High) — Wildcard CORS

**Was:** `Access-Control-Allow-Origin: *` on every response, so any website could read API responses through a victim's browser.

**Now:** `api.js` reflects the request `Origin` only when `new URL(origin).host === req Host`; otherwise no ACAO header is emitted. Allowed methods/headers are explicit (`Content-Type`, `X-Admin-Token`). The `cors()` middleware is gone from `server.mjs`. Same-origin only is correct here because the front end and the function are always served from the same host, including the `/cappuccinostudiox` mount.

The `cors` package is still listed in `package.json` because `_deprecated/server.vercel.mjs` imports it. `_deprecated/` is denied at the edge, so nothing on the deployed site loads it — drop the dependency together with that folder when it is deleted.


### 3.4 F-04 (High) — Missing security headers and CSP

**Was:** no CSP, no `X-Frame-Options`, no `Referrer-Policy`, no HSTS. The site could be framed (clickjacking the admin UI) and any injected script ran unconstrained.

**Now:** `_headers` (new, at the publish root so Netlify picks it up) sets on `/*`:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none';
  img-src 'self' data: https:; media-src 'self' https:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  script-src 'self'; worker-src 'self' blob:; connect-src 'self';
  frame-src 'self' blob:; frame-ancestors 'none'; form-action 'self';
  upgrade-insecure-requests
```

Per-path rules: `/admin.html`, `/project-edit.html`, `/content-management.html` get `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`; `/ui-kit/*` gets `noindex`; `/api/*` and `/cappuccinostudiox/api/*` get `no-store`.

`server.mjs` mirrors the same policy for local development, minus `upgrade-insecure-requests` and HSTS (they would break `http://localhost`).

**Enabling work required to keep `script-src 'self'`:**

* All inline `<script>` blocks were extracted to `js/inline/*.js` (`index-1`, `index-2`, `project-1..3`, `project-files-1..2`, `project-edit-1`, `ui-kit-index-1`, `booking-1`) and the pages reference them with `<script src>`.
* Inline `onclick=` handlers on `index.html` / `kitchen.html` were removed and rebound with `addEventListener` in `js/pages/index.js` / `kitchen.js`.
* PDF.js is vendored locally (F-13), removing the last third-party script origin.

`frame-src` is `'self' blob:` rather than `'none'` **on purpose**: the project viewer renders PDFs in a same-origin `iframe` (and occasionally a blob URL from PDF.js). `'none'` would have broken PDF viewing — caught during verification.

### 3.5 F-05 (High) — Server code and PII were downloadable

**Was:** because `publish = "."`, these all returned content: `/server.mjs`, `/netlify/functions/api.js`, `/netlify/lib/*`, `/package.json`, `/package-lock.json`, `/netlify.toml`, `/docs/*`, `/src/data/bookings.json`, `/src/data/waitlist.json`, `/node_modules/*`.

**Now:** `_redirects` (new) denies them **before** the `netlify.toml` catch-all rewrites run (Netlify evaluates `_redirects` first and the first match wins) with `404` + `404.html`. Rules exist both plain and under `/cappuccinostudiox/…`. `server.mjs` has the equivalent `BLOCKED_PREFIXES` / `BLOCKED_FILES` middleware and its static fallback is confined to the project root.

`src/data/projects.json` and `src/data/site-config.json` stay public deliberately: pages fetch them as a fallback when the API is unreachable and they contain no personal data.

`robots.txt` (new) disallows the admin routes, `ui-kit/`, `js/inline/` and `src/data/` — courtesy only; the deny rules are the control.

Two related decisions worth keeping:

* `NOTICE` stays **public**. It carries the Apache-2.0 attribution for the vendored PDF.js, and hiding a legal notice helps nobody. `SECURITY_REPORT.md`, `docs/` and `.netlify/` are denied instead.
* `Scenes/` and `Fonts/` must stay public — the pages load `Scenes/Lib/*.png` and `Fonts/CodeSaver-Regular.otf` directly. Do not add them to the deny list when tidying. (Unreferenced deploy weight: `Portfolio Working Files/` ≈ 1.3 MB of design PNGs, `_deprecated/` is already denied.)



### 3.6 F-06 (High) — Upload endpoint

**Was (local server):** `POST /api/upload` accepted any file from anyone, wrote it under `public/assets/projects/<projectId>/` using the client-supplied filename, with no size cap.

**Now (local server):** admin token required; multer `fileSize` capped at 25 MB with `files: 1`; `projectId` validated against `^[A-Za-z0-9_-]{1,40}$`; filename reduced to a safe basename (`[^\w.-]` stripped), prefixed with a random suffix, and the resolved destination re-checked so it stays inside the project folder (traversal defence).

**Now (production):** `/api/upload` returns `501 UPLOAD_DISABLED` with a message explaining that object storage must be configured first. Netlify Functions have an ephemeral filesystem and no shared disk; "fixing" uploads there would mean writing user content to Blobs and serving it from the site origin, which is not something to introduce silently in a hardening pass.

**Client:** `js/supabaseStorage.js` (local-only since the Supabase removal) now uses the same 25 MB limit as the server, so the browser rejects oversized files with an accurate message instead of surfacing a bare `413`.

### 3.7 F-07 (Medium) — Request body limits

`api.js` rejects bodies over 100 KB before parsing (`413`); `server.mjs` uses `express.json({ limit: '100kb' })`. No accepted payload is anywhere near that size.

### 3.8 F-08 (Medium) — Form spam

Both public forms (`POST /api/bookings`, `POST /api/waitlist`) now carry:

1. **A honeypot field** — a `hidden` paragraph labelled "Don't fill this out" wrapping the `botField` input (`tabindex="-1"`, `autocomplete="off"`, so it is neither visible nor focusable) on `index.html`, `kitchen.html`, `booking.html` and `project-files.html`, wired into the payload by `js/pages/booking.js` and both handlers in `js/site-modals.js`. If it has a value the server returns `200 {ok:true}` and stores nothing, so bots do not learn they were caught.
2. **A fixed-window per-IP rate limit** — 8 submissions/hour for bookings, 5/hour for waitlist. IPs are SHA-256 hashed before becoming a Blob key, counters live in Netlify Blobs (`consumeRateLimit()` in `netlify/lib/blobStore.js`; the dev server keeps the same counters in memory), and the limiter **fails open** if storage errors: losing a booking is worse than absorbing some spam. `429` responses include `Retry-After`.
3. **A privacy note** beside the submit button (what is stored, why, how to request deletion).

### 3.9 F-09 (Medium) — DOM XSS sinks

* `js/core.js#escapeHtml` used the `div.textContent → div.innerHTML` trick, which escapes `<`, `>`, `&` **but not quotes**. Every `data-x="${escapeHtml(value)}"` in `js/site-modals.js`, `js/pages/booking.js`, `js/pages/project-edit.js`, `js/pages/content-management.js` and `js/pages/project-files.js` was therefore an attribute-breakout sink. It is now a full five-character escape.
* `js/ui.js#createContent` interpolated carousel text into `innerHTML` unescaped; it now escapes (copy is static today — this closes the sink for future dynamic sets).
* `js/inline/booking-1.js#preselectOfferFromUrl` interpolated `?offer=` into a CSS selector (`.…[data-value="' + wanted + '"]`), stripping only `"`. A crafted value could throw or match unintended nodes. It now validates `^[A-Za-z0-9_-]{1,40}$` and compares against each option's `data-value`, never building a selector from input.
* `js/pages/project-story.js` already escaped text correctly; its URL-bearing attributes were the remaining gap (F-10).


### 3.10 F-10 (Medium) — `javascript:` / `data:` URLs from stored data

Project records are admin-managed, but stored data still lands in `href`, `src` and `iframe.src`. A stored `javascript:` URL is stored XSS on click; a `javascript:` value in `iframe.src` can execute in the page origin.

* `js/pages/project-story.js` gained `safeUrl()` — allows `http(s)://`, optional `blob:`, optional image/PDF `data:` and scheme-less same-origin paths; everything else becomes `''`. Applied to the media-card `href`, poster `src`, the media-error "open original" link, `video.src`/`video.poster`, the PDF `iframe.src` and the lightbox `img.src`. A refused PDF now shows an in-dialog error instead of loading.
* `js/pages/project.js` refuses non-`http(s)`/`blob:`/same-origin document URLs before handing them to the PDF viewer or the fallback `iframe`.

### 3.11 F-11 (Medium) — Error message leakage

`api.js` no longer returns `err.message`. Known storage failures map to `503 STORAGE_UNAVAILABLE`; everything else is a generic `500 {error:'Internal error'}` with detail written to the function log only. `server.mjs` follows the same pattern.

### 3.12 F-12 (Medium) — Project id handling

Client `storage.js#getProject` already used `encodeURIComponent`; the server now also refuses ids outside `^[A-Za-z0-9_-]{1,40}$` (Blob-key and filesystem safety) and `saveProjectPersistent` re-validates before writing. `js/projectLoader.js#getProjectIdFromURL` trims the value and treats empty as absent, so `?id=` never reaches a fetch.

### 3.13 F-13 (Low) — Third-party script origin

PDF.js came from `cdnjs.cloudflare.com`, which would have forced `script-src 'self' cdnjs.cloudflare.com` and put a third-party origin in the trust chain. `pdf.min.mjs` (5.4.149) and `pdf.worker.min.mjs` are now vendored in `js/vendor/pdfjs/`; `js/pages/project.js` points `PDFJS_CDN` at `(window.__BASE_PATH || '') + '/js/vendor/pdfjs'`, `GlobalWorkerOptions.workerSrc` follows, and `NOTICE` records the Apache-2.0 attribution (the `@licstart` block is preserved in the file).

**Maintenance:** this copy no longer updates itself — see §7.

### 3.14 F-14 / F-15 / F-16 (Low) — Hardening details

* **F-14:** `Referrer-Policy`, `Permissions-Policy`, `nosniff`, HSTS, and `base-uri`/`object-src`/`form-action` added (§3.4).
* **F-15:** admin/editor pages are `no-store` + `X-Robots-Tag: noindex, nofollow` + `robots.txt` disallow, so a shared machine's cache or a crawler cannot surface an admin URL.
* **F-16:** `.gitignore` now covers `.env`, `.env.*` (with `!.env.example`), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `config/secrets.*`, `secrets.json`, plus `.DS_Store` and `*.log`.

### 3.15 F-17 / F-18 (Info) — Verified clean

* No `eval(`, `new Function(`, `document.write(` anywhere in `js/`, `netlify/` or `server.mjs`.
* No `*.map` files ship.
* `npm audit --omit=dev` → `found 0 vulnerabilities`.
* `multer` is pinned at `1.4.5-lts.2` while `2.5.0` is current — tracked in §7.


---

## 4. Phase 3 — Verification (what was actually run)

All checks below were executed against the working tree on 29 Oct 2026.

| # | Check | Command / method | Result |
|---|-------|------------------|--------|
| V-1 | Syntax of every shipped module and function | `node --input-type=module --check` over `js/*.js`, `js/pages/*.js`, `js/inline/*.js`, `netlify/functions/*.js`, `netlify/lib/*.js`; `node --check server.mjs` | 0 failures |
| V-2 | No inline scripts / handlers left (CSP prerequisite) | grep for `<script>` tags without `src`, and for inline `on*=` handlers (click, load, error, submit, change, input, keydown) across all HTML | 0 matches |
| V-3 | No dangerous sinks | grep for `eval(`, `new Function(`, `document.write(` under `js/`, `netlify/`, `server.mjs` | 0 matches |
| V-4 | No source maps shipped | `find . -name '*.map' -not -path './node_modules/*'` | none |
| V-5 | No insecure absolute URLs | grep for `http://` in HTML/JS/CSS/JSON/TOML/MD | 0 in site code; the only hits are the Apache licence URL inside the vendored PDF.js and inside binary media payloads |
| V-6 | Every local asset referenced by HTML resolves | extracted all `src`/`href` refs from the 13 HTML pages (resolved per-page), requested each from the dev server | 49 unique local refs → `200`, including every new `js/inline/*.js`. One pre-existing miss (`/Cappuccino.svg`, the `ui-kit` favicon) fixed by pointing it at `../favicon.svg` |
| V-7 | Security headers present | `curl -D- http://localhost:8099/` | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, full CSP with `script-src 'self'` |
| V-8 | Admin guard blocks anonymous writes | `POST /api/local/projects` without token | `401` |
| V-9 | Admin guard blocks anonymous upload | `POST /api/upload` without token | `401` |
| V-10 | Token accepted server-side | `POST /api/upload` **with** `X-Admin-Token` but no file | `400 {"error":"No file uploaded"}` (guard passed, multer rejected the empty form) |
| V-11 | Token probe works | `GET /api/admin/session` with no / wrong / correct token | `401` / `401` / `200 {"ok":true,"admin":true}`; prefixed route `401` without token |
| V-12 | Honeypot swallows bots without storing | `POST /api/bookings` with `botField` filled | `200 {"ok":true}`, nothing written |
| V-13 | Booking validation | `POST /api/bookings` missing `service` | `400` with a specific `INVALID_*` code (no internals leaked) |
| V-14 | Valid booking accepted | `POST /api/bookings` with a real weekday slot | `201`, booking stored, reference issued |
| V-15 | Double-booking rejected | same date+time, different person | `409 SLOT_TAKEN` |
| V-16 | Rate limit enforced | 5 waitlist submissions from one IP, then more | requests 1–5 → `201`, requests 6–7 → `429 RATE_LIMITED` |
| V-17 | Oversized body rejected | 200 KB JSON to `POST /api/bookings` | `413` |
| V-18 | Denied paths are 404 | `GET /server.mjs`, `/package.json`, `/netlify/functions/api.js`, `/src/data/bookings.json`, `/docs/PRE-MAIN-SCAN.md`, `/SECURITY_REPORT.md`, `/.netlify/state.json` — plain **and** under `/cappuccinostudiox/` | `404` for all |
| V-19 | Vendored PDF.js served | `GET /js/vendor/pdfjs/pdf.min.mjs`, `…/pdf.worker.min.mjs` | `200` / `200` |
| V-20 | Test data not left behind | `src/data/bookings.json` + `waitlist.json` restored from pre-test backups; `projects.json` diffed | `[]`, `[]`, `identical to backup` |
| V-21 | Dependency audit | `npm audit --omit=dev` | `found 0 vulnerabilities` |
| V-22 | Honeypot writes nothing | `POST /api/bookings` with `botField` set, then read `bookings.json` | `200`, file unchanged (no `Bot Bot` record) |
| V-23 | Public read surfaces stay public | `GET /api/local/projects`, `GET /api/availability` anonymously | `200` (project data is public by design) |
| V-24 | Server CSP matches `_headers` | `curl -D- /` after the `frame-src` change | `frame-src 'self' blob:`, `script-src 'self'`, no `upgrade-insecure-requests`/HSTS on localhost |
| V-25 | `_redirects` is well-formed | column-count check on every non-comment line; rule counts per block | 45 rules (23 plain + 22 `/cappuccinostudiox/` twins), 3 columns each, no orphans. The bare `/netlify` entry has no prefixed twin by design — the catch-all rewrite lands on `/netlify`, which is already denied. Netlify parses this file server-side, so this is a structural check, not a live one |
| V-26 | Every offer CTA maps to a real dropdown option | extracted `?offer=` values from `offers.html`, diffed against the `data-value` options in `booking.html` | 3/3 matched (`creative-strategist`, `content-engine`, `edit-sprint`); no CTA points at a slug the form cannot select |
| V-27 | Every service slug offered in any page is accepted by the API | `validateBookingInput()` run in-process for all 17 dropdown slugs (see §4.3) | 17/17 accepted, `serviceLabel` resolved for each. **This failed before the fix**: 5 slugs were rejected with `INVALID_SERVICE` |
| V-28 | Offer bookings work end to end | `POST /api/bookings` once per offer slug against the dev server | `201` each with the right `serviceLabel`; `bookings.json` restored to `[]` afterwards (V-20 still holds) |
| V-29 | Project writes reject id-less and path-like ids on **both** dev routes | `POST /api/local/projects` and the `/cappuccinostudiox/` twin, four bodies each, with and without the token | `{"name":"x"}` → `400 Project id is required.`; `{"id":"../etc"}` → `400 Project id must be 1-40 letters…`; valid id → `200`; no token → `401`. Production already behaved this way — only the dev server was lax (see §4.4) |

### 4.1 Things this pass could **not** verify locally

* **Netlify Function execution.** `netlify dev` needs an authenticated CLI session. `api.js` was therefore reviewed by inspection and exercised through its mirror (`server.mjs`), which implements the same routes, guards, limits and headers. The two differ in exactly two intentional ways: production storage is Netlify Blobs (dev uses JSON files) and production returns `501` from `/api/upload` (dev accepts uploads to disk). **Run one post-deploy smoke test** (§6.3) to confirm the function, `_headers` and `_redirects` behave the same in production.
* **Browser CSP enforcement.** No headless browser was available. The CSP was validated by static analysis (V-2, V-3, V-4, V-19) — every script is same-origin, every font/image origin is allowlisted, and `frame-src` was widened specifically so the PDF viewer keeps working. **Open each page once after deploy with DevTools open** and confirm zero CSP violations in the console.

### 4.2 Two traps for whoever re-runs this

1. **Kill stale dev servers first.** An earlier `node server.mjs` from this session was still holding port 8099 and answered the first round of curls with pre-change code (it reported `frame-src 'none'` and served `SECURITY_REPORT.md`). Check with `lsof -nP -iTCP:8099 -sTCP:LISTEN` and kill it, or use a different `PORT`.
2. **Set `ADMIN_TOKEN` before testing the guards.** With no token configured the dev server deliberately allows loopback requests, so every admin route answers `200` and the test tells you nothing. Run `ADMIN_TOKEN=smoke-test-token PORT=8099 node server.mjs`, then expect `401` without the header and `200` with it.

### 4.3 Pre-deploy QA — the offers funnel was dead on arrival

The hardening pass left the booking validator stricter than the UI that feeds it, and nothing failed loudly: the offer buttons rendered, the dropdown preselected, and the server then answered `400 INVALID_SERVICE :: Please choose a service.` — a message that blames the visitor for a value they never chose.

* **Cause.** `SERVICE_SLUGS` in `netlify/lib/bookingShared.js` still listed only the twelve legacy service names. The five newer slugs that the site actually submits — `creative-strategist`, `content-engine`, `edit-sprint` (every CTA on `offers.html`) plus `music-release-content-dev` and `sound-design-and-production` (offered in the modals on `index.html`, `kitchen.html` and `project-files.html`) — were missing, so 5 of the 17 selectable services could never be booked.
* **Fix.** The allowlist and `SERVICE_LABELS` now cover all 17 slugs, sorted, with a comment naming the files that must stay in sync. Validation is still an allowlist — adding a service now takes a deliberate edit in one place, which is the point.
* **Re-test.** V-26 (link contract), V-27 (validator accepts 17/17) and V-28 (three live `201`s, then `bookings.json` restored to `[]`). The honeypot returned `200 {"ok":true}` and stored nothing, as designed (V-12, V-22).

Two copy inconsistencies that would have shipped alongside it:

* `offers.html` FAQ claimed both one-off tiers "hand you finished files and a calendar". Only the Content Engine includes a calendar; the Edit Sprint is cut files only. Reworded.
* `kitchen.html`'s offer panel described the Content Engine as "scripted, **shot** and edited", which contradicts the same page's and `offers.html`'s "filming is not included". Now "scripted, edited and sound-designed".

`offers.html` also had no `og:`/`twitter:` tags, unlike `index.html` and `kitchen.html`, so the one page built to be shared produced a bare link preview. It now carries the same four `og:` tags plus `twitter:card`. The image path is relative, matching the other two pages — see §9.6.

### 4.4 A junk project card was live on the site

While clicking through the local build, `/project-files.html` showed a seventh card named **“x”**. It was not a project: the record in `src/data/projects.json` was literally `{"name":"x"}` — no id, no thumbnail, no storyline. Clicking it navigated to `project.html?id=undefined`.

* **Where it came from.** An authenticated probe against the dev server's project-write route. `POST /api/local/projects` pushed `req.body` verbatim, so any `{"name":"…"}` body appended a record that the list endpoint then served as a real project (`id: undefined`, `thumbnail: null`, `layout: "deck"`).
* **Why the earlier checks missed it.** The record was written at 12:49, before the `projects.json` backup used for the “restored byte-identical” check was taken at 12:51. The comparison was therefore truthful and useless: it proved the file had not changed *since the contamination*.
* **Fix.** The record is gone (`projects.json` back to the six real projects, 38,545 bytes, verified against a fresh backup taken beforehand). Both dev write routes — the root one and the `/cappuccinostudiox/` twin — now call a single `saveProjectRecord()` that enforces the same rule production already enforced in `blobStore.saveProjectPersistent()`: a non-empty id, 1–40 characters of `[A-Za-z0-9_-]`.
* **Why that mattered.** Production rejected this payload all along, so this was another dev/production split — and the second time in this pass that the local mirror was the more permissive of the two (compare §4.3). Two routes, two hand-written validators, one of them silently looser: the fix collapses them into one function so they cannot disagree again.
* **Re-test.** V-29: id-less and `../etc` bodies → `400` on both routes, valid id → `200`, no token → `401`, `projects.json` restored afterwards.

---

## 5. Phase 4 — Residual risk

| ID | Risk | Why it remains | Mitigation / next step |
|----|------|----------------|------------------------|
| R-01 | `style-src 'unsafe-inline'` | The pages carry inline `<style>` blocks and many `style=""` attributes; there is no build step to hash or extract them. Inline CSS is a much weaker XSS vector than inline script, but it does allow UI redressing and data-exfiltration tricks in some browsers | Add a build step (or a one-off codemod) that moves styles into `css/*.css` and hashes the rest; then drop `'unsafe-inline'` behind a report-only rollout |
| R-02 | Single shared admin token in `sessionStorage` | No per-user accounts, no expiry, no audit trail. An XSS that survived CSP could read the token for that tab | Rotate on a schedule (§7). Longer term: put admin behind Netlify Identity / an OAuth proxy so the browser never holds a site-wide secret |
| R-03 | Admin writes are not rate-limited | A valid token can write as fast as the network allows | Acceptable for one operator; add a per-token limit if a second person gets access |
| R-04 | Honeypot + IP rate limit are speed bumps, not bot management | Blob counters are eventually consistent and the limiter fails open by design; the honeypot only stops naive bots | Enable a real challenge (Cloudflare Turnstile or reCAPTCHA v3) verified server-side in `api.js` — §6.2 |
| R-05 | No CSRF token on admin writes | Mitigated structurally: cross-site requests cannot set `X-Admin-Token` without a CORS preflight, which the function refuses; `SameSite` cookies are not used at all | Keep the header requirement if the auth model ever changes |
| R-06 | Booking e-mails are stored in Blobs | Needed to run the studio | Define retention (e.g. purge after 12 months) and a deletion path; keep `/api/bookings` admin-only |
| R-07 | Third-party requests to Google Fonts and Unsplash | Privacy/availability of two external origins; `img-src https:` is broad by design | Self-host the Inter woff2 files to drop `fonts.googleapis.com`/`fonts.gstatic.com`; narrow `img-src` if imagery is centralised |
| R-08 | Vendored PDF.js (5.4.149) | It does not update itself | Update per §7 and re-run V-19 |
| R-09 | `multer@1.4.5-lts.2` | 2.x is current; the upgrade touches the upload route only | Plan the upgrade; the route is dev-only today, so it is not blocking |
| R-10 | A secret was previously in the shipped bundle | The old admin password lived in `js/pages/index.js`. It is out of the code, but any archive, zip or earlier deploy still contains it | Treat it as burned: never reuse it, rotate anything it protected — §6.5. The literal is redacted from this report so the first commit does not re-publish it |


---

## 6. Manual / external steps (cannot be done from this repo)

### 6.1 Configure the admin token (required before the admin UI works in production)

1. Generate a token: `openssl rand -base64 48`.
2. Netlify → **Site configuration → Environment variables → Add a variable**
   * Key `ADMIN_TOKEN`, value = the generated token, scopes = all deploy contexts (or at least *Production*).
   * Keep `BOOKINGS_ADMIN_TOKEN` only if something else still reads it; otherwise delete it so there is one source of truth.
3. Trigger a redeploy — environment changes only apply to new builds.
4. Verify:
   * `curl -i https://<site>/api/admin/session` → `401`
   * `curl -i -H "X-Admin-Token: <token>" https://<site>/api/admin/session` → `200 {"ok":true,"admin":true}`
5. Open `admin.html` and `project-edit.html`: the prompt should appear once, survive reloads within the tab, and writes should succeed.

### 6.2 Bot protection (recommended follow-up)

The honeypot and rate limit are deliberately cheap. For real protection:

1. Create a Cloudflare Turnstile widget (or a reCAPTCHA v3 key) for the site's domain.
2. Add the widget to `booking.html` / the booking modal — note this needs a `script-src` (and usually `frame-src`) addition for that origin, which is why it was not done blind here.
3. Server-side: verify the returned token in `api.js` before `createBookingPersistent` / `createWaitlistPersistent`, and keep the secret in a Netlify env var (`TURNSTILE_SECRET`), **never** in the repo.
4. Keep the honeypot and rate limit anyway — defence in depth at zero cost.

### 6.3 Post-deploy smoke test (5 minutes, after any deploy that touches config)

```bash
SITE=https://<site>
curl -sI $SITE/ | grep -Ei 'content-security|x-frame|strict-transport|referrer'
curl -s -o /dev/null -w '%{http_code}\n' $SITE/server.mjs               # expect 404
curl -s -o /dev/null -w '%{http_code}\n' $SITE/src/data/bookings.json   # expect 404
curl -s -o /dev/null -w '%{http_code}\n' $SITE/netlify/functions/api.js # expect 404
curl -s -o /dev/null -w '%{http_code}\n' $SITE/api/bookings             # expect 401
curl -s -o /dev/null -w '%{http_code}\n' $SITE/api/admin/session        # expect 401
```

Then load `/`, `/kitchen`, `/work`, a project page (open a PDF), `/contact`, and submit one real booking with the DevTools console open: **no CSP violations**, and no unexpected 4xx/5xx in the Network tab.

### 6.4 Privacy / legal

* The booking and waitlist forms now state what is collected and why. Make the site's privacy policy match that copy and name the retention period you pick in R-06.
* If the studio is EU/UK-facing, disclose the Google Fonts / Unsplash requests or remove those origins (R-07).

### 6.5 Secret history

The old admin password was shipped inside the client bundle, so assume it is public. It is out of the code now, **but** any previously published copy (zip, deploy artefact, archive, another machine) still contains it.

The repository is `gosi-dev/cappuccinostudiox` (**private**). Its history was built from scratch so the secret never enters it:

* The literal is redacted everywhere in this report — every mention reads `<the password>`. Verified by grepping the entire tree (`grep -ra`, binaries included) and by re-reading the pushed file through the GitHub API; both come back empty.
* An earlier publishing attempt **did** capture the literal in a commit, because this report quoted it four times as evidence. A force-push hid that commit from `main`, but GitHub kept the superseded object fetchable by SHA — so the repository was **deleted and re-created**, and the local `.git` (which still held the blob) was discarded and re-initialised before the first commit. There is no earlier revision to recover, on the remote or on this machine.
* The pre-push check now greps for the burnt literal itself, not just token-shaped patterns. An arbitrary 13-character word matches no `sk-…` / `ghp_…` / JWT / private-key rule — precisely how the first attempt slipped through a scan that looked clean.

What is deliberately **not** in the repo: `src/data/bookings.json` and `waitlist.json` (customer PII — currently empty, but the app writes real submissions there in dev), `node_modules/` and `.netlify/` (local CLI state). Everything else is tracked, **including `public/assets/`** — 522 MB of video, PDFs and project uploads — because the media *is* the portfolio and the repo is private. The accepted cost is a ~530 MB clone and binaries that git cannot diff or merge.

Actions still open: never reuse that string; check whether it was reused for e-mail, hosting, FTP or a password-manager entry; rotate anything it unlocked. GitHub's native **secret scanning with push protection** is only free on public repos (private ones need GitHub Advanced Security), and this repo reports no such configuration — so the equivalent check is local: **`scripts/pre-push-scan.sh`**, installed as `.git/hooks/pre-push`:

```bash
ln -sf ../../scripts/pre-push-scan.sh .git/hooks/pre-push
```

It greps the whole tree, **including binaries**, for (1) known-burnt literals by value — the list lives in `.git/burnt-literals.txt`, outside git, because writing the literal into a committed script would re-publish it — (2) credential shapes (`sk-…`, `ghp_…`, `AKIA…`, JWTs, PEM blocks, Slack tokens), (3) secret-bearing files (`.env`, `*.pem`, `*.key`, `secrets.json`) that became tracked, and (4) `bookings.json` / `waitlist.json` sneaking in. Verified against planted samples: each one blocks the push with exit 1. Bypass only with `git push --no-verify`, after reading what it flagged.


---

## 7. Maintenance checklist

### Every 30 days

- [ ] `npm audit --omit=dev` in the project root → resolve anything above *low*.
- [ ] Netlify → **Logs → Functions**: scan `api.js` for repeated `401` (someone probing) or `503 STORAGE_UNAVAILABLE` (storage problem) — and confirm error details are in the logs, not in responses.
- [ ] Netlify → **Usage**: check function invocations, bandwidth and Blob operations against the plan limits (protects against silent abuse).
- [ ] Spot-check a booking end-to-end (form → admin list → cancel).

### Every 90 days

- [ ] Rotate `ADMIN_TOKEN` (`openssl rand -base64 48` → Netlify env → redeploy → confirm old token now returns `401`).
- [ ] Update vendored PDF.js: download the matching `pdf.min.mjs` + `pdf.worker.min.mjs` into `js/vendor/pdfjs/`, re-run V-19, keep the `NOTICE` version line accurate.
- [ ] Re-run the §6.3 smoke test.
- [ ] Re-read the `_redirects` deny list against the current file tree — new server-side files must be added.
- [ ] Purge bookings older than the retention period chosen in R-06.

### Every 12 months

- [ ] Review the CSP: try dropping `'unsafe-inline'` from `style-src` via `Content-Security-Policy-Report-Only` for a week, then enforce if the report is clean.
- [ ] Re-evaluate the auth model (R-02) against how many people actually need admin access.
- [ ] Re-check dependency majors (`express` 5.3.0 is available; `multer` 2.x — R-09).
- [ ] Confirm who holds `ADMIN_TOKEN` and that it is in a password manager, not a chat thread.

### When adding a feature

- [ ] Any new endpoint: decide public vs admin **first**, and add the guard in **both** `api.js` and `server.mjs`.
- [ ] Any new user-supplied string that reaches the DOM: escape with `escapeHtml`; if it is a URL, pass it through `safeUrl`.
- [ ] Any new third-party origin: extend the matching CSP directive in `_headers` **and** `server.mjs`, or vendor the asset instead.
- [ ] Any new file that should not be public: add it to `_redirects` and `BLOCKED_*` in `server.mjs`.

---

## 8. Files changed

| File | Change |
|------|--------|
| `_headers` | **New.** Full CSP + security headers; `no-store`/`noindex` for admin pages and `/api/*` |
| `_redirects` | **New.** 404 rules for server code, `.git`, `.env`, `.netlify`, `docs`, PII JSON, dev dirs (plain + `/cappuccinostudiox/*`); `NOTICE` deliberately left public |
| `robots.txt` | **New.** Disallows admin routes, `ui-kit/`, `js/inline/`, `src/data/` |
| `404.html` | **New.** Branded not-found page used by the deny rules |
| `NOTICE` | **New.** PDF.js Apache-2.0 attribution |
| `SECURITY_REPORT.md` | **New.** This document |
| `.gitignore` | Secrets and key material, logs, OS files |
| `package.json`, `package-lock.json` | `multer` pinned on the 1.4.5-lts line (see R-09); `npm audit --omit=dev` → 0 vulnerabilities |
| `js/adminSession.js` | **New.** Token prompt → `sessionStorage` → `X-Admin-Token` via a `fetch` wrapper; probes `/api/admin/session` |
| `js/vendor/pdfjs/pdf.min.mjs`, `pdf.worker.min.mjs` | **New.** Vendored PDF.js 5.4.149 |
| `netlify/functions/api.js` | Same-origin CORS, security headers, 100 KB body cap, honeypot, rate limit, admin guards on all reads/writes, id validation, generic 500s, `/api/admin/session`, upload → `501` |
| `netlify/lib/blobStore.js` | `consumeRateLimit()` (hashed IP, fixed window, fail-open); `saveProjectPersistent` validation |
| `netlify/lib/adminAuth.js` | Token verification helper (used by `api.js`) |
| `netlify/lib/bookingShared.js` | `SERVICE_SLUGS` / `SERVICE_LABELS` extended to all 17 services the site offers — the three offers and two modal-only services were being rejected with `INVALID_SERVICE` (see §4.3) |
| `docs/PRE-MAIN-SCAN.md` | Hardcoded-password literal redacted; note now points at the token flow |
| `server.mjs` | Mirrors all of the above for local dev; blocked-path middleware (incl. `docs`, `.netlify`); loopback-only admin when `ADMIN_TOKEN` is unset; admin `GET /api/bookings` + `/api/waitlist` added for parity; upload hardened (guard, 25 MB, safe filename, path confinement); both project-write routes now share `saveProjectRecord()`, so the dev server rejects id-less bodies exactly like `blobStore.saveProjectPersistent()` does in production (see §4.4) |
| `src/data/projects.json` | Removed a junk `{"name":"x"}` record that had been appended by an authenticated dev-server probe and was rendering as a seventh project card pointing at `project.html?id=undefined` (see §4.4). Six real projects remain; pre-cleanup copy saved outside the repo |
| `js/core.js` | `escapeHtml` now escapes `"` and `'` |
| `js/ui.js` | Carousel content escaped before `innerHTML` |
| `js/pages/project-story.js` | `safeUrl()` allowlist applied to every `href`/`src`/`iframe.src` |
| `js/pages/project.js` | Same-origin vendored PDF.js; URL-scheme checks before PDF/iframe loading |
| `js/pages/index.js`, `js/pages/kitchen.js` | Hardcoded password removed; inline `on*` handlers replaced with listeners |
| `js/inline/*.js` | **New.** Extracted inline scripts (`booking-1` also fixes the `?offer=` selector injection) |
| `js/supabaseStorage.js` | `MAX_UPLOAD_BYTES` 300 MB → 25 MB to match the server |
| `ui-kit/index.html` | Favicon `../Cappuccino.svg` (missing) → `../favicon.svg`; inline script → `js/inline/ui-kit-index-1.js` |
| `index.html`, `kitchen.html`, `booking.html`, `project-files.html`, `project.html`, `project-edit.html`, `admin.html` | Inline scripts/handlers removed, honeypot fields, privacy notes, CSP-safe `<script src>` wiring (`project-story.html` needed no change — it was already external-script only) |
| `offers.html` | `og:`/`twitter:` tags added (link-preview parity with the other marketing pages); FAQ corrected — the Edit Sprint does not include a posting calendar |
| `kitchen.html` (copy) | Offer panel no longer says the Content Engine is "shot" by the studio, which contradicted the "filming not included" line on the same page and on `offers.html` |


---

## 9. Open questions for the owner

These change how much of the residual risk actually matters; none of them block the changes on disk.

1. **Will more than one person ever need admin access?** If yes, the shared token (R-02) should become real accounts — Netlify Identity or an OAuth proxy — before a second person is onboarded.
2. **Where is the site's audience?** An EU/UK audience makes the Google Fonts and Unsplash requests (R-07) a consent question, not just a performance one.
3. **What is the booking retention period?** R-06 asks for a number; anything between 6 and 24 months is defensible, but it should be written into the privacy policy.
4. **Is `Portfolio Working Files/` meant to ship?** It is 1.3 MB of unreferenced design PNGs at the publish root. Harmless, but it is deploy weight and public by default.
5. **The site is now under git** — `gosi-dev/cappuccinostudiox`, private, single commit, **media included** (see §6.5). Decide whether Netlify should keep deploying the folder or switch to building from GitHub — the latter now works, since the repo contains everything the site serves; watch build minutes and the ~530 MB clone.
6. **What is the production URL?** `og:image` on all three marketing pages is a relative path, which Facebook and X reject; `og:url` cannot be written at all without the real origin. One absolute base URL lets all of it be fixed in a single pass.
7. **Is `3d-cabinet.html` supposed to be live?** It is a complete 30 KB page at the publish root that no link or menu points to. Either link it, or let `_redirects` return `404` for it — an unlinked page is still a public page, and it is not covered by the deny list.
8. **Should the offer prices carry a tax line?** They are quoted as flat EUR figures ("€2,500 per month", bank transfer, no VAT note). If the studio is VAT-registered, an EU buyer will ask; if it is under the threshold, say so once and the question stops coming.

---

*Prepared as part of a static-site security hardening pass. Every code change referenced above is on disk and committed — `gosi-dev/cappuccinostudiox` (private) holds a single initial commit on `main`, site media included. The burned password literal is redacted from this report and absent from the entire tree and from the commit history, which was rebuilt from scratch after the first attempt leaked it (§6.5).*

