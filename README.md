## Admin dashboard

The private admin dashboard is available at `/admin`. Access requires the signed-in Supabase user to have `role: "admin"` in Auth `app_metadata`; this value must be assigned from the Supabase dashboard or another trusted server-side process. Do not place the service-role key in frontend environment variables. The `admin-snapshot` Edge Function verifies the role before using its service-role connection to join Auth users with platform activity.

Deploy the function and migration from a machine authenticated with Supabase CLI:

```bash
npx supabase login
npx supabase functions deploy admin-snapshot --project-ref wnbynyymqhkestmkcenj
npx supabase db push --project-ref wnbynyymqhkestmkcenj
```
# PrimePips Platform

## Transactional email setup

The platform queues mandatory account emails in `public.email_events`. Database triggers cover signup welcome messages, payment/account activation, phase results, rule breaches, drawdown warnings, payouts, and KYC status changes. The `send-transactional-email` Edge Function delivers them through Resend with retries and idempotency.

Configure the provider once in Supabase:

```bash
npx supabase secrets set RESEND_API_KEY='re_xxx' EMAIL_FROM='PrimePips <notifications@your-domain.com>' EMAIL_LOGO_URL='https://your-domain.com/primepips-email-logo.svg' APP_URL='https://your-domain.com' SUPPORT_EMAIL='support@your-domain.com' --project-ref wnbynyymqhkestmkcenj
npx supabase functions deploy send-transactional-email --project-ref wnbynyymqhkestmkcenj
```

`EMAIL_LOGO_URL` must be a public HTTPS image. It defaults to `${APP_URL}/primepips-email-logo.svg`, using the repository asset at `public/primepips-email-logo.svg`, so deploy that asset at the same domain as `APP_URL` or set `EMAIL_LOGO_URL` to its public HTTPS location. The sender domain must be verified in Resend. The scheduled worker migration uses Vault secrets named `supabase_url` and `supabase_service_role_key`; create those in Supabase Vault before applying the migration. Never put either value in `VITE_*` variables.

Supabase Auth uses the branded templates in `supabase/templates/`. Login uses a magic link, signup verification uses a six-digit code, and password recovery uses a secure reset link. Enable **Confirm email**, configure Auth SMTP with the verified Resend domain, and apply the Auth configuration from a machine authenticated with Supabase CLI:

```bash
npx supabase config push --project-ref wnbynyymqhkestmkcenj
```

If the hosted project still shows the default Supabase email, paste the matching file contents into Dashboard → Authentication → Email Templates, or run the config push again. The logo URL resolves to `{{ .SiteURL }}/primepips-email-logo.svg`, so the SVG must be publicly available at that path.

On Supabase free-tier projects using the default email provider, template updates are blocked. Configure custom SMTP first in Dashboard → Project Settings → Authentication → SMTP Settings, using the verified Resend domain:

```text
SMTP host: smtp.resend.com
SMTP port: 465
SMTP user: resend
SMTP password: your Resend API key
Sender email: notifications@your-domain.com
Sender name: PrimePips Funding
```

Keep the Resend API key in the Supabase dashboard only. After custom SMTP is enabled, run `npx supabase config push --project-ref wnbynyymqhkestmkcenj --yes` again. If custom SMTP is unavailable on the current project plan, upgrade the project or paste the templates into the dashboard after enabling a supported SMTP provider.

The signup template uses `{{ .Token }}` rather than `{{ .ConfirmationURL }}`:

```html
<h2>Your PrimePips verification code</h2>
<p>Enter this code in the PrimePips app:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>This code expires soon. If you did not request it, you can ignore this email.</p>
```

The app supports signup verification at `/verify-email`, magic-link login at `/login`, and recovery at `/reset-password`. Add these URLs to Auth redirect URLs: `https://your-domain.com/auth/callback`, `https://your-domain.com/reset-password`, and the local development equivalents.

After deploying, test the queue by creating a signup and checking `email_events` for `pending`, then inspect the Edge Function logs and Resend delivery logs.

The branded Auth templates and transactional email worker are intentionally reserved in this repository while the app uses password login. When the Supabase Pro plan or custom SMTP is available, say `integrate the emailing system`, configure SMTP, push `supabase/config.toml`, and deploy the email worker.

# 🚀 Full Trading Prop Firm Website — One‑Prompt Build for Lovable

Copy and paste this entire file into **Lovable** and it will generate a complete, fully functional, market‑ready site with payment integration, dashboard, backend, admin controls, and branding.

---

# 🏦 **PROJECT: Full Trading Prop Firm Platform (Market‑Ready)**

Use this prompt to create everything: branding, frontend, backend, database, APIs, user flows, dashboards, KYC uploads, MT5/MT4 integration endpoints, and payment processing.

---

# ✅ **BRANDING + TONE**

**Brand Name:** *PrimePips Funding* (Lovable may generate alternatives, but this is the default).

**Brand Style:**

* Luxury fintech style
* Black × Gold primary palette
* Clean, modern UI (similar to leading trading evaluation platforms)
* Minimal heavy gradients, bold headers, glass‑morphism on cards

**Logo Direction:**
A gold upward‑moving candlestick + shield combination.

---

# 🧩 **SITE STRUCTURE**

Lovable should generate all pages fully functional.

### **1. Landing Page**

* Hero section with animated trading chart background
* CTA: **"Start Your Evaluation"** and **"Join as a Trader"**
* Key selling points (instant payouts, low spreads, global traders)
* Trust badges + payout proof placeholders
* Pricing plans with buttons that lead to checkout
* Explainer of the 2-phase or 1-phase evaluation process
* Comparison chart
* Testimonials slider
* FAQ section

### **2. Trader Dashboard (After Login)**

* Overview of evaluation account and funded account status
* Daily drawdown, overall drawdown, profit target, equity
* Connect to MT4/MT5 metrics via backend endpoints (backend only — no broker API keys required yet)
* Payout request button and page
* KYC upload page
* Trading rules page
* Referral link + referral earnings

### **3. Admin Dashboard**

* Manage users
* Update trading account metrics manually
* Approve/reject KYC
* Approve payout requests
* Create new challenges
* View payment logs

### **4. Auth Pages**

* Login
* Register
* Forgot Password
* Email verification

### **5. Payments & Checkout**

Support these processors:

* **Paystack** (primary — for Nigeria/global)
* **Stripe** (alternative for international)

Checkout should:

* Create user challenge purchase
* Redirect to dashboard after payment success

---

# 🛠️ **FUNCTIONAL REQUIREMENTS**

Lovable should generate **both frontend and backend**.

### **Frontend Requirements**

Framework: **Next.js 14 (App Router)**
UI: **TailwindCSS + Framer Motion**
State: **Zustand or Redux Toolkit**

Pages to generate:

* `/` (Landing)
* `/pricing`
* `/login`
* `/register`
* `/dashboard`
* `/dashboard/kyc`
* `/dashboard/payouts`
* `/dashboard/referrals`
* `/admin`
* `/admin/users`
* `/admin/kyc`
* `/admin/payouts`
* `/admin/challenges`

### **Backend Requirements**

Backend: **Node.js + Express or Next.js API routes**
Database: **PostgreSQL or MySQL** (Lovable decides based on template)
ORM: **Prisma**

API Endpoints:

* `/api/auth/*`
* `/api/payments/paystack/init`
* `/api/payments/paystack/verify`
* `/api/trader/metrics/update`
* `/api/trader/get-account`
* `/api/kyc/upload`
* `/api/admin/update-metrics`
* `/api/admin/approve-kyc`
* `/api/admin/approve-payout`

### **Database Models (Prisma)**

* **User** (email, password, role, verified)
* **Challenge** (type, price, rules)
* **UserChallenge** (status, profitTarget, lossLimit, currentEquity, phase)
* **KYC** (userId, status, files)
* **Payout** (userId, amount, status)
* **PaymentLog**
* **Referral** (userId, referredUsers, earnings)

---

# 💳 **PAYMENT INTEGRATION (PAYSTACK + STRIPE)**

Lovable should implement:

### **Paystack**

* Payment initialization endpoint
* Callback/verification endpoint
* Webhook handler for payment confirmation

### **Stripe**

* Checkout session creation
* Webhook verification

System should:

* Create challenge purchase record
* Unlock dashboard on successful payment

### **Current Supabase Paystack setup**

The active card/bank flow uses Paystack through the Supabase Edge Functions in
`supabase/functions/korapay-checkout` and `supabase/functions/korapay-webhook`.
The folder names are retained for deployment compatibility; the provider code
and database value are Paystack.

Add the Paystack secret manually in Supabase, not in the frontend or source code.
Use `sk_test_...` while testing and replace it with `sk_live_...` only when you
are ready for production:

1. Open **Supabase Dashboard → Project Settings → Edge Functions → Secrets**.
2. Add `PAYSTACK_SECRET_KEY` with the appropriate Paystack test or live secret key.
3. Deploy all three payment functions after adding or changing the secret.

The equivalent CLI commands are:

```bash
npx supabase secrets set PAYSTACK_SECRET_KEY='sk_test_your_key' --project-ref wnbynyymqhkestmkcenj
npx supabase functions deploy korapay-checkout --project-ref wnbynyymqhkestmkcenj
npx supabase functions deploy korapay-webhook --project-ref wnbynyymqhkestmkcenj
npx supabase functions deploy verify-paystack-payment --project-ref wnbynyymqhkestmkcenj
```

Set this URL as the Paystack webhook URL:

`https://wnbynyymqhkestmkcenj.supabase.co/functions/v1/korapay-webhook`

---

# 📈 **TRADER ACCOUNT METRICS (SIMULATION)**

Include API endpoints to **manually update trading metrics** until MT5 broker integration is added.

Metrics include:

* Profit target
* Current profit
* Daily drawdown
* Overall drawdown
* Equity

Front-end dashboard must display all metrics in real time.

---

# 📤 **KYC System**

* File upload (ID front/back, selfie)
* Admin approval page
* Status display for users

---

# 💸 **Payout System**

* User requests payout
* Admin approves
* Status updates (pending → approved → paid)

---

# 👥 **Referral System**

* Referral links
* Referral earnings tracking
* Commission logs

---

# 🔥 **EXTRA FEATURES (Lovable should include)**

* Email verification flow
* Mobile responsive design
* Dark mode
* SEO optimised landing page
* Animated hero section
* Test data for admin preview

---

# 🧪 **TEST USERS TO GENERATE AUTOMATICALLY**

* Admin account ([admin@example.com](mailto:admin@example.com) / password123)
* Example trader account ([user@example.com](mailto:user@example.com) / password123)

---

# 📜 **FINAL INSTRUCTIONS FOR LOVABLE**

You should now:

1. Generate the **entire functional site** with all pages.
2. Implement fully working **payments**, **KYC**, **payouts**, **referrals**, **challenges**, and **dashboards**.
3. Provide a **one‑click deploy** option (Vercel preferred).
4. Generate environment variables template.
5. Provide Postgres schema migrations.
6. Auto-create admin test user.
7. Package everything into a clean directory structure.

---

# 🎉 **END OF FILE — Build the full production-grade Trading Prop Firm Platform**

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://primepipstrading.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/213c226d-7a46-41d5-855b-827208589ae5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Transactional email

Transactional email is an outbox-driven Supabase Edge Function workflow. Database triggers create one idempotent `email_events` row for each mandatory account, payment, security, phase, payout, and KYC event. `send-transactional-email` claims pending rows, sends both HTML and plain text through Resend, and records the provider message ID or a retryable failure. Marketing email preference is separate in `email_preferences`; mandatory emails cannot be disabled.

Configure these Supabase Edge Function secrets (never add them to `VITE_*` frontend variables):

```sh
npx supabase secrets set RESEND_API_KEY='re_...' EMAIL_FROM='PrimePips <notifications@example.com>' EMAIL_LOGO_URL='https://app.example.com/primepips-logo.svg' APP_URL='https://app.example.com' SUPPORT_EMAIL='support@example.com' --project-ref wnbynyymqhkestmkcenj
```

`EMAIL_LOGO_URL` must be a public HTTPS URL to `public/primepips-email-logo.svg` (or an equivalent high-resolution PNG), for example `https://app.example.com/primepips-email-logo.svg`. The sender always renders it in the charcoal header, never as a standalone light-background image. Deploy the migration and function with:

```sh
npx supabase db push --project-ref wnbynyymqhkestmkcenj
npx supabase functions deploy send-transactional-email --project-ref wnbynyymqhkestmkcenj
```

Run the sender from a trusted scheduler every minute by POSTing to its function URL with the service-role key as the bearer token. Do not expose that key to the browser. For safe testing, use a Resend test domain/API key and a test recipient, inspect `email_events` for `sent`/`failed` status, then switch `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_LOGO_URL`, and `APP_URL` to production values after DNS verification. Local SQL lint requires `supabase start`; this repository does not include a test-email command or provider credentials.
