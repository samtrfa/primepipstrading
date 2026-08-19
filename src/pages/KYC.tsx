import { useEffect, useState } from "react";

type Status = "upload" | "validating" | "verified";

export default function KYC() {
  const [status, setStatus] = useState<Status>("upload");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status !== "validating") return;

    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(100, (elapsed / 15000) * 100));
    }, 100);

    const complete = window.setTimeout(() => {
      window.clearInterval(timer);
      setProgress(100);
      setStatus("verified");
    }, 15000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(complete);
    };
  }, [status]);

  const handleFile = (file?: File) => {
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "application/pdf"];

    if (!allowed.includes(file.type)) {
      window.alert("Please upload a JPG, PNG, or PDF document.");
      return;
    }

    setFileName(file.name);
    setProgress(0);
    setStatus("validating");
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">KYC Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your identity by submitting a valid document.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
        {status === "upload" && (
          <div className="space-y-6 text-center">
            <div>
              <h2 className="text-xl font-semibold">Submit your document</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a government-issued identity document to begin.
              </p>
            </div>

            <label className="inline-flex cursor-pointer rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
              Choose document
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>

            <p className="text-xs text-muted-foreground">
              Accepted formats: JPG, PNG, PDF
            </p>
          </div>
        )}

        {status === "validating" && (
          <div className="mx-auto max-w-lg space-y-5 text-center">
            <div className="text-5xl">📄</div>
            <h2 className="text-xl font-semibold">
              Your document is being validated
            </h2>
            <p className="text-sm text-muted-foreground">
              We received your document. Please wait while it is reviewed.
            </p>

            <div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Validating… {Math.round(progress)}%
              </p>
            </div>

            <p className="break-all text-sm text-muted-foreground">
              Received: {fileName}
            </p>
          </div>
        )}

        {status === "verified" && (
          <div className="space-y-4 text-center">
            <div className="text-6xl text-green-600">✓</div>
            <h2 className="text-2xl font-bold text-green-600">KYC Verified</h2>
            <p className="text-sm text-muted-foreground">
              Your document has been successfully validated.
            </p>
            <p className="break-all text-sm text-muted-foreground">
              Verified document: {fileName}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}