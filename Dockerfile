# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_LUMI_LIVE_WS_URL
ARG NEXT_PUBLIC_LUMI_LIVE_SESSION_PATH
ARG NEXT_PUBLIC_LUMI_CHAT_PROXY_PATH
ARG NEXT_PUBLIC_LUMI_UPLOAD_PROXY_PATH
ARG NEXT_PUBLIC_API_BASE_URL

ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_LUMI_LIVE_WS_URL=$NEXT_PUBLIC_LUMI_LIVE_WS_URL
ENV NEXT_PUBLIC_LUMI_LIVE_SESSION_PATH=$NEXT_PUBLIC_LUMI_LIVE_SESSION_PATH
ENV NEXT_PUBLIC_LUMI_CHAT_PROXY_PATH=$NEXT_PUBLIC_LUMI_CHAT_PROXY_PATH
ENV NEXT_PUBLIC_LUMI_UPLOAD_PROXY_PATH=$NEXT_PUBLIC_LUMI_UPLOAD_PROXY_PATH
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile \
  && pnpm store prune

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --chown=nextjs:nodejs next.config.ts ./

USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
