# Business rules — weekly rewards settlement

These restate the assessment rules from the quest brief in the form I would want
them written before testing anything: each one numbered, each one with its
ambiguity resolved explicitly, and each one mapped to the test that holds it.

They describe a **fictional** rewards service defined by the assessment, not any
live MUST Company product.

---

## R1 — Settlement schedule

The settlement job runs **every Tuesday at 09:00 UTC**.

*Resolved ambiguity:* 09:00 UTC, not 09:00 in any local zone. A run that fires
at a different time must still settle the same period — the period is derived
from the calendar, not from when the job happened to start. A job that is two
hours late settles the same week.

Held by **TC-21**.

## R2 — The settled period

The period is **`[Monday 00:00:00.000 UTC, the following Monday 00:00:00.000 UTC)`**
— lower bound **inclusive**, upper bound **excluded**.

The period settled by a Tuesday run is the week that closed at the **most recent
Monday 00:00 UTC**, roughly 33 hours before the run fires.

Worked example for the run at `2026-11-03T09:00:00Z` (a Tuesday):

| | instant |
|---|---|
| period start (inclusive) | `2026-10-26T00:00:00.000Z` (Monday) |
| period end (excluded) | `2026-11-02T00:00:00.000Z` (Monday) |
| run fires | `2026-11-03T09:00:00.000Z` (Tuesday) |

*Resolved ambiguities:*

- A task completed **Sunday 2026-11-01 at 23:59:59 UTC is inside** this period
  and is paid by the Tuesday 2026-11-03 run. This is the case the role
  description raises.
- A task completed at **exactly `2026-11-02T00:00:00.000Z` is outside** this
  period. It belongs to the next one and is paid a week later. The boundary
  instant belongs to the later period, never to both.
- Boundaries are UTC instants. The user's local time, the server's local time
  and the operations team's local time are all irrelevant to which period a task
  falls in. A task completed at `2026-11-01T16:30:00Z` is in this period even
  though that is already Monday 01:30 in Asia/Seoul.

Held by **TC-03, TC-04, TC-05, TC-06, TC-07, TC-08**.

## R3 — Credit value

Each qualifying completed task earns **10 test credits**.

*Resolved ambiguity:* the value is an admin-console setting, not a constant in
code. A change to it applies to runs executed after the change; it does not
retroactively restate settled periods.

Held by **TC-01, TC-14**.

## R4 — Exactly once

A task ID is counted **at most once, ever**. Three distinct mechanisms are needed
and all are rules, not implementation details:

- **R4a** — duplicate task IDs within one run are collapsed to one.
- **R4b** — re-running a settlement for a period that is already settled for a
  user adds nothing. Idempotency is keyed on `(periodId, userId)`.
- **R4c** — a task ID that any earlier ledger entry covers is refused, whatever
  its period. R4b cannot do this: a different period is a different key.

*Resolved ambiguity:* a retry is not a failure. Re-running a completed
settlement must be a safe, boring, no-op operation that anyone on call can do
without checking with engineering first.

Held by **TC-09, TC-10, TC-11, TC-15, TC-20**.

## R5 — Notification ordering

A settlement notification is sent **only after** a payout has been committed.

*Resolved ambiguity:* "committed" means the ledger write returned successfully.
A user who was not paid — held, failed or skipped — receives no alert. An alert
is never sent optimistically ahead of the money.

Held by **TC-01, TC-11, TC-13**.

## R6 — Notification failure is not a payout failure

A notification failure **must never reverse, block or retry** a committed payout.
The failure is recorded for independent redelivery.

*Resolved ambiguity:* the run as a whole is still `SUCCESS` when a payout
committed and only its alert failed. Undelivered alerts are an operations task,
not a settlement rollback.

Held by **TC-12**.

## R7 — Account state (assumption, not given in the brief)

The brief does not state what happens when an account is not in good standing,
so I have made this assumption explicit rather than leaving it implied:

> A payout is committed only for an account in `ACTIVE` state at the moment the
> run evaluates it. A non-active account is **held**, not dropped: the credits
> are not forfeited and no alert is sent. Once the account is active again, the
> tasks settle on a re-run of that period or on a reconciliation run (R9).
> The next weekly run does **not** pick them up, because its window has moved on.

This is the conservative reading — it never pays an account that should not be
paid, and never silently destroys a user's earnings. If the real rule is
"forfeit on suspension", TC-13 and TC-19 are the tests that need to change.

Held by **TC-13, TC-19**.

## R8 — Admin configuration (assumption)

Credits per task and whether notifications are enabled are admin-console
settings. Disabling notifications suppresses alerts but does **not** suppress
payouts — money and messaging are independently controlled.

Held by **TC-14, TC-16**.

## R9 — Reconciliation (assumption)

A weekly run looks at one period, so a task it misses is not retried by the next
one. The brief does not say what happens to such a task. My assumption, in the
spirit of "each qualifying task earns 10 credits":

> An eligible task from a closed period that no ledger entry covers is still
> owed. A reconciliation run pays it, once, under its own period ID
> (`RECON-<date>`), with the task-ID guard forced on. Account holds, ledger
> commit and notification ordering work exactly as in a weekly run.

*Resolved ambiguities:*

- Reconciliation pays at the credit value in force when it runs, not the value
  at the time of the task. If the real rule differs, this is the line to change.
- It runs after the weekly run for that week, and is safe to repeat.
- A user reconciled once this week is skipped by a second reconciliation in the
  same week. A task that arrived in between waits for next week's.

`findUnpaidTasks` is the read-only form of the same query. It is what an operator
reviews before paying, and it is what a run reporting `SUCCESS` cannot tell you.

Held by **TC-18, TC-19**.
