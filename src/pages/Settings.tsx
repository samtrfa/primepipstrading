import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Save, User } from "lucide-react";
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
      setIsLoading(false);
    };

    loadProfile();
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
      },
    });

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
      </div>
    </DashboardLayout>
  );
}