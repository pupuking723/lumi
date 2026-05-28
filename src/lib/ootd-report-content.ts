export interface OotdReportChatSummaryData {
  todayJudgment: {
    title: string;
    score?: number;
    label?: string;
    summary?: string;
  };
  overallStyle?: string;
  highlights?: string[];
  biggestIssue?: string;
  suggestions?: Array<{
    title?: string;
    body?: string;
  }>;
  palette?: Array<{
    name?: string;
    hex?: string;
  }>;
  mochiLine?: string;
  shareCard?: {
    title?: string;
    quote?: string;
    advice?: string[];
    cta?: string;
  };
}

export function parseOotdReportContent(
  content: string,
): OotdReportChatSummaryData | null {
  const trimmed = content.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");

  if (jsonStart < 0 || jsonEnd <= jsonStart) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const report = parsed as Partial<OotdReportChatSummaryData>;
    const judgment = report.todayJudgment;
    if (
      !judgment ||
      typeof judgment !== "object" ||
      typeof judgment.title !== "string" ||
      !judgment.title.trim()
    ) {
      return null;
    }

    return {
      todayJudgment: {
        title: judgment.title,
        score:
          typeof judgment.score === "number" ? judgment.score : undefined,
        label: typeof judgment.label === "string" ? judgment.label : undefined,
        summary:
          typeof judgment.summary === "string" ? judgment.summary : undefined,
      },
      overallStyle:
        typeof report.overallStyle === "string"
          ? report.overallStyle
          : undefined,
      highlights: Array.isArray(report.highlights)
        ? report.highlights.filter((item): item is string => typeof item === "string")
        : undefined,
      biggestIssue:
        typeof report.biggestIssue === "string"
          ? report.biggestIssue
          : undefined,
      suggestions: Array.isArray(report.suggestions)
        ? report.suggestions
            .filter((item) => item && typeof item === "object")
            .map((item) => item as { title?: unknown; body?: unknown })
            .map((item) => ({
              title: typeof item.title === "string" ? item.title : undefined,
              body: typeof item.body === "string" ? item.body : undefined,
            }))
        : undefined,
      palette: Array.isArray(report.palette)
        ? report.palette
            .filter((item) => item && typeof item === "object")
            .map((item) => item as { name?: unknown; hex?: unknown })
            .map((item) => ({
              name: typeof item.name === "string" ? item.name : undefined,
              hex: typeof item.hex === "string" ? item.hex : undefined,
            }))
        : undefined,
      mochiLine:
        typeof report.mochiLine === "string" ? report.mochiLine : undefined,
      shareCard:
        report.shareCard && typeof report.shareCard === "object"
          ? {
              title:
                typeof report.shareCard.title === "string"
                  ? report.shareCard.title
                  : undefined,
              quote:
                typeof report.shareCard.quote === "string"
                  ? report.shareCard.quote
                  : undefined,
              advice: Array.isArray(report.shareCard.advice)
                ? report.shareCard.advice.filter(
                    (item): item is string => typeof item === "string",
                  )
                : undefined,
              cta:
                typeof report.shareCard.cta === "string"
                  ? report.shareCard.cta
                  : undefined,
            }
          : undefined,
    };
  } catch {
    return null;
  }
}

export function isPartialOotdReportContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed.includes("{")) return false;
  return (
    trimmed.includes('"todayJudgment"') ||
    trimmed.includes('"overallStyle"') ||
    trimmed.includes('"biggestIssue"') ||
    trimmed.includes('"suggestions"') ||
    trimmed.includes('"mochiLine"')
  );
}
