## Project Context – TruckHelpNow

TruckHelpNow is a **Next.js + React** web application that provides **truck repair and diagnostic help for drivers**, backed by **Supabase** for data/storage and using **OpenAI** for AI-assisted flows.

- **Primary goal**: Help truck drivers describe issues, get structured diagnostics, and access relevant repair information quickly and safely.
- **Target users**: Truck drivers, dispatchers, and support staff with limited time, often on mobile devices and in low-connectivity environments.

### Tech Stack

- **Framework**: Next.js `16.1.6` (React `19`)
- **Language**: TypeScript
- **Styling**: Tailwind CSS `4`
- **Backend / Data**: Supabase (`@supabase/supabase-js` `^2.97.0`)
- **AI**: OpenAI (`openai` `^6.25.0`)

### Supabase

- Project is configured via environment variables (see `README.md` and `.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- The initial schema is defined in `supabase/migrations/20250228000000_initial_schema.sql` and should be applied via the Supabase SQL Editor before local development.

### Local Development

- **Install dependencies**: `npm install`
- **Run dev server**: `npm run dev`
- **Build**: `npm run build`
- **Start production build**: `npm run start`
- **Lint**: `npm run lint`

### Design & UX Principles

- **Driver-first UX**:
  - Simple, readable UI; works well on mobile.
  - Minimize required typing (use buttons, presets, and guided flows).
  - Clear status/feedback on long-running actions (e.g., AI or network calls).
- **Safety & clarity**:
  - AI suggestions must be framed as guidance, not absolute truth.
  - Surface warnings when advice touches on safety‑critical actions (e.g., braking systems).

### AI Usage Guidelines

- Use AI to:
  - Help structure driver-reported symptoms into clear, machine-usable data.
  - Suggest likely causes and next diagnostic steps.
  - Draft checklists or instructions that a human can verify.
- Avoid:
  - Letting AI make unreviewed, safety‑critical decisions.
  - Hallucinating specific part numbers, legal advice, or repair guarantees.

### Future Work Notes

- Consider:
  - Adding **role-based views** (driver vs dispatcher vs mechanic).
  - Improving **offline resilience** (caching, retry logic).
  - Logging anonymized diagnostic flows for quality improvement and analytics.

