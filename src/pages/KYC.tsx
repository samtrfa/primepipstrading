import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, FileCheck2, ShieldAlert, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type KycRecord = {
  id: string; status: string; rejection_reason: string | null; reviewed_at: string | null; reviewed_by: string | null;
  identity_document_type: string | null; address_document_type: string | null; identity_submitted_at: string | null; address_submitted_at: string | null;
};

const identityTypes = [{ value: "passport", label: "Passport" }, { value: "national_id", label: "National ID" }, { value: "drivers_license", label: "Driver's license" }];
const addressTypes = [{ value: "utility_bill", label: "Utility bill" }, { value: "bank_statement", label: "Bank statement" }, { value: "government_letter", label: "Government letter" }];
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

export default function KYCPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [record, setRecord] = useState<KycRecord | null>(null);
  const [identityType, setIdentityType] = useState("passport");
  const [addressType, setAddressType] = useState("utility_bill");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadKyc = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return; }
    const { data, error } = await supabase.from("kyc_verifications").select("id, status, rejection_reason, reviewed_at, reviewed_by, identity_document_type, address_document_type, identity_submitted_at, address_submitted_at").maybeSingle();
    if (error) toast({ title: "Unable to load KYC status", description: error.message, variant: "destructive" });
    else setRecord(data);
    setLoading(false);
  };

  useEffect(() => { void loadKyc(); }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identityFile || !addressFile) { toast({ title: "Both documents are required", description: "Upload one identity document and one proof of address.", variant: "destructive" }); return; }
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (![identityFile, addressFile].every((file) => allowed.includes(file.type) && file.size <= 10 * 1024 * 1024)) { toast({ title: "Unsupported document", description: "Use a PDF, JPG, or PNG file up to 10 MB.", variant: "destructive" }); return; }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const upload = async (file: File, kind: string) => {
      const path = `${user.id}/${crypto.randomUUID()}-${kind}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      return path;
    };
    try {
      const identityPath = await upload(identityFile, "identity");
      const addressPath = await upload(addressFile, "address");
      const { data, error } = await supabase.rpc("submit_kyc", { p_identity_document_type: identityType, p_identity_document_path: identityPath, p_address_document_type: addressType, p_address_document_path: addressPath });
      if (error) throw error;
      setRecord(data);
      setIdentityFile(null); setAddressFile(null);
      toast({ title: "KYC submitted", description: "Your documents are now pending review." });
    } catch (error) {
      toast({ title: "KYC submission failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const canSubmit = !record || record.status === "not_started" || record.status === "rejected";
  const status = record?.status || "not_started";
  const StatusIcon = status === "approved" ? CheckCircle2 : status === "rejected" ? ShieldAlert : status === "pending" ? Clock3 : FileCheck2;

  return <DashboardLayout title="Identity verification" subtitle="Verify your identity before requesting trading-profit payouts">
    <div className="mx-auto max-w-3xl space-y-6">
      <Card variant="elevated"><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle className="font-serif text-2xl">KYC status</CardTitle><CardDescription>Your documents are stored privately and reviewed by the PrimePips team.</CardDescription></div><Badge className="gap-1 capitalize"><StatusIcon className="h-3.5 w-3.5" />{status.replace("_", " ")}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm">
        {status === "rejected" && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"><p className="font-medium text-destructive">Changes required</p><p className="mt-1 text-muted-foreground">{record?.rejection_reason}</p></div>}
        {record?.identity_submitted_at && <p className="text-muted-foreground">Submitted {formatDate(record.identity_submitted_at)}</p>}
        {record?.reviewed_at && <p className="text-muted-foreground">Reviewed {formatDate(record.reviewed_at)}{record.reviewed_by ? ` by reviewer ${record.reviewed_by.slice(0, 8)}` : ""}</p>}
        {status === "approved" && <p className="text-success">Your funded-account trading payouts are enabled.</p>}
        {status === "pending" && <p className="text-muted-foreground">Review usually takes 1-2 business days.</p>}
      </CardContent></Card>

      {canSubmit && <Card><CardHeader><CardTitle className="font-serif text-2xl">{status === "rejected" ? "Resubmit documents" : "Submit documents"}</CardTitle><CardDescription>Upload clear, current documents. Accepted formats: PDF, JPG, or PNG, up to 10 MB each.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="identityType">Identity document type</Label><select id="identityType" value={identityType} onChange={(event) => setIdentityType(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{identityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><Label htmlFor="identityFile" className="pt-2">Identity document</Label><input id="identityFile" required type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setIdentityFile(event.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" /></div><div className="space-y-2"><Label htmlFor="addressType">Proof of address type</Label><select id="addressType" value={addressType} onChange={(event) => setAddressType(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{addressTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><Label htmlFor="addressFile" className="pt-2">Proof of address</Label><input id="addressFile" required type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setAddressFile(event.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" /></div></div>
        <Button type="submit" variant="gold" disabled={submitting}><Upload className="h-4 w-4" />{submitting ? "Submitting..." : "Submit for review"}</Button>
      </form></CardContent></Card>}
      {loading && <p className="text-sm text-muted-foreground">Loading KYC status...</p>}
    </div>
  </DashboardLayout>;
}
