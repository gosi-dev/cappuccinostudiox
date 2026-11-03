# UI Kit

Build and clean up UI elements here. When they’re ready, we turn them into components and templates on the main site.

## See updates live

1. **From the project root**, start a local server:
   ```bash
   npx serve .
   ```
2. **In your browser**, open:
   ```
   http://localhost:3000/ui-kit/
   ```
3. **Edit** any file in `ui-kit/` (or ask for changes). **Refresh** the page to see updates.

For automatic refresh on save, open the project in Cursor and use **Live Server** on `ui-kit/index.html` (Right‑click → Open with Live Server). Then every save will reload the page.

## Files

- **index.html** — Playground: all kit sections in one page. Add new sections here as we build.
- **kit.css** — Shared styles (Code Saver, yellow/red palette). Use in every kit page.
- **README.md** — This file.

## Locking into the site

When a component is ready, we copy or adapt it into the main site (e.g. into `booking.html`, shared CSS, or a reusable pattern) and wire it to the existing framework.
