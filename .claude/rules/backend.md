---
description: Rules for backend TypeScript files in src/
globs: src/**/*.ts
---

# Backend Rules

- ESM project: ALL imports must use `.js` extension (even for `.ts` files)
- Database: ALL queries go through `src/db/repository.ts`. Add new methods there, import from there.
- Config: ALL env vars accessed via `import { config } from './config.js'`. Never use `process.env` directly.
- AI prompts: ALL prompts live in `src/ai/prompts.ts`. Handlers import from there.
- Error handling: Log errors with context, don't swallow silently. Use `console.error` with the function name.
- WhatsApp: Messages are processed through `src/engine/messageProcessor.ts`. New message types go there.
- Timezone: Always use `America/Argentina/Buenos_Aires`. Never assume UTC for user-facing dates.
