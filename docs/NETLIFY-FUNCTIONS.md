# Netlify Functions Setup

This portfolio now includes a Netlify functions router that keeps existing frontend API URLs working.

## Files added

- `netlify.toml`
- `netlify/functions/api.js`
- `netlify/lib/jsonData.js`

## Route mapping

`netlify.toml` rewrites:

- `/api/*` -> `/.netlify/functions/api`
- `/cappuccinostudiox/api/*` -> `/.netlify/functions/api`

The function handles:

- `GET /api/local/projects`
- `GET /api/local/projects/:id`
- `GET /api/project-files-config`
- `GET /api/availability`

## Write endpoint behavior

These currently return `501` by design in static Netlify mode:

- `POST /api/local/projects`
- `POST /api/project-files-config`
- `POST /api/bookings`
- `POST /api/waitlist`
- `POST /api/upload`

Reason: Netlify function filesystem writes are not persistent across invocations/deploys.

## For full CMS persistence

Use one of these:

1. Supabase (or another database/storage service) from functions.
2. A hosted Node server for write APIs.

## Local smoke test used

```bash
node --input-type=module -e "import { handler } from './netlify/functions/api.js'; const res = await handler({ httpMethod:'GET', path:'/api/local/projects' }); console.log(res.statusCode);"
```
