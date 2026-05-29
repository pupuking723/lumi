function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function configuredPublicOrigin() {
  const raw = process.env.LUMI_PUBLIC_APP_ORIGIN?.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function resolvePublicOrigin(request: Request) {
  const configured = configuredPublicOrigin();
  if (configured) return configured;

  const requestUrl = new URL(request.url);
  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    request.headers.get("host") ||
    requestUrl.host;
  const proto =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(":", "") ||
    "https";
  return `${proto}://${host}`;
}

export function resolvePublicRequestParts(request: Request) {
  const origin = new URL(resolvePublicOrigin(request));
  return {
    host: origin.host,
    proto: origin.protocol.replace(":", "") || "https",
  };
}

export function publicUrl(
  request: Request,
  path: string,
  search?: URLSearchParams,
) {
  const url = new URL(path, resolvePublicOrigin(request));
  url.search = search?.toString() ?? "";
  return url.toString();
}
