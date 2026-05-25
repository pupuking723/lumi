# Lumi

Lumi is a mobile-first Next.js MVP for an AI Agent social app. The first Agent is Mochi, a cotton-elf fashion companion for text chat, realtime voice styling, and outfit camera analysis.

The frontend runs independently with a mock API adapter. Set `NEXT_PUBLIC_API_BASE_URL` to connect the same UI to an external backend.

Chat is already wired to the GoClaw Agent endpoint from Apifox through a local Next.js proxy route. The defaults match the LAN API at `http://192.168.6.203:9600` and can be overridden with the variables in `.env.example`.

Google login is wired through the same NextAuth Google provider pattern used by ShortArt. Configure `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and `GOOGLE_SECRET` in `.env.local`; for local OAuth, `NEXTAUTH_URL` must match the port you are running.

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
