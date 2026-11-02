# Flow map — weekly settlement

## The run, step by step

```mermaid
flowchart TD
    A[Scheduler fires<br/>Tuesday 09:00 UTC] --> B[settlementWindow runAt]
    B --> C{"SETL-001 lives here<br/>Period = [Mon 00:00Z, Mon 00:00Z)<br/>lower inclusive, upper EXCLUDED"}
    C --> D[Select tasks<br/>status = COMPLETED<br/>completedAt in period]
    D --> E[Drop duplicate task IDs<br/>within the run - R4a]
    E --> F[Group by userId]
    F --> G{Already settled?<br/>key = periodId:userId - R4b}
    G -->|yes| H[SKIP - no payout, no alert<br/>reason recorded]
    G -->|no| G2{Task IDs in an<br/>earlier ledger entry? - R4c}
    G2 -->|all of them| H2[DROP - no payout, no alert<br/>task IDs recorded]
    G2 -->|the rest| I{Account ACTIVE?}
    I -->|no| J[HOLD - credits retained<br/>no alert]
    I -->|yes| K[COMMIT ledger entry<br/>credits = count x creditsPerTask]
    K -->|write fails| L[FAILURE for this user<br/>run status = PARTIAL_FAILURE<br/>no alert - R5]
    K -->|committed| M[Payout is final]
    M --> N{Notifications enabled?}
    N -->|no| O[Alert SUPPRESSED_BY_ADMIN]
    N -->|yes| P[Send notification]
    P -->|delivered| Q[Alert SENT]
    P -->|provider error| R["Alert PENDING_RETRY<br/>payout NOT reversed - R6"]
    J -.->|account active again| S[Reconciliation - R9<br/>same steps, wider window]
    L -.->|not re-run before next Tuesday| S
```

The ordering is the point. Money is committed at **K**, and every branch after
that leaves the payout intact. Nothing downstream of the ledger write can take
it back.

The dotted lines matter just as much. **J** and **L** do not rejoin the next
weekly run, because its window has moved on. Without reconciliation they end
there.

## Where each candidate failure attaches

| Node | Failure it admits | Guarded by |
|---|---|---|
| **C** | Boundary computed in local time, or upper bound inclusive | **SETL-001** — TC-05 to TC-08 |
| E | Upstream re-emits a task ID, paid twice | TC-09 |
| G | Idempotency keyed on run attempt rather than period, retry double-pays | TC-10, TC-11 |
| G2 | A task ID is paid again in a later period | TC-15, TC-20 |
| I | Suspended account paid, or earnings silently destroyed | TC-13, TC-19 |
| K→L | One bad write aborts the whole batch, or leaves no resume path | TC-11, TC-19 |
| P→R | Notification wrapped in the payout transaction, provider error rolls back money | TC-12 |
| S | The band left behind when the fix ships | TC-18 |

## The nine-hour shift, drawn

Run at Tue 2026-11-03 09:00 UTC.

```
                Sun 25         Mon 26                      Sun 01         Mon 02
                15:00          00:00                       15:00          00:00
                  |              |                           |              |
intended          |              [===========================================)
                  |              |  period SETL-2026-10-26   |              |
                  |              |                           |              |
actual (faulty)   [=========================================]                |
                  |                                          |              |
                  ^^^^^^^^^^^^^^^                            ^^^^^^^^^^^^^^^^
                  pulled in from the               the band: dropped from this
                  previous period                  period, left to next week
```

The window is nine hours early on every run. What that costs depends on which
window ran the week before, because the question is whether the neighbouring
windows still meet:

| This week | Last week | Effect on tasks in the band | Evidence |
|---|---|---|---|
| faulty | faulty | Paid one week late, once. Consecutive faulty windows meet at Sunday 15:00 UTC | TC-17 |
| faulty | correct | **Paid twice.** The windows overlap: the fault has just shipped | TC-15 |
| correct | faulty | **Never paid.** The windows leave a gap: the fix has just shipped | TC-18 |

All three are in [`results/demo-cutover.txt`](../results/demo-cutover.txt).
