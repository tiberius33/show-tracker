# mysetlists.net Development Guide

## Routing: read before touching navigation

This app is a Next.js static export (`output: 'export'`, `trailingSlash: true` in next.config.js). Only pre-rendered routes exist as files in the build output. A dynamic route with runtime ids — `/shows/[id]`, `/festivals/[id]` — cannot be served:

- On the web, Netlify's catch-all rule (`/* → /index.html`) returns the root page's HTML for any missing route, making the URL work but the page render wrong
- On iOS, there is no Netlify at all. Capacitor serves bundled files directly; the catch-all doesn't exist, and the behavior is whatever the local server does with a missing path

**Detail views use a query parameter on a real route**, not a dynamic route:
- `/shows/?show=<id>` renders `ShowDetailView` on the `/shows` page, the same URL pattern songs, runs, and tours use
- The URL is a real pre-rendered route (`out/shows/index.html` exists)
- Back controls work because `lib/navRoutes.js` declares `detailParam: 'show'` for `/shows`, telling the mobile header this is a detail view inside a list
- Deep links (pasted URLs, shared links, Resend emails) redirect via `netlify.toml`: `/shows/<id>` and `/shows/<id>/` → `/shows/?show=<id>` (status 301)

**Verify any navigation change** against the contents of `out/` after `npm run build`, not against the source alone. The presence of a `.jsx` file says nothing about whether the route can be served.

In-app navigation goes through `showHref(id)` helper in `lib/showRouting.js` — use it everywhere so there is one place this can ever be wrong again.

This pattern has now cost three attempts to get right. The next session should not have to rediscover it.
