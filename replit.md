# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

Primary web artifact: **Selfbeat** — a production React/Vite app where users submit any question and watch 10 live AI models (ChatGPT, Claude, Gemini, DeepSeek, Grok, Mistral Large, Llama 3.3, Perplexity Sonar, Cohere Command R+, Qwen 2.5) answer simultaneously, self-critique against each other, and receive a final verdict with AI-generated insights. Tagline: "Where AI meets its match — itself."

### Architecture
- **Home page** → user submits question → instantly navigates to `/stream?q=...` (no blocking call)
- **Streaming results page** (`/stream`) → makes a POST SSE request to `/api/selfbeat/comparisons/stream`; displays 10 skeleton cards immediately, then updates each card progressively as `round1` (answer), `round2` (critique+scores), and `verdict` events arrive; on `done`, navigates to `/results/{id}` via wouter
- **Results page** (`/results/:id`) → fetches final saved result from PostgreSQL, shows final ranked cards with score bars, verdict, agreement/disagreement points, optional physician note
- **SSE endpoint** (`POST /api/selfbeat/comparisons/stream`) → emits per-model events as each AI resolves; caches results in PostgreSQL; cache replay is near-instant (~20ms) vs live (~19s)
- **10 AI providers**: OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), OpenRouter (DeepSeek, Grok, Mistral, Llama, Perplexity, Cohere, Qwen)
- **Quality features**: refusal detection (rose badge), generic/cached response detection (amber badge), GPT-4o-mini generates agreement/disagreement from actual answer content, winner determined by avg(accuracyScore, selfAwarenessScore)

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
