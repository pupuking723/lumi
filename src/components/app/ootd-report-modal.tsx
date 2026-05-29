"use client";

import type { ReactNode } from "react";
import {
  Copy,
  Download,
  LoaderCircle,
  QrCode,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeMediaImageUrl } from "@/lib/api/media-url";
import type { OotdReport, OotdShareCard } from "@/types/lumi";

interface OotdReportModalProps {
  open: boolean;
  report?: OotdReport | null;
  imageUrl?: string;
  shareCard?: OotdShareCard | null;
  pending: boolean;
  error?: string;
  sharePending: boolean;
  shareFallbackOpen?: boolean;
  shareError?: string;
  onClose: () => void;
  onShare: () => void;
  onCopyShareLink: () => void;
  onDownloadShareImage: () => void;
}

export function OotdReportModal({
  open,
  report,
  imageUrl,
  shareCard,
  pending,
  error,
  sharePending,
  shareFallbackOpen = false,
  shareError,
  onClose,
  onShare,
  onCopyShareLink,
  onDownloadShareImage,
}: OotdReportModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="OOTD report"
      className="fixed inset-0 z-[80] bg-[#f5f3f6] text-[#302d43] md:grid md:place-items-center md:bg-[#302d43]/18 md:p-6 md:backdrop-blur-sm"
    >
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col bg-[#f7f6f8] md:h-[min(82vh,900px)] md:max-w-[860px] md:overflow-hidden md:rounded-[30px] md:border md:border-white/80 md:shadow-[0_28px_90px_rgba(48,45,67,0.22)]">
        <header className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-white/80 px-5 md:h-20 md:px-7">
          <div>
            <p className="text-[0.78rem] font-extrabold text-[#9b8da7]">
              Mochi OOTD
            </p>
            <h2 className="text-xl font-extrabold tracking-normal">
              Today&apos;s report
            </h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Close OOTD report"
            onClick={onClose}
            className="rounded-full md:size-11"
          >
            <X size={18} aria-hidden />
          </Button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 [-webkit-overflow-scrolling:touch] md:overflow-hidden md:px-7 md:py-6">
          {pending && <OotdLoadingState />}
          {!pending && error && <OotdErrorState message={error} />}
          {!pending && report && (
            <div className="mx-auto max-w-[430px] md:h-full md:max-w-none md:min-h-0">
              <OotdReportBody report={report} imageUrl={imageUrl} />
            </div>
          )}
        </main>

        {!pending && report && (
          <footer className="shrink-0 border-t border-white/80 bg-[#f7f6f8]/94 px-4 py-4 backdrop-blur md:px-7">
            <div className="mx-auto flex max-w-[430px] flex-col gap-3 md:max-w-none md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 md:max-w-[360px]">
                <p className="text-sm font-extrabold">Share this look</p>
                {shareCard?.shortUrl && (
                  <p className="mt-1 truncate text-xs font-bold text-[#766d85]">
                    {shareCard.shortUrl}
                  </p>
                )}
                {shareError && (
                  <p className="mt-1 text-xs font-bold text-[#9d3650]">
                    {shareError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {shareCard && (
                  <div className="relative hidden size-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white md:flex">
                    {shareCard.qrImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shareCard.qrImageUrl}
                        alt="Share QR code"
                        className="size-full object-cover"
                      />
                    ) : (
                      <QrCode size={23} aria-hidden />
                    )}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={onShare}
                  disabled={sharePending}
                  className="h-12 flex-1 rounded-full px-6 md:flex-none"
                >
                  {sharePending ? (
                    <LoaderCircle size={17} className="animate-spin" aria-hidden />
                  ) : (
                    <Share2 size={17} aria-hidden />
                  )}
                  Share
                </Button>
              </div>
            </div>
            {shareFallbackOpen && shareCard?.shortUrl && (
              <div className="mx-auto mt-3 max-w-[430px] rounded-[24px] border border-white/80 bg-white/82 p-3 shadow-[0_18px_50px_rgba(48,45,67,0.12)] md:max-w-none">
                <div className="flex items-center gap-3">
                  <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#f7f6f8]">
                    {shareCard.qrImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shareCard.qrImageUrl}
                        alt="Share QR code"
                        className="size-full object-cover"
                      />
                    ) : (
                      <QrCode size={23} aria-hidden />
                    )}
                  </div>
                  <p className="min-w-0 flex-1 text-sm font-bold text-[#5d566b]">
                    Share the image, or send the link back to Lumi.
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <ShareActionButton onClick={onCopyShareLink} icon={<Copy size={18} />}>
                    Copy
                  </ShareActionButton>
                  <ShareActionLink
                    href={whatsAppShareUrl(shareCard.shortUrl, report)}
                    onClick={() => primeShareText(report, shareCard.shortUrl)}
                    icon={<WhatsAppIcon />}
                  >
                    WhatsApp
                  </ShareActionLink>
                  <ShareActionLink
                    href={xShareUrl(shareCard.shortUrl, report)}
                    onClick={() => primeShareText(report, shareCard.shortUrl)}
                    icon={<XBrandIcon />}
                  >
                    X
                  </ShareActionLink>
                  <ShareActionLink
                    href={telegramShareUrl(shareCard.shortUrl, report)}
                    onClick={() => primeShareText(report, shareCard.shortUrl)}
                    icon={<TelegramIcon />}
                  >
                    Telegram
                  </ShareActionLink>
                  <ShareActionLink
                    href={facebookShareUrl(shareCard.shortUrl, report)}
                    onClick={() => primeShareText(report, shareCard.shortUrl)}
                    icon={<FacebookIcon />}
                  >
                    Facebook
                  </ShareActionLink>
                  <ShareActionButton
                    onClick={onDownloadShareImage}
                    icon={<Download size={18} />}
                  >
                    Download
                  </ShareActionButton>
                </div>
              </div>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[18px] fill-current">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.051 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.889-9.884 2.64.001 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.463 3.488A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.946L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  );
}

function XBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[15px] fill-current">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932Zm-1.291 19.491h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[18px] fill-current">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0m4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[18px] fill-current">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.761 0 2.072.15 2.608.298v3.324c-.283-.03-.775-.045-1.386-.045-1.967 0-2.728.745-2.728 2.683v1.298h3.919l-.673 3.667h-3.246v7.98Z" />
    </svg>
  );
}

function ShareActionButton({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[4.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] bg-[#f7f6f8] px-2 text-xs font-extrabold text-[#302d43]"
    >
      <span className="grid size-7 place-items-center rounded-full bg-white text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
        {icon}
      </span>
      <span className="max-w-full truncate">{children}</span>
    </button>
  );
}

function ShareActionLink({
  children,
  href,
  icon,
  onClick,
}: {
  children: ReactNode;
  href: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className="flex h-[4.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] bg-[#f7f6f8] px-2 text-xs font-extrabold text-[#302d43]"
    >
      <span className="grid size-7 place-items-center rounded-full bg-white text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
        {icon}
      </span>
      <span className="max-w-full truncate">{children}</span>
    </a>
  );
}

function shareTitle(report: OotdReport) {
  return report.shareCard?.title || report.todayJudgment.title || "Mochi OOTD";
}

function shareDescription(report: OotdReport) {
  return (
    report.shareCard?.quote ||
    report.mochiLine ||
    report.todayJudgment.summary ||
    shareTitle(report)
  ).trim();
}

function shareText(report: OotdReport, url: string) {
  return `${shareDescription(report)} ${url}`.trim();
}

function primeShareText(report: OotdReport, url: string) {
  void navigator.clipboard?.writeText(shareText(report, url));
}

function whatsAppShareUrl(url: string, report: OotdReport) {
  return `https://wa.me/?text=${encodeURIComponent(shareText(report, url))}`;
}

function xShareUrl(url: string, report: OotdReport) {
  return `https://x.com/intent/post?text=${encodeURIComponent(shareText(report, url))}`;
}

function telegramShareUrl(url: string, report: OotdReport) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareDescription(report))}`;
}

function facebookShareUrl(url: string, report: OotdReport) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareDescription(report))}`;
}

function OotdLoadingState() {
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center text-center">
      <LoaderCircle size={28} className="mb-4 animate-spin text-[#f18aaa]" />
      <p className="text-lg font-extrabold">Mochi is reading the outfit</p>
      <p className="mt-2 max-w-[18rem] text-sm font-bold text-[#756c83]">
        Color, proportion, scene fit, then the useful part.
      </p>
    </div>
  );
}

function OotdErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-20 max-w-[360px] rounded-[24px] border border-[#ead1d8] bg-[#fff3f5]/82 p-5 text-[#7d2f45]">
      <p className="text-lg font-extrabold">Report failed</p>
      <p className="mt-2 text-sm font-bold">{message}</p>
    </div>
  );
}

function OotdReportBody({
  report,
  imageUrl,
}: {
  report: OotdReport;
  imageUrl?: string;
}) {
  const summary = report.todayJudgment.summary?.trim() ?? "";
  const overallStyle = report.overallStyle?.trim() ?? "";
  const biggestIssue = report.biggestIssue?.trim() ?? "";
  const mochiLine = report.mochiLine?.trim() ?? "";
  const palette = (report.palette ?? []).filter((color) => color.hex && color.name);
  const highlights = (report.highlights ?? []).filter((item) => item.trim());
  const suggestions = (report.suggestions ?? []).filter(
    (suggestion) => suggestion.title?.trim() || suggestion.body?.trim(),
  );

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/82 bg-[#fbfafc] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_22px_60px_rgba(52,49,69,0.12)] md:grid md:h-full md:min-h-0 md:grid-cols-[minmax(260px,0.82fr)_minmax(0,1fr)]">
      <OotdReportImage imageUrl={imageUrl} />
      <div className="space-y-5 p-5 md:min-h-0 md:overflow-y-auto md:p-6 md:pr-7 [-webkit-overflow-scrolling:touch]">
        <section>
          <h1 className="text-2xl font-extrabold leading-7 tracking-normal">
            {report.todayJudgment.title}
          </h1>
          {summary && (
            <p className="mt-3 text-[0.95rem] font-semibold leading-6 text-[#5d566b]">
              {summary}
            </p>
          )}
        </section>

        <section className="flex items-center justify-center py-2">
          <OotdScoreRing
            score={report.todayJudgment.score}
            label={report.todayJudgment.label}
          />
        </section>

        {overallStyle && (
          <ReportSection title="Overall style">
            <p className="text-[0.95rem] font-semibold leading-6 text-[#5d566b]">
              {overallStyle}
            </p>
          </ReportSection>
        )}

        {palette.length > 0 && (
          <ReportSection title="Color DNA">
            <div className="grid grid-cols-3 gap-3">
              {palette.map((color) => (
                <div key={`${color.name}-${color.hex}`} className="min-w-0">
                  <div
                    className="h-12 rounded-[12px] border border-black/5"
                    style={{ backgroundColor: color.hex }}
                  />
                  <p className="mt-1 truncate text-xs font-extrabold">
                    {color.name}
                  </p>
                  <p className="text-[0.68rem] font-bold text-[#8b8298]">
                    {color.hex}
                  </p>
                </div>
              ))}
            </div>
          </ReportSection>
        )}

        {highlights.length > 0 && (
          <ReportSection title="What works">
            <CompactList items={highlights} />
          </ReportSection>
        )}

        {biggestIssue && (
          <ReportSection title="Biggest issue">
            <p className="text-[0.95rem] font-semibold leading-6 text-[#5d566b]">
              {biggestIssue}
            </p>
          </ReportSection>
        )}

        {suggestions.length > 0 && (
          <ReportSection title="Fix it now">
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div key={`${suggestion.title}-${suggestion.body}`}>
                  {suggestion.title?.trim() && (
                    <p className="text-sm font-extrabold">
                      {suggestion.title}
                    </p>
                  )}
                  {suggestion.body?.trim() && (
                    <p className="mt-1 text-[0.92rem] font-semibold leading-6 text-[#5d566b]">
                      {suggestion.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ReportSection>
        )}

        {mochiLine && (
          <blockquote className="border-l-4 border-[#f18aaa] pl-4 text-lg font-extrabold leading-7">
            {mochiLine}
          </blockquote>
        )}
      </div>
    </article>
  );
}

function OotdReportImage({ imageUrl }: { imageUrl?: string }) {
  const normalizedImageUrl = normalizeMediaImageUrl(imageUrl);

  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-[#ebe7ee] md:h-full md:min-h-0 md:aspect-auto">
      {normalizedImageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizedImageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-2xl"
          />
          <div className="absolute inset-0 bg-[#302d43]/10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizedImageUrl}
            alt="Uploaded OOTD"
            className="relative z-10 size-full object-contain"
          />
        </>
      ) : (
        <div className="flex size-full items-center justify-center px-6 text-center text-sm font-extrabold text-[#8b8298]">
          OOTD image
        </div>
      )}
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[#e7e2ea] pt-4">
      <h3 className="mb-2 text-base font-extrabold tracking-normal">{title}</h3>
      {children}
    </section>
  );
}

function CompactList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[0.95rem] font-semibold leading-6 text-[#5d566b]">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#302d43]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function OotdScoreRing({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(10, score));
  const degrees = Math.round((clamped / 10) * 360);

  return (
    <div className="flex flex-col items-center">
      <div
        className="grid size-36 place-items-center rounded-full"
        style={{
          background: `conic-gradient(#302d43 ${degrees}deg, #ded9e2 ${degrees}deg 360deg)`,
        }}
      >
        <div className="grid size-28 place-items-center rounded-full bg-[#fbfafc] text-center">
          <div>
            <p className="text-3xl font-extrabold">
              {clamped.toFixed(1)}
              <span className="text-sm text-[#9b94a5]">/10</span>
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm font-extrabold">{label}</p>
    </div>
  );
}

export async function createOotdShareImageBlob({
  report,
  imageUrl,
  shareCard,
}: {
  report: OotdReport;
  imageUrl?: string;
  shareCard?: OotdShareCard | null;
}): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 5600;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#F7F6F8";
  ctx.fillRect(0, 0, width, height);

  const margin = 36;
  const cardX = margin;
  const cardW = width - margin * 2;
  const bodyX = 86;
  const bodyW = width - 172;
  let y = margin;

  const normalizedImageUrl = normalizeMediaImageUrl(imageUrl);
  const photo = normalizedImageUrl
    ? await loadCanvasImage(normalizedImageUrl).catch(() => null)
    : null;
  const qr = shareCard?.qrImageUrl
    ? await loadCanvasImage(shareCard.qrImageUrl).catch(() => null)
    : null;

  ctx.fillStyle = "#FBFAFC";
  roundRect(ctx, cardX, y, cardW, height - margin * 2, 44);
  ctx.fill();

  if (photo) {
    drawCoverImage(ctx, photo, cardX, y, cardW, 1260, 44);
  } else {
    ctx.fillStyle = "#EAE6EE";
    roundRect(ctx, cardX, y, cardW, 1260, 44);
    ctx.fill();
    drawTextBlock(
      ctx,
      "OOTD image",
      bodyX,
      y + 610,
      bodyW,
      32,
      "#8B8298",
      "800",
    );
  }
  y = margin + 1260 + 72;

  y = drawTextBlock(
    ctx,
    report.todayJudgment.title,
    bodyX,
    y,
    bodyW,
    54,
    "#302D43",
    "800",
    8,
  );

  const summary = report.todayJudgment.summary?.trim();
  if (summary) {
    y += 28;
    y = drawTextBlock(ctx, summary, bodyX, y, bodyW, 34, "#5D566B", "700", 8);
  }
  y += 66;

  drawScoreRing(ctx, width / 2, y + 190, 170, report.todayJudgment.score);
  ctx.fillStyle = "#302D43";
  ctx.font = "800 34px Arial";
  ctx.textAlign = "center";
  ctx.fillText(report.todayJudgment.label, width / 2, y + 430);
  ctx.textAlign = "left";
  y += 515;

  const overallStyle = report.overallStyle?.trim();
  if (overallStyle) {
    y = drawSectionDivider(ctx, bodyX, y, bodyW);
    y = drawSection(ctx, "Overall style", overallStyle, y, bodyX, bodyW);
  }

  const palette = (report.palette ?? []).filter((color) => color.hex && color.name);
  if (palette.length > 0) {
    y = drawSectionDivider(ctx, bodyX, y, bodyW);
    y = drawPaletteSection(ctx, palette, y, bodyX, bodyW);
  }

  const highlights = (report.highlights ?? []).filter((item) => item.trim());
  if (highlights.length > 0) {
    y = drawSectionDivider(ctx, bodyX, y, bodyW);
    y = drawListSection(ctx, "What works", highlights, y, bodyX, bodyW);
  }

  const biggestIssue = report.biggestIssue?.trim();
  if (biggestIssue) {
    y = drawSectionDivider(ctx, bodyX, y, bodyW);
    y = drawSection(ctx, "Biggest issue", biggestIssue, y, bodyX, bodyW);
  }

  const suggestions = (report.suggestions ?? []).filter(
    (suggestion) => suggestion.title?.trim() || suggestion.body?.trim(),
  );
  if (suggestions.length > 0) {
    y = drawSectionDivider(ctx, bodyX, y, bodyW);
    y = drawSuggestionSection(ctx, suggestions, y, bodyX, bodyW);
  }

  const mochiLine = report.mochiLine?.trim();
  if (mochiLine) {
    y += 46;
    ctx.fillStyle = "#F18AAA";
    roundRect(ctx, bodyX, y - 10, 8, 132, 4);
    ctx.fill();
    y = drawTextBlock(ctx, mochiLine, bodyX + 34, y + 34, bodyW - 34, 42, "#302D43", "800", 5);
    y += 48;
  }

  y = Math.max(y, y + 10);
  ctx.fillStyle = "#FBFAFC";
  roundRect(ctx, bodyX, y, bodyW, 190, 28);
  ctx.fill();

  ctx.fillStyle = "#302D43";
  ctx.font = "800 34px Arial";
  ctx.fillText("Lumi", bodyX + 28, y + 66);
  ctx.font = "700 24px Arial";
  ctx.fillStyle = "#7A7186";
  drawTextBlock(
    ctx,
    shareCard?.shortUrl ?? report.shareCard?.cta ?? "Try Lumi",
    bodyX + 28,
    y + 110,
    qr ? bodyW - 230 : bodyW - 56,
    24,
    "#7A7186",
    "700",
    2,
  );
  if (qr) {
    ctx.drawImage(qr, bodyX + bodyW - 178, y + 24, 142, 142);
  }
  y += 242;

  const finalHeight = Math.min(height, Math.ceil(y + margin));
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = finalHeight;
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) return null;
  finalCtx.drawImage(canvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);

  return canvasToBlob(finalCanvas);
}

export async function createOotdShareImageFile({
  report,
  imageUrl,
  shareCard,
}: {
  report: OotdReport;
  imageUrl?: string;
  shareCard?: OotdShareCard | null;
}) {
  const blob = await createOotdShareImageBlob({ report, imageUrl, shareCard });
  if (!blob) return null;
  return new File([blob], `lumi-ootd-${report.id}.png`, { type: "image/png" });
}

export async function downloadOotdShareImage({
  report,
  imageUrl,
  shareCard,
}: {
  report: OotdReport;
  imageUrl?: string;
  shareCard?: OotdShareCard | null;
}) {
  const blob = await createOotdShareImageBlob({ report, imageUrl, shareCard });
  if (!blob) return;
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = `lumi-ootd-${report.id}.png`;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

function drawSection(
  ctx: CanvasRenderingContext2D,
  title: string,
  body: string,
  y: number,
  x: number,
  width: number,
) {
  ctx.fillStyle = "#302D43";
  ctx.font = "800 36px Arial";
  ctx.fillText(title, x, y);
  return drawTextBlock(ctx, body, x, y + 62, width, 34, "#5D566B", "700", 8) + 36;
}

function drawSectionDivider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
) {
  ctx.strokeStyle = "#E7E2EA";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  return y + 60;
}

function drawPaletteSection(
  ctx: CanvasRenderingContext2D,
  palette: Array<{ name?: string; hex?: string }>,
  y: number,
  x: number,
  width: number,
) {
  ctx.fillStyle = "#302D43";
  ctx.font = "800 36px Arial";
  ctx.fillText("Color DNA", x, y);
  y += 54;

  const gap = 28;
  const count = Math.min(3, Math.max(1, palette.length));
  const swatchW = (width - gap * (count - 1)) / count;
  palette.slice(0, 3).forEach((color, index) => {
    const sx = x + index * (swatchW + gap);
    ctx.fillStyle = color.hex ?? "#EAE6EE";
    roundRect(ctx, sx, y, swatchW, 86, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(48,45,67,0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#5D566B";
    ctx.font = "800 28px Arial";
    ctx.fillText(color.name ?? "", sx, y + 132);
    ctx.fillStyle = "#9B94A5";
    ctx.font = "700 24px Arial";
    ctx.fillText(color.hex ?? "", sx, y + 164);
  });

  return y + 212;
}

function drawListSection(
  ctx: CanvasRenderingContext2D,
  title: string,
  items: string[],
  y: number,
  x: number,
  width: number,
) {
  ctx.fillStyle = "#302D43";
  ctx.font = "800 36px Arial";
  ctx.fillText(title, x, y);
  y += 58;
  for (const item of items) {
    ctx.fillStyle = "#302D43";
    ctx.beginPath();
    ctx.arc(x + 10, y + 17, 6, 0, Math.PI * 2);
    ctx.fill();
    y = drawTextBlock(ctx, item, x + 34, y, width - 34, 34, "#5D566B", "700", 5) + 14;
  }
  return y + 20;
}

function drawSuggestionSection(
  ctx: CanvasRenderingContext2D,
  suggestions: Array<{ title?: string; body?: string }>,
  y: number,
  x: number,
  width: number,
) {
  ctx.fillStyle = "#302D43";
  ctx.font = "800 36px Arial";
  ctx.fillText("Fix it now", x, y);
  y += 58;
  for (const suggestion of suggestions) {
    const title = suggestion.title?.trim();
    const body = suggestion.body?.trim();
    if (title) {
      ctx.fillStyle = "#302D43";
      ctx.font = "800 30px Arial";
      ctx.fillText(title, x, y);
      y += 42;
    }
    if (body) {
      y = drawTextBlock(ctx, body, x, y, width, 32, "#5D566B", "700", 6) + 28;
    }
  }
  return y;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  color: string,
  weight: string,
  maxLines = 6,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${fontSize}px Arial`;
  const words = tokenizeCanvasText(text);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = appendCanvasToken(line, word);
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else if (ctx.measureText(next).width > maxWidth) {
      const chars = Array.from(word);
      for (const char of chars) {
        const candidate = line + char;
        if (ctx.measureText(candidate).width > maxWidth && line) {
          lines.push(line);
          line = char;
        } else {
          line = candidate;
        }
      }
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const lineHeight = Math.round(fontSize * 1.35);
  const visible = lines.slice(0, maxLines);
  visible.forEach((value, index) => {
    ctx.fillText(value, x, y + index * lineHeight);
  });
  return y + visible.length * lineHeight;
}

function tokenizeCanvasText(text: string) {
  const segments = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF]+|[^\s]+/g) ?? [];
  return segments.flatMap((segment) =>
    /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF]/.test(segment)
      ? Array.from(segment)
      : segment,
  );
}

function appendCanvasToken(line: string, token: string) {
  if (!line) return token;
  if (isCjkToken(token) || isCjkToken(line.at(-1) ?? "")) {
    return `${line}${token}`;
  }
  return `${line} ${token}`;
}

function isCjkToken(value: string) {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF]/.test(value);
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 0,
) {
  ctx.save();
  if (radius > 0) {
    roundRect(ctx, x, y, width, height, radius);
    ctx.clip();
  }
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
}

function drawScoreRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  score: number,
) {
  const clamped = Math.max(0, Math.min(10, score));
  const start = -Math.PI / 2;
  const end = start + (clamped / 10) * Math.PI * 2;

  ctx.lineWidth = 42;
  ctx.strokeStyle = "#DED9E2";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#302D43";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();

  ctx.fillStyle = "#FBFAFC";
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#302D43";
  ctx.font = "800 70px Arial";
  ctx.textAlign = "center";
  ctx.fillText(clamped.toFixed(1), cx - 24, cy + 24);
  ctx.fillStyle = "#9B94A5";
  ctx.font = "800 32px Arial";
  ctx.fillText("/10", cx + 82, cy + 22);
  ctx.textAlign = "left";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
