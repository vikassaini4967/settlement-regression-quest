# directive.md — final

**Quest:** AI-Native Product QA Engineer (Business Flows & Operational Quality) — MUST Company
**Author:** Vikas Kumar Saini
**Date:** 2026-11-02
**Status:** Complete — fix verified, regression in place, release decision recorded

---

## 1. Objective

Take one high-impact failure in a weekly settlement, payout and notification
flow; reproduce it deterministically; establish the business rule it violates;
and leave a regression check that fails against the broken behaviour and passes
against the fix — so the failure cannot return silently.

The measure of success is not that a bug was found. It is that the same class of
failure now fails in CI instead of in a user's settlement alert, and that the fix
can ship without losing anyone's credits.

## 2. Scope

### In scope

- The fictional weekly rewards settlement defined by the quest brief: Tuesday
  09:00 UTC run, Monday-to-Monday period with the upper bound excluded, 10
  credits per qualifying task, task IDs counted once, notification only after a
  successful payout, notification failure never reversing a payout.
- One defect solved deeply: **SETL-001**, the settlement period boundary,
  including its behaviour across weeks and on the week the fix ships.
- A runnable fixture with a faulty build, a corrected build, and a real local-time
  regression.
- Twenty-one automated cases covering the happy path, both cut-off boundaries, a
  timezone conversion, duplicate input, retry, partial failure, account changes,
  admin settings and cutover.
- A defect report, a release-readiness checklist and a recorded release decision.

### Out of scope, and deliberately so

- **Any live or production system.** Everything runs in memory. Nothing touches
  a network, a chain or a payment provider.
- **Four of the five candidate failures.** Ranked in [`intent.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/intent.md),
  not solved; each has a passing guardrail test so the chosen fix cannot regress
  them.
- **Invented impact history.** I have no access to MUST's incident data, support
  queue or codebase. There are no ticket counts or production metrics anywhere
  in this submission, and inference is labelled as inference.
- **Concurrency, a dedicated DST case and the notification retry worker.** Named
  as known gaps in [`docs/test-cases.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/test-cases.md#known-gaps) rather
  than quietly omitted.

## 3. Requirements

| # | Requirement | Where it is met |
|---|---|---|
| R-1 | At least three candidate failures listed and ranked by impact, frequency and effort; one chosen with reasoning | [`intent.md` §2–3](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/intent.md) — five candidates, scored |
| R-2 | Uncertainty explained rather than incident history invented | [`intent.md` §1, §4](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/intent.md); no metrics claimed anywhere |
| R-3 | The flow mapped | [`docs/flow-map.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/flow-map.md) |
| R-4 | At least eight cases with inputs and expected outcomes, covering happy path, cut-off boundary, timezone conversion, duplicate input, retry, partial failure | [`docs/test-cases.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/test-cases.md) — 21 cases |
| R-5 | Assumptions about account changes and admin settings stated | [`docs/business-rules.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/business-rules.md) R7, R8, R9; tested by TC-13, TC-14, TC-16, TC-18, TC-19 |
| R-6 | A minimal reproducible fixture with automated checks | `src/`, `tests/` — zero dependencies, Node 20+ |
| R-7 | The regression fails against the faulty behaviour and passes after the fix | `IMPL=buggy` 18/22 · `IMPL=fixed` 22/22 — [`results/summary.json`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/summary.json) |
| R-8 | No live financial system tested | In-memory store only; no network calls in the codebase |
| R-9 | One actionable defect report: repro, expected vs actual, severity rationale, root cause, evidence, proposed fix | [`docs/defect-report-SETL-001.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/defect-report-SETL-001.md) |
| R-10 | Which release checks would block this failure | Defect report, final section; Gates 2, 4, 6 and 8 in the checklist |
| R-11 | Final test run demonstrated, remaining gaps recorded, release-readiness decision and handoff given | Appendix below; [`docs/release-readiness-checklist.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/release-readiness-checklist.md) |
| R-12 | AI usage, corrections and personal verification made visible | Appendix below; [`docs/ai-usage.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/ai-usage.md) |

## 4. Completion criteria

All met.

- [x] Five candidate failures ranked; one chosen with stated reasoning
- [x] Business rules written with every ambiguity resolved and each rule mapped to a test
- [x] Flow mapped, with each candidate failure attached to the node that admits it
- [x] ≥ 8 automated cases — **21 delivered**, covering all six required categories
- [x] Defect reproduced on demand by a single command
- [x] Regression **fails** on the faulty build: exactly TC-05, TC-06, TC-07, TC-08
- [x] Regression **passes** on the corrected build: 22/22
- [x] Corrected build proven independent of the runner's timezone across UTC, Asia/Seoul and a DST zone
- [x] Timezone matrix proven to catch a real local-time regression that UTC alone misses
- [x] Each new test shown to fail when the protection it covers is removed
- [x] Defect report with severity rationale and root cause, not just a repro
- [x] Behaviour across weeks established, not assumed, and the fix's cutover gap closed and tested (TC-17, TC-18)
- [x] Release-readiness checklist with eight gates and a recorded decision
- [x] Remaining gaps recorded rather than omitted
- [x] Evidence generated by script, which fails if the claims made here stop being true

---

## Appendix — results and handoff

### A. Artifacts

| | |
|---|---|
| Repository | https://github.com/vikassaini4967/settlement-regression-quest |
| Loom (≤ 5 min) | https://www.loom.com/share/6bb645d3ed6944c8bb18b45869490b08 |
| Career Path & Career Leverage Video (≤ 5 min) | https://www.loom.com/share/00b15d48ea4545c4b1d78b83dc0daf4e |
| `intent.md` | [intent.md](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/intent.md) |
| `directive.md` | this file |
| Runnable test project | [`tests/settlement.test.js`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/tests/settlement.test.js), [`tests/fixtures.js`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/tests/fixtures.js), `src/` |
| 21 cases and results | [`docs/test-cases.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/test-cases.md) |
| Defect / root-cause report | [`docs/defect-report-SETL-001.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/defect-report-SETL-001.md) |
| Release-readiness checklist | [`docs/release-readiness-checklist.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/release-readiness-checklist.md) |
| Business rules | [`docs/business-rules.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/business-rules.md) |
| Flow map | [`docs/flow-map.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/flow-map.md) |
| AI usage and corrections | [`docs/ai-usage.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/ai-usage.md) |
| CI | [GitHub Actions](https://github.com/vikassaini4967/settlement-regression-quest/actions) — Node 20 and 22 across three timezones, plus a job that confirms the faulty builds fail |

### B. Reproduce every claim

```bash
git clone https://github.com/vikassaini4967/settlement-regression-quest.git && cd settlement-regression-quest
IMPL=buggy node src/cli/run-settlement.js    # the defect
IMPL=fixed node src/cli/run-settlement.js    # the fix
node src/cli/run-cutover.js                  # across weeks, and the week the fix ships
IMPL=buggy npm test                          # 18 pass, 4 fail
IMPL=fixed npm test                          # 22 pass, 0 fail
TZ=UTC IMPL=localtime npm test               # 22 pass: a real local-time bug is invisible
TZ=Asia/Seoul IMPL=localtime npm test        # 16 pass, 6 fail: the matrix catches it
node scripts/capture-evidence.js             # regenerates results/, exits 1 if a claim breaks
```

No install step. No dependencies. Node 20 or newer.

### C. Checks and actual results

**The defect in one run.** The first run after the fault ships.

| | corrected | faulty |
|---|---|---|
| window | `[2026-10-26T00:00:00Z , 2026-11-02T00:00:00Z)` | `[2026-10-25T15:00:00Z , 2026-11-01T15:00:00Z]` |
| users paid | 4 | 2 |
| credits paid | 50 | 40 |
| alerts sent | 4 | 2 |
| wrong payments | none | T-0999 paid twice; U-chen and U-dara unpaid and unnotified |
| run status | `SUCCESS` | `SUCCESS` ← the defect raises no error |

**Across weeks.** The tasks in the last nine hours of the week:

| Situation | Effect | Case |
|---|---|---|
| Faulty window running every week | Paid one week late, once | TC-17 |
| The week the fault ships | Paid twice | TC-15 |
| The week the fix ships, no reconciliation | **Never paid** | TC-18 |
| The week the fix ships, with reconciliation | Paid once | TC-18 |

**Final test run.** Captured on Node v25.2.1. 22 tests means 21 cases plus one
build-identity assertion.

| build | result | failing cases |
|---|---|---|
| `IMPL=buggy` | **18 pass, 4 fail** | TC-05, TC-06, TC-07, TC-08 — all SETL-001 |
| `IMPL=fixed` | **22 pass, 0 fail** | — |
| `IMPL=fixed TZ=UTC` | 22 pass, 0 fail | — |
| `IMPL=fixed TZ=Asia/Seoul` | 22 pass, 0 fail | — |
| `IMPL=fixed TZ=America/New_York` | 22 pass, 0 fail | — |
| `IMPL=localtime TZ=UTC` | 22 pass, 0 fail | none: the bug is invisible under UTC |
| `IMPL=localtime TZ=Asia/Seoul` | 16 pass, 6 fail | TC-01, TC-03, TC-05, TC-06, TC-08, TC-21 |
| `IMPL=localtime TZ=America/New_York` | 20 pass, 2 fail | TC-03, TC-04 |

**Evidence files**

| | |
|---|---|
| Machine-readable summary | [`results/summary.json`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/summary.json) |
| Faulty build, full test output | [`results/tests-buggy.txt`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/tests-buggy.txt) |
| Corrected build, full test output | [`results/tests-fixed.txt`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/tests-fixed.txt) |
| Corrected build, timezone matrix | [`results/tests-fixed-tz-matrix.txt`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/tests-fixed-tz-matrix.txt) |
| Local-time regression, timezone matrix | [`results/tests-localtime-tz-matrix.txt`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/tests-localtime-tz-matrix.txt) |
| Faulty build, demo run | [`results/demo-buggy.txt`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/demo-buggy.txt) |
| Corrected build, demo run | [`results/demo-fixed.txt`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/demo-fixed.txt) |
| Across weeks and cutover | [`results/demo-cutover.txt`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/results/demo-cutover.txt) |

### D. AI contribution and corrections

AI did the scaffolding, widened the list of boundary cases, drafted the prose, and
ran the audit of the first version. The problem choice, the release decision and
the severity call are mine.

The audit matters most. The first version had green tests and green CI, and was
still wrong. The main corrections, each with its evidence in
[`docs/ai-usage.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/ai-usage.md):

| First version | Found by running it | Correction |
|---|---|---|
| TC-15 proved the task-ID guard works | The guard never fired; the test could not fail | Rewritten to show 20 cr with the guard off and 10 with it on |
| "Every run overpays and underpays" | A faulty window running every week pays each task once, late | Severity rationale rewritten; TC-17 |
| Release decision: GO | The fix alone leaves a gap that is never paid | Reconciliation, TC-18, Gate 8; decision is now conditional |
| Held credits settle "on a later run" | Only on a re-run of the same period | R7 reworded, R9 added, TC-19 |
| Timezone matrix catches local-time code | Unproven: no build used local time | `IMPL=localtime` proves it |

### E. Limitations

1. **Concurrency untested.** Simultaneous runs would race on the idempotency check. A real system needs database unique constraints, not an application-level lookup.
2. **Reconciliation is manual and fixture-only.** Nothing schedules it. It pays at the current credit value. A real cutover needs the list reviewed against real data by a named owner.
3. **No alert for the silent case.** `findUnpaidTasks` is the query an alert would sit on, but no alert exists (Gate 7).
4. **Notification redelivery is recorded, not driven.** The retry worker is out of scope.
5. **No dedicated DST case.** The corrected window uses no local time, so DST cannot reach it.
6. **R7, R8 and R9 are my assumptions**, not rules from the brief. Each is labelled and held by a named test.
7. **The fixture is not a real system.** All severity, scores and impact reasoning are my estimates. Nothing here has been measured.

### F. Release-readiness decision

**CONDITIONAL GO.** The window fix, the task-ID guard and the reconciliation run
ship together. Shipping the window change alone is a **NO-GO**, because it
permanently loses the last band of tasks. Gates 1, 2, 4, 5, 6 and 8 pass on the
fixture and Gate 3's tests pass. For a real system, two items block: database
unique constraints (Gate 3), and reconciliation reviewed against real data by a
named owner (Gate 8). Gate 7 alerting is the next piece of work.
Full record: [`docs/release-readiness-checklist.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/release-readiness-checklist.md).

### G. Handoff

To take this over, in order:

1. **Read** [`docs/business-rules.md`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/docs/business-rules.md) first. If you disagree with R2, R7, R8 or R9, stop — everything downstream depends on them, and R7 to R9 are my assumptions rather than given rules.
2. **Run** `IMPL=buggy node src/cli/run-settlement.js`, the same with `IMPL=fixed`, then `node src/cli/run-cutover.js`. Thirty seconds, and the defect is visible without reading code.
3. **Run** `IMPL=buggy npm test` and `IMPL=fixed npm test` to see the gate open and close.
4. **To change the business rules:** edit `src/shared/rules.js` and `src/windows/fixed.js`. Reconciliation (`src/shared/reconcile.js`) derives its boundary from `fixed.js`.
5. **To add a case:** add it to `tests/settlement.test.js` using the instants in `tests/fixtures.js`. Tag it `[SETL-001]` only if it fails on the faulty build — that tag is the regression gate and should stay precise. Then watch it fail once before trusting it.
6. **To change fault behaviour:** `store.failLedgerFor(userId)` and `store.failNotificationFor(userId)` in `src/shared/store.js`.
7. **Never hand-edit `results/`.** Run `node scripts/capture-evidence.js`.

**If this were going into a real repository:** add the lint rule banning
local-time date constructors in settlement code (Gate 4), and move the
idempotency guarantee from application-level checks to a database unique
constraint on `(periodId, userId)` plus one on the task ID in the payout-line
table. The timezone matrix and the faulty-build gate already run in CI:
[`.github/workflows/ci.yml`](https://github.com/vikassaini4967/settlement-regression-quest/blob/main/.github/workflows/ci.yml).

### H. Effort and origin

| | |
|---|---|
| Actual effort | About 10–12 hours in total, including documentation and both videos |
| What pre-existed | Nothing; built for this Quest |

### I. Data and confidentiality

The rewards service is the fictional one defined by the quest brief. All users,
tasks and amounts in the fixture are synthetic. No confidential information,
personal data, credentials or API keys from any past or current employer appear
in this submission.
