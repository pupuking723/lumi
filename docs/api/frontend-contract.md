# Lumi Frontend API Contract

The frontend uses `src/lib/api/client.ts`. If `NEXT_PUBLIC_API_BASE_URL` is empty, Lumi uses the mock adapter for most features. Chat message sending is now hybrid: by default it calls the local Next.js proxy route `/api/chat/completions`, which forwards to the GoClaw Agent endpoint from Apifox.

## GoClaw Chat Integration

- Frontend proxy: `POST /api/chat/completions`.
- Upstream endpoint: `POST http://192.168.6.203:9600/v1/chat/completions`.
- Upstream model: `agent:fox-spirit`.
- Auth flow: NextAuth Google sign-in exchanges the Google `id_token`/`access_token` with `POST /v1/auth/google/login`. Google One Tap uses GIS `credential` through the NextAuth `google-one-tap` credentials provider.
- Upstream headers: `Accept-Language: zh`, `Authorization: Bearer <goclaw-user-session-token>`.
- Request shape sent upstream: `{ model, messages, stream: true }`.
- Response shape expected upstream: `text/event-stream` chunks shaped like `data: {"choices":[{"delta":{"content":"..."}}]}` and ending with `data: [DONE]`.
- Set `NEXT_PUBLIC_LUMI_CHAT_PROXY_PATH=off` to force local mock chat responses.

Server-side environment variables are documented in `.env.example`. The frontend no longer sends `X-GoClaw-User-Id` or `X-GoClaw-Tenant-Id`; GoClaw derives those values from the bearer token.

## Required Endpoints

- `GET /me` returns `UserProfile`.
- `PATCH /me/style-profile` accepts partial `UserProfile["styleProfile"]` and returns `UserProfile`.
- `GET /agents/mochi/conversations` returns `MochiConversation[]`.
- `POST /agents/mochi/conversations` creates a Mochi conversation.
- `GET /conversations/:id/messages` returns `ChatMessage[]`.
- `POST /conversations/:id/messages` accepts `{ content, imageUrl? }` and returns `{ userMessage, assistantMessage }`.
- `POST /live/sessions` creates a `LiveSession` and may return a realtime token.
- `POST /vision/analyses` accepts `{ intent, imageName?, imageUrl? }` and returns `VisionAnalysis`.
- `GET /looks` returns `LookCard[]`.
- `POST /looks` accepts `{ title, imageUrl?, analysis, visibility? }` and returns `LookCard`.
- `POST /looks/:id/share-link` returns `ShareLink`.

## Type Notes

Core frontend types live in `src/types/lumi.ts`: `UserProfile`, `MochiConversation`, `ChatMessage`, `LiveSession`, `VisionAnalysis`, `LookCard`, and `ShareLink`.

## Adapter Expectations

The HTTP adapter sends JSON. If the backend requires direct binary upload for Snap, add a storage pre-sign step or multipart upload endpoint before replacing the current `{ imageName, imageUrl }` shape. Keep the frontend call site stable by updating only `src/lib/api/http.ts`.

## Privacy Defaults

The UI treats photos and saved looks as private by default. Backend storage, retention, deletion, moderation, auth, and abuse prevention rules are intentionally owned by the external backend.
