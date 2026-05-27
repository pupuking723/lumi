# Lumi

Lumi is a mobile-first Next.js MVP for an AI Agent social app. The first Agent is Mochi, a cotton-elf fashion companion for text chat, realtime voice styling, and outfit camera analysis.

The frontend runs independently with a mock API adapter. Set `NEXT_PUBLIC_API_BASE_URL` to connect the same UI to an external backend.

Chat is wired to GoClaw through local Next.js proxy routes. After Google sign-in, NextAuth exchanges the Google token with GoClaw and forwards the returned GoClaw bearer token to upstream C-side requests.

Google login is wired through the same NextAuth Google provider pattern used by ShortArt. Configure `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`, and `LUMI_AGENT_API_BASE_URL` in `.env.local`; for local OAuth, `NEXTAUTH_URL` must match the port you are running.

## Getting Started

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

Useful docs:

- `docs/product/lumi-mvp.md`
- `docs/characters/mochi.md`
- `docs/api/frontend-contract.md`

## Scripts

- `pnpm dev` starts the app.
- `pnpm lint` runs ESLint.
- `pnpm test` runs Vitest unit/component checks.
- `pnpm e2e` runs Playwright mobile smoke tests.

## MVP Scope

In scope: Home, onboarding, Mochi text chat, Live state flow, Snap analysis, saved looks, profile/settings, mock API, and frontend/backend contract docs.

Out of scope: full community feed, friends, comments, DMs, multi-agent selection, shopping, and backend services.
