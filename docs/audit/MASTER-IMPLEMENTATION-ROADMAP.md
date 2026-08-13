# Master implementation roadmap

The standing brief for this program. A session reads this plus `SESSION-STATE.md`, then continues with the next unfinished phase. It is not re-negotiated each session.

---

## Objective

A secure, accessible, professionally designed **local** implementation of the Areen CUBs Studio platform: six role-scoped dashboards, a client portal, client-scoped content and video review, projects/tasks, quotes and invoices with optional TVA, a financial reporting foundation, Content OS and publishing, an audit trail, a responsive accessible design system, a safe Google Drive architecture, and automated unit/database/RLS/browser/accessibility testing.

Local and fabricated data only.

---

## Non-negotiable restrictions

- Free and open-source only. No payment, trial, subscription or billing.
- No production Supabase connection, remote query, migration, repair, push, pull or dump.
- No production migration-history command without separate approval.
- No Vercel change, deployment or production data modification.
- Never read, print, copy or modify the Windows production `.env.local`.
- Never expose keys, JWTs, passwords or connection strings; never commit environment files, machine configuration or generated credentials.
- Synthetic `.invalid` users and fabricated business data only.
- No client communications, payments, refunds or payroll changes.
- Do not change contracts, service pricing or historical invoices.
- Do not create real worker/client/task/financial records, or import historical Areen/Roc/Cleaners/NormSafety data.
- Do not deploy the Content OS RLS migration.
- Keep the money engine approval-gated.
- Do not accept licences or contractual terms on the owner's behalf.
- Stop the local database when it is not actively required.

---

## Phase order

Execute in this order. Each phase is its own commit (or several, for materially different fixes).

1. **Contrast and semantic design tokens**
2. **Role schema and complete RLS matrix**
3. **Team hydration** (`/dashboard/team` React #418)
4. **Commercial dashboard**
5. **Intern dashboard**
6. **Client portal**
7. **Video review**
8. **Google Drive adapter architecture**
9. **Optional TVA**
10. **Reporting**
11. **Final design and QA**

---

## Phase detail

### 1. Contrast and semantic design tokens
Axe evidence is the source of truth. Approved palette — primary `#1064D4`, secondary `#3382D6`, supporting `#8FADCE`, light background `#E8EBEC`, dark background `#0A336F`. Meet WCAG AA: 4.5:1 normal text, 3:1 large text, 3:1 meaningful controls and boundaries. **Never** `#8FADCE` as body text on `#E8EBEC`; supporting colours stay accents where they cannot carry readable text. Prefer semantic token changes over route-specific patches. Preserve hierarchy and brand. Test light and dark. Fabricated-data screenshots at desktop/tablet/mobile. No broad axe exclusions.

**Typography:** keep Noto Sans Arabic via `next/font`; keep the current Latin font until a valid Clear Sans web licence exists; never embed Ping AR; support `lang="ar"` without introducing RTL business behaviour.

### 2. Role schema and complete RLS matrix
Roles: administrator, worker, freelancer, commercial, intern, client. Write the permission matrix **before** implementing.

- **Administrator** — full internal access, financial administration, user/permission management, audit visibility.
- **Commercial** — only clients they created or were assigned; may create clients and manage those clients' contact/commercial data; may create and edit *draft* quotes and invoices for them. Cannot delete records, mark invoices paid, issue refunds, change global pricing, alter historical financial records, or see unrelated clients, worker performance or agency finances.
- **Worker** — assigned projects/tasks and the client information those require; content needed for assigned work; no unrestricted financial access; no unrelated client data.
- **Freelancer** — assigned projects and tasks only; reduced client information; no agency financial or worker-performance data.
- **Intern** — simplified dashboard; assigned tasks and only the clients those require; less than a worker; no finance, contracts, worker performance, private notes or unrelated clients.
- **Client** — their own organisation only; their posts, deliverables and review media; may comment; no internal notes, costs, margins, worker data or other clients; no approval of payments, refunds or contractual changes.

**Data model:** fail closed when a profile or membership is missing; explicit membership/assignment relationships; never infer access from email domains; track who created and assigned each client; server-side authorization **and** RLS; never rely on hidden UI controls; index policy joins; audit trail for significant mutations.

**RLS tests** must cover every role against clients, projects, tasks, content plans, content items, quotes, invoices, comments, media/review records, internal notes and audit records — asserting **rows visible and rows affected**, not merely whether SQL throws. Forward-only migrations; never rewrite an applied migration.

### 3. Team hydration
Bounded production-build component bisection; three-minute cap per probe with milestone output and guaranteed cleanup. Run only the targeted desktop test while diagnosing. Replace the route body with a static marker to decide subtree vs shared shell. Inspect invalid table/list nesting, missing `<tbody>`, array mutation during render, sorting/`localeCompare`, generated IDs, browser storage, NotificationBell, conditional client-only rendering. Revert every diagnostic patch. **No `suppressHydrationWarning`.** Identify the exact server/client mismatch, apply the smallest root fix, verify all three viewports.

### 4. Commercial dashboard
Personal pipeline, clients created, assigned clients, draft quotes, draft invoices, follow-up status, commercial activity, upcoming actions. No global finance totals, unrelated clients, worker-performance data, final payment/refund actions or destructive actions. Responsive empty/loading/validation/error states.

### 5. Intern dashboard
Assigned tasks, deadlines, status, necessary project/client context, files required for assigned work, relevant comments and mentions. Excludes finance, contracts, internal client risks, worker reports, unassigned projects/clients and administrator tools.

### 6. Client portal
Client accounts and a client-scoped portal: own posts and content plans, deliverables, comments, review history, clear loading/empty/error states, mobile-responsive, accessible keyboard and screen-reader behaviour. Membership enforced by RLS. Never expose internal notes, costs, margins, worker metrics, or another client through URLs or IDs — **test direct-object-reference attacks**. No client approval of contractual or financial actions.

### 7. Video review
Internal upload/attachment, client-specific access, versions, time-coded comments, general comments, comment resolution, review status, audit history, file metadata, role-based permissions. Internal staff upload; clients view and comment. **No public unauthenticated file URLs.** Local: synthetic storage provider, file-type and size validation, unauthorized-access tests, never commit media.

### 8. Google Drive adapter architecture
Server-side storage-provider interface with a Drive adapter behind environment configuration. `GOOGLE_DRIVE_ROOT_FOLDER_ID` — never hard-code a personal folder ID. OAuth tokens server-side and encrypted, never in frontend code or browser storage. **Do not connect the real account.** Setup and permission runbook; separate approval before connecting; every client gets a separate scoped folder/mapping; clients can never browse the agency root.

### 9. Optional TVA
Explicit per-document toggle, configurable rate, changeable before finalisation, fiscal stamp separate. Preview, server validation, print output and stored totals share **one** calculation source. Integer millimes internally. Never recompute historical documents or silently change an issued one. Immutable calculation snapshot on final documents. Draft edits audit-logged. Commercial users edit only permitted drafts for their clients. Payment status derived consistently, discrepancies surfaced.

**Money compatibility:** keep the engine behind a disabled production feature gate until the one-centime divergence is approved; implement local shadow comparison recording divergences without sensitive document data; never connect to production persistence; historical totals untouched.

### 10. Reporting
Evidence-based Daily Agency Brief, Weekly Agency Management Report, project health, overdue/blocked work, worker workload, client follow-ups, financial alerts, website/dashboard issues, approval-required actions. Worker reports must weigh complexity, deadlines, dependencies, workload, quality evidence and delivery time — **never volume alone**. Client and finance reports must mark confirmed data, missing data, assumptions, estimates and incomplete records.

### 11. Final design and QA
Apply the design system across admin, worker, freelancer, commercial, intern, client portal, finance, Content OS, video review, authentication and error/unavailable-account pages. Verify navigation, tables, search, filters, sorting, pagination, forms, modals, notifications, loading, empty states, validation, mobile/tablet/desktop layout, overflow, typography, spacing, focus, contrast, keyboard navigation, screen-reader names and reduced motion. No unrelated visual experimentation.

---

## Testing

Maintain and expand unit, money, authentication, migration, RLS integration, Playwright, axe-core, role-matrix, direct-object-reference, responsive and preview-lifecycle tests.

**Browser matrix:** desktop 1280×720, tablet 768×1024, mobile 390×844. Server TZ **UTC**, browser TZ **Africa/Tunis**, locale **fr-FR** with English coverage where relevant.

**Gates:** install, typecheck, all unit tests, all database/RLS tests, required browser tests, axe with no unresolved critical/serious violations in tested core flows, production build, migration chain replays from zero, synthetic seed succeeds, secret scan, no production hostname in test traffic, stack stopped, zero containers and listeners, clean tree.

---

## Approval-gated — never execute

1. Production service-role key rotation
2. Vercel environment changes
3. Production redeployment
4. Production migration-history inspection
5. Production repair migration
6. Applying RLS migrations to production
7. Activating the money engine in production
8. Connecting the real Google Drive account
9. Embedding Clear Sans without licence evidence
10. Creating real users or client accounts
11. Importing real tasks, clients or financial records
12. Sending messages
13. Payments, refunds or payroll
14. Deleting or archiving records

Recorded once in `DECISIONS-NEEDED.md`; all other safe work continues.

---

## Definition of completion

Do not report the program complete unless every locally implementable phase is finished, all required tests pass, no critical browser or RLS failure is hidden or skipped, every unfinished item is genuinely approval-gated, production was never contacted, no secret was exposed, the branch is clean, a safe local preview command exists, and documentation explains how to verify every major feature.
