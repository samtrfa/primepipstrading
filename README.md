# PrimePips Platform

# 🚀 Full Forex Prop Firm Website — One‑Prompt Build for Lovable

Copy and paste this entire file into **Lovable** and it will generate a complete, fully functional, market‑ready site with payment integration, dashboard, backend, admin controls, and branding.

---

# 🏦 **PROJECT: Full Forex Prop Firm Platform (Market‑Ready)**

Use this prompt to create everything: branding, frontend, backend, database, APIs, user flows, dashboards, KYC uploads, MT5/MT4 integration endpoints, and payment processing.

---

# ✅ **BRANDING + TONE**

**Brand Name:** *PrimePips Funding* (Lovable may generate alternatives, but this is the default).

**Brand Style:**

* Luxury fintech style
* Black × Gold primary palette
* Clean, modern UI (similar to FTMO, MyForexFunds, Funding Pips)
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

Add the live secret manually in Supabase, not in the frontend or source code:

1. Open **Supabase Dashboard → Project Settings → Edge Functions → Secrets**.
2. Add `PAYSTACK_SECRET_KEY` with the Paystack live secret key (`sk_live_...`).
3. Deploy both functions after adding the secret.

The equivalent CLI commands are:

```bash
supabase secrets set PAYSTACK_SECRET_KEY='sk_live_your_key' --project-ref aqgflcdsaprvwlkeqdrq
supabase functions deploy korapay-checkout --project-ref aqgflcdsaprvwlkeqdrq
supabase functions deploy korapay-webhook --project-ref aqgflcdsaprvwlkeqdrq
```

Set this URL as the Paystack webhook URL:

`https://aqgflcdsaprvwlkeqdrq.supabase.co/functions/v1/korapay-webhook`

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

# 🎉 **END OF FILE — Build the full production-grade Forex Prop Firm Platform**

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
