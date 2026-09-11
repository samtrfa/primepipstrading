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
      const width = certificate.clientWidth || certificate.scrollWidth;
      const height = certificate.clientHeight || certificate.scrollHeight;
      const canvas = await html2canvas(certificate, {
        backgroundColor: "#0b1116",
        scale: 2,
        useCORS: true,
        logging: false,
        width,
        height,
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
          return (
            <article key={certificateRecord.id} className="relative overflow-hidden">
              <div ref={(element) => { certificateRefs.current[certificateRecord.id] = element; }} className="relative grid aspect-[1.414/1] w-full grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden border-[6px] border-[#c6a75e] bg-[#0b1116] text-[#f5f0e4] shadow-2xl ring-1 ring-[#8a6a2e]/70 print:h-[148.5mm] print:w-[210mm] print:aspect-auto print:shadow-none">
                <div className="pointer-events-none absolute inset-2 border border-[#c6a75e]/50" />
                <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-[#c6a75e]/20" />
                <div className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full border border-[#c6a75e]/10" />

                <header className="relative flex flex-col items-center px-8 pt-5 sm:px-14 sm:pt-6">
                  <img src="/primepips-email-logo.svg" alt="PrimePips" className="h-10 w-auto max-w-[min(15rem,80%)] object-contain sm:h-12" />
                  <div className="mt-3 flex w-full max-w-2xl items-center gap-3"><span className="h-px flex-1 bg-[#c6a75e]/50" /><span className="whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.28em] text-[#d4af37]">Official certificate</span><span className="h-px flex-1 bg-[#c6a75e]/50" /></div>
                </header>

                <main className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden px-8 py-3 text-center sm:px-14 sm:py-4">
                  <p className="text-[7px] font-bold uppercase tracking-[0.28em] text-[#d4af37] sm:text-[8px]">{isPayout ? "Successful payout certificate" : "Achievement certificate"}</p>
                  <h3 className="mt-2 font-serif text-[clamp(1.6rem,2.5vw,3rem)] font-bold leading-none tracking-tight text-[#f5f0e4]">{isPayout ? "Payout Honor" : "Funded Achievement"}</h3>
                  <p className="mt-2 max-w-full break-words px-2 font-serif text-[11px] font-bold text-[#f5f0e4] sm:text-sm">Presented to {traderName}</p>
                  {isPayout && <p className="mt-3 font-serif text-[clamp(2rem,4vw,3.2rem)] font-bold leading-none tracking-tight text-[#d4af37]">{amount}</p>}
                  <p className="mt-2 max-w-xl text-[9px] leading-[1.35] text-[#b7c3c5] sm:text-[10px]">{isPayout ? `Crypto payout via PrimePips.` : `Completed ${certificateRecord.phase_name} of the PrimePips program.`}</p>
                </main>

                <div className="relative z-10 mx-8 grid h-[3.25rem] grid-cols-3 divide-x divide-[#c6a75e]/30 overflow-hidden border-y border-[#c6a75e]/40 bg-[#111b21]/70 text-center sm:mx-14 sm:h-[3.5rem]">
                  <div className="flex min-w-0 flex-col justify-center px-2 leading-none sm:px-4"><p className="text-[6px] font-bold uppercase tracking-[0.14em] text-[#d4af37] sm:text-[7px]">{isPayout ? "Payout" : "Program"}</p><p className="mt-1 truncate text-[8px] font-semibold leading-none text-[#f5f0e4] sm:text-[9px]">{isPayout ? amount : challengeLabels[certificateRecord.challenge_type || ""] || certificateRecord.challenge_type}</p></div>
                  <div className="flex min-w-0 flex-col justify-center px-2 leading-none sm:px-4"><p className="text-[6px] font-bold uppercase tracking-[0.14em] text-[#d4af37] sm:text-[7px]">{isPayout ? "Method" : "Passed"}</p><p className="mt-1 truncate text-[8px] font-semibold capitalize leading-none text-[#f5f0e4] sm:text-[9px]">{isPayout ? methodLabel : certificateRecord.phase_name}</p></div>
                  <div className="flex min-w-0 flex-col justify-center px-2 leading-none sm:px-4"><p className="text-[6px] font-bold uppercase tracking-[0.14em] text-[#d4af37] sm:text-[7px]">Account size</p><p className="mt-1 truncate text-[8px] font-semibold leading-none text-[#f5f0e4] sm:text-[9px]">{accountSize}</p></div>
                </div>

                <footer className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-t border-[#c6a75e]/30 bg-[#080d12]/80 px-8 py-3 text-[8px] uppercase tracking-[0.16em] text-[#9aaeb2] sm:px-14"><span>PrimePips Funding</span><span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3 text-[#d4af37]" />{new Date(certificateRecord.awarded_at).toLocaleDateString()}</span><span className="font-mono normal-case tracking-normal">Ref #{certificateRecord.id.slice(0, 8)}</span></footer>
              </div>
              <div className="mt-3 bg-background print:hidden"><Button type="button" variant="outline" className="w-full" disabled={downloadingId !== null} onClick={() => downloadCertificate(certificateRecord)}><Download className="mr-2 h-4 w-4" />{downloadingId === certificateRecord.id ? "Preparing PNG..." : "Download Certificate"}</Button></div>
            </article>
          );
        })}</div>}
      </div>
    </DashboardLayout>
  );
}