# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SuccessOS — coach personal de éxito por WhatsApp. Bot que trackea objetivos, hábitos y métricas de vida del usuario via texto/audio, con PWA como interfaz web.

## Commands

### Backend
```bash
npm run dev          # Development with hot reload (tsx watch)
npm start            # Production run
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema changes to SQLite
```

### Frontend (web/)
```bash
cd web
npm run dev          # Vite dev server
npm run build        # tsc + vite build
npm run preview      # Preview production build
```

No test suite exists in this project.

## Architecture

### Entry Point & Boot
`src/index.ts` starts three systems in parallel: DB init, WhatsApp (Baileys), Express API, and node-cron scheduler.

### Message Flow (WhatsApp + Web Chat)
All messages — WhatsApp and web chat — go through `src/engine/messageProcessor.ts`. This is the central routing brain:

1. **Calendar connect** → `src/calendar/handler.ts`
2. **Help** → static help text
3. **Trivial** (ok, dale, jaja…) → empty response, no AI call
4. **Recalibration** (cambiar objetivo…) → `src/engine/recalibration.ts`
5. **Calendar** (agendame, qué tengo…) → `src/calendar/handler.ts`
6. **Status** (como vengo, progreso…) → `src/ai/coach.ts` with STATUS_PROMPT
7. **Quick log** (ends with `$`) → `src/ai/extractor.ts` + `src/engine/tracker.ts`, returns "Anotado ✓"
8. **Full message** → extract → track → coach → respond

WhatsApp handler lives in `src/whatsapp/handler.ts` and delegates to `processMessage`. Web chat goes through `src/api/routes.ts` POST `/chat` which also calls `processMessage`.

### AI Layer (`src/ai/`)
- `extractor.ts` — GPT-4o-mini extracts structured data (metrics, habits, goal progress) from free text
- `coach.ts` — GPT-4o-mini generates coaching responses using context (entry, goals, patterns, conversation history)
- `transcriber.ts` — Whisper-1 transcribes audio messages
- `prompts.ts` — All system prompts in one place
- Hard cost limit: $10/month. Models: `gpt-4o-mini` + `whisper-1` (set in `src/config.ts`)

### Database (`src/db/`)
SQLite via Drizzle ORM + better-sqlite3. Schema in `src/db/schema.ts`. All DB calls go through `src/db/repository.ts` — never use the Drizzle client directly from outside `db/`.

Key tables: `users`, `dailyEntries`, `goals`, `goalLogs`, `messages`, `habits`, `habitLogs`, `studySessions`, `flashcardDecks`, `flashcards`, `studySubjects`, `patterns`, `calendarTokens`, `authTokens`.

### Scheduler (`src/scheduler/`)
node-cron runs every 15 min. Handles: morning/evening check-ins, weekly reports, pattern analysis.

### PWA (`web/src/`)
React + Vite + Tailwind. Auth via JWT magic link sent through WhatsApp. Main sections:
- **Dashboard** — metrics, goals, daily score
- **Chat** — web chat interface (`ChatCheckin.tsx`) mirrors WhatsApp bot
- **Study** — Pomodoro (`PomodoroTimer.tsx`), Flow (`FlowTimer.tsx`), flashcards, spaced repetition
- **Habits**, **Insights**, **Profile**

API calls from frontend go to `http://localhost:3000/api` in dev; production points to Oracle Cloud instance.

### Google Calendar (`src/calendar/`)
OAuth2 flow. Tokens stored in `calendarTokens` table. `handler.ts` parses natural language calendar commands.

## Key Conventions

- **Language**: Spanish argentino informal in all bot responses and UI copy.
- **Quick log trigger**: Message must end with literal `$` (e.g. `"gym 1hr$"`, `"dormí 6hs $"`). Anything else goes through full coaching flow.
- **Timezone**: `America/Argentina/Buenos_Aires` hardcoded as default.
- **Config**: All env vars are read once in `src/config.ts`. Access via `import { config }`.
- **ESM**: Project uses `"type": "module"`. All imports need `.js` extension even for `.ts` source files.
- **Data dir**: `./data/` holds the SQLite DB and Baileys auth state. Never commit this.

## Workflow Rules

### Token Efficiency (CRITICAL)
- NEVER re-read a file you already read in this session unless the user changed it externally.
- When editing, use the Edit tool with minimal context — not Write with full file rewrites.
- For exploration, use Glob/Grep first. Only read files that match. Never read "just in case."
- When reporting changes, say what changed and where — don't echo back the full code.
- Prefer `Edit` with small surgical diffs over rewriting entire files.
- When asked to change multiple files, batch related reads in parallel, then batch edits in parallel.

### Code Quality
- TypeScript strict mode. No `any`. No `as` casts unless truly unavoidable.
- All new DB operations go through `src/db/repository.ts`. Never import drizzle client directly.
- All new AI prompts go in `src/ai/prompts.ts`. Never hardcode prompts in handlers.
- New API endpoints must use the existing auth middleware pattern from `src/api/routes.ts`.
- Frontend: reuse existing components before creating new ones. Check `web/src/components/` first.
- Keep functions under 50 lines. Extract when complexity grows.

### Deployment
- Production: Oracle Cloud at 146.235.245.149 (user: ubuntu, service: successos)
- Deploy flow: build locally → scp to server → restart service
- ALWAYS build frontend (`cd web && npm run build`) before deploying if frontend changed.
- NEVER push to a remote git repo without explicit user request.

### Planning
- For tasks touching 3+ files: present a brief plan BEFORE coding. List files to change and why.
- For single-file changes: just do it.
- When unsure about approach: ask. Don't guess and waste tokens on wrong paths.
