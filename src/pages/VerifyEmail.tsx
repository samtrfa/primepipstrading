import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "signup" });
    setLoading(false);
    if (error) {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Email verified", description: "Your account is ready." });
    navigate("/dashboard", { replace: true });
  };

  const resend = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    toast(error ? { title: "Unable to resend code", description: error.message, variant: "destructive" } : { title: "Code sent", description: "Check your inbox for a new verification code." });
  };

  return <div className="flex min-h-screen items-center justify-center bg-background p-4"><Card className="w-full max-w-md"><CardHeader className="text-center"><Link to="/" className="mx-auto mb-4 inline-flex items-center gap-2"><TrendingUp className="h-7 w-7 text-primary" /><span className="text-2xl font-serif font-bold">Prime<span className="text-primary">Pips</span></span></Link><CardTitle className="font-serif text-2xl">Verify your email</CardTitle><CardDescription>Enter the six-digit code from your PrimePips email.</CardDescription></CardHeader><CardContent><form onSubmit={verify} className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" /></div></div><div className="space-y-2"><Label htmlFor="code">Verification code</Label><Input id="code" inputMode="numeric" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></div><Button type="submit" className="w-full" disabled={loading}>{loading ? "Verifying..." : "Verify email"}</Button></form><Button type="button" variant="ghost" className="mt-2 w-full" onClick={resend}>Resend code</Button></CardContent></Card></div>;
}