import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "PrimePips <notifications@primepips.com>";
const EMAIL_LOGO_URL = Deno.env.get("EMAIL_LOGO_URL");
const APP_URL = (Deno.env.get("APP_URL") || "https://primepips.com").replace(/\/$/, "");
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "support@primepips.com";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const text = (value: unknown, fallback = "Not available") => String(value ?? fallback);
const money = (value: unknown) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const titleCase = (value: unknown) => text(value, "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const url = (path: unknown) => /^https?:\/\//.test(text(path, "")) ? text(path) : `${APP_URL}/${text(path, "").replace(/^\//, "")}`;

const details = (items: Array<[string, unknown]>) => items.filter(([, value]) => value !== undefined && value !== null && value !== "")
  .map(([label, value]) => `<tr><td style="padding:9px 0;color:#66717b;font-size:14px;width:42%;">${escapeHtml(label)}</td><td style="padding:9px 0;color:#111820;font-size:14px;font-weight:bold;">${escapeHtml(value)}</td></tr>`).join("");

function content(eventType: string, metadata: Record<string, unknown>) {
  const accountId = text(metadata.account_id, "").slice(0, 8);
  const account = accountId ? `#${accountId}` : "your account";
  const common = { account_id: account, challenge_type: titleCase(metadata.challenge_type), account_size: metadata.account_size ? `$${Number(metadata.account_size).toLocaleString()}` : undefined };
  switch (eventType) {
    case "account_created": return { subject: "Welcome to PrimePips", heading: "Welcome to PrimePips", intro: "Your PrimePips account has been created successfully.", body: "Your workspace is ready. Explore your dashboard to complete your profile, choose an evaluation, and manage your trading journey.", cta: ["Open dashboard", url(metadata.dashboard_url || "/dashboard")], rows: [] };
    case "purchase_initiated": return { subject: "Your PrimePips payment is pending", heading: "Payment pending", intro: "We have started your PrimePips account purchase.", body: "Your payment has not been confirmed yet. We will email you again when the payment is completed.", cta: ["View dashboard", url("/dashboard")], rows: [...Object.entries(common), ["Amount", money(metadata.amount)], ["Payment reference", metadata.payment_reference]] };
    case "purchase_successful": return { subject: "PrimePips payment confirmed", heading: "Payment confirmed", intro: "Your PrimePips purchase was successful.", body: "Your account is being prepared. Sign in to review the rules and next steps before trading.", cta: ["View account", url("/dashboard")], rows: [...Object.entries(common), ["Amount", money(metadata.amount)], ["Payment reference", metadata.payment_reference]] };
    case "payment_failed_or_expired": return { subject: "PrimePips payment incomplete", heading: "Payment not completed", intro: "Your PrimePips payment was not completed before it expired or was declined.", body: "No account access was granted for this payment. You can safely start a new checkout from the secure link below.", cta: ["Retry payment", url(metadata.retry_url || "/purchase-account")], rows: [["Payment reference", metadata.payment_reference], ["Account", account]] };
    case "account_activated": return { subject: "Your PrimePips account is ready", heading: "Ready to trade", intro: "Your PrimePips account has been activated.", body: "Review your rules, plan your risk, and open the dashboard when you are ready to begin.", cta: ["Open trading dashboard", url(metadata.dashboard_url || "/dashboard")], rows: [...Object.entries(common)] };
    case "phase_passed": return { subject: "Congratulations on passing your PrimePips phase", heading: "Phase passed", intro: "Congratulations. You have completed a PrimePips trading phase.", body: "Your results have been recorded. Check your dashboard for the next phase and its objectives.", cta: ["Review next steps", url("/dashboard")], rows: [["Account", account], ["Completed phase", metadata.phase], ["Performance", money(metadata.performance)]] };
    case "account_breached": return { subject: "PrimePips account status update", heading: "Account status update", intro: "Your PrimePips account has been marked as failed after a rule breach was recorded.", body: "This decision is based on the risk rule shown below. Your account is no longer available for trading. Contact support if you believe the recorded information needs review.", cta: ["Contact support", `mailto:${SUPPORT_EMAIL}`], rows: [["Account", account], ["Breach type", titleCase(metadata.breach_type)], ["Relevant metric", metadata.metric ? `${metadata.metric}%` : undefined], ["Threshold", metadata.threshold ? `${metadata.threshold}%` : undefined], ["Recorded at", metadata.timestamp], ["Status", "Failed"]] };
    case "drawdown_warning": return { subject: "PrimePips drawdown warning", heading: "Risk limit approaching", intro: "Your account is approaching a drawdown limit.", body: "Please review your open risk and the applicable rule before taking another position. This is a warning, not an account closure.", cta: ["Review risk rules", url("/dashboard")], rows: [["Account", account], ["Current drawdown", metadata.current_drawdown ? `${metadata.current_drawdown}%` : undefined], ["Remaining allowance", metadata.remaining_allowance ? `${metadata.remaining_allowance}%` : "Review dashboard"], ["Relevant rule", metadata.rule]] };
    case "payout_submitted": return { subject: "PrimePips payout request received", heading: "Payout submitted", intro: "We have received your payout request.", body: "Our team will review the request and email you when its status changes.", cta: ["View payouts", url("/payouts")], rows: [["Amount", money(metadata.amount)], ["Method", titleCase(metadata.method)], ["Account", account], ["Submitted", metadata.submitted_at]] };
    case "payout_approved": case "payout_rejected": case "payout_paid": return { subject: `PrimePips payout ${text(eventType).replace("payout_", "")}`, heading: `Payout ${text(eventType).replace("payout_", "")}`, intro: `Your PrimePips payout request has been ${text(eventType).replace("payout_", "")}.`, body: eventType === "payout_rejected" ? "Review the request details in your dashboard or contact support for clarification before submitting another request." : "Review the payout details in your dashboard for the latest next steps.", cta: ["View payout details", url("/payouts")], rows: [["Amount", money(metadata.amount)], ["Method", titleCase(metadata.method)], ["Account", account], ["Status", titleCase(text(eventType).replace("payout_", ""))]] };
    case "kyc_submitted": return { subject: "PrimePips verification received", heading: "Verification submitted", intro: "We have received your identity verification documents.", body: "Our team will review them securely. You will receive an email when the review is complete. Please do not email identity documents to support.", cta: ["View verification status", url("/kyc")], rows: [["Submitted", metadata.submitted_at], ["Review time", "Usually within 1-2 business days"]] };
    case "kyc_approved": return { subject: "PrimePips verification approved", heading: "Verification approved", intro: "Your identity verification has been approved.", body: "Your account now meets the verification requirement. Continue from your dashboard when ready.", cta: ["Open dashboard", url("/dashboard")], rows: [] };
    case "kyc_rejected": return { subject: "PrimePips verification needs attention", heading: "Verification not approved", intro: "We could not approve your identity verification at this time.", body: `Reason: ${text(metadata.rejection_reason, "Please review the verification page for details.")} Resubmit clear, valid documents from inside your secure dashboard.`, cta: ["Resubmit verification", url("/kyc")], rows: [["Reason", metadata.rejection_reason]] };
    default: return { subject: "PrimePips account update", heading: "Account update", intro: "There is a new update on your PrimePips account.", body: "Sign in to your dashboard to review it.", cta: ["Open dashboard", url("/dashboard")], rows: [] };
  }
}

function render(eventType: string, metadata: Record<string, unknown>) {
  if (!EMAIL_LOGO_URL || !/^https:\/\//.test(EMAIL_LOGO_URL)) throw new Error("EMAIL_LOGO_URL must be a public HTTPS URL");
  const message = content(eventType, metadata);
  const rowHtml = details(message.rows as Array<[string, unknown]>);
  const plainRows = (message.rows as Array<[string, unknown]>).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => `${label}: ${text(value)}`).join("\n");
  const plain = `${message.heading}\n\n${message.intro}\n${message.body}\n\n${plainRows}\n\n${message.cta[0]}: ${message.cta[1]}\n\nPrimePips\n${SUPPORT_EMAIL}\nPrivacy: ${url("/privacy")} | Terms: ${url("/terms")}`;
  const html = `<!doctype html><html><body style="margin:0;background:#eef1f3;font-family:Arial,Helvetica,sans-serif;color:#111820;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f3;padding:24px 8px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;"><tr><td align="center" style="background:#111820;border-bottom:3px solid #d4af37;padding:28px 20px;"><img src="${escapeHtml(EMAIL_LOGO_URL)}" width="180" alt="PrimePips" style="display:block;width:180px;max-width:100%;height:auto;border:0;"></td></tr><tr><td style="padding:42px 38px 34px;"><h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#111820;">${escapeHtml(message.heading)}</h1><p style="margin:0 0 12px;font-size:17px;line-height:1.55;">${escapeHtml(message.intro)}</p><p style="margin:0 0 26px;color:#52606b;font-size:15px;line-height:1.65;">${escapeHtml(message.body)}</p>${rowHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e7ea;border-bottom:1px solid #e2e7ea;margin:0 0 28px;">${rowHtml}</table>` : ""}<a href="${escapeHtml(message.cta[1])}" style="display:inline-block;background:#d4af37;color:#111820;font-weight:bold;text-decoration:none;padding:14px 21px;font-size:15px;">${escapeHtml(message.cta[0])}</a></td></tr><tr><td style="background:#f6f7f8;padding:24px 38px;color:#66717b;font-size:12px;line-height:1.7;">PrimePips<br><a href="${url("/")}" style="color:#66717b;">Website</a> | <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#66717b;">Support</a> | <a href="${url("/privacy")}" style="color:#66717b;">Privacy Policy</a> | <a href="${url("/terms")}" style="color:#66717b;">Terms</a><br><br>This is a mandatory account communication. It cannot be disabled.</td></tr></table></td></tr></table></body></html>`;
  return { subject: message.subject, html, plain };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (authorization !== `Bearer ${SERVICE_ROLE_KEY}`) return json({ error: "Unauthorized" }, 401);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY is not configured" }, 500);
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: events, error } = await admin.rpc("claim_email_events", { p_limit: 25 });
    if (error) throw error;
    let sent = 0;
    for (const event of events || []) {
      try {
        const rendered = render(event.event_type, event.metadata || {});
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: EMAIL_FROM, to: [event.recipient], subject: rendered.subject, html: rendered.html, text: rendered.plain }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.message || `Resend returned ${response.status}`);
        await admin.rpc("record_email_event_result", { p_id: event.id, p_status: "sent", p_provider_message_id: result.id });
        sent++;
      } catch (eventError) {
        await admin.rpc("record_email_event_result", { p_id: event.id, p_status: "failed", p_error_message: eventError instanceof Error ? eventError.message : "Delivery failed" });
      }
    }
    return json({ claimed: events?.length || 0, sent });
  } catch (error) {
    console.error("send-transactional-email error:", error);
    return json({ error: "Unable to process email events" }, 500);
  }
});
