const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const LATIN_RE = /[A-Za-z]/;

export function inferPreferredLanguageFromText(text?: string) {
  const value = text?.trim() ?? "";
  if (!value) return "";
  if (CJK_RE.test(value)) return "zh";
  if (LATIN_RE.test(value)) return "en";
  return "";
}

export function resolveProxyAcceptLanguage(
  text?: string,
  requestAcceptLanguage?: string | null,
) {
  return (
    inferPreferredLanguageFromText(text) ||
    requestAcceptLanguage ||
    process.env.LUMI_AGENT_ACCEPT_LANGUAGE ||
    "en"
  );
}
