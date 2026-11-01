# Test cases and results

Source: [`tests/settlement.test.js`](../tests/settlement.test.js) ·
Fixture data: [`tests/fixtures.js`](../tests/fixtures.js)

**16 cases** plus one build-identity assertion. All reference the run at
`2026-11-03T09:00:00Z` (Tuesday), period `SETL-2026-10-26` =
`[2026-10-26T00:00:00Z, 2026-11-02T00:00:00Z)`, unless stated otherwise.

Reproduce:

```bash
IMPL=buggy npm test    # 13 pass, 4 fail  -> the SETL-001 regression gate
IMPL=fixed npm test    # 17 pass, 0 fail
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
| Duplicate input | TC-09 |
| Retry | TC-10, TC-11 |
| Partial failure | TC-11, TC-12 |
| Account changes (assumption) | TC-13 |
| Admin settings (assumption) | TC-14, TC-16 |

---

## Cases

| ID | Covers | Input | Expected outcome | buggy | fixed |
|----|--------|-------|------------------|:-----:|:-----:|
| **TC-01** | Happy path | U1 with 3 completed tasks mid-period | 30 credits, exactly 1 ledger entry, exactly 1 alert `SENT`, run `SUCCESS` | pass | pass |
| **TC-02** | Happy path, grouping | U1 ×1 task, U2 ×2 tasks | U1 = 10 cr, U2 = 20 cr, 2 ledger entries, 2 users paid, 30 cr total | pass | pass |
| **TC-03** | Cut-off, upper bound | 1 task at exactly `2026-11-02T00:00:00.000Z` | Not paid by the 11-03 run; paid by the 11-10 run (period `SETL-2026-11-02`); 10 cr total across both | pass | pass |
| **TC-04** | Cut-off, lower bound | 1 task at exactly `2026-10-26T00:00:00.000Z` | Paid by the 11-03 run — lower bound is inclusive | pass | pass |
| **TC-05** | **[SETL-001]** Late-Sunday work | 1 task at `2026-11-01T23:59:59Z` | Paid by the 11-03 run, alert `SENT` in the same run | **FAIL** | pass |
| **TC-06** | **[SETL-001]** Timezone conversion | 1 task at `2026-11-01T16:30:00Z` (= Mon 01:30 Asia/Seoul) | Paid by the 11-03 run — the period is defined in UTC, not KST | **FAIL** | pass |
| **TC-07** | **[SETL-001]** Cross-period double count | 1 task at `2026-11-01T15:00:00Z` (= Mon 00:00 KST), two consecutive runs | 10 cr total, 1 ledger entry — never paid in two periods | **FAIL** | pass |
| **TC-08** | **[SETL-001]** Prior-period bleed | 1 task at `2026-10-25T20:00:00Z` (previous period) | Not paid by the 11-03 run — it was settled a week earlier | **FAIL** | pass |
| **TC-09** | Duplicate input | Same task ID `T-1` appearing twice in source data | 10 cr, not 20; the duplicate is reported in `duplicateTaskIdsDropped` | pass | pass |
| **TC-10** | Retry | Identical run executed twice | Credits unchanged, 1 ledger entry, second run reports `ALREADY_SETTLED_FOR_PERIOD`, no duplicate alert | pass | pass |
| **TC-11** | Partial failure + resume | U1/U2/U3, ledger write injected to fail for U2 | Run = `PARTIAL_FAILURE`; U1 and U3 paid; U2 unpaid with **no alert**; after clearing the fault a re-run pays only U2; 3 ledger entries total | pass | pass |
| **TC-12** | Notification failure (R6) | U1 paid, notification provider injected to fail | Payout stands (10 cr, 1 ledger entry), run still `SUCCESS`, alert recorded `PENDING_RETRY` | pass | pass |
| **TC-13** | Account change (R7) | U1 `ACTIVE`, U2 `SUSPENDED` | U2 held with `ACCOUNT_SUSPENDED`, no ledger entry, no alert; after reactivation a re-run pays U2 — credits were not forfeited | pass | pass |
| **TC-14** | Admin setting (R8) | `creditsPerTask = 25`, 2 tasks | 50 credits — the value comes from config, not a constant | pass | pass |
| **TC-15** | Defence in depth | Paid-task-ID guard enabled, task already settled in an earlier period | Still 10 cr — a task any ledger entry already covers is never paid again, *even on the faulty build* | pass | pass |
| **TC-16** | Admin setting (R8) | `notificationsEnabled = false` | Payout still commits (10 cr); alert recorded `SUPPRESSED_BY_ADMIN` | pass | pass |

---

## Reading the result

The four failures on the faulty build are all the same defect seen from four
angles — underpayment at the top of the window (TC-05, TC-06), double payment at
the boundary instant (TC-07), and bleed from the previous period (TC-08). They
share one root cause and one fix.

TC-15 is worth a second look: it passes on **both** builds. That is the point of
it. The paid-task-ID guard is a control that would have contained the money half
of SETL-001 even while the window was wrong. It does not fix the missing-alert
half, which is why it is a mitigation and not the fix.

## Known gaps

Recorded honestly rather than papered over:

- **No DST-transition case.** Asia/Seoul has no DST, so the fixture models a
  constant +9 offset. A team running the same code against a DST zone would need
  cases either side of a transition.
- **Concurrency is not tested.** Two settlement runs firing simultaneously would
  race on the idempotency check. The fixture is single-threaded; in a real system
  this needs a unique constraint in the database, not an application-level
  `hasSettled` lookup, plus a test that proves the constraint holds.
- **Notification redelivery is recorded, not driven.** TC-12 proves the payout
  survives and the failure is captured. The retry worker that drains
  `PENDING_RETRY` is out of scope here and would need its own tests.
- **The fixture is not the real system.** It reproduces the arithmetic and the
  ordering, not MUST's actual schema, provider behaviour or chain interactions.
