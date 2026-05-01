# Client 360 Restore Report

## 1) Where Client 360 Lives

| What | Path |
|------|------|
| **Page entrypoint** | `src/app/clients/[id]/page.tsx` — server page that loads client + submissions and renders `<ClientInsightsClient />`. |
| **Main Client 360 UI** | `src/components/ClientInsightsClient.tsx` — tabs (Performance, Consultants, Job Orders, Renewals, Key Stakeholders, Signals, Opportunities, Risk, Briefing), Engagement Pulse, “Client 360 — {clientName}”, Prepare Briefing, drag-and-drop tab order. |
| **Related** | `src/app/clients/page.tsx` (untracked) — clients list; `src/components/ClientsPageClient.tsx` (untracked) — list UI. Agency nav “Clients” → `/clients` → list → click client → `/clients/[id]` (Client 360). |

---

## 2) Git State (Summary)

- **Branch:** `feature/candidate-review-lane` (ahead of origin by 1 commit).
- **HEAD:** `3c432a4` — “Refactor Client 360 layout with sticky engagement card”.
- **Modified (unstaged):**  
  `prisma/dev.db`, `prisma/schema.prisma`, `src/app/api/candidates/[id]/contact/route.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/requisitions/[id]/page.tsx`, `src/components/CandidateDetailSheet.tsx`, **`src/components/ClientInsightsClient.tsx`**, `src/components/KanbanLane.tsx`.
- **Untracked:** e.g. `src/app/client/`, `src/app/api/dev/`, `src/app/clients/page.tsx`, `src/components/ClientsPageClient.tsx`, `src/components/TopNav.tsx`, etc.
- **reflog:** No reset/checkout that dropped the Client 360 commit; HEAD has been at 3c432a4.

**Diff:** `ClientInsightsClient.tsx` in the working tree has **+612 / -128** lines vs HEAD (i.e. the **current file on disk is the larger, fuller** Client 360 with more tabs and sortable behavior; HEAD has the smaller, 1138-line version).

---

## 3) Role / Data Gating (Likely Cause of “Client 360 Gone”)

- **Client 360 is agency-only.**  
  In `src/app/clients/[id]/page.tsx` (lines 33–41): if `role === "CLIENT"` the page returns “Not authorized” and “Client Insights is only available to Agency users.” So **CLIENT users never see the Client 360 UI.**
- **No clientId-based routing** that would hide the page for agency; once role is AGENCY and a valid `clientId` is in the URL, the page loads and renders Client 360.
- **Conclusion:** If you are logged in as **client@demo.com** (CLIENT), you will never see Client 360. Use **agency@demo.com** (AGENCY), go to **Clients** in the nav, then open a client to reach `/clients/[id]` and the full Client 360 page.

---

## 4) Restore Options (If Code Was Actually Reverted)

- **Current repo state:** The working copy of `ClientInsightsClient.tsx` is the **expanded** version (~1670 lines, all tabs + DnD). The version in **HEAD** (3c432a4) is **shorter** (~1138 lines). So **do not** run a restore from HEAD if you want to keep the current, fuller Client 360.
- **If on your machine** `ClientInsightsClient.tsx` is the **short** version (e.g. ~1138 lines) and you want the **last committed** Client 360 (refactor with sticky engagement card), run:
  ```bash
  git checkout HEAD -- src/components/ClientInsightsClient.tsx
  ```
- **If the full Client 360 (with OPPORTUNITIES, PERFORMANCE, sortable tabs) was never committed** and you only have the short file, that version cannot be restored from git; you’d need it from backup or another clone.

---

## 5) Build Check

- `npm run build` was run in this environment and failed with `EPERM` (spawn) in the sandbox. Run locally to confirm:
  ```bash
  npm run build
  ```
  or
  ```bash
  npm run dev
  ```
  Then open **agency@demo.com** → **Clients** → click a client and confirm Client 360 and tabs/hover behavior.

---

## Summary

- **Root cause (most likely):** **Role gating** — Client 360 is only available to **AGENCY**. After using the dev bootstrap, logging in as **client@demo.com** shows the client portal and no “Clients” / Client 360; the page is not missing, it’s intentionally hidden for CLIENT.
- **No agency-side files were modified** in this report; no restore was performed so the current (larger) `ClientInsightsClient.tsx` was not overwritten.
- **Files that define Client 360:**  
  `src/app/clients/[id]/page.tsx`, `src/components/ClientInsightsClient.tsx`; supporting: `src/app/clients/page.tsx`, `src/components/ClientsPageClient.tsx` (untracked).
- **Action:** Log in as **agency@demo.com**, go to **Clients**, open a client. If you still don’t see the full Client 360, confirm whether your `ClientInsightsClient.tsx` is the long (~1670) or short (~1138) version and use the restore command above only if you want the committed (short) version.
