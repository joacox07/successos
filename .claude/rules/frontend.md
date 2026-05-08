---
description: Rules for React frontend files in web/src/
globs: web/src/**/*.{ts,tsx}
---

# Frontend Rules

- UI language: Spanish argentino informal. All user-facing text in Spanish.
- Styling: Tailwind CSS only. No inline styles, no CSS modules.
- API calls: Use the existing `api` object from `web/src/lib/api.ts`. Never use raw `fetch`.
- Auth: JWT token stored in localStorage. The `api` object handles auth headers automatically.
- Components: Check `web/src/components/` before creating new ones. Reuse aggressively.
- Pages: Each page is a standalone component in `web/src/pages/`. Route config in `App.tsx`.
- State: Use React hooks (useState, useEffect). No external state management library.
- Mobile-first: All layouts must work on mobile. PWA is primarily used on phone.
