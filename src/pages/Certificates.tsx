import { useEffect, useRef, useState } from "react";
import { Award, CalendarDays, Download, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";

interface Certificate {
  id: string;
  account_id: string;
  challenge_type: string;
  account_size: number;
  phase_number: number;
  phase_name: string;
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
        .select("id, account_id, challenge_type, account_size, phase_number, phase_name, awarded_at")
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
      const canvas = await html2canvas(certificate, { backgroundColor: "#e9e4d8", scale: 2, useCORS: true, logging: false });
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
    <DashboardLayout title="Certificates" subtitle="View certificates for your funded accounts">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col justify-between gap-3 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">PrimePips credentials</p>
            <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">Funded status certificates</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Official platform records for accounts that have reached funded status.</p>
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

        {!loading && certificates.length > 0 && <div className="grid gap-8 xl:grid-cols-2">{certificates.map((certificateRecord) => (
          <article key={certificateRecord.id} className="relative overflow-hidden border-8 border-[#b9a36a] bg-[#e9e4d8] text-[#20272d] shadow-2xl ring-1 ring-[#8b6b28]/60 print:shadow-none">
            <div ref={(element) => { certificateRefs.current[certificateRecord.id] = element; }} className="relative">
              <div className="pointer-events-none absolute inset-2 border border-[#b99a4b]/70" />
            <header className="relative flex items-center justify-between gap-4 bg-[#111820] px-5 py-5 text-white sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <img src="/logo.svg" alt="PrimePips logo" className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0"><p className="font-serif text-xl font-bold tracking-tight">Prime<span className="text-[#d4af37]">Pips</span></p></div>
              </div>
              <p className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4af37]">Official record</p>
            </header>
            <div className="relative px-6 py-9 text-center sm:px-12 sm:py-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#b99a4b] bg-[#f3ead0] text-[#8b6b28]"><ShieldCheck className="h-8 w-8" /></div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8b6b28]">Certificate of passing</p>
              <h3 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[#20272d] sm:text-4xl">PrimePips <span className="text-[#8b6b28]">Achievement</span></h3>
              <div className="mx-auto my-6 h-px max-w-xs bg-[#b99a4b]" />
              <p className="mx-auto max-w-lg text-sm leading-7 text-[#59636b]">This certificate recognizes that the trader successfully completed the {certificateRecord.phase_name} of the PrimePips program.</p>
              <div className="mx-auto mt-8 grid max-w-lg grid-cols-2 border-y border-[#d8c58a] text-left">
                <div className="border-r border-[#d8c58a] px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b6b28]">Program</p><p className="mt-1 font-serif text-base font-bold">{challengeLabels[certificateRecord.challenge_type] || certificateRecord.challenge_type}</p></div>
                <div className="px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b6b28]">Passed</p><p className="mt-1 font-serif text-base font-bold">{certificateRecord.phase_name}</p></div>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] text-[#59636b]"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#8b6b28]" /> Awarded {new Date(certificateRecord.awarded_at).toLocaleDateString()}</span><span className="font-mono">Ref #{certificateRecord.id.slice(0, 8)}</span></div>
            </div>
            <footer className="relative flex items-center justify-between gap-4 border-t border-[#c8b98e] bg-[#dcd3bd]/75 px-6 py-4 text-[10px] uppercase tracking-wider text-[#59636b] sm:px-8"><span>PrimePips Funding</span><span>Platform verified</span></footer>
            </div>
            <div className="relative bg-background px-5 py-4 print:hidden"><Button type="button" variant="outline" className="w-full" disabled={downloadingId !== null} onClick={() => downloadCertificate(certificateRecord)}><Download className="mr-2 h-4 w-4" />{downloadingId === certificateRecord.id ? "Preparing PNG..." : "Download Certificate"}</Button></div>
          </article>
        ))}</div>}
      </div>
    </DashboardLayout>
  );
}