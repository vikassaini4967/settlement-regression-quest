# intent.md

**Quest:** AI-Native Product QA Engineer — settlement / payout / notification regression
**Author:** Vikas Kumar Saini
**Date:** 2026-11-01

---

## 1. What I set out to do

Take one high-impact failure in a weekly settlement flow, prove it exists with a
reproducible fixture, establish what the business rule actually says, and leave
behind a regression check that fails against the broken behaviour and passes
against the fix.

I used the suggested fictional rewards service from the brief rather than
inventing a different domain, because the rules it gives are already precise
enough to argue about: a weekly window with an excluded upper boundary, a
fixed credit value, task-ID uniqueness, and a notification that must follow a
payout without being able to undo it. Changing the domain would have cost
clarity and bought nothing.

**A note on scope honesty.** I have no access to MUST Company's incident
history, support queue or codebase. Everything below is reasoning from the
rules as written plus what the role description says has been hurting the team.
I have not invented ticket counts, incident dates or production metrics
anywhere in this submission. Where I am inferring rather than observing, I say
so.

---

## 2. Candidate failures I considered

I listed five plausible ways this flow breaks, then scored each one. "Frequency"
is my estimate of how often the failure *fires* given the rules as written —
not a measured rate.

| # | Failure | User impact | Frequency / likelihood | Effort to prove | Pick |
|---|---------|-------------|------------------------|-----------------|------|
| 1 | **Period boundary computed in local time, upper bound inclusive** — the window is anchored to the team's wall clock instead of UTC, and `<=` is used where the rule says the end is excluded | **Very high.** Produces *both* underpayment (user paid late, no alert) and overpayment (same task paid in two periods) | **Very high.** Fires on every single run, needs no retry, no outage, no unusual input. Any user active in the 9 hours before the boundary is affected | Low — pure function, no infrastructure | **Yes** |
| 2 | Retry after a failed run creates a second payout — idempotency keyed on run attempt instead of (period, user) | Very high | Medium. Only fires when a run is retried | Low | No |
| 3 | Notification send sits inside the payout transaction, so a provider error rolls back a good payout | High | Medium. Needs a provider failure | Low | No |
| 4 | Duplicate task IDs from the upstream job counted twice | High | Low–medium. Needs upstream re-emission | Low | No |
| 5 | Partial batch failure with no resume — the re-run pays the already-paid prefix again | Very high | Low. Needs a mid-batch failure *and* a naive re-run | Medium | No |

## 3. Why I chose #1

Three reasons, in order of weight.

**It fires unconditionally.** Every other candidate needs a trigger — a retry, a
provider outage, a bad upstream emission. #1 is wrong on a quiet Tuesday with
healthy infrastructure and clean input. That makes it both the most frequent and
the hardest to notice, because nothing in the system reports an error. The run
says `SUCCESS`.

**One root cause, two opposite symptoms.** The same nine-hour shift drops the
tail of the current week (user not paid, no settlement alert, support ticket)
and drags in the tail of the previous week (task paid a second time, real money
out the door). A team triaging these separately would open two unrelated
investigations. That is exactly the "each case is small, but together they pull
engineering time away from building" pattern the role describes.

**It is the structurally likely mistake here.** MUST Company is based in South
Korea (KST, UTC+9, no DST) and the business rule is written in UTC. Any
`new Date(y, m, d)` on a server or laptop set to `Asia/Seoul` silently produces
a boundary nine hours off. The posting's own example — "a user completes a task
on Sunday, settlement runs on Tuesday, and nobody can say whether it counts" —
is the symptom of a boundary nobody can state unambiguously. I want to be clear
this is inference about a plausible failure mode, not a claim about MUST's code,
which I have never seen.

Candidates #2–#5 are not ignored: each has a passing test in the suite
(TC-09 through TC-13, TC-15), so the fix to #1 cannot quietly regress them, and
the next person to touch the window function inherits those guardrails.

## 4. What I deliberately did not do

- **No live system.** Everything runs against an in-memory fixture. Nothing
  touches a network, a chain, or a payment provider.
- **No fabricated impact numbers.** I can show the defect and its blast radius
  on the fixture. I cannot show "X% fewer tickets" for a system I have no data
  on, so I have not claimed it.
- **No second defect solved shallowly.** The brief asks for one solved deeply.
  I spent the depth on boundary semantics, the exactly-once argument across two
  consecutive runs, and a defence-in-depth control, rather than fixing five
  things at surface level.
- **No confidential material.** No employer data, credentials, keys or customer
  records appear anywhere in this project.

## 5. How I used AI, and what I checked myself

Recorded in full in [`docs/ai-usage.md`](docs/ai-usage.md). The short version:
I used AI to accelerate scaffolding, enumerate boundary cases and draft prose.
I verified every date-arithmetic claim against a calendar by hand, and the
pass/fail evidence in `results/` is generated by a script rather than written
out, so it cannot drift from what the code actually does.
