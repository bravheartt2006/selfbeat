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
- **Auth**: Custom Google OAuth via Passport.js + express-session + PostgreSQL session store. Sign-in popup flow: `/api/auth/google` → `/api/auth/google/callback` → `/api/auth/success` (posts `selfbeat-auth-success` message, closes popup). No Clerk.
- **Route guards**: `RequireAuth` component in `App.tsx` redirects unauthenticated users trying to access `/stream` or `/results` to `/sign-in`.
- **Credits**: 25 free on signup; 1 credit per comparison; tracked in `selfbeat_users` DB table
- **Anti-fraud**: FingerprintJS in `lib/fingerprint.ts`. Device fingerprint stored in `selfbeat_fingerprints` table. On POST `/api/users/me`, if fingerprint was already used on a different account → credits reset to 0, `deviceCreditBlocked: true` returned; frontend shows toast warning.
- **Free trial**: `POST /api/trial/start` — one-time 3-day Pro trial (no credit card). `trialUsed`, `trialStartDate`, `trialEndDate`, `convertedAfterTrial`, `trialReminderSent`, `trialExpirySent` columns on users table. Trial status returned by `/api/auth/me` and `/api/users/me/credits`. `checkAndDeductCredit()` honours active trial. Email sequences (start, 24h reminder, expiry) via Resend (`RESEND_API_KEY` secret). Post-trial discount ($7.99 first month) applied via Stripe coupon (`STRIPE_TRIAL_DISCOUNT_COUPON` env var) within 24h of expiry.
- **Trial UI**: `TrialBanner` component (sticky top, real-time countdown, updates every 10s). Paywall overlay shows "Try Pro free for 3 days" when user is signed in and hasn't used trial. Pricing page shows trial offer, active state, and welcome-back offer.
- **Login log**: `selfbeat_login_log` table — logs every sign-in with userId, ipAddress, timestamp.
- **Rate limiting**: `express-rate-limit` middleware. `streamRateLimiter` on stream endpoint, `apiRateLimiter` on credit balance endpoint.
- **Smart blur**: When user has 0 credits (and no active trial/subscription), backend sends `limited: true` → frontend shows Round 1 + blurred Round 2 overlay with trial/upgrade CTA
- **Pricing page**: `/pricing` — 4 plans: Starter ($4.99/25 credits), Pro Monthly ($9.99), Pro Annual ($79, Save 34%), Team ($39/mo)
- **Stripe**: Checkout via `/api/stripe/checkout` (supports `applyTrialDiscount` flag for $7.99 coupon), portal via `/api/stripe/portal`, webhook at `/api/stripe/webhook` (must come before express.json!). Coupon ID set via `STRIPE_TRIAL_DISCOUNT_COUPON` env var.
- **User table**: `selfbeat_users` (id, email, displayName, pictureUrl, credits, stripeCustomerId, stripeSubscriptionId, hasUnlimited, unlimitedUntil, lastSignInAt, trialUsed, trialStartDate, trialEndDate, convertedAfterTrial, trialReminderSent, trialExpirySent)
- **Fingerprint table**: `selfbeat_fingerprints` (fingerprintId, userId, seenAt)
- **Votes table**: `selfbeat_votes` (id serial PK, userId, comparisonId UUID, votedForAi, createdAt). UNIQUE(userId, comparisonId) enforces one vote per user per comparison. Supports toggle (re-vote same = delete) and change (different model = update).
- **Email**: Resend package installed. `artifacts/api-server/src/lib/email.ts` — 3 email templates (trial start, 24h reminder, expiry). Gracefully skips if `RESEND_API_KEY` not set (logs instead).

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
