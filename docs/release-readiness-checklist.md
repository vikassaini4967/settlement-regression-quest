# Release-readiness checklist — settlement, payout and notification flows

Scope: any change that touches period calculation, payout amounts, the ledger,
idempotency, or settlement notifications.

**The line I hold:** a gate that fails blocks the release. Not "note it and
ship" — blocks it. Small boundary problems are exactly what gets waved through
as acceptable risk. If a gate is genuinely wrong for a given change, the gate
gets amended and re-reviewed; it does not get waived in the moment by whoever is
shipping.

Boxes show the state of this submission: ticked means verified on the fixture,
open means not met or not possible here. The decision record at the end says what
each open box means for a real release.

---

## Gate 1 — Business rules are written down before the code is reviewed

- [x] Every rule the change touches exists in [`business-rules.md`](business-rules.md) with its ambiguity resolved, not just in a ticket
- [x] Each boundary is stated as an instant with an explicit timezone and explicit inclusivity (`[a, b)`), never as "Monday midnight"
- [x] Any assumption the brief did not cover is written as an assumption with the test that holds it named

**Blocks on:** a rule that cannot be stated unambiguously. If two engineers read
the window differently, the release waits.

## Gate 2 — Boundary test set passes

- [x] TC-03, TC-04 — both bounds, exact-instant cases
- [x] TC-05, TC-06 — the last hours before the period closes, including a timestamp that falls on the next calendar day in the team's local zone
- [x] TC-07 — the same task across two consecutive runs pays exactly once
- [x] TC-08 — the previous period does not bleed into this one

**Blocks on:** any failure. This gate alone stops SETL-001 reaching production.

## Gate 3 — Exactly-once is proven, not asserted

- [x] TC-09 — duplicate task IDs in source data
- [x] TC-10 — identical run executed twice changes nothing
- [x] TC-11 — partial failure resumes without re-paying the already-paid users
- [x] TC-15, TC-20 — a task covered by an earlier ledger entry is refused, on by default
- [ ] The idempotency guarantee is enforced by a database constraint, not only by application code

**Blocks on:** any failure, or an idempotency key that is derived from the run
attempt rather than from `(periodId, userId)`.

## Gate 4 — Timezone independence

- [x] The suite passes under `TZ=UTC`, `TZ=Asia/Seoul` and `TZ=America/New_York` (a DST zone) — captured run in [`results/tests-fixed-tz-matrix.txt`](../results/tests-fixed-tz-matrix.txt), enforced on Node 20 and 22 by [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- [x] The matrix is shown to catch a real regression: `IMPL=localtime` passes under UTC and fails under the other two — [`results/tests-localtime-tz-matrix.txt`](../results/tests-localtime-tz-matrix.txt)
- [x] No local-time date construction (`new Date(y, m, d)`, `getFullYear`, `getMonth`, `getDate`, `getDay`) in the corrected window — `Date.UTC` and `getUTC*` only
- [ ] Enforced by a lint rule rather than by review attention

**Blocks on:** a suite whose result depends on the runner's timezone. That is
the defect, not a flaky test.

## Gate 5 — Money and messaging are independently safe

- [x] TC-12 — a notification failure leaves the payout committed and the run `SUCCESS`
- [x] TC-11 — a user who was not paid receives no alert
- [x] TC-16 — disabling notifications suppresses alerts without suppressing payouts
- [x] The notification send is outside the payout transaction, verifiable by reading the code, not only by the test passing

**Blocks on:** any path where a messaging provider can reverse, block or retry a
committed payout.

## Gate 6 — The run is legible after the fact

- [x] The run record states the resolved period ID and the window as explicit UTC instants with bracket notation
- [x] The printed window is compared against the documented rule during sign-off — the demo prints both, one above the other
- [x] Held, skipped and failed users are each recorded with a reason code, distinct from "not in this period"
- [ ] A run that paid nobody is distinguishable from a run that was not scheduled — the fixture has no scheduler

**Blocks on:** a run whose settled period cannot be read off its own output.
This is what makes "did Sunday's task count?" answerable in seconds instead of
by an engineer reading code.

## Gate 7 — Alerting exists for the silent case

- [ ] A run that completes `SUCCESS` while `findUnpaidTasks` reports closed-period tasks that are not held raises an alert
- [ ] A run with anomalous totals (zero payouts on a normally-busy week, or totals outside an expected band) raises an alert
- [ ] `PENDING_RETRY` notifications are drained by a worker and the backlog is monitored
- [ ] `PARTIAL_FAILURE` pages someone; it is not only written to the run record

**Blocks on:** nothing by itself for a small change — but a release that adds a
new silent-success path does not ship without its alert.

**Why this gate exists:** SETL-001 exits `SUCCESS` every time. Correctness gates
catch it before release; this one catches the next one like it after release.

## Gate 8 — A change to period logic ships with a cutover plan

- [x] Old and new windows are compared across the release: what is overlapped, what is left in a gap — [`results/demo-cutover.txt`](../results/demo-cutover.txt)
- [x] The gap has a tested recovery that pays each task once and is safe to repeat — TC-18
- [ ] `findUnpaidTasks` output is reviewed and approved before reconciliation pays anything — needs real data and a real approver
- [ ] The run after cutover is checked against the same report and comes back empty, apart from held accounts

**Blocks on:** a change that moves a boundary without saying what happens to the
tasks on either side of it. This is the gate that stops the SETL-001 fix from
losing a week's band.

---

## Release decision record

Fill this in at sign-off and attach it to the release.

| Field | |
|---|---|
| Change | |
| Gates passed | |
| Gates failed | |
| Evidence | link to the CI run and `results/summary.json` |
| Known gaps accepted | |
| Decision | **GO** / **NO-GO** |
| Signed off by | |

### This submission's decision

| Field | |
|---|---|
| Change | SETL-001 — correct the settlement window to UTC with an exclusive upper bound, keep the task-ID guard on, reconcile at cutover |
| Evidence | `results/summary.json` — faulty build 18/22 with TC-05 to TC-08 failing; corrected build 22/22 under UTC, Asia/Seoul and America/New_York; local-time regression 22/22 under UTC, 16/22 and 20/22 under the other two |
| Decision | **CONDITIONAL GO.** The three parts of the fix ship together. Shipping the window change alone is a **NO-GO**, because it permanently loses the last band of tasks. |
| Signed off by | Vikas Kumar Saini, 2026-11-02 |

| Gate | On the fixture | Open before a real release |
|---|---|---|
| 1 Rules written | Pass | Confirm assumptions R7, R8 and R9 with the business owner |
| 2 Boundary tests | Pass | — |
| 3 Exactly-once | Tests pass | **Blocking.** Unique constraints on `(periodId, userId)` and on the task ID. Application checks race under concurrency |
| 4 Timezone | Pass | Lint rule, otherwise this rests on review attention |
| 5 Money and messaging | Pass | — |
| 6 Legible run | Pass, except the scheduler item | Record of runs that did not fire |
| 7 Alerting | Not met, accepted | Not blocking this change: it adds no silent-success path. Next piece of work |
| 8 Cutover | Pass on the fixture | **Blocking.** Reconciliation reviewed against real data, approved by a named owner, and the post-cutover report comes back clean |

Known gaps accepted are listed in [`test-cases.md`](test-cases.md#known-gaps).
