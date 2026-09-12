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

  const downloadCertificate = async (certificateRecord: Certificate) => {
    const certificate = certificateRefs.current[certificateRecord.id];
    if (!certificate || downloadingId) return;
    setDownloadingId(certificateRecord.id);
    try {
      const canvas = await html2canvas(certificate, {
        backgroundColor: "#000000",
        scale: 2,
        useCORS: true,
        logging: false,
        width: 1080,
        height: 1080,
        windowWidth: 1080,
        windowHeight: 1080,
        scrollX: 0,
        scrollY: 0,
      });
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
            <article key={certificateRecord.id} className="relative overflow-hidden" style={{ width: "100%", maxWidth: 1080, margin: "0 auto" }}>
              <div
                ref={(element) => { certificateRefs.current[certificateRecord.id] = element; }}
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 1080,
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