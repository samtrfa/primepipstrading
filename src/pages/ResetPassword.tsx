import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6 || password !== confirmation) {
      toast({ title: "Check your password", description: password !== confirmation ? "The passwords do not match." : "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Unable to update password", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password updated", description: "You can now sign in with your new password." });
    navigate("/dashboard", { replace: true });
  };

  return <div className="flex min-h-screen items-center justify-center bg-background p-4"><Card className="w-full max-w-md"><CardHeader className="text-center"><Link to="/" className="mx-auto mb-4 inline-flex items-center gap-2"><TrendingUp className="h-7 w-7 text-primary" /><span className="text-2xl font-serif font-bold">Prime<span className="text-primary">Pips</span></span></Link><CardTitle className="font-serif text-2xl">Choose a new password</CardTitle><CardDescription>Use at least six characters for your new password.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="password">New password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input id="password" type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" /></div></div><div className="space-y-2"><Label htmlFor="confirmation">Confirm password</Label><Input id="confirmation" type="password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div><Button type="submit" className="w-full" disabled={loading}>{loading ? "Updating..." : "Update password"}</Button></form></CardContent></Card></div>;
}