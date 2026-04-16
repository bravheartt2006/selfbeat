# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

Primary web artifact: **Selfbeat** — a production React/Vite app where users submit any question and watch 10 live AI models (ChatGPT, Claude, Gemini, DeepSeek, Grok, Mistral Large, Llama 3.3, Perplexity Sonar, Cohere Command R+, Qwen 2.5) answer simultaneously, self-critique against each other, and receive a final verdict with AI-generated insights. Tagline: "Where AI meets its match — itself." Physician-founded.

### Architecture
- **Home page** → user submits question → requires sign-in (Clerk) → navigates to `/stream?q=...`
- **Streaming results page** (`/stream`) → POST SSE to `/api/selfbeat/comparisons/stream`; emits `meta` (limited flag), `round1`, `round2`, `verdict`, `done` events; when `limited: true`, stops after Round 1 and shows blur/upgrade overlay
- **Results page** (`/results/:id`) → fetches final saved result from PostgreSQL, shows final ranked cards with score bars, verdict, agreement/disagreement points, optional physician note
- **SSE endpoint** (`POST /api/selfbeat/comparisons/stream`) → checks Clerk auth + credits via `checkAndDeductCredit()`; sets `limited: true` when user has 0 credits; caches results in PostgreSQL
- **10 AI providers**: OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), OpenRouter (DeepSeek, Grok, Mistral, Llama, Perplexity, Cohere, Qwen)
- **Quality features**: refusal detection (rose badge), generic/cached response detection (amber badge), GPT-4o-mini generates agreement/disagreement from actual answer content, winner determined by avg(accuracyScore, selfAwarenessScore)

### Monetization
- **Auth**: Clerk (Google + Apple Sign-In only — configured via Auth pane in workspace toolbar)
- **Credits**: 10 free on signup; 1 credit per comparison; tracked in `selfbeat_users` DB table
- **Fingerprinting**: FingerprintJS (loaded in `CreditsProvider`) — device fingerprint stored in `selfbeat_fingerprints` table
- **Smart blur**: When user has 0 credits, backend sends `limited: true` → frontend shows Round 1 + blurred Round 2 overlay with upgrade CTA
- **Pricing page**: `/pricing` — 3 plans: 25 credits/$4.99 (one-time), Monthly unlimited/$9.99, Annual unlimited/$79
- **Stripe**: Checkout via `/api/stripe/checkout`, portal via `/api/stripe/portal`, webhook at `/api/stripe/webhook` (before express.json!)
- **User table**: `selfbeat_users` (id, email, credits, stripeCustomerId, stripeSubscriptionId, hasUnlimited, unlimitedUntil)
- **Fingerprint table**: `selfbeat_fingerprints` (fingerprintId, userId, seenAt)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend artifact**: Selfbeat React/Vite app at `artifacts/selfbeat`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
