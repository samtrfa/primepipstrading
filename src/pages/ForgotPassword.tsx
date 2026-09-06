import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Unable to send reset email", description: error.message, variant: "destructive" });
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/login" className="mx-auto mb-4 inline-flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            <span className="text-2xl font-serif font-bold">Prime<span className="text-primary">Pips</span></span>
          </Link>
          <CardTitle className="font-serif text-2xl">Reset your password</CardTitle>
          <CardDescription>{sent ? "Check your inbox for a secure reset link." : "Enter your account email and we will send a reset link."}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? <Button asChild className="w-full"><Link to="/login">Return to sign in</Link></Button> : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" /></div></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</Button>
              <Button asChild variant="ghost" className="w-full"><Link to="/login"><ArrowLeft className="mr-2 h-4 w-4" />Back to sign in</Link></Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}