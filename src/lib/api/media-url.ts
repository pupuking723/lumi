export function normalizeMediaImageUrl(value?: string | null) {
  const url = value?.trim();
  if (!url) return "";

  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }

  if (url.startsWith("/v1/media/")) {
    return `/api/media/${url.slice("/v1/media/".length)}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/v1/media/")) {
      return `/api/media/${parsed.pathname.slice("/v1/media/".length)}${parsed.search}`;
    }
  } catch {
    return url;
  }

  return url;
}

export function normalizePayloadMediaImageUrl<T>(payload: T): T {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  if (typeof record.imageUrl !== "string") return payload;

  return {
    ...record,
    imageUrl: normalizeMediaImageUrl(record.imageUrl),
  } as T;
}
