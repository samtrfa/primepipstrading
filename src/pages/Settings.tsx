import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Plus, Save, Trash2, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [wallets, setWallets] = useState<Array<{ id: string; network: string; wallet_address: string; label: string | null }>>([]);
  const [network, setNetwork] = useState("USDT (TRC20)");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletLabel, setWalletLabel] = useState("");
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      setFullName(session.user.user_metadata?.full_name || "");
      setPhoneNumber(session.user.user_metadata?.phone_number || "");
      setEmail(session.user.email || "");
      const { data: paymentMethods, error } = await supabase
        .from("payment_methods")
        .select("id, network, wallet_address, label")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Unable to load payment methods", description: error.message, variant: "destructive" });
      } else {
        setWallets(paymentMethods || []);
      }
      const { data: preferences } = await supabase
        .from("email_preferences")
        .select("marketing_enabled")
        .maybeSingle();
      if (preferences) setMarketingEnabled(preferences.marketing_enabled);
      setIsLoading(false);
    };

    loadProfile();
  }, [navigate, toast]);

  const addWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAddingWallet(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAddingWallet(false); navigate("/login"); return; }

    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ user_id: user.id, method_type: "crypto", network, wallet_address: walletAddress.trim(), label: walletLabel.trim() || null })
      .select("id, network, wallet_address, label")
      .single();
    setIsAddingWallet(false);
    if (error) {
      toast({ title: "Unable to add wallet", description: error.code === "23505" ? "This wallet is already saved for this network." : error.message, variant: "destructive" });
      return;
    }
    setWallets((current) => [data, ...current]);
    setWalletAddress("");
    setWalletLabel("");
    toast({ title: "Wallet added", description: "This wallet is now available for crypto withdrawals." });
  };

  const removeWallet = async (id: string) => {
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) {
      toast({ title: "Unable to remove wallet", description: error.message, variant: "destructive" });
      return;
    }
    setWallets((current) => current.filter((wallet) => wallet.id !== id));
    toast({ title: "Wallet removed" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
      },
    });

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: preferencesError } = await supabase
        .from("email_preferences")
        .upsert({ user_id: user?.id, marketing_enabled: marketingEnabled }, { onConflict: "user_id" });
      if (preferencesError) {
        toast({ title: "Profile saved, email preference not updated", description: preferencesError.message, variant: "destructive" });
      }
    }

    setIsSaving(false);

    if (error) {
      toast({
        title: "Unable to save changes",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Settings saved",
      description: "Your profile details have been updated.",
    });
  };

  return (
    <DashboardLayout title="Settings" subtitle="Manage your personal account details">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" className="px-0 hover:bg-transparent" onClick={() => window.location.assign("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Button>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Personal information</CardTitle>
            <CardDescription>
              Keep your contact details up to date for account notifications and support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-6 text-sm text-muted-foreground">Loading your profile...</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter your full name"
                      className="pl-10"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Mobile number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      placeholder="+1 555 123 4567"
                      className="pl-10"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={email} className="pl-10" readOnly disabled />
                  </div>
                  <p className="text-xs text-muted-foreground">Contact support if you need to change your email address.</p>
                </div>

                <div className="flex justify-end border-t border-border pt-5">
                  <Button type="submit" variant="gold" disabled={isSaving}>
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Email preferences</CardTitle>
            <CardDescription>Mandatory account, payment, security, payout, KYC, and phase emails always remain enabled.</CardDescription>
          </CardHeader>
          <CardContent>
            <label htmlFor="marketingEmails" className="flex cursor-pointer items-start gap-3 text-sm">
              <input id="marketingEmails" type="checkbox" checked={marketingEnabled} onChange={(event) => setMarketingEnabled(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
              <span><span className="font-medium text-foreground">Receive occasional PrimePips updates and offers</span><span className="mt-1 block text-muted-foreground">This optional setting does not affect transactional account communications.</span></span>
            </label>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl"><Wallet className="h-5 w-5 text-primary" />Crypto payment methods</CardTitle>
            <CardDescription>Save the wallet addresses where your trading earnings and commissions should be sent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={addWallet} className="grid gap-4 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
              <div className="space-y-2"><Label htmlFor="walletNetwork">Network</Label><select id="walletNetwork" value={network} onChange={(event) => setNetwork(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option>USDT (TRC20)</option><option>USDT (ERC20)</option><option>USDC (ERC20)</option><option>Bitcoin</option><option>Ethereum</option><option>BNB Smart Chain</option><option>Solana</option></select></div>
              <div className="space-y-2"><Label htmlFor="walletLabel">Label <span className="text-muted-foreground">(optional)</span></Label><Input id="walletLabel" value={walletLabel} onChange={(event) => setWalletLabel(event.target.value)} placeholder="Main wallet" /></div>
              <div className="space-y-2"><Label htmlFor="walletAddress">Wallet address</Label><Input id="walletAddress" required minLength={20} maxLength={128} value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="Paste your crypto wallet address" /></div>
              <Button type="submit" variant="gold" disabled={isAddingWallet}><Plus className="h-4 w-4" />{isAddingWallet ? "Adding..." : "Add wallet"}</Button>
            </form>
            {wallets.length > 0 && <div className="space-y-3 border-t border-border pt-5">{wallets.map((wallet) => <div key={wallet.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 p-4"><div className="min-w-0"><p className="font-medium text-foreground">{wallet.label || wallet.network}</p><p className="truncate text-sm text-muted-foreground">{wallet.network} · {wallet.wallet_address}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => removeWallet(wallet.id)} aria-label={`Remove ${wallet.label || wallet.network} wallet`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}
            {wallets.length === 0 && <p className="text-sm text-muted-foreground">No crypto wallets saved yet.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}