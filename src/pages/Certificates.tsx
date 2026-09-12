import { useEffect, useRef, useState } from "react";
import { Award, CalendarDays, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";

interface Certificate {
  id: string;
  account_id: string | null;
  challenge_type: string | null;
  account_size: number | null;
  phase_number: number | null;
  phase_name: string | null;
  payout_id: string | null;
  payout_amount: number | null;
  payout_method: string | null;
  recipient_name: string | null;
  awarded_at: string;
}

const challengeLabels: Record<string, string> = {
  three_step: "3-Step Challenge",
  two_step: "2-Step Challenge",
  one_step: "1-Step Challenge",
  instant: "Instant Funding",
};

export default function Certificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const certificateRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const loadFundedAccounts = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("certificates")
        .select("id, account_id, challenge_type, account_size, phase_number, phase_name, payout_id, payout_amount, payout_method, recipient_name, awarded_at")
        .order("awarded_at", { ascending: false });

      if (error) console.error("Error fetching certificates:", error);
      setCertificates(data || []);
      setLoading(false);
    };

    loadFundedAccounts();
  }, []);

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

  const renderCertificateToCanvas = async (certificateRecord: Certificate) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const isPayout = Boolean(certificateRecord.payout_id);
    const amount = `$${Number(certificateRecord.payout_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const accountSize = certificateRecord.account_size ? `$${Number(certificateRecord.account_size).toLocaleString()}` : "-";
    const traderName = certificateRecord.recipient_name || "PrimePips Trader";
    const methodLabel = certificateRecord.payout_method?.replace(/_/g, " ") || "Crypto";
    const payoutDate = new Date(certificateRecord.awarded_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

    const cardX = 184;
    const cardY = 120;
    const cardW = 712;
    const cardH = 840;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cardGradient = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    cardGradient.addColorStop(0, "#303840");
    cardGradient.addColorStop(1, "#1a2127");

    ctx.fillStyle = cardGradient;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(214, 184, 117, 0.9)";
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.stroke();

    ctx.strokeStyle = "rgba(214,184,117,0.2)";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, cardX + 8, cardY + 8, cardW - 16, cardH - 16, 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "rgba(214,184,117,0.09)";
    ctx.arc(cardX + cardW - 110, cardY + 120, 100, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgba(214,184,117,0.05)";
    ctx.arc(cardX + 60, cardY + cardH - 60, 120, 0, Math.PI * 2);
    ctx.fill();

    const logo = await loadImage("/primepips-email-logo.svg");
    const logoWidth = 220;
    const logoHeight = 70;
    const logoX = cardX + (cardW - logoWidth) / 2;
    const logoY = cardY + 36;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

    const titleY = cardY + 245;
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3f0eb";
    ctx.font = "700 74px Arial";
    ctx.fillText(isPayout ? "PAYOUT" : "ACHIEVEMENT", cardX + cardW / 2, titleY);
    ctx.fillText("CERTIFICATE", cardX + cardW / 2, titleY + 75);

    ctx.fillStyle = "#dfe3e6";
    ctx.font = "italic 24px Georgia";
    ctx.fillText(`presented to: ${traderName}`, cardX + cardW / 2, titleY + 150);

    ctx.fillStyle = "#d4af37";
    ctx.font = "700 62px Arial";
    ctx.fillText(amount, cardX + cardW / 2, titleY + 250);

    const dividerY = titleY + 285;
    ctx.strokeStyle = "rgba(214,184,117,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 80, dividerY);
    ctx.lineTo(cardX + cardW - 80, dividerY);
    ctx.stroke();

    const detailY = dividerY + 60;
    const detailGap = 220;
    const detailFont = "600 18px Arial";
    const valueFont = "700 26px Arial";

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(217,223,224,0.8)";
    ctx.font = "600 13px Arial";
    ctx.letterSpacing = "0.14em";
    ctx.fillText("ACCOUNT SIZE", cardX + cardW / 2 - detailGap, detailY);
    ctx.fillText(isPayout ? "PAYOUT DATE" : "AWARD DATE", cardX + cardW / 2 + detailGap, detailY);

    ctx.fillStyle = "#f3f0eb";
    ctx.font = valueFont;
    ctx.fillText(accountSize, cardX + cardW / 2 - detailGap, detailY + 52);
    ctx.fillText(payoutDate, cardX + cardW / 2 + detailGap, detailY + 52);

    ctx.fillStyle = "rgba(217,223,224,0.85)";
    ctx.font = "600 12px Arial";
    ctx.fillText(`METHOD: ${methodLabel.toUpperCase()}`, cardX + 150, cardY + cardH - 52);
    ctx.fillText("PRIMEPIPS", cardX + cardW - 150, cardY + cardH - 52);

    return canvas;
  };

  const downloadCertificate = async (certificateRecord: Certificate) => {
    const certificate = certificateRefs.current[certificateRecord.id];
    if (!certificate || downloadingId) return;
    setDownloadingId(certificateRecord.id);

    try {
      const canvas = await renderCertificateToCanvas(certificateRecord);
      if (!canvas) return;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `primepips-certificate-${certificateRecord.id.slice(0, 8)}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout title="Certificates" subtitle="View your funded-account achievements and successful payout awards">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col justify-between gap-3 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">PrimePips credentials</p>
            <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">PrimePips certificates</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Official records for trading achievements and successful payouts awarded by PrimePips.</p>
          </div>
          <div className="hidden items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground sm:flex"><Award className="h-4 w-4 text-primary" /> Verified account records</div>
        </div>

        {loading && <Card variant="elevated"><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading certificates...</CardContent></Card>}

        {!loading && certificates.length === 0 && (
          <Card variant="elevated">
            <CardContent className="flex flex-col items-center p-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Award className="h-7 w-7" /></div>
              <h3 className="font-serif text-xl font-bold text-foreground">No certificates yet</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Complete an evaluation and reach funded status to receive a certificate here.</p>
            </CardContent>
          </Card>
        )}

        {!loading && certificates.length > 0 && <div className="grid gap-8 xl:grid-cols-2">{certificates.map((certificateRecord) => {
          const isPayout = Boolean(certificateRecord.payout_id);
          const amount = `$${Number(certificateRecord.payout_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
          const accountSize = certificateRecord.account_size ? `$${Number(certificateRecord.account_size).toLocaleString()}` : "-";
          const traderName = certificateRecord.recipient_name || "PrimePips Trader";
          const methodLabel = certificateRecord.payout_method?.replace(/_/g, " ") || "Crypto";
          const payoutDate = new Date(certificateRecord.awarded_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
          return (
            <article key={certificateRecord.id} className="relative overflow-hidden" style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
              <div
                ref={(element) => { certificateRefs.current[certificateRecord.id] = element; }}
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 760,
                  aspectRatio: "1 / 1",
                  margin: "0 auto",
                  overflow: "hidden",
                  border: "2px solid rgba(214, 184, 117, 0.8)",
                  borderRadius: "16px",
                  background: "linear-gradient(180deg, rgba(43,48,52,0.94) 0%, rgba(17,23,28,0.96) 100%)",
                  boxShadow: "0 0 0 1px rgba(214,184,117,0.28), inset 0 0 0 1px rgba(214,184,117,0.16)",
                  color: "#f5f0e4",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ position: "absolute", inset: 8, border: "1px solid rgba(214,184,117,0.4)", borderRadius: 10, boxSizing: "border-box" }} />
                <div style={{ position: "absolute", inset: 0, opacity: 0.16, background: "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.10), transparent 24%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.06), transparent 18%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", border: "1px solid rgba(214,184,117,0.10)", right: -40, top: -70 }} />
                <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", border: "1px solid rgba(214,184,117,0.08)", left: -40, bottom: -80 }} />

                <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", width: "100%", height: "100%", boxSizing: "border-box", padding: "26px 30px 18px" }}>
                  <header style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 2 }}>
                    <div style={{ width: 164, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src="/primepips-email-logo.svg" alt="PrimePips" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                    </div>
                  </header>

                  <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", flex: 1, paddingTop: 10, paddingBottom: 8 }}>
                    <h3 style={{ margin: 0, fontFamily: "Arial, Helvetica, sans-serif", fontSize: "clamp(24px, 3vw, 52px)", letterSpacing: "0.02em", textTransform: "uppercase", fontWeight: 700, lineHeight: 0.98, color: "#f5f0e4" }}>{isPayout ? "Payout" : "Achievement"}<br />{isPayout ? "Certificate" : "Certificate"}</h3>
                    <p style={{ margin: "14px 0 0", fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: "#f5f0e4", fontWeight: 500 }}>presented to: <span style={{ fontStyle: "normal", fontWeight: 700 }}>{traderName}</span></p>
                    {isPayout && <p style={{ margin: "18px 0 0", fontFamily: "Georgia, serif", fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.06em", color: "#d4af37" }}>{amount}</p>}

                    <div style={{ width: "100%", marginTop: 20, padding: "0 10%" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, width: "100%" }}>
                        <div style={{ textAlign: "center", borderTop: "1px solid rgba(214,184,117,0.45)", paddingTop: 10 }}>
                          <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "#d9dfe0", marginBottom: 4 }}>Account Size</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f0e4" }}>{accountSize}</div>
                        </div>
                        <div style={{ textAlign: "center", borderTop: "1px solid rgba(214,184,117,0.45)", paddingTop: 10 }}>
                          <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "#d9dfe0", marginBottom: 4 }}>{isPayout ? "Payout Date" : "Award Date"}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f0e4" }}>{payoutDate}</div>
                        </div>
                      </div>

                      {isPayout && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(214,184,117,0.25)", fontSize: 10, color: "#d9dfe0", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                          <span>Method: {methodLabel}</span>
                          <span>PrimePips</span>
                        </div>
                      )}
                    </div>
                  </main>
                </div>
              </div>
              <div className="mt-3 bg-background print:hidden"><Button type="button" variant="outline" className="w-full" disabled={downloadingId !== null} onClick={() => downloadCertificate(certificateRecord)}><Download className="mr-2 h-4 w-4" />{downloadingId === certificateRecord.id ? "Preparing PNG..." : "Download Certificate"}</Button></div>
            </article>
          );
        })}</div>}
      </div>
    </DashboardLayout>
  );
}