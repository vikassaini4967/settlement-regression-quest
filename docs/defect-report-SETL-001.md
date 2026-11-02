# SETL-001 — Settlement period boundary is nine hours early and the upper bound is inclusive

| | |
|---|---|
| **ID** | SETL-001 |
| **Component** | Settlement engine → `settlementWindow()` |
| **Severity** | **S1 — Critical** (see rationale) |
| **Priority** | P0 |
| **Type** | Business-rule defect (date arithmetic) |
| **Affects** | Every settlement run. No trigger condition required. |
| **Status** | Reproduced, root-caused, fixed, regression added, cutover plan tested |
| **Reported by** | Vikas Kumar Saini |

The service is the fictional one in the brief, and all data here is synthetic.

---

## Summary

The settlement period is built from **Monday midnight in Asia/Seoul** rather
than Monday midnight UTC, and the upper boundary is compared with `<=` instead
of `<`. The period is therefore shifted nine hours early **and** inclusive at
both ends.

Every run settles the wrong tasks: anything in the last nine hours of the week
(the band, Sunday 15:00 to 24:00 UTC) lands in the wrong period, with no alert
and no error.

The cost depends on the week:

| Situation | Effect on tasks in the band |
|---|---|
| Faulty window has been running | Paid one week late |
| The week the fault ships | **Paid twice** |
| The week the fix ships | **Never paid**, unless reconciled |

The last row is the reason this report carries a cutover step. Correcting the
window on its own permanently loses a week's band.

## Environment

- Fixture: `settlement-regression-quest`, Node v25.2.1, zero dependencies
- Faulty build: `IMPL=buggy` (`src/windows/buggy.js`, task-ID guard off)
- Corrected build: `IMPL=fixed` (`src/windows/fixed.js`, task-ID guard on)
- No live financial system is involved at any point.

## Steps to reproduce

```bash
cd settlement-regression-quest
IMPL=buggy node src/cli/run-settlement.js
```

The demo settles the week of 10-19 correctly, then one week for four synthetic
users at `2026-11-03T09:00:00Z`. It is the first run after the fault ships.

| user | task | completed at | should be |
|---|---|---|---|
| U-aisha | T-1001, T-1002 | Wed/Thu, mid-period | paid, 20 cr |
| U-ben | T-1003 | Fri, mid-period | paid, 10 cr |
| U-ben | T-0999 | `2026-10-25T20:00:00Z` — **previous** period, paid by the previous run | **not** paid again |
| U-chen | T-1004 | `2026-11-01T23:10:00Z` — Sunday night, inside the period | paid, 10 cr |
| U-dara | T-1005 | `2026-11-01T16:30:00Z` — Mon 01:30 KST, inside the period in UTC | paid, 10 cr |

Then, for the behaviour across weeks and at cutover:

```bash
node src/cli/run-cutover.js
```

## Expected vs actual

**Expected** (`IMPL=fixed`):

```
window : [2026-10-26T00:00:00.000Z , 2026-11-02T00:00:00.000Z)
PAID     U-aisha 20cr | U-ben 10cr | U-chen 10cr | U-dara 10cr
ALERTS   4 SENT
PAID TWICE (none)
totals   4 users, 50 credits
```

**Actual** (`IMPL=buggy`):

```
window : [2026-10-25T15:00:00.000Z , 2026-11-01T15:00:00.000Z]
PAID     U-aisha 20cr | U-ben 20cr  (includes T-0999 from the previous period)
NOT PAID U-chen, U-dara
ALERTS   2 SENT
PAID TWICE T-0999
totals   2 users, 40 credits
status   SUCCESS      <-- no error is raised
```

Three distinct user-visible wrongs in that run:

1. **U-ben is overpaid 10 credits.** T-0999 is in the ledger from the previous
   run and is paid again.
2. **U-chen and U-dara are not paid and receive no settlement alert.** Their
   work is invisible until the following Tuesday, or for good if the fix ships
   first. This is the "my alert never arrived" ticket.
3. **The run reports `SUCCESS`.** Nothing in the run record says anything is
   wrong.

Full captured output: [`results/demo-buggy.txt`](../results/demo-buggy.txt) vs
[`results/demo-fixed.txt`](../results/demo-fixed.txt).

## What it does across weeks

Three tasks, four timelines, from [`results/demo-cutover.txt`](../results/demo-cutover.txt).
All three tasks fall in a band. "x2" means paid twice, and "late" means one week
after the run the task belongs to.

| Timeline | T-0999 | T-1004 | T-1005 |
|---|---|---|---|
| A. Faulty window every week | x1, late | x1, late | x1, late |
| B. Fault ships after a correct run | **x2** | x1, late | x1, late |
| C. Fix ships, no reconciliation | x1, late | **x0** | **x0** |
| D. Fix ships, then reconciliation | x1, late | x1, late | x1, late |

Consecutive faulty windows meet at Sunday 15:00 UTC, so a faulty build that keeps
running does not double-pay the band. It overlaps with a correct window on the
week it arrives, and leaves a gap against one on the week it leaves.

There is one double payment inside timeline A: a task at exactly
`15:00:00.000Z` on a Sunday is in both windows, because the upper bound is
inclusive (TC-07). That needs a timestamp on the exact millisecond.

## Severity rationale — S1

On its steady-state behaviour alone I would call this S2: users are paid late,
not robbed. Two things raise it to S1.

- **It moves money wrongly whenever the window changes.** The week the fault
  ships, the band is paid twice. The week the fix ships, the band is lost.
  Neither reverses itself, and the second is a loss the fix itself would cause.
- **It fires on every run with no trigger.** Unlike a retry or provider bug, it
  needs no unusual condition. Every user active in the band is affected, every
  week.
- **It is silent.** The run exits `SUCCESS`. There is no failed job and no error.
  Without a check that compares task data against the ledger, detection depends
  on users complaining.
- **It is self-concealing.** A late alert and a payment error look like unrelated
  bugs, so triage would naturally split them into separate investigations.

This severity is my judgement from the rules and the fixture. I have no incident
data for this system.

## Root cause

`src/windows/buggy.js`:

```js
const shift = SEOUL_UTC_OFFSET_HOURS * HOUR_MS;        // B1: +9h
const end   = new Date(previousMondayMidnight(runAt).getTime() - shift);
const start = new Date(end.getTime() - 7 * DAY_MS);
contains: (t) => t.getTime() >= start.getTime()
               && t.getTime() <= end.getTime();        // B2: inclusive end
```

Two mistakes in one function:

**B1 — local-time anchoring.** The boundary was derived from Seoul wall-clock
midnight and then compared against task timestamps, which are true UTC instants.
Monday 00:00 KST is Sunday 15:00 UTC, so both boundaries land nine hours early.
On a real host this comes from local-time date construction (`new Date(y, m, d)`
with `TZ=Asia/Seoul`). `buggy.js` models it as a constant so it reproduces on any
machine. [`src/windows/localtime.js`](../src/windows/localtime.js) is the real
construction, and it behaves the same way under `TZ=Asia/Seoul`.

**B2 — inclusive upper bound.** `<=` where rule R2 says the end is excluded.
With the lower bound also inclusive, an instant landing exactly on a boundary
belongs to two consecutive periods and is paid twice. It needs a timestamp on the
exact millisecond, so it is rare, but the money it moves is real. TC-07 holds it.

**Why it would survive review.** The function looks correct if you read "Monday
00:00" as a wall-clock phrase. The rule is only unambiguous if "UTC" is written
into the comparison, not just into the specification document. And a suite that
runs under UTC cannot see B1 at all: `IMPL=localtime` passes every test under
`TZ=UTC`.

## Fix

The fix has three parts, and they ship together.

**1. Correct the window.** `src/windows/fixed.js`, all arithmetic in UTC, upper
bound exclusive:

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

Beyond the arithmetic, this stops the class of defect rather than this instance:

- **`Date.UTC` and `getUTC*` only.** No local-time constructor anywhere in the
  window function. Worth enforcing with a lint rule banning `new Date(y, m, d)`
  in settlement code.
- **The window is returned as a value, not re-derived.** `periodId`, `start`,
  `end`, a `contains` predicate and a printable `label` come from one place, so
  the boundary cannot be computed differently in two call sites.
- **The boundary is printed on every run** (`window: [...)` in the CLI output and
  in the run result). An operator can read the actual period off the run record.

**2. Keep the task-ID guard on.** The `(period, user)` key cannot stop a task
being paid in a second period, because a different period is a different key. The
guard (`guardAlreadyPaidTaskIds`, now on by default) refuses any task ID an
earlier ledger entry covers. **TC-15** shows the difference on the same scenario:
20 credits with the guard off, 10 with it on. **TC-20** shows the engine default
protects a task ID re-emitted in a later period, a separate way to break R4.

The guard is defence in depth, not the fix: it stops money going out twice but
would not have stopped U-chen and U-dara going unpaid. In a real system the
equivalent is a unique constraint on the task ID in the payout-line table, so the
guarantee is enforced by the database rather than by application code.

**3. Run reconciliation on the week the fix ships.** `src/shared/reconcile.js`.
The last faulty window stops at Sunday 15:00 UTC and the first corrected window
starts at Monday 00:00 UTC, so nothing covers the band between them.
`findUnpaidTasks` lists eligible tasks that no ledger entry covers, and
`runReconciliation` pays them once. **TC-18** proves the gap and the recovery.

The same step recovers tasks left behind by a hold, a failed write or a late
arrival (**TC-19**). The next weekly run does not reach those either.

## Verification

```bash
IMPL=buggy npm test   # 18 pass, 4 fail  — TC-05, TC-06, TC-07, TC-08
IMPL=fixed npm test   # 22 pass, 0 fail
node src/cli/run-cutover.js
```

Evidence regenerated from a clean run by `node scripts/capture-evidence.js`, which
also fails if any claim here stops being true:
[`results/summary.json`](../results/summary.json).

## Release checks that would have blocked this

See [`release-readiness-checklist.md`](release-readiness-checklist.md). The four
that catch this specific defect:

- **Gate 2** — the boundary test set (TC-03 to TC-08) must pass. It fails on the
  faulty build, so the release stops.
- **Gate 4** — CI runs with `TZ` set to non-UTC zones. A local-time construction
  that passes under UTC fails here, which `IMPL=localtime` demonstrates.
- **Gate 6** — the computed window is printed in the run record and checked
  against the documented rule during release sign-off. A nine-hour shift is
  visible on sight.
- **Gate 8** — a change to which tasks belong to which period ships with a
  reconciliation plan. This is the one that stops the fix from losing the band.
