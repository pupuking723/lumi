import { ImageResponse } from "next/og";

export const runtime = "edge";

function trimParam(value: string | null, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 180) : fallback;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const title = trimParam(url.searchParams.get("title"), "Mochi OOTD");
  const description = trimParam(
    url.searchParams.get("description"),
    "See this Mochi OOTD report.",
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f6f8",
          color: "#302d43",
          padding: "72px",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          <div
            style={{
              color: "#9b8da7",
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            Mochi OOTD
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.02,
              maxWidth: 900,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: "#5d566b",
              display: "flex",
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.22,
              maxWidth: 940,
            }}
          >
            {description}
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              borderLeft: "10px solid #f18aaa",
              color: "#302d43",
              display: "flex",
              fontSize: 34,
              fontWeight: 900,
              paddingLeft: "24px",
            }}
          >
            Share the look
          </div>
          <div
            style={{
              background: "#302d43",
              borderRadius: 999,
              color: "white",
              display: "flex",
              fontSize: 30,
              fontWeight: 900,
              padding: "22px 34px",
            }}
          >
            Lumi
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
