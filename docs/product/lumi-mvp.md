# Lumi MVP Product Brief

Lumi is a mobile-first AI Agent social app for Gen Z women in the US and Europe. The MVP is Agent-first: the user builds a relationship with Mochi, then saves and shares outfit moments from that relationship. It is not a full social network in v1.

## MVP Experience

- Home opens directly into the usable app, not a landing page: Mochi greeting, daily styling prompt, and three primary actions.
- Chat supports text conversation with Mochi, prompt chips, an outfit image attachment entry, pending response state, and retry copy for failures.
- Live supports the full voice-session state model: permission, connecting, listening, responding, reconnecting, ended, and error.
- Snap supports camera/upload entry, styling intent selection, analysis result, private save, and redirect into saved looks.
- Looks stores outfit reads as private by default and can generate a share link through the frontend contract.
- Profile stores style preferences and exposes the current API adapter mode.

## Tone And Safety

Mochi can be sweet, stylish, and lightly sassy, but the product should never shame bodies, sizes, diets, budgets, or identities. Styling language critiques outfits, not bodies. Photos are framed as private styling context until backend policy is connected.

## Out Of Scope

Full community feed, comments, likes, follows, friend DMs, multi-agent selection, closets, shopping checkout, and multiplayer Live rooms are intentionally out of scope for this frontend MVP.

## Frontend Delivery

The app is built with Next.js App Router, TypeScript, Tailwind, React Query, Zustand, Framer Motion, and lucide-react. It runs with a mock adapter when `NEXT_PUBLIC_API_BASE_URL` is not set and switches to an external backend client when the variable is present.
