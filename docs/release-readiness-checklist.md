# Release-readiness checklist — settlement, payout and notification flows

Scope: any change that touches period calculation, payout amounts, the ledger,
idempotency, or settlement notifications.

**The line I hold:** a gate that fails blocks the release. Not "note it and
ship" — blocks it. The whole reason these flows generate weeks of operation
support is that small boundary problems were allowed through as acceptable
risk. If a gate is genuinely wrong for a given change, the gate gets amended and
re-reviewed; it does not get waived in the moment by whoever is shipping.

---

## Gate 1 — Business rules are written down before the code is reviewed

- [ ] Every rule the change touches exists in [`business-rules.md`](business-rules.md) with its ambiguity resolved, not just in a ticket
- [ ] Each boundary is stated as an instant with an explicit timezone and explicit inclusivity (`[a, b)`), never as "Monday midnight"
- [ ] Any assumption the brief did not cover is written as an assumption with the test that holds it named

**Blocks on:** a rule that cannot be stated unambiguously. If two engineers read
the window differently, the release waits.

## Gate 2 — Boundary test set passes

- [ ] TC-03, TC-04 — both bounds, exact-instant cases
- [ ] TC-05, TC-06 — the last hours before the period closes, including a timestamp that falls on the next calendar day in the team's local zone
- [ ] TC-07 — the same task across two consecutive runs pays exactly once
- [ ] TC-08 — the previous period does not bleed into this one

**Blocks on:** any failure. This gate alone stops SETL-001.

## Gate 3 — Exactly-once is proven, not asserted

- [ ] TC-09 — duplicate task IDs in source data
- [ ] TC-10 — identical run executed twice changes nothing
- [ ] TC-11 — partial failure resumes without re-paying the already-paid users
- [ ] TC-15 — a task covered by an earlier ledger entry is refused
- [ ] The idempotency guarantee is enforced by a database constraint, not only by application code

**Blocks on:** any failure, or an idempotency key that is derived from the run
attempt rather than from `(periodId, userId)`.

## Gate 4 — Timezone independence

- [ ] The suite passes under `TZ=UTC`, `TZ=Asia/Seoul` and `TZ=America/New_York` (a DST zone) on Node 20 and 22, enforced on every push and pull request by [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — captured run in [`results/tests-fixed-tz-matrix.txt`](../results/tests-fixed-tz-matrix.txt)
- [ ] No local-time date construction (`new Date(y, m, d)`, `getFullYear`, `getMonth`, `getDate`, `getDay`) anywhere in settlement code — `Date.UTC` and `getUTC*` only
- [ ] Ideally enforced by a lint rule rather than by review attention

**Blocks on:** a suite whose result depends on the runner's timezone. That is
the defect, not a flaky test.

## Gate 5 — Money and messaging are independently safe

- [ ] TC-12 — a notification failure leaves the payout committed and the run `SUCCESS`
- [ ] TC-11 — a user who was not paid receives no alert
- [ ] TC-16 — disabling notifications suppresses alerts without suppressing payouts
- [ ] The notification send is outside the payout transaction, verifiable by reading the code, not only by the test passing

**Blocks on:** any path where a messaging provider can reverse, block or retry a
committed payout.

## Gate 6 — The run is legible after the fact

- [ ] The run record states the resolved period ID and the window as explicit UTC instants with bracket notation
- [ ] The printed window is compared against the documented rule during sign-off — a shifted boundary is visible on sight
- [ ] Held, skipped and failed users are each recorded with a reason code, distinct from "not in this period"
- [ ] A run that paid nobody is distinguishable from a run that was not scheduled

**Blocks on:** a run whose settled period cannot be read off its own output.
This is what makes "did Sunday's task count?" answerable in seconds instead of
by an engineer reading code.

## Gate 7 — Alerting exists for the silent case

- [ ] A run that completes `SUCCESS` with anomalous totals (zero payouts on a normally-busy week, or totals outside an expected band) raises an alert
- [ ] `PENDING_RETRY` notifications are drained by a worker and the backlog is monitored
- [ ] `PARTIAL_FAILURE` pages someone; it is not only written to the run record

**Blocks on:** nothing by itself for a small change — but a release that adds a
new silent-success path does not ship without its alert.

**Why this gate exists:** SETL-001 exits `SUCCESS` every time. No gate above
Gate 7 would have detected it in production. Correctness gates catch it before
release; this one catches the next one like it after release.

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
| Change | SETL-001 — correct the settlement window to UTC with an exclusive upper bound |
| Gates passed | 1, 2, 3, 4, 5, 6 |
| Gates failed | none |
| Evidence | `results/summary.json` — faulty build 13/17 with TC-05 to TC-08 failing; corrected build 17/17; timezone matrix 17/17 across UTC, Asia/Seoul, America/New_York |
| Known gaps accepted | No DST-transition case; concurrency between simultaneous runs untested; notification redelivery worker out of scope; Gate 7 alerting is a recommendation, not implemented in the fixture. All four are listed in [`test-cases.md`](test-cases.md#known-gaps). |
| Decision | **GO** for the fixture. For a real system: GO on the fix, with the paid-task-ID guard shipped alongside it and the concurrency constraint raised as the next piece of work before the next settlement change. |
| Signed off by | Vikas Kumar Saini, 2026-11-01 |
