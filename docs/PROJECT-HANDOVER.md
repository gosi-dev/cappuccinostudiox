# Project Handover — Cappuccino Studiox Portfolio

This document briefs a new agent (or developer) so they can continue work on this codebase without losing context. Read it first when taking over.

---

## 1. What this project is

- **Portfolio/CMS site** for **Cappuccino Studiox** (design/creative studio).
- **Stack:** Static HTML/CSS/JS frontend, **Vercel** hosting, **Supabase** (Postgres + Storage). No framework (vanilla JS, ES modules).
- **Deployment:** GitHub → Vercel. Branches: **staging** (preview), **main** (production). Typical flow: commit on staging → push staging → merge staging into main → push main.
- **Live site:** `https://cappuccinostudiox.vercel.app` (or custom domain).

---

## 2. Repo structure (high level)

- **Root:** HTML pages (`index.html`, `project.html`, `project-edit.html`, `project-files.html`, `content-management.html`, `kitchen.html`, `booking.html`, `admin.html`, `3d-cabinet.html`, etc.).
- **`js/`** — Frontend logic:
  - **`core.js`** — Shared constants (`IDB_NAME`, `CMS_PROJECT_PREFIX`, etc.), `init()`, `escapeHtml`, page detection.
  - **`storage.js`** — Project load/save: `getProject(id)`, `saveProject(project)`. Tries API first, then IndexedDB, then localStorage. **On successful save we now sync the same payload to IndexedDB and localStorage** so local state matches the server.
  - **`supabaseStorage.js`** — Upload project media (File/Blob/data URL) to Supabase bucket `project-media`. Uses `GET /api/config` for Supabase URL + anon key. **50 MB max file size** (Supabase Free tier); larger files throw a clear error and are not embedded as base64.
  - **`projectRenderer.js`** — Applies CMS data to state, builds `backgroundVideos` and `defaultBackgroundVideos`, inits background loop and gallery.
  - **`loadingScreen.js`** — Shared loading overlay (red, logo, wipe animation). Uses `100dvh` for mobile. `showLoadingScreen()`, `hideLoadingScreen()`.
  - **`js/pages/`** — Page-specific entry points: `project.js`, `project-edit.js`, `project-files.js`, `content-management.js`, `admin.js`, `3d-cabinet.js`, etc.
- **`api/`** — Vercel serverless (one file = one route):
  - **`config.js`** — `GET /api/config` → `{ supabaseUrl, supabaseAnonKey }` (from env). Frontend uses this to upload to Storage.
  - **`projects.js`** — `GET /api/projects` (list), `POST /api/projects` (upsert project). Body limit **4.5 MB** (Vercel, cannot be increased).
  - **`projects/[id].js`** — `GET /api/projects/:id` (single project).
  - **`storage-cleanup.js`** — `POST /api/storage-cleanup`. Deletes orphan files in bucket `project-media`. Requires **SUPABASE_SERVICE_ROLE_KEY** in Vercel.
  - **`project-files-config.js`** — `GET /api/project-files-config` (fetch 3D config from Supabase), `POST /api/project-files-config` (save). Used by project-files page and admin so config is server-side and consistent across devices.
- **`docs/`** — Project documentation (setup, troubleshooting, handover). See section 8 below.

---

## 3. Core concepts

### Projects (CMS)

- A **project** has: `id`, `name`, `items` (gallery: image/video/PDF), `assets` (video sources for cuts), `storyline`, `storylineTitle`, `thumbnail`, **`defaultBackgroundUrl`** (optional; one image or video URL shown as the project page background until a gallery item is selected), and per-item flags **`backgroundRoster`** and **`defaultBackgroundRoster`**.
- **Default background (uploaded)** — If **`defaultBackgroundUrl`** is set, the project page shows this as the only background on load and when no gallery item is selected; it changes only when the user taps a gallery item.
- **Background roster** — Items with `backgroundRoster: true` appear in the main background loop and in the expanded background when that item is hovered/selected (used when there is no uploaded default, or for fallback when the selected item is not on the roster).
- **Default background roster** — Items with `defaultBackgroundRoster: true` are used: (1) as the initial background when there are no background-roster items and no uploaded default, and (2) when the user hovers/selects an item that is *not* on the background roster (instead of the previous red fallback).
- **Save flow:** Edit page builds payload → `POST /api/projects` with full JSON. If payload &gt; 4.5 MB, Vercel returns 413; app then saves to IndexedDB + localStorage and shows “Saved locally only.” To avoid that, media must be in Supabase Storage (URLs only in JSON).

### Media and 4.5 MB limit

- **Vercel request body limit is 4.5 MB.** Project JSON must stay under that for cloud save.
- Media is stored in **Supabase Storage** bucket **`project-media`**. The edit page uploads files via `supabaseStorage.js` and stores only **URLs** in `items`/`assets`/`thumbnail`. If upload fails (e.g. no config or 50 MB exceeded), the app can fall back to base64, which can push the payload over 4.5 MB.
- **File size:** Supabase Free tier = 50 MB per file. The app blocks uploads &gt; 50 MB and shows: “File too large (max 50 MB). Use a smaller file or compress it.” All upload call sites have `.catch()` so the user sees that message instead of silent base64 fallback.

### Sync and local storage

- **IndexedDB** (`PortfolioCMS`, store `projects`) and **localStorage** (`cms_project_<id>`) hold project data. On **successful** save we write the same payload to both so they stay in sync with the server. Diagnostic snippets (see docs) read from IndexedDB to report embedded vs URL count and payload size.

---

## 4. Supabase

- **Project URL** — From Dashboard → Project Settings → **API** (or Data API). Used as `SUPABASE_URL` in Vercel.
- **Keys** — From Project Settings → **API Keys** (not Data API). **Legacy API Keys** tab: **anon** (public) and **service_role** (secret). `SUPABASE_ANON_KEY` for API + frontend; `SUPABASE_SERVICE_ROLE_KEY` only for server (e.g. storage cleanup).
- **Bucket:** `project-media`, **public**, with RLS: INSERT and SELECT for `bucket_id = 'project-media'`.
- **Tables:** `projects` (id, name, items, storyline, storyline_title, thumbnail, assets, **default_background_url**). `items`/`assets` are JSON; thumbnail and default_background_url can be URL or null. If the table was created before the default-background feature, add the column: `ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_background_url text;` **`site_config`** (key text primary key, value jsonb) — stores Project Files 3D config under key `project_files_3d`. One-time setup: see **`docs/PROJECT-FILES-CONFIG-SETUP.md`** (copy-paste SQL).

---

## 5. Vercel

- **Env vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Production, Preview, Developer). For storage cleanup: `SUPABASE_SERVICE_ROLE_KEY` (same environments). Redeploy after changing env.
- **API routes:** Files in `api/` become routes at `/api/<name>`. E.g. `api/storage-cleanup.js` → `POST /api/storage-cleanup`. If that returns 404, ensure the file is committed and the branch is deployed, then redeploy.

---

## 6. Key pages and features

- **Project page** (`project.html` + `js/pages/project.js`) — Gallery track, background videos, expanded background, storyline overlay. Video sound is controlled **per item** via the **Sound** toggle in the content management panel (project edit); no audio control in the project page menu. Caption in preview mode: **“TAP TO OPEN”** for all item types (not only PDF).
- **Project edit** (`project-edit.html` + `js/pages/project-edit.js`) — Playlist of items (image/video/PDF), per-item toggles **Background roster**, **Default background**, and for video items **Sound** (whether that video plays with audio when opened). Storyline fields, thumbnail, replace/re-trim/add cut, Save. Save syncs to API and updates IDB/localStorage on success.
- **Project files** (`project-files.html` + `js/pages/project-files.js`) — 3D box with **iso-cards** (project thumbnails). **Desktop:** hover = card pops up, click = open project. **Mobile:** tap+drag = scroll carousel; first tap = preview (pop up); second tap on same card = open project; tap outside = clear preview.
- **Content management** — List of projects, edit/delete, add new. Reads/writes via same API and storage layer.
- **Loading screen** — Used on project, project-edit, project-files, content-management. Centered logo, red wipe; hide when first meaningful content is ready (e.g. project data applied or first asset loaded). Uses `100dvh` for mobile.

---

## 7. Mobile and UX details

- **Tap highlight:** `-webkit-tap-highlight-color: transparent` is set on `body` (and in `ui-kit/kit.css`) so the default blue tap overlay does not show on interactive elements.
- **Menu:** Project page menu has “AUDIO: OFF/ON” and “PROJECT FILES”. `.menu-child-button:active` uses white bg + red text for tap feedback on mobile.

---

## 8. Docs index

- **`SUPABASE-STORAGE-SETUP.md`** — Why 4.5 MB errors happen, bucket creation, RLS, env vars, file size limit (50 MB).
- **`STORAGE-CLEANUP-HOW-TO.md`** — Run cleanup (manual POST or Vercel Cron), service role key, 404 troubleshooting.
- **`PAYLOAD-SIZE-LIMIT.md`** — Why project doesn’t sync when over 4.5 MB.
- **`LOADING-SCREENS.md`** — Which pages use loading screen and why.
- **`CMS-STORAGE-AND-SYNC.md`** / **`SYNC-AND-STORAGE-NOTES.md`** — Sync and storage notes.
- **`SUPABASE-ADD-THUMBNAIL-COLUMN.md`** — Thumbnail column on `projects` table.
- **`GALLERY-TRACK-INTERACTIONS.md`** — Gallery/project page interactions.
- **`PROJECT-FILES-MOBILE-SCROLL-REALITY.md`** — Mobile scroll behavior on project-files.
- **`PROJECT-FILES-CONFIG-SETUP.md`** — Supabase table and RLS for Project Files 3D config (copy-paste SQL).

---

## 9. Conventions and gotchas

- **PowerShell (Windows):** Use `;` to chain commands, not `&&`.
- **Paths:** Workspace may be URL-encoded (e.g. `Mide%20Akindeko`). Use relative paths or the path format the IDE provides.
- **Diagnostics:** To check a project’s payload and embedded count (e.g. “why is save failing?”), run the IndexedDB snippet from the storage-cleanup / payload docs on the **edit page** for that project (with `?id=...` in the URL). Embedded (data URL) count and size in MB explain 4.5 MB failures.
- **New items:** When creating new project items in code, include both `backgroundRoster: false` and `defaultBackgroundRoster: false` unless intentional.

---

## 10. Recent work (for continuity)

- **Storage:** Sync to IndexedDB/localStorage on *successful* save so diagnostics and reload see the same data as the server.
- **Supabase:** 50 MB upload limit enforced in `supabaseStorage.js`; all upload paths have `.catch()` to show the “File too large” message.
- **Default background roster:** Toggle “Default background” per item; used on first load (if no background roster) and when selected item is not on background roster.
- **“TAP TO OPEN”** caption in preview mode for all media types (not only PDF).
- **Tap highlight** removed site-wide; **audio toggle** on project page; **menu child button** `:active` style for mobile.
- **Storage cleanup** doc updated with clearer steps; 404 for cleanup route fixed by ensuring `api/storage-cleanup.js` is in the deployed branch and redeploying.

Use this handover plus the listed docs to continue feature work, debugging, or onboarding. For Supabase/Storage and deployment details, the setup and cleanup docs are the source of truth.
