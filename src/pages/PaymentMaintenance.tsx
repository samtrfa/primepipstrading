import { ArrowLeft, AlertTriangle, Clock3, RefreshCcw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PaymentMaintenance() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-lg md:p-10">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Platform update in progress
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Purchases are temporarily paused
        </h1>

        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We’re making a platform update to improve payment reliability and account activation.
          New purchases are temporarily unavailable while this work is being completed.
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-muted/30 p-5">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              This is a temporary maintenance window. Please check back shortly.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCcw className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Payments will reopen automatically once the update is complete and verified.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Existing funded accounts remain unaffected while this maintenance is in progress.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
