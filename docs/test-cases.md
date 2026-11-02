# Test cases and results

Source: [`tests/settlement.test.js`](../tests/settlement.test.js) ·
Fixture data: [`tests/fixtures.js`](../tests/fixtures.js)

**21 cases** plus one build-identity assertion, so a run reports 22 tests. All
reference the run at `2026-11-03T09:00:00Z` (Tuesday), period `SETL-2026-10-26` =
`[2026-10-26T00:00:00Z, 2026-11-02T00:00:00Z)`, unless stated otherwise. All data
is synthetic.

Reproduce:

```bash
IMPL=buggy npm test    # 18 pass, 4 fail  -> the SETL-001 regression gate
IMPL=fixed npm test    # 22 pass, 0 fail
```

Captured output: [`results/tests-buggy.txt`](../results/tests-buggy.txt),
[`results/tests-fixed.txt`](../results/tests-fixed.txt),
[`results/summary.json`](../results/summary.json).

---

## Coverage required by the brief

| Required | Covered by |
|---|---|
| Happy path | TC-01, TC-02 |
| Cut-off boundary | TC-03, TC-04, TC-05, TC-07 |
| Timezone conversion | TC-06 |
| Duplicate input | TC-09, TC-20 |
| Retry | TC-10, TC-11 |
| Partial failure | TC-11, TC-12, TC-19 |
| Account changes (assumption) | TC-13, TC-19 |
| Admin settings (assumption) | TC-14, TC-16 |

---

## Cases

Cases marked † name the build for each run, because they describe what happens
between builds, so they give the same result under every `IMPL`.

| ID | Covers | Input | Expected outcome | buggy | fixed |
|----|--------|-------|------------------|:-----:|:-----:|
| **TC-01** | Happy path | U1 with 3 completed tasks mid-period | 30 credits, exactly 1 ledger entry, exactly 1 alert `SENT`, run `SUCCESS` | pass | pass |
| **TC-02** | Happy path, grouping | U1 ×1 task, U2 ×2 tasks | U1 = 10 cr, U2 = 20 cr, 2 ledger entries, 2 users paid, 30 cr total | pass | pass |
| **TC-03** | Cut-off, upper bound | 1 task at exactly `2026-11-02T00:00:00.000Z` | Not paid by the 11-03 run; paid by the 11-10 run (period `SETL-2026-11-02`); 10 cr total across both | pass | pass |
| **TC-04** | Cut-off, lower bound | 1 task at exactly `2026-10-26T00:00:00.000Z` | Paid by the 11-03 run — lower bound is inclusive | pass | pass |
| **TC-05** | **[SETL-001]** Late-Sunday work | 1 task at `2026-11-01T23:59:59Z` | Paid by the 11-03 run, alert `SENT` in the same run | **FAIL** | pass |
| **TC-06** | **[SETL-001]** Timezone conversion | 1 task at `2026-11-01T16:30:00Z` (= Mon 01:30 Asia/Seoul) | Paid by the 11-03 run — the period is defined in UTC, not KST | **FAIL** | pass |
| **TC-07** | **[SETL-001]** Cross-period double count | 1 task at `2026-11-01T15:00:00Z` (= Mon 00:00 KST), two consecutive runs | 10 cr total, 1 ledger entry — never paid in two periods | **FAIL** | pass |
| **TC-08** | **[SETL-001]** Prior-period bleed | 1 task at `2026-10-25T20:00:00Z` (previous period) | Not paid by the 11-03 run — it belongs to the previous run | **FAIL** | pass |
| **TC-09** | Duplicate input | Same task ID `T-1` appearing twice in source data | 10 cr, not 20; the duplicate is reported in `duplicateTaskIdsDropped` | pass | pass |
| **TC-10** | Retry | Identical run executed twice | Credits unchanged, 1 ledger entry, second run reports `ALREADY_SETTLED_FOR_PERIOD`, no duplicate alert | pass | pass |
| **TC-11** | Partial failure + resume | U1/U2/U3, ledger write injected to fail for U2 | Run = `PARTIAL_FAILURE`; U1 and U3 paid; U2 unpaid with **no alert**; after clearing the fault a re-run of the same period pays only U2; 3 ledger entries total | pass | pass |
| **TC-12** | Notification failure (R6) | U1 paid, notification provider injected to fail | Payout stands (10 cr, 1 ledger entry), run still `SUCCESS`, alert recorded `PENDING_RETRY` | pass | pass |
| **TC-13** | Account change (R7) | U1 `ACTIVE`, U2 `SUSPENDED` | U2 held with `ACCOUNT_SUSPENDED`, no ledger entry, no alert; after reactivation a re-run of the same period pays U2 | pass | pass |
| **TC-14** | Admin setting (R8) | `creditsPerTask = 25`, 2 tasks | 50 credits — the value comes from config, not a constant | pass | pass |
| **TC-15** † | Defence in depth (R4c) | T-1 paid by a correct run, then the faulty window ships and drags it back in | Guard off: 20 cr, paid twice. Guard on: 10 cr and T-1 reported in `alreadyPaidTaskIdsDropped` | pass | pass |
| **TC-16** | Admin setting (R8) | `notificationsEnabled = false` | Payout still commits (10 cr); alert recorded `SUPPRESSED_BY_ADMIN` | pass | pass |
| **TC-17** † | Impact, steady state | Faulty window on three consecutive runs; one task in each week's band | The Sunday task is paid one week late, and no task is paid twice | pass | pass |
| **TC-18** † | Cutover (R9) | Faulty run, then corrected run; 2 tasks in the band | Corrected run pays 0; `findUnpaidTasks` lists both; reconciliation pays 20 cr with alerts `SENT`; repeating it pays 0 | pass | pass |
| **TC-19** † | Reconciliation (R7, R9) | U1 late-arriving task, U2 held then reactivated, U3 ledger failure, U4 still suspended | The next weekly run pays none of them; reconciliation pays U1, U2, U3 once; U4 stays held | pass | pass |
| **TC-20** † | Duplicate across periods (R4c) | Same task ID with a timestamp in each of two periods, default engine settings | 10 cr; second occurrence reported in `alreadyPaidTaskIdsDropped` | pass | pass |
| **TC-21** | Late job (R1) | Job fires 2 hours late, then 2 days late | Same period ID `SETL-2026-10-26` both times | pass | pass |

---

## Reading the result

The four failures on the faulty build are the same defect from four angles: tasks
missing from the top of the window (TC-05, TC-06), the boundary instant paid in
two periods (TC-07), and tasks pulled in from the previous period (TC-08). They
share one root cause and one fix.

The `buggy` and `fixed` columns only compare one week. What the defect costs over
several weeks is in TC-15, TC-17 and TC-18, which is why those three name their
builds directly.

## Does the suite fail when it should?

A green test only means something if it can go red, so each protection was
removed in a throwaway copy to confirm a test catches it.

The automated row runs on every `node scripts/capture-evidence.js`. The rest are
one-line edits, run once by hand, and are not part of the captured evidence.

| Change made | How it was run | Tests that then fail |
|---|---|---|
| Local-time date methods (`IMPL=localtime`), `TZ=UTC` | automated | **none: the mistake is invisible** |
| The same, `TZ=Asia/Seoul` | automated | TC-01, TC-03, TC-05, TC-06, TC-08, TC-21 |
| The same, `TZ=America/New_York` | automated | TC-03, TC-04 |
| Faulty window, shift only (`<` restored) | manual | TC-05, TC-06, TC-08 |
| Faulty window, inclusive bound only (offset set to 0) | manual | TC-03 |
| Engine guard default off | manual | TC-20 |
| Guard logic removed | manual | TC-15, TC-19, TC-20 |
| Guard off in reconciliation | manual | TC-19 |
| Reconciliation window inverted | manual | TC-18, TC-19 |

The first row is the argument for the timezone matrix. CI that only runs under
UTC would pass this regression.

## Known gaps

Recorded honestly rather than papered over:

- **Concurrency is not tested.** Two settlement runs firing simultaneously would
  race on the idempotency check. The fixture is single-threaded; in a real system
  this needs a unique constraint in the database, not an application-level
  `hasSettled` lookup, plus a test that proves the constraint holds.
- **No dedicated DST-transition case.** The corrected window uses no local time,
  so DST cannot reach it, and the fixture dates happen to straddle the US change
  on 2026-11-01. A team using local time anywhere near this code would need cases
  either side of a transition.
- **Notification redelivery is recorded, not driven.** TC-12 proves the payout
  survives and the failure is captured. The retry worker that drains
  `PENDING_RETRY` is out of scope here and would need its own tests.
- **Reconciliation is operator-triggered.** Nothing schedules it. It pays at the
  current credit value and skips a user already reconciled this week (R9).
- **Weeks already paid late stay paid late.** Reconciliation closes the gap at
  cutover. It cannot give anyone back the week they waited.
- **No alert exists for the silent case.** `findUnpaidTasks` is the query an alert
  would sit on, but no alert is built (Gate 7).
- **The fixture is not the real system.** It reproduces the arithmetic and the
  ordering, not MUST's actual schema, provider behaviour or chain interactions.
