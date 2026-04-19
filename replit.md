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

### Monetization & Auth
- **Auth**: Clerk (Google Sign-In only). Custom sign-in page at `/sign-in` uses `useSignIn().authenticateWithRedirect` with `strategy: "oauth_google"`. No email/password. `/sign-up` redirects to `/sign-in`. SSO callbacks at `/sign-in/sso-callback` and `/sign-up/sso-callback` handled by `AuthenticateWithRedirectCallback`.
- **Route guards**: `RequireAuth` component in `App.tsx` redirects unauthenticated users trying to access `/stream` or `/results` to `/sign-in`.
- **Credits**: 10 free on signup; 1 credit per comparison; tracked in `selfbeat_users` DB table
- **Anti-fraud**: FingerprintJS in `lib/fingerprint.ts` (separate module, not exported from credits-context). Device fingerprint stored in `selfbeat_fingerprints` table. On new user creation, if fingerprint was already used on a different account → `startingCredits = 0`, `deviceCreditBlocked: true` returned from POST `/api/users/me`; frontend shows toast warning.
- **Login log**: `selfbeat_login_log` table — logs every sign-in with userId, fingerprintId, ipAddress, timestamp.
- **Rate limiting**: `express-rate-limit` middleware — 10 req/min per user (userId or IPv6-safe IP). Applied on `/api/selfbeat/comparisons/stream` via `streamRateLimiter` and credit balance endpoint via `apiRateLimiter`.
- **Smart blur**: When user has 0 credits, backend sends `limited: true` → frontend shows Round 1 + blurred Round 2 overlay with upgrade CTA
- **Pricing page**: `/pricing` — 5 plans: Free, Starter ($4.99/25 credits), Pro Monthly ($14.99), Pro Annual ($99, gold), Team ($49/mo)
- **Stripe**: Checkout via `/api/stripe/checkout`, portal via `/api/stripe/portal`, webhook at `/api/stripe/webhook` (must come before express.json!)
- **User table**: `selfbeat_users` (id, email, displayName, pictureUrl, credits, stripeCustomerId, stripeSubscriptionId, hasUnlimited, unlimitedUntil, lastSignInAt)
- **Fingerprint table**: `selfbeat_fingerprints` (fingerprintId, userId, seenAt)

### Blog
- Blog posts data: `artifacts/selfbeat/src/lib/blog-posts.ts` (4 posts, HTML content via `dangerouslySetInnerHTML`)
- Blog list: `/blog` → `pages/blog.tsx`; Blog detail: `/blog/:slug` → `pages/blog-post.tsx`
- Blog prose styles: `.blog-content` CSS class in `index.css` (h2, h3, p, ul, li, blockquote, strong, em)
- "Blog" nav item added to Navbar between Leaderboard and About

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
