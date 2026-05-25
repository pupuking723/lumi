import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import next from "next";
import WebSocket, { WebSocketServer } from "ws";

const dir = process.cwd();

function loadLocalEnv(root) {
  const shellKeys = new Set(Object.keys(process.env));

  for (const fileName of [".env", ".env.local"]) {
    const filePath = resolve(root, fileName);
    if (!existsSync(filePath)) continue;

    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!shellKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv(dir);

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, dir, hostname, port });
const handle = app.getRequestHandler();

const DEFAULT_AGENT_BASE_URL = "http://192.168.6.203:9600";
const DEFAULT_LIVE_WS_PATH = "/v1/closy/live/gemini/ws";
const LOCAL_LIVE_PROXY_PATH = "/api/live/gemini/ws";

function toWebSocketUrl(baseUrl, path) {
  const root = baseUrl.replace(/\/$/, "");
  const url = new URL(`${root}${path}`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}

function closePair(client, upstream, code = 1000, reason = "closed") {
  if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
    client.close(code, reason);
  }
  if (
    upstream.readyState === WebSocket.OPEN ||
    upstream.readyState === WebSocket.CONNECTING
  ) {
    upstream.close(code, reason);
  }
}

function createLiveProxy(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (requestUrl.pathname !== LOCAL_LIVE_PROXY_PATH) return;

    wss.handleUpgrade(request, socket, head, (client) => {
      const baseUrl =
        process.env.LUMI_AGENT_API_BASE_URL?.replace(/\/$/, "") ??
        DEFAULT_AGENT_BASE_URL;
      const livePath = process.env.LUMI_AGENT_LIVE_WS_PATH ?? DEFAULT_LIVE_WS_PATH;
      const token = process.env.LUMI_AGENT_API_TOKEN ?? "dev-token";
      const userId = process.env.LUMI_AGENT_USER_ID ?? "user-a";
      const tenantId = process.env.LUMI_AGENT_TENANT_ID ?? "default";
      const upstreamUrl = toWebSocketUrl(baseUrl, livePath);

      requestUrl.searchParams.forEach((value, key) => {
        upstreamUrl.searchParams.set(key, value);
      });

      const upstream = new WebSocket(upstreamUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-GoClaw-User-Id": userId,
          "X-GoClaw-Tenant-Id": tenantId,
        },
      });

      const pendingMessages = [];

      client.on("message", (data, isBinary) => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(data, { binary: isBinary });
          return;
        }
        pendingMessages.push([data, isBinary]);
      });

      upstream.on("open", () => {
        client.send(JSON.stringify({ type: "ready" }));
        for (const [data, isBinary] of pendingMessages.splice(0)) {
          upstream.send(data, { binary: isBinary });
        }
      });

      upstream.on("message", (data, isBinary) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data, { binary: isBinary });
        }
      });

      upstream.on("close", (code, reason) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close(code, reason.toString() || "upstream closed");
        }
      });

      upstream.on("error", (error) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "error",
              message: error instanceof Error ? error.message : "Live connection failed.",
            }),
          );
        }
        closePair(client, upstream, 1011, "upstream error");
      });

      client.on("close", () => closePair(client, upstream));
      client.on("error", () => closePair(client, upstream, 1011, "client error"));
    });
  });
}

await app.prepare();

const server = createServer((request, response) => {
  handle(request, response);
});

createLiveProxy(server);

server.listen(port, hostname, () => {
  console.log(`> Server listening at http://${hostname}:${port}`);
  console.log(`> Live WS proxy ready at ${LOCAL_LIVE_PROXY_PATH}`);
});
