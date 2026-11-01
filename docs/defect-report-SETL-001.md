# SETL-001 — Settlement period boundary is nine hours early and the upper bound is inclusive

| | |
|---|---|
| **ID** | SETL-001 |
| **Component** | Settlement engine → `settlementWindow()` |
| **Severity** | **S1 — Critical** (see rationale) |
| **Priority** | P0 |
| **Type** | Business-rule defect (date arithmetic) |
| **Affects** | Every settlement run. No trigger condition required. |
| **Status** | Reproduced, root-caused, fixed, regression added |
| **Reported by** | Vikas Kumar Saini |

---

## Summary

The settlement period is built from **Monday midnight in Asia/Seoul** rather
than Monday midnight UTC, and the upper boundary is compared with `<=` instead
of `<`. The period is therefore shifted nine hours early **and** inclusive at
both ends.

One run settles the wrong nine hours at each edge: it pays tasks from the
previous period a second time, and it fails to pay tasks from the last nine
hours of the current period — with no alert and no error.

## Environment

- Fixture: `settlement-quest`, Node v22.23.4, zero dependencies
- Faulty build: `IMPL=buggy` (`src/windows/buggy.js`)
- Corrected build: `IMPL=fixed` (`src/windows/fixed.js`)
- No live financial system is involved at any point.

## Steps to reproduce

```bash
cd settlement-quest
IMPL=buggy node src/cli/run-settlement.js
```

The demo settles one week for four users at `2026-11-03T09:00:00Z`:

| user | task | completed at | should be |
|---|---|---|---|
| U-aisha | T-1001, T-1002 | Wed/Thu, mid-period | paid, 20 cr |
| U-ben | T-1003 | Fri, mid-period | paid, 10 cr |
| U-ben | T-0999 | `2026-10-25T20:00:00Z` — **previous** period, already settled | **not** paid again |
| U-chen | T-1004 | `2026-11-01T23:10:00Z` — Sunday night, inside the period | paid, 10 cr |
| U-dara | T-1005 | `2026-11-01T16:30:00Z` — Mon 01:30 KST, inside the period in UTC | paid, 10 cr |

## Expected vs actual

**Expected** (`IMPL=fixed`):

```
window : [2026-10-26T00:00:00.000Z , 2026-11-02T00:00:00.000Z)
PAID     U-aisha 20cr | U-ben 10cr | U-chen 10cr | U-dara 10cr
ALERTS   4 SENT
totals   4 users, 50 credits
```

**Actual** (`IMPL=buggy`):

```
window : [2026-10-25T15:00:00.000Z , 2026-11-01T15:00:00.000Z]
PAID     U-aisha 20cr | U-ben 20cr  (includes T-0999 from the previous period)
NOT PAID U-chen, U-dara
ALERTS   2 SENT
totals   2 users, 40 credits
status   SUCCESS      <-- no error is raised
```

Three distinct user-visible wrongs in a single run:

1. **U-ben is overpaid 10 credits.** T-0999 was settled in the previous period
   and is paid again.
2. **U-chen and U-dara are not paid and receive no settlement alert.** Their
   work is invisible until the following Tuesday. This is the "my alert never
   arrived" ticket.
3. **The run reports `SUCCESS`.** Nothing in logs, metrics or alerting fires.
   The defect is only discoverable from user reports.

Full captured output: [`results/demo-buggy.txt`](../results/demo-buggy.txt) vs
[`results/demo-fixed.txt`](../results/demo-fixed.txt).

## Severity rationale — S1

- **It moves money incorrectly in both directions.** Overpayment is direct
  financial loss; underpayment is a broken promise to the user.
- **It fires on every run with no trigger.** Unlike a retry or provider bug, it
  needs no unusual condition. Every user active in the nine hours before the
  boundary is affected, every week.
- **It is silent.** The run exits `SUCCESS`. There is no failed job, no error
  log, no metric to alert on. Detection depends entirely on users complaining.
- **It is self-concealing.** The two symptoms look like unrelated bugs — one a
  payments issue, one a notifications issue — so triage naturally splits them
  into separate investigations that each find nothing.
- **It compounds.** Every run both overpays and underpays, and the underpaid
  tasks are picked up a week late, which makes period-over-period totals
  disagree with task-level data in a way that is tedious to unwind.

## Root cause

`src/windows/buggy.js`:

```js
const shift = SEOUL_UTC_OFFSET_HOURS * HOUR_MS;        // B1: +9h
const end   = new Date(previousMondayMidnight(runAt).getTime() - shift);
const start = new Date(end.getTime() - 7 * DAY_MS);
contains: (t) => t.getTime() >= start.getTime()
               && t.getTime() <= end.getTime();        // B2: inclusive end
```

Two mistakes in one function, compounding:

**B1 — local-time anchoring.** The boundary was derived from Seoul wall-clock
midnight and then compared against task timestamps, which are true UTC instants.
Monday 00:00 KST is Sunday 15:00 UTC, so both boundaries land nine hours early.
In production this comes from local-time date construction
(`new Date(y, m, d)` on a host with `TZ=Asia/Seoul`); the fixture models it as
an explicit offset constant so it reproduces identically on any machine and in
CI regardless of the runner's timezone. The arithmetic under test is the same.

**B2 — inclusive upper bound.** `<=` where rule R2 says the end is excluded.
With the lower bound also inclusive, an instant landing exactly on a boundary
belongs to two consecutive periods and is paid twice. On its own B2 is a
once-in-a-blue-moon bug — it needs a timestamp at exactly `00:00:00.000`. B1
makes it routine, because it relocates the boundary to `15:00:00.000`, a far
busier moment, and the two together produce the double payment seen in TC-07.

**Why it survived review.** The function looks correct if you read "Monday
00:00" as a wall-clock phrase. The rule is only unambiguous if "UTC" is written
into the comparison, not just into the specification document. There is no test
that distinguishes a UTC boundary from a local one unless someone deliberately
picks a timestamp inside the offset gap — which is precisely what TC-05 to TC-08
now do.

## Fix

`src/windows/fixed.js` — all arithmetic in UTC, upper bound exclusive:

```js
function previousUtcMondayMidnight(at) {
  const utcDayStart = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const daysSinceMonday = (at.getUTCDay() + 6) % 7;
  return new Date(utcDayStart - daysSinceMonday * DAY_MS);
}

const end   = previousUtcMondayMidnight(runAt);
const start = new Date(end.getTime() - 7 * DAY_MS);
contains: (t) => t.getTime() >= start.getTime()
               && t.getTime() <  end.getTime();   // exclusive
```

Beyond the two-line arithmetic change, the fix carries three things that stop
the class of defect rather than this instance of it:

1. **`Date.UTC` and `getUTC*` only.** No local-time constructor anywhere in the
   window function. Worth enforcing with a lint rule banning `new Date(y, m, d)`
   in settlement code.
2. **The window is returned as a value, not re-derived.** `periodId`, `start`,
   `end`, a `contains` predicate and a printable `label` come from one place, so
   the boundary cannot be computed differently in two call sites.
3. **The boundary is printed on every run** (`window: [...)` in the CLI output
   and in the run result). An operator can read the actual period off the run
   record instead of inferring it. This is what makes the posting's "nobody can
   say whether it counts" question answerable in seconds.

## Mitigating control (recommended, separate from the fix)

Enable the paid-task-ID guard — `guardAlreadyPaidTaskIds: true` on the engine —
so a task ID covered by any earlier ledger entry is refused rather than paid
again. **TC-15** proves this contains the double-payment half of SETL-001 even
on the faulty build.

It is defence in depth, not a fix: it would have stopped the money going out
twice, but it would **not** have stopped U-chen and U-dara going unpaid and
unnotified. Ship it alongside the fix, not instead of it. In a real system the
equivalent is a unique constraint on the task ID in the payout-line table, so
the guarantee is enforced by the database rather than by application code.

## Verification

```bash
IMPL=buggy npm test   # 13 pass, 4 fail  — TC-05, TC-06, TC-07, TC-08
IMPL=fixed npm test   # 17 pass, 0 fail
```

Evidence regenerated from a clean run by `node scripts/capture-evidence.js`:
[`results/summary.json`](../results/summary.json).

## Release checks that would have blocked this

See [`release-readiness-checklist.md`](release-readiness-checklist.md). The
three that catch this specific defect:

- **Gate 2** — the boundary test set (TC-03 to TC-08) must pass. It fails on the
  faulty build, so the release stops.
- **Gate 4** — CI runs with `TZ` set to a non-UTC zone. Any local-time date
  construction that survives review fails here instead of in production.
- **Gate 6** — the computed window is printed in the run record and checked
  against the documented rule during release sign-off. A nine-hour shift is
  visible on sight.
