# Areen CUBs Studio — Agency Management App
**Strategy document v1 — 2026-05-06**

---

## 1. What we are building (in plain words)

A private web app for **Areen CUBs** that does four things:

1. **Manages every task** the agency works on — who's doing what, for which client, by when.
2. **Three different views** depending on who logs in:
   - **Admins** (CEO / CTO / CMO) — see everything, including money.
   - **Full-time workers** — see all tasks across all clients, can pick up / update tasks.
   - **Freelancers** — see **only** the tasks assigned specifically to them.
3. **Generates devis (quotes) in 60 seconds** — matching the exact format of your existing devis (EST 0034 / 0035 / 0036), auto-numbered, with the Areen CUBs header and Cachet & Signature block, exported as PDF.
4. **Tracks money** — what's been quoted, what's been signed, what's been paid, what's still outstanding. Per client, per month, per service.

Goal: replace the mix of WhatsApp + Google Drive + manual PDF editing with a single place that the whole team can use.

---

## 2. Why this matters (business case)

Reading your three latest devis (NormSafety 1 814,75 DT / WejdenSpire 1 713,60 DT / Healthcare Innovation 2 671,55 DT), three patterns jump out:

- **You repeat the same ~12 services** across clients (Identité de Marque, Pitch Deck, Bannière LinkedIn, QR codes, Stratégie marketing, etc.). Today each devis is hand-built. That's 30–60 minutes of work that should be 90 seconds.
- **You have no central view of "who owes us what."** With ~6 200 DT quoted just in the last 5 days, this becomes the difference between cashflow and chaos very quickly.
- **Freelancers and full-timers need different things.** Freelancers should see *their* job + brief + deadline + nothing else. Full-timers need the team picture. Today they probably both get the same WhatsApp group.

The app pays for itself by saving ~5h/week of admin per founder + reducing late payments.

---

## 3. Tech stack (recommended)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 + TypeScript** | One framework, fast, deploys to Vercel in one click |
| UI | **Tailwind CSS + shadcn/ui** | Looks clean by default, no design fights |
| Database + Auth | **Supabase** (Postgres + Auth + Storage + RLS) | Free tier covers you for years, role-based security built in |
| PDF generation | **@react-pdf/renderer** | Pixel-match the existing Areen CUBs devis layout |
| Email | **Resend** | Send devis to clients from `areencubs.com` |
| Hosting | **Vercel** (frontend) + **Supabase** (backend) | $0 to start, auto-deploys on git push |
| Repo | **GitHub** | Standard, free, with auto-deploy hooks |

**Total monthly cost at your size: 0 DT until you exceed ~50 000 monthly requests, then ~$25/month.**

Alternative considered: WordPress / Bubble / Notion — rejected because none can produce a PDF that matches your existing devis template *and* enforce role-based dashboards properly.

---

## 4. Data model (the core tables)

```
users           id, email, full_name, role(admin|worker|freelancer), avatar, hourly_rate
clients         id, name, address, matricule_fiscal, email, phone, source, created_at
projects        id, client_id, name, status, start_date, end_date, owner_id
tasks           id, project_id, title, description, assignee_id, status, priority,
                deadline, deliverable_url, freelancer_payout_dt
services        id, name_fr, name_en, default_price_dt, default_unit, category
devis           id, devis_number(EST-0037+), client_id, date, due_date,
                status(draft|sent|accepted|rejected),
                payment_status(unpaid|partial|paid), subtotal, tva, total, notes
devis_items     id, devis_id, service_id, description, qty, unit_price, line_total
payments        id, devis_id, amount, paid_at, method, notes
comments        id, task_id, user_id, body, created_at
files           id, task_id|devis_id, url, uploaded_by, created_at
```

**Pre-seeded service catalog** (from your existing devis):

| Service | Default price (DT) |
|---|---|
| Identité de Marque | 550 |
| Identité basée sur logo existant | 300 |
| Conception de Flyer | 100 |
| Conception de Flyer V2 | 50 |
| Carte de Visite | 50 |
| Bannière LinkedIn | 75 |
| Pitch Deck | 100 |
| Pitch Deck + Google Form | 120 |
| Publication LinkedIn / unité | 50 |
| Publication social media / unité | 50 |
| Carrousel / unité | 80 |
| Roll-up | 100 |
| Traçage de logo | 50 |
| QR code premium trackable (12 mois) | 50 |
| Stratégie marketing complète | 350 |
| Gestion réseaux sociaux (mensuel) | 100–180 |

---

## 5. Permissions matrix (the security spine)

|  | Admin | Worker | Freelancer |
|---|---|---|---|
| See all tasks | ✅ | ✅ | ❌ (only own) |
| Create / assign tasks | ✅ | ✅ (own clients) | ❌ |
| Update own tasks | ✅ | ✅ | ✅ |
| See clients list | ✅ | ✅ (no MF / no $) | ❌ (only client name on own task) |
| See devis & prices | ✅ | ❌ | ❌ |
| Generate devis | ✅ | ❌ | ❌ |
| See revenue / payments | ✅ | ❌ | ❌ |
| See own payout per task | ✅ | n/a | ✅ |
| Manage users | ✅ | ❌ | ❌ |
| Manage service catalog | ✅ | ❌ | ❌ |

Enforced server-side via **Supabase Row-Level Security (RLS)** — not just hidden in the UI. A freelancer hitting the API directly still gets 403.

---

## 6. The three dashboards

### 6.1 Admin dashboard (CEO / CTO / CMO)
- **Top KPI strip:** MTD revenue · Outstanding (unpaid) · Active projects · Active tasks · Avg devis value
- **Revenue chart** — paid vs invoiced, last 12 months
- **Devis pipeline (Kanban):** Draft → Sent → Accepted → Paid
- **Outstanding clients list** — sorted by days-overdue
- **Service profitability** — which services made the most DT this quarter
- **Team workload** — tasks per person, overdue flags
- **"+ Quick Devis"** button (always visible, top right)

### 6.2 Worker dashboard (full-time)
- **My week** — tasks due this week
- **All tasks board** — Kanban: Todo / In Progress / Review / Done, filterable by client / assignee
- **Clients page** — name, status, active projects (no money column)
- **My time** (optional Phase 5)

### 6.3 Freelancer dashboard
- **My tasks only** — Kanban
- For each task: brief, files, deadline, **agreed payout in DT**, payment status (pending/paid)
- Submit deliverable → admin reviews → marked done
- No access to other freelancers, other clients, or anything financial that isn't their own payout

---

## 7. The Quick Devis flow (the killer feature)

From admin dashboard, click **+ Quick Devis**:

1. Pick client (autocomplete) or **+ New client** (name, address, MF — 4 fields)
2. Add line items — start typing → autocomplete from service catalog → quantity → price (pre-filled, editable)
3. Live preview on the right showing the exact Areen CUBs PDF layout
4. Auto-fills:
   - Devis number (`#EST 000 0037`, increments)
   - Date (today)
   - Échéance (today + 14 days)
   - Subtotal / TVA 19% / Total TTC
5. Three buttons:
   - **Save as draft**
   - **Download PDF**
   - **Send by email** (to client, with PDF attached, "From: areencubs@gmail.com")

Time from click to sent devis: **under 90 seconds** for a returning client.

---

## 8. Build phases (what gets shipped when)

| Phase | Scope | Days | Outcome |
|---|---|---|---|
| **0 — Foundation** | Next.js + Supabase + Tailwind + Auth + Vercel deploy | 1–2 | Anyone can sign up & log in; roles seeded |
| **1 — Core MVP** | Clients + Projects + Tasks + 3 role-gated dashboards | 3–7 | Team can replace WhatsApp task tracking |
| **2 — Devis engine** | Service catalog + builder UI + PDF export matching template + email send | 8–12 | First real devis generated from the app |
| **3 — Money tracking** | Payment status + admin revenue dashboard + outstanding tracker | 13–15 | Admin knows cashflow at a glance |
| **4 — Polish** | Notifications, file uploads, comments, FR/EN toggle, mobile | 16–20 | Production-ready for real daily use |
| **5 — Optional** | Time tracking, calendar, client portal, Slack integration | later | Once core is rock-solid |

**Phase 1–3 = the minimum to replace what you do today.** Phase 4 makes it pleasant. Phase 5 is "nice to have."

---

## 9. Decisions — locked in (2026-05-06)

1. **Language**: ✅ FR / EN toggle. Devis always rendered in French.
2. **Login method**: ✅ Username + password (no email, no Google sign-in). Admin creates accounts; no public signup. Implementation: each user gets a synthetic email `username@areencubs.studio` behind the scenes so Supabase Auth works, but the user only ever types a username.
3. **Freelancer payouts**: ✅ Handled outside the app. No payout field on tasks. Freelancers only see task brief + deadline + status.
4. **Client portal**: ✅ Strictly internal-only. Clients never log in. (Removes Phase 5 client portal entirely.)
5. **Domain**: ✅ GitHub repo → Vercel auto-deploy. Will use the default Vercel URL initially; custom domain can be wired later if/when needed.
6. **Existing data**: ✅ Start clean. **All ~16 services from past devis are pre-seeded** in `supabase/seed.sql` with their prices (see §4). Past clients (NormSafety / WejdenSpire / Healthcare Innovation) are NOT imported — you re-add them as needed.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Team doesn't adopt it (still uses WhatsApp) | Phase 1 must be *faster* than WhatsApp for assigning a task. Test with 1 worker before rolling out. |
| Devis PDF doesn't match existing layout exactly | Use `@react-pdf/renderer` and base layout 1:1 on your EST 0036 PDF. Get visual sign-off before Phase 3. |
| RLS misconfigured → freelancer sees prices | Write automated tests that simulate each role hitting each endpoint. Block on green tests before launch. |
| Vendor lock-in (Supabase) | Postgres is portable. Worst case: export DB and migrate to self-hosted in a weekend. |
| Cost grows unexpectedly | Hard caps: stay on free Vercel/Supabase tiers until you have 50+ active users. Alert on usage. |

---

## 11. Project structure (when we start coding)

```
AreenCUBs-Studio/
├─ STRATEGY.md                ← this file
├─ README.md                  ← how to run locally
├─ .env.example               ← env vars (Supabase URL, keys, Resend key)
├─ package.json
├─ next.config.js
├─ src/
│  ├─ app/                    ← Next.js App Router
│  │  ├─ (auth)/login
│  │  ├─ (admin)/dashboard
│  │  ├─ (worker)/dashboard
│  │  ├─ (freelancer)/dashboard
│  │  ├─ devis/[id]
│  │  ├─ clients/[id]
│  │  └─ api/
│  ├─ components/
│  │  ├─ ui/                  ← shadcn primitives
│  │  ├─ devis/               ← DevisBuilder, DevisPDF
│  │  ├─ tasks/               ← TaskBoard, TaskCard
│  │  └─ dashboards/          ← AdminKPIs, WorkerBoard, FreelancerList
│  ├─ lib/
│  │  ├─ supabase/            ← client + server + RLS helpers
│  │  ├─ pdf/                 ← devis renderer
│  │  └─ permissions.ts       ← role guards
│  └─ types/
└─ supabase/
   ├─ migrations/             ← SQL schema
   └─ seed.sql                ← service catalog + roles
```

---

## 12. Next concrete step

Once you confirm the 6 decisions in section 9, **Phase 0 starts the same day**: I scaffold the Next.js + Supabase project in this folder, push it to a new GitHub repo, and deploy a "Hello world + login" version to Vercel. You should be able to log in within ~2 hours.

Then we move into Phase 1 (clients + tasks + dashboards) the next day.
