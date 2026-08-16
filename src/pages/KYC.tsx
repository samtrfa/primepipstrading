import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  User,
  MapPin,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

interface KYCStatus {
  stage: "not_started" | "identity" | "address" | "review" | "approved" | "rejected";
  completion: number;
  identity: {
    status: "pending" | "verified" | "rejected";
    document_type?: string;
    submitted_at?: string;
  };
  address: {
    status: "pending" | "verified" | "rejected";
    document_type?: string;
    submitted_at?: string;
  };
  review: {
    status: "pending" | "completed";
    reviewed_at?: string;
  };
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: {
    icon: Clock,
    color: "text-warning",
    label: "Pending",
  },
  verified: {
    icon: CheckCircle2,
    color: "text-success",
    label: "Verified",
  },
  rejected: {
    icon: AlertCircle,
    color: "text-destructive",
    label: "Rejected",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-success",
    label: "Completed",
  },
};

export default function KYCPage() {
  const navigate = useNavigate();
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // TODO: Fetch KYC verification status from backend when kyc_verification table is created\n      // For now, show not_started state with structure ready for integration\n      setKycStatus({\n        stage: \"not_started\",\n        completion: 0,\n        identity: {\n          status: \"pending\",\n        },\n        address: {\n          status: \"pending\",\n        },\n        review: {\n          status: \"pending\",\n        },\n      });\n      setLoading(false);
    };

    checkAuthAndFetchData();
  }, [navigate]);

  if (loading) {
    return (
      <DashboardLayout
        title="KYC Verification"
        subtitle="Complete your identity verification"
      >
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading KYC status...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!kycStatus) {
    return (
      <DashboardLayout
        title="KYC Verification"
        subtitle="Complete your identity verification"
      >
        <Card variant="elevated">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">Unable to load KYC status</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const getStageIcon = (status: string) => {
    const config = statusConfig[status];
    return config ? <config.icon className={`w-5 h-5 ${config.color}`} /> : null;
  };

  return (
    <DashboardLayout
      title="KYC Verification"
      subtitle="Complete your identity verification"
    >
      <div className="space-y-6">
        {/* Overall Progress */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Verification Progress</span>
              <Badge
                variant={
                  kycStatus.stage === "approved"
                    ? "default"
                    : kycStatus.stage === "rejected"
                      ? "destructive"
                      : "secondary"
                }
              >
                {kycStatus.stage.charAt(0).toUpperCase() + kycStatus.stage.slice(1)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  Completion Status
                </span>
                <span className="text-sm text-muted-foreground">
                  {kycStatus.completion}%
                </span>
              </div>
              <Progress value={kycStatus.completion} className="h-2" />
            </div>
            <p className="text-sm text-muted-foreground">
              Complete all verification steps to unlock full account features and payout capabilities.
            </p>
          </CardContent>
        </Card>

        {/* Verification Stages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stage 1: Identity */}
          <Card
            variant="elevated"
            className={
              kycStatus.identity.status === "verified"
                ? "border-success/50 bg-success/5"
                : kycStatus.identity.status === "rejected"
                  ? "border-destructive/50 bg-destructive/5"
                  : ""
            }
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                {getStageIcon(kycStatus.identity.status)}
                <span className="text-base">Identity Verification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Document Type</p>
                <p className="font-medium text-foreground">
                  {kycStatus.identity.document_type || "Not submitted"}
                </p>
              </div>
              {kycStatus.identity.submitted_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Submitted</p>
                  <p className="font-medium text-foreground">
                    {new Date(kycStatus.identity.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {kycStatus.identity.status === "pending" && (
                <Button variant="gold" size="sm" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              )}
              {kycStatus.identity.status === "rejected" && (
                <Button variant="outline" size="sm" className="w-full text-destructive">
                  Resubmit
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stage 2: Address */}
          <Card
            variant="elevated"
            className={
              kycStatus.address.status === "verified"
                ? "border-success/50 bg-success/5"
                : kycStatus.address.status === "rejected"
                  ? "border-destructive/50 bg-destructive/5"
                  : ""
            }
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                {getStageIcon(kycStatus.address.status)}
                <span className="text-base">Address Verification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Document Type</p>
                <p className="font-medium text-foreground">
                  {kycStatus.address.document_type || "Not submitted"}
                </p>
              </div>
              {kycStatus.address.submitted_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Submitted</p>
                  <p className="font-medium text-foreground">
                    {new Date(kycStatus.address.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {kycStatus.address.status === "pending" && (
                <Button variant="gold" size="sm" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              )}
              {kycStatus.address.status === "rejected" && (
                <Button variant="outline" size="sm" className="w-full text-destructive">
                  Resubmit
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stage 3: Review */}
          <Card
            variant="elevated"
            className={
              kycStatus.review.status === "completed"
                ? "border-success/50 bg-success/5"
                : ""
            }
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                {getStageIcon(kycStatus.review.status)}
                <span className="text-base">Final Review</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {kycStatus.review.status === "pending"
                  ? "Your documents are being reviewed. This usually takes 1-2 business days."
                  : "Your verification has been completed."}
              </p>
              {kycStatus.review.reviewed_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reviewed</p>
                  <p className="font-medium text-foreground">
                    {new Date(kycStatus.review.reviewed_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Requirements Info */}
        <Card variant="elevated" className="bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Verification Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Identity Document
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>• Valid passport, driver's license, or national ID</li>
                <li>• Must be clear and readable</li>
                <li>• Must not be expired</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address Proof
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>• Utility bill, bank statement, or rent agreement</li>
                <li>• Must be dated within last 3 months</li>
                <li>• Must clearly show your name and address</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
