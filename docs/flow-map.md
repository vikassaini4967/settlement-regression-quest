# Flow map — weekly settlement

## The run, step by step

```mermaid
flowchart TD
    A[Scheduler fires<br/>Tuesday 09:00 UTC] --> B[settlementWindow runAt]
    B --> C{"Period = [Mon 00:00Z, Mon 00:00Z)<br/>lower inclusive, upper EXCLUDED"}
    C -->|SETL-001 lives here| C
    C --> D[Select tasks<br/>status = COMPLETED<br/>completedAt in period]
    D --> E[Drop duplicate task IDs<br/>within the run - R4a]
    E --> F[Group by userId<br/>credits = count x creditsPerTask]
    F --> G{Already settled?<br/>key = periodId:userId}
    G -->|yes| H[SKIP - no payout, no alert]
    G -->|no| I{Account ACTIVE?}
    I -->|no| J[HOLD - credits retained<br/>no alert, settles later]
    I -->|yes| K[COMMIT ledger entry]
    K -->|write fails| L[FAILURE for this user<br/>run status = PARTIAL_FAILURE<br/>no alert - R5]
    K -->|committed| M[Payout is final]
    M --> N{Notifications enabled?}
    N -->|no| O[Alert SUPPRESSED_BY_ADMIN]
    N -->|yes| P[Send notification]
    P -->|delivered| Q[Alert SENT]
    P -->|provider error| R["Alert PENDING_RETRY<br/>payout NOT reversed - R6"]
```

The ordering is the point. Money is committed at **K**, and every branch after
that leaves the payout intact. Nothing downstream of the ledger write can take
it back.

## Where each candidate failure attaches

| Node | Failure it admits | Guarded by |
|---|---|---|
| **C** | Boundary computed in local time, or upper bound inclusive | **SETL-001** — TC-05 to TC-08 |
| E | Upstream re-emits a task ID, paid twice | TC-09 |
| G | Idempotency keyed on run attempt rather than period, retry double-pays | TC-10, TC-11 |
| I | Suspended account paid, or earnings silently destroyed | TC-13 |
| K→L | One bad write aborts the whole batch, or leaves no resume path | TC-11 |
| P→R | Notification wrapped in the payout transaction, provider error rolls back money | TC-12 |
| (cross-run) | A task covered by an earlier ledger entry is paid again | TC-15 |

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
                  dragged in from              dropped from this period:
                  the previous period:         user not paid, no alert,
                  task paid a SECOND time      lands in next week's run
```

Both error bands are nine hours wide and both appear on every single run.
