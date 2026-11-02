# intent.md

**Quest:** AI-Native Product QA Engineer — settlement / payout / notification regression
**Author:** Vikas Kumar Saini
**Date:** 2026-11-02

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

I listed five plausible ways this flow breaks and scored each from 1 to 5. **The
scores are my estimates from the rules as written, not measurements.**

- **User impact:** 5 = many users lose money or are paid twice, 3 = a smaller group
  is affected and the harm is recoverable.
- **Likelihood:** 5 = fires on every run with no trigger, 3 = needs a routine
  operational event, 2 = needs an unusual event.
- **Ease of proving:** 5 = a pure function, 3 = needs state set up across steps.

I ranked on impact × likelihood, and used ease of proving only to break ties.

| # | Failure | Impact | Likelihood | Ease | Score | Rank |
|---|---------|:-----:|:---------:|:---:|:----:|:---:|
| 1 | **Period boundary computed in local time, upper bound inclusive** — the window is anchored to the team's wall clock instead of UTC, and `<=` is used where the rule says the end is excluded | 4 | 5 | 5 | **20** | **1** |
| 2 | Retry after a failed run creates a second payout — idempotency keyed on run attempt instead of (period, user) | 5 | 3 | 5 | 15 | 2 |
| 3 | Notification send sits inside the payout transaction, so a provider error rolls back a good payout | 4 | 3 | 5 | 12 | 3 |
| 5 | Partial batch failure with no resume — the re-run pays the already-paid prefix again | 5 | 2 | 3 | 10 | 4 |
| 4 | Duplicate task IDs from the upstream job counted twice | 4 | 2 | 5 | 8 | 5 |

Why #1 scores 4 on impact rather than 5: while the fault is running it delays
payment rather than destroying it. The worse outcomes come on the week the window
changes (see §3). I first scored it 5 on the claim that every run also overpays.
Testing showed that claim was wrong, so I lowered the score and checked that the
ranking still held.

The ranking is not fragile. At an impact of 3 the score is 15, level with #2, and
#1 still wins the judgement: a failed retry is at least visible to whoever ran it.

## 3. Why I chose #1

Four reasons, in order of weight.

**It fires unconditionally.** Every other candidate needs a trigger — a retry, a
provider outage, a bad upstream emission. #1 is wrong on a quiet Tuesday with
healthy infrastructure and clean input. That makes it both the most frequent and
the hardest to notice, because nothing in the system reports an error. The run
says `SUCCESS`.

**One root cause, symptoms that look unrelated.** While the fault runs, it looks
like a late-alert problem: tasks from the last nine hours of the week are paid a
week late. On the week it ships, it looks like a payments problem: the same band
is paid twice. A team triaging these separately would open two unrelated
investigations. That is exactly the "each case is small, but together they pull
engineering time away from building" pattern the role describes.

**The obvious fix makes it worse.** Correcting the window on its own permanently
loses one week's band, because the last faulty window and the first corrected one
do not meet. That is the depth I wanted from this problem: the regression test is
the easy part, and the release is where the money is. I only found this once I
tested the first version of my own work, which is recorded in
[`docs/ai-usage.md`](docs/ai-usage.md).

**It is the structurally likely mistake here.** MUST Company is based in South
Korea (KST, UTC+9, no DST) and the business rule is written in UTC. Any
`new Date(y, m, d)` on a server or laptop set to `Asia/Seoul` silently produces
a boundary nine hours off, and it passes every test on a UTC build server. The
posting's own example — "a user completes a task on Sunday, settlement runs on
Tuesday, and nobody can say whether it counts" — is the symptom of a boundary
nobody can state unambiguously. I want to be clear this is inference about a
plausible failure mode, not a claim about MUST's code, which I have never seen.

Candidates #2–#5 are not ignored: each has a passing test in the suite (#2 TC-10,
#3 TC-12, #4 TC-09 and TC-20, #5 TC-11), so the fix to #1 cannot quietly regress
them, and the next person to touch the window function inherits those guardrails.

## 4. Who is affected, the evidence, and the value

**Affected users (fictional service).** Anyone who completes a task in the last
nine hours of the week, Sunday 15:00 to 24:00 UTC, which is Monday morning in
Seoul. Behind them, whoever answers "did Sunday's task count?" and the engineers
pulled in to find out.

**Evidence.** A deterministic reproduction on a synthetic fixture, and nothing
else. It shows what the code does, not how often this happens anywhere real:

- one run: the faulty build pays 40 credits to 2 users where 50 to 4 are due, and
  reports `SUCCESS`
- across weeks: a task paid late, paid twice or never paid, depending on which
  window ran the week before
- a real local-time regression passes all 22 tests under `TZ=UTC` and fails under
  `TZ=Asia/Seoul`

I have no ticket data, incident reports or user research, so I claim none.

**Intended value.** "Did Sunday's task count?" gets an answer from the run record
rather than from an engineer reading code. This class of failure fails in CI
instead of in a user's settlement alert. The fix can ship without losing anyone's
credits. I cannot put a number on any of that for a system I have no data on.

## 5. Non-goals

- **No live system.** Everything runs against an in-memory fixture. Nothing
  touches a network, a chain, or a payment provider.
- **No fabricated impact numbers.** I can show the defect and its blast radius
  on the fixture. I cannot show "X% fewer tickets" for a system I have no data
  on, so I have not claimed it.
- **No second defect solved shallowly.** The brief asks for one solved deeply.
  I spent the depth on boundary semantics, what happens across consecutive weeks,
  and shipping the fix safely, rather than fixing five things at surface level.
- **No confidential material.** No employer data, credentials, keys or customer
  records appear anywhere in this project.

## 6. How I used AI, and what I checked myself

Recorded in full in [`docs/ai-usage.md`](docs/ai-usage.md). The short version:
I used AI to accelerate scaffolding, enumerate boundary cases, draft prose and
audit the first version by experiment. That audit found real errors, including a
test that could not fail and a release decision that would have lost credits, and
each one is listed there with its correction. The pass/fail evidence in `results/`
is generated by a script rather than written out, and the script fails if the
claims made about that evidence stop being true.
