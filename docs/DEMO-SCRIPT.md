# Interactive modernization demo — end-to-end script

A single narrative that shows a legacy COBOL program becoming a modern,
observable cloud service **with evidence at every step**. Each stage is driven
from the tool a stakeholder already lives in (Jira, Slack, GitHub, Confluence)
and produces a concrete artifact.

**One-line arc:** Jira story → PR + CI parity (GitHub) → **DB parity proof** →
deploy → runtime health (Datadog/Sentry) → Confluence roll-up.

---

## Cast / setup (once, before the demo)

- **Repo:** `jpm2756/cognition-demo` — the **"before" state**: forked legacy COBOL
  (`CBACT01C`) + the database-parity harness, **no modern port yet** (so CI is red
  and the demo turns it green).
- **Playbook:** `!modernize_parity` (Fleet mode + Jira/Slack/Confluence delivery).
- **Integrations connected:** GitHub (native), Jira, Slack (`#general`,
  `C0BGV742NDN`), Confluence (space `CognitionD`), and the **Supabase MCP** the
  DB-parity SQL runs against live.
- **Portfolio page:** the sample "Modernization Portfolio" already published in
  Confluence — open it in a tab as the "map".

---

## Scene 1 — Kickoff from Jira (business context)

**Presenter:** in project **KAN**, open the ticket *"Modernize CBACT01C"* and
**assign it to Devin** (put "use `!modernize_parity`, repo
`jpm2756/cognition-demo`" in the description).

**What the audience sees:** assigning the ticket kicks off a Devin session
automatically (native Jira integration). The ticket is the single source of
business intent — no context switch for the PM.

> Talking point: "The work starts where the business already tracks it."

## Scene 2 — Devin delivers a PR (the modernization factory)

Devin runs the playbook: extracts the business spec, compiles the *unmodified*
COBOL under GnuCOBOL to a **golden baseline**, and writes the modern TypeScript
service (`modern/src/cbact01c.ts`) that makes the waiting **parity harness** pass.
It opens a PR, comments the PR link + parity result back on the Jira ticket, and
posts a "PR ready" note to Slack `#general`.

**Artifacts:** a GitHub PR, a green/threaded Jira comment, a Slack message.

> Talking point: "Not a code dump — a PR with a test that certifies identical
> behavior."

## Scene 3 — CI goes red → green (GitHub, native)

Before the PR, CI on `main` is **red** — the parity gate has no modern service to
satisfy it. Open the PR's **Actions** run: GnuCOBOL builds the baseline, the new
modern service runs, and the database-parity check passes — the gate flips green.

> Talking point: "Every push re-derives the mainframe truth and re-checks it —
> parity is a gate, not a claim. Watch it go from red to green."

## Scene 4 — Prove it as an auditor would (DB parity) ⭐

Run the **database-parity harness** (`npm run test:db`, also a CI step). It loads
the legacy baseline and the modern output into two Postgres tables and runs:

- a `FULL OUTER JOIN` diff → **0 mismatched rows across all accounts**;
- `SUM(curr_bal)` per table → **balances reconcile to the cent** (e.g. `12269.00`).

With the **Supabase MCP** connected, do this *live* from chat: ask Devin in Slack
to "show the parity diff and the balance reconciliation," and it runs the SQL
against Supabase and posts the result.

> Talking point: "0 mismatched rows, and the ledger ties to the penny. That's the
> language your auditors and mainframe team speak."

## Scene 5 — Deploy + runtime health (Datadog / Sentry)

Deploy the modern service, then (via the Datadog/Grafana MCP) pull **live p95
latency and throughput** the green-screen batch never exposed. Feed one malformed
record and (via the Sentry MCP) show the **captured exception + stack trace +
offending input** — modern error handling replacing an abend/dump. Compare error
rate before/after to prove the cutover didn't regress.

> Talking point: "Modernization isn't just new code — it's observability the
> mainframe couldn't give you."

## Scene 6 — Roll-up to Confluence (the map, updated)

The playbook refreshes the **Confluence "Modernization Portfolio"** page:
`CBACT01C` now green, the rest pending — each row linking its PR and Jira ticket.
The page is the human-facing stakeholder view over the fleet's parity status.

> Talking point: "A living migration dashboard non-technical stakeholders can read."

## Scene 7 (optional) — Drive it from Slack / fan out

- In `#general`: `@Devin modernize the next program in
  jpm2756/cognition-demo` or `@Devin review <PR link>` — proving
  hands-on control from chat (Slack monitor automation).
- Or trigger a **fleet sweep**: map the repo and fan out one PR per remaining
  program, posting a roll-up to Slack.

---

## Evidence checklist (what the prospect walks away having seen)

| Step | Tool | Evidence |
|---|---|---|
| Intent | Jira | Ticket → auto-started session |
| Delivery | GitHub | PR with mapping + parity test |
| Parity gate | GitHub Actions | red → green as the modern service lands |
| Data parity | Postgres (Supabase) | 0 mismatched rows + `SUM(curr_bal)` reconciles |
| Runtime health | Datadog/Sentry | p95 latency, throughput, captured exception |
| Portfolio | Confluence | Live per-program status, PR + ticket links |

## Integrations status for the full script

- **Connected today:** GitHub, Jira, Slack, Confluence, Supabase (Postgres MCP).
- **Scene 4 (live):** the **Supabase MCP** runs the parity SQL live; the harness +
  CI already prove it without any MCP.
- **Add for Scene 5:** **Datadog** and/or **Sentry** MCP (requires a deployed
  service to have telemetry to show).
