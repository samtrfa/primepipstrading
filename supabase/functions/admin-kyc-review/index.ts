import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const token = authorization.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await anon.auth.getClaims(token);
    if (claimsError || claims?.claims?.app_metadata?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    if (typeof body.kycId !== "string" || !body.kycId || !["approved", "rejected"].includes(body.status)) {
      return json({ error: "Invalid KYC review" }, 400);
    }
    if (body.status === "rejected" && (typeof body.rejectionReason !== "string" || !body.rejectionReason.trim())) {
      return json({ error: "A rejection reason is required" }, 400);
    }

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: application, error: applicationError } = await admin
      .from("kyc_verifications")
      .select("id, status, identity_document_path, address_document_path")
      .eq("id", body.kycId)
      .maybeSingle();
    if (applicationError || !application) return json({ error: "KYC application not found" }, 404);
    if (application.status !== "pending") return json({ error: "KYC application is not pending" }, 409);

    const { data: archivedDocuments, error: archiveError } = await admin
      .from("kyc_documents")
      .select("storage_path")
      .eq("kyc_id", body.kycId);
    if (archiveError) return json({ error: "Could not load stored KYC documents" }, 500);

    const paths = [...new Set([
      application.identity_document_path,
      application.address_document_path,
      ...(archivedDocuments ?? []).map((document) => document.storage_path),
    ].filter((path): path is string => Boolean(path)))];
    if (paths.length) {
      const { error: removalError } = await admin.storage.from("kyc-documents").remove(paths);
      if (removalError) {
        console.error("Could not remove KYC documents:", removalError.message);
        return json({ error: "Could not remove KYC documents; review was not completed" }, 500);
      }
    }

    const { data, error } = await anon.rpc("review_kyc", {
      p_kyc_id: body.kycId,
      p_status: body.status,
      p_rejection_reason: typeof body.rejectionReason === "string" ? body.rejectionReason.trim() || null : null,
    });
    if (error) {
      console.error("Could not record KYC review:", error.message);
      return json({ error: "Documents were removed, but the review could not be recorded" }, 409);
    }

    return json(data);
  } catch (error) {
    console.error("admin-kyc-review error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});