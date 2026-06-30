# Datacenter Monitor

A real-time datacenter infrastructure monitoring demo built with [Parallel](https://parallel.ai)'s Monitor API and Task API. Tracks 1,939 U.S. datacenter facilities across 23 markets with live event detection, per-facility enrichment, and deep research reports.

## What it does

- **31 monitors** watch for datacenter developments across the U.S. — power grid changes, zoning decisions, ownership transfers, new site discoveries, community opposition, and more
- **1,939 facilities** enriched with 25 fields each (description, power capacity, owner, tenants, cooling type, hazard zone, etc.) using Task API `ultra2x` deep research
- **Snapshot monitors** re-verify every facility hourly, detecting field-level changes with diffs
- **Deep research reports** generated on-demand for any event using `ultra-fast` processor with live streaming progress
- **Interactive map** with filter-driven marker highlighting and region fly-to
- **Dataset table** with per-cell basis (reasoning + citations) from Task API

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **react-leaflet** + Leaflet (map)
- **Tailwind CSS** (Parallel design system)
- **Parallel API** (Monitor API + Task API)
- **Vercel** (hosting, Blob storage, serverless)

## Parallel APIs used

### Monitor API
- **Event-stream monitors** (31) — watch web signals hourly, return structured events with category, severity, headline, summary, affected entities, and citations
- **Snapshot monitors** (1,939) — re-run enrichment queries hourly, detect field-level changes with diffs
- **Structured output schema** — monitors return classified events (`POWER_GRID`, `ZONING_POLICY`, `COMMUNITY`, etc.)
- **Webhooks + SSE** — events push to the app in real-time

### Task API
- **Facility enrichment** — `ultra2x` processor, 25-field JSON schema, 1,939 facilities enriched in parallel via Task Groups
- **Deep research reports** — `ultra-fast` processor, text mode, streaming SSE progress
- **Per-field basis** — every enriched value has reasoning + citations

## Setup

### Prerequisites
- Node.js 18+
- A [Parallel API key](https://platform.parallel.ai)
- A Vercel account (for Blob storage and deployment)

### 1. Install

```bash
git clone https://github.com/khushishelat/datacenter-map-demo.git
cd datacenter-map-demo
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
# Edit .env.local with your Parallel API key
```

### 3. Create monitors

```bash
npx tsx scripts/setup-monitors.ts
```

### 4. Enrich facilities

```bash
npx tsx scripts/run-enrichment.ts
npx tsx scripts/run-enrichment-v2.ts
npx tsx scripts/collect-enrichments.ts
npx tsx scripts/collect-enrichments-v2.ts
```

### 5. Upload to Vercel Blob

```bash
BLOB_READ_WRITE_TOKEN=xxx npx tsx scripts/upload-per-facility.ts
```

### 6. Create snapshot monitors

```bash
WEBHOOK_URL=https://your-app.vercel.app/api/webhook npx tsx scripts/create-snapshots.ts
```

### 7. Run

```bash
npm run dev     # local
vercel --prod   # deploy
```

## Architecture

```
Map View              Monitor Panel (right rail)
- Leaflet map         - Chart-as-filter (category/region/severity/time)
- 1,939 dots          - Filtered event feed with citations
- Tooltips + popups   - Deep research reports (streaming)
- Region fly-to       - Locate button → map fly-to

Dataset View
- 25 enriched fields per facility
- Per-cell basis panel (reasoning + citations from Vercel Blob)
- Monitor signals + snapshot diffs
- Activity window (24h / 7d / 30d)

API Routes
  /api/monitors   — live events from 31 monitors (Parallel API)
  /api/basis      — per-facility basis (~95KB each, from Vercel Blob)
  /api/snapshots  — snapshot change detection
  /api/research   — deep research with SSE streaming (Parallel Task API)
  /api/webhook    — receives monitor events via webhook
```

## Scripts

| Script | Purpose |
|--------|---------|
| `setup-monitors.ts` | Create 31 monitors with structured output |
| `run-enrichment.ts` | Enrich facilities (v1, 8 fields, ultra2x) |
| `run-enrichment-v2.ts` | Enrich facilities (v2, 17 fields, ultra2x) |
| `collect-enrichments.ts` | Collect enrichment results |
| `upload-per-facility.ts` | Upload per-facility basis to Vercel Blob |
| `create-snapshots.ts` | Create hourly snapshot monitors |
| `set-webhooks.ts` | Register webhook URL on all monitors |
| `check-events.ts` | CLI tool to check monitor events |

## License

MIT
