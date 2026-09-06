import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const token = authorization.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await anon.auth.getClaims(token);
    if (claimsError || claims?.claims?.app_metadata?.role !== "admin") return json({ error: "Forbidden" }, 403);
    const body = await req.json();
    if (typeof body.path !== "string" || !body.path || body.path.includes("..")) return json({ error: "Invalid document path" }, 400);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: application, error: applicationError } = await admin
      .from("kyc_verifications")
      .select("id")
      .or(`identity_document_path.eq.${body.path},address_document_path.eq.${body.path}`)
      .maybeSingle();
    if (applicationError) return json({ error: "Document is not registered to a KYC application" }, 404);
    if (!application) {
      const { data: archivedDocument, error: archiveError } = await admin
        .from("kyc_documents")
        .select("id")
        .eq("storage_path", body.path)
        .maybeSingle();
      if (archiveError || !archivedDocument) return json({ error: "Document is not registered to a KYC application" }, 404);
    }
    const { data, error } = await admin.storage.from("kyc-documents").createSignedUrl(body.path, 300);
    if (error || !data?.signedUrl) return json({ error: "Document preview unavailable" }, 404);
    return json({ signedUrl: data.signedUrl, expiresIn: 300 });
  } catch (error) {
    console.error("admin-kyc-document error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
