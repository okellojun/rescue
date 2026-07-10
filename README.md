# RescueRoute

**RescueRoute** is a real-time, hyper-local disaster relief and mutual aid canvas. When a hurricane, flood, or wildfire hits, the people who need help and the people who can offer it are often blocks apart but have no shared, live view of each other. RescueRoute gives them one: a dark, high-contrast map where every help request and aid offer appears as a pulsing marker the instant it is filed, and responders can claim a request in a single tap. The design philosophy is **"frictionless UX under panic"** — minimal cognitive load, fluid animation, instant real-time feedback, and zero dead-ends for a panicked user on a cracked phone with two bars of signal.

**Live demo:** _<add your deployed URL here>_

## Architecture

```
┌─────────────┐     POST /api/parse-incident     ┌──────────────┐
│  Browser UI │ ───────────────────────────────▶ │  Next.js API │
│ (dashboard) │                                   │   route      │
└──────┬──────┘                                   └──────┬───────┘
       │                                                 │
       │  Supabase Realtime (postgres_changes)            │ OpenAI
       │  INSERT / UPDATE                                 │ Structured Outputs
       │                                                 ▼
       │                                          ┌──────────────┐
       │                                          │   OpenAI     │
       │                                          │ gpt-4o-mini  │
       │                                          └──────┬───────┘
       │                                                 │ parsed JSON
       ▼                                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                      Supabase (Postgres)                        │
│   tickets table  ·  RLS  ·  Realtime publication               │
└──────────────────────────────────────────────────────────────┘
```

## Tech stack

| Layer        | Technology                                  | Version   |
| ------------ | ------------------------------------------- | --------- |
| Framework    | Next.js (App Router, Server Actions)        | 15.x      |
| Language     | TypeScript (`strict: true`)                 | 5.x       |
| Styling      | Tailwind CSS                                | 3.4.x     |
| UI primitives| shadcn/ui (Radix)                           | latest    |
| Animation    | Framer Motion                              | 11.x      |
| Mapping      | MapLibre GL JS via `react-map-gl` (OpenStreetMap tiles) | 4.x / 7.x |
| Backend      | Supabase (Postgres 15, Auth, Realtime, RLS) | latest    |
| AI layer     | OpenAI `gpt-4o-mini` (Structured Outputs)   | latest    |
| Validation   | Zod                                         | 3.x       |

## Local setup

```bash
git clone <repo-url>
cd rescueroute
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables

| Name                              | Description                                          | Where to obtain                  | Required |
| --------------------------------- | ---------------------------------------------------- | -------------------------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | Supabase project URL                                 | Supabase dashboard → Settings     | yes      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Supabase anon public key (client-side, RLS-governed) | Supabase dashboard → API          | yes      |
| `SUPABASE_SERVICE_ROLE_KEY`        | Supabase service-role key (server-only, bypasses RLS)| Supabase dashboard → API          | yes      |
| `NEXT_PUBLIC_MAPBOX_TOKEN`         | Mapbox public access token (optional — OSM tiles are used by default) | mapbox.com → Account → Tokens    | no       |
| `OPENAI_API_KEY`                   | OpenAI API key (server-only)                         | platform.openai.com → API keys    | yes      |
| `NEXT_PUBLIC_DEFAULT_MAP_LAT`      | Fallback map center latitude                          | any coordinate                    | no       |
| `NEXT_PUBLIC_DEFAULT_MAP_LNG`      | Fallback map center longitude                         | any coordinate                    | no       |

> `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` must NEVER be prefixed with `NEXT_PUBLIC_` — that would expose them to the browser.

## Supabase setup

1. Create a new Supabase project at supabase.com.
2. Open the SQL editor and paste the contents of `supabase-schema.sql`, then run it. (Or use `supabase db push` with the CLI.)
3. Confirm Realtime is enabled on the `tickets` table: the migration adds it to the `supabase_realtime` publication, but you can also toggle it in the dashboard under Database → Replication.
4. Copy the project URL, anon key, and service-role key into `.env.local`.

## Deployment — Vercel (primary)

1. Push the repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Next.js** (auto-detected). No build override needed — `next build` is the default.
3. In Project Settings → Environment Variables, add every variable from the table above for both **Production** and **Preview**.
   - `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only — do not mark them as `NEXT_PUBLIC_`.
4. Deploy. After deploy, verify the AI route with a test POST:
   ```bash
   curl -X POST https://<your-domain>/api/parse-incident \
     -H "Content-Type: application/json" \
     -d '{"rawText":"Family trapped on the second floor, someone is bleeding badly."}'
   ```

## Deployment — Netlify (secondary)

`netlify.toml` is already configured:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

1. Connect the repo at app.netlify.com.
2. Add the same environment variables in Site Settings → Environment Variables.
3. The `@netlify/plugin-nextjs` plugin handles API routes as serverless functions automatically — no manual function config needed.

## Known limitations & future work

These are honest hackathon-scope boundaries, not hidden gaps:

- **No offline queue/sync.** If the device loses signal mid-report, the request is lost. A future version would queue writes in IndexedDB and replay on reconnect.
- **No real SMS/Twilio gateway.** The "SMS" ingestion path is simulated via the `/api/parse-incident` text input, not a live Twilio webhook.
- **In-memory rate limiting only.** The token bucket lives in process memory and resets on cold start; production should use Upstash Redis for a shared, durable limit.
- **No PostGIS geo-indexing yet.** Location queries use a composite `(latitude, longitude)` b-tree index. A future upgrade would add a `geography` column and `ST_DWithin` radius queries.

## License

MIT

_Built for [Hackathon Name] — attribution placeholder._
