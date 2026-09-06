import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let active = true;
    const finishAuthentication = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !data.session) {
        setStatus("error");
        return;
      }
      if (new URLSearchParams(window.location.search).get("next") === "/reset-password") {
        navigate("/reset-password", { replace: true });
        return;
      }
      setStatus("success");
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 900);
    };
    finishAuthentication();
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            {status === "loading" ? "Verifying your link" : status === "success" ? "Email verified" : "Link unavailable"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {status === "loading" && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
          {status === "success" && <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />}
          {status === "error" && <XCircle className="mx-auto h-10 w-10 text-destructive" />}
          <p className="text-sm text-muted-foreground">
            {status === "loading" ? "Please wait while we securely complete authentication." : status === "success" ? "Your account is ready. Redirecting to your dashboard..." : "This link may have expired or already been used. Request a new one to continue."}
          </p>
          {status === "error" && <Button asChild variant="gold" className="w-full"><Link to="/login">Return to sign in</Link></Button>}
        </CardContent>
      </Card>
    </div>
  );
}