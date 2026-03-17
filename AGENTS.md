# AGENTS.md

## Cursor Cloud specific instructions

### Overview

TruckHelpNow is a single Next.js App Router application (no monorepo). It uses npm as its package manager (`package-lock.json`).

### Services

| Service | How to run | Notes |
|---------|-----------|-------|
| Next.js dev server | `npm run dev` (port 3000) | Core service; serves landing page, `/chat`, and API routes |
| Supabase | External hosted instance | No local Supabase CLI setup; requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| OpenAI API | External | Requires `OPENAI_API_KEY`; used by `/api/chat` route |

### Standard commands

See `package.json` scripts:
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint` (ESLint flat config in `eslint.config.mjs`)
- **Seed KB**: `npm run seed` (populates diagnostic knowledge base in Supabase)

### Environment variables

Required in `.env.local` (gitignored):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

The app builds and the dev server starts with placeholder values, but API routes (`/api/chat`, `/api/cases`) will return errors without valid credentials.

### Non-obvious caveats

- `lib/supabase.ts` (browser client) is currently empty; all Supabase access goes through `lib/supabase-server.ts` (service-role, server-only).
- The `/api/chat` route validates the OpenAI key length and rejects short/placeholder keys with a clear error message (not a crash).
- There are no automated test suites (no Jest/Vitest/etc). The `test:diagnostic-kb` script is a manual diagnostic check that requires a live Supabase connection.
- ESLint runs with the flat config format (`eslint.config.mjs`); `npm run lint` exits 0 with only warnings in the current codebase.
- Next.js 16.x with Turbopack is used for dev builds.
- The chat page (`/chat`) has a "Start" button that initializes a diagnostic session before the user can send messages. Clicking "Start" triggers a greeting from the AI assistant.
- The `/api/cases` route requires a working Supabase connection to persist cases. Without it, the chat still works for one-off messages but case history is not saved.
- The `/api/chat` response includes both a text `reply` and a `structured` JSON diagnostic object. The chat UI renders both the text summary and structured sections (detected codes, possible causes, checks, guidance).
