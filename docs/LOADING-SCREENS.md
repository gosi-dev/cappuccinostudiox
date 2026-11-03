# Pages that benefit from loading screens

These pages wait on **async data** (API or storage) before showing their main content. Until that finishes, the user may see a blank area, placeholders, or a flash of wrong content. A loading screen gives clear feedback and avoids confusion.

---

## 1. **Project page** (`project.html`)

- **What loads:** Project data via `getProject(projectId)` (API → IndexedDB → localStorage). Then `applyCmsData()` fills gallery, background videos, storyline.
- **Before load:** Background/gallery can be empty or default; storyline empty; menu may show "PROJECT" without name.
- **Benefit:** Show a loading state (e.g. spinner or “Loading project…”) until project data has been applied, then hide it. Especially helpful on slow or first load on a new device.

---

## 2. **Project edit** (`project-edit.html`)

- **What loads:** Project via `getProject(projectId)`; then playlist, name, storyline, thumbnail are rendered.
- **Before load:** Playlist is empty, inputs blank, “Storage: 0 / 300 MB”.
- **Benefit:** Show loading over the main form/playlist until `getProject().then(...)` has run and `render()` has been called. Avoids the impression that the project is empty.

---

## 3. **Project files** (`project-files.html`)

- **What loads:** Project list via `fetchProjectList()` (GET /api/projects), then list is saved and the 3D iso cards are built.
- **Before load:** Box/cards may be missing or show dummy thumbnails until the fetch completes.
- **Benefit:** Show loading (e.g. “Loading projects…”) until the fetch + `saveProjectList` + card build have run. Then hide and show the box.

---

## 4. **Content management** (`content-management.html`)

- **What loads:** Project list via `fetchProjectList()`, then `renderList()` fills the list.
- **Before load:** Project list is empty; user may think there are no projects (especially on a new device).
- **Benefit:** Show loading over the list area until the fetch and `renderList()` are done. Then hide and show the list (or “No projects” if empty).

---

## Summary

| Page                | Waits on              | Without loading screen                    |
|---------------------|------------------------|-------------------------------------------|
| project.html        | getProject + applyCms | Empty/default gallery, no storyline       |
| project-edit.html   | getProject + render    | Empty playlist, blank form                |
| project-files.html  | fetchProjectList       | No cards or dummy cards until API returns |
| content-management  | fetchProjectList       | Empty list until API returns              |

**Other pages** (index, kitchen, booking, admin, 3d-cabinet) either don’t block the main view on a slow API or load data on interaction (e.g. submit). They are lower priority for a loading screen.

---

## Implementation approach

- **Shared loading UI:** One small CSS + JS pattern (e.g. a full-page or in-content overlay with a spinner and optional “Loading…” text) used on these four pages.
- **Show** the loader as soon as the page script runs (or when the async work starts).
- **Hide** the loader when the relevant data has been applied (e.g. after `applyCmsData` / `render()` / `renderList()` / card build).
- **Error:** If the request fails (e.g. no network), hide the loader and show the current fallback UI (or a short error message) so the page doesn’t stay stuck on “Loading…”.

Next step: add the shared loading markup/CSS/JS and wire it into these four pages as above.
