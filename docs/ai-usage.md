# How AI was used on this quest, and what I verified myself

The evaluation criteria ask what was delegated to AI and what was verified by
hand. This is that record, written honestly rather than flatteringly.

## Delegated to AI

| Work | Why delegate it |
|---|---|
| Scaffolding the fixture — store, engine, CLI, evidence script | Mechanical. The design decisions were mine; the typing is not worth my time |
| Enumerating candidate boundary cases | Good at breadth. It surfaced the inclusive-bound interaction with the offset shift, which sharpened TC-07 |
| Drafting prose for the docs in this folder | Faster to edit a draft than to face a blank page |
| Generating the first pass of the test table in `test-cases.md` | Tedious, mechanical cross-referencing |
| Auditing the first version against the brief, by experiment | Good at running many small what-if scenarios quickly. See below |
| Drafting talk-track outlines for the two videos | Kept out of this repository. The recordings are in my own words |

## Corrections: what the first version got wrong

The first version of this submission (commit `4e2fafa`) was complete, its tests
were green and its CI passed. It was also wrong in ways that reading it did not
show. A second pass on 2026-11-02 used Claude Code to test the claims by running
scenarios against the engine rather than re-reading them.

| What the first version said | What running it showed | Correction |
|---|---|---|
| TC-15 "proves the guard contains double payment, even on the faulty build" | The test gave the same result with the guard off. The guard never fired on either build, because the scenario never paid the task twice. **The test could not fail** | Rewritten: same scenario with the guard off (20 cr) and on (10 cr). Confirmed it fails when the guard logic is removed |
| "Every run both overpays and underpays" | A faulty window running every week pays each task once, a week late. Consecutive faulty windows meet, so they do not overlap. Double payment needs a correct run before it, or a timestamp on the exact boundary millisecond | Severity rationale rewritten, and I now say S2 on steady state alone. TC-17 pins the behaviour |
| The demo's U-ben "is paid a second time" | The demo's ledger was empty, so T-0999 was being paid for the first time | The demo now settles the previous week first, and prints tasks paid more than once from the ledger |
| Release decision: GO | Deploying the fix leaves a gap between the last faulty window and the first corrected one. **Tasks in it are never paid.** The fix, shipped as written, would have destroyed credits | Added reconciliation, TC-18 and Gate 8. Decision is now a conditional GO |
| R7: held credits "settle on a later run" | Only if someone re-runs the same period, which is what TC-13 did. The next weekly run does not reach them. Same for failed writes and late-arriving tasks | R7 reworded, R9 added, TC-19 covers all three |
| R4: a task ID counts "at most once, ever" | The corrected build paid a re-emitted task ID twice by default | Guard on by default, TC-20 |
| The timezone matrix would catch local-time code | Unproven. Neither build used local time, so the matrix could not fail | Added `IMPL=localtime`: it passes under UTC and fails under Seoul and New York |
| Code comments: "the behaviour that was in production" | There is no production. That was invented incident history for a fictional service, which the brief forbids | Removed |

A correction caused its own bug. Turning the guard on by default made retries
drop out of the run record, and the new evidence check failed on TC-10. The fix
was to reorder the engine so the period check runs first, not to change the test.

The common thread is that all of it passed review by reading. The lesson I am
keeping: an AI-drafted test suite is green by construction, so a test only counts
once I have watched it fail. That is why
[`test-cases.md`](test-cases.md#does-the-suite-fail-when-it-should) now records
what breaks when each protection is removed.

## Verified by hand, because getting it wrong invalidates the submission

**Every date in the fixture, against a calendar.** `2026-11-01` is a Sunday,
`2026-11-02` a Monday, `2026-11-03` a Tuesday, and `2026-10-26` is exactly seven
days before `2026-11-02`. The whole submission rests on these being right, and
an LLM producing a plausible-looking wrong weekday is exactly the failure mode I
would not catch by reading.

**The nine-hour arithmetic, in both directions.** Monday 00:00 KST is Sunday
15:00 UTC. The faulty window is therefore `[Sun 25 15:00Z, Sun 01 15:00Z]`. I
checked each test timestamp against both windows manually before running
anything, and predicted which four cases would fail. The run matched the
prediction — had it not, I would have been debugging my understanding, not the
code.

**That the four failures are one defect, not four.** Easy to assemble a suite
where several tests fail for unrelated reasons and call it a regression gate.
TC-05 to TC-08 fail on the faulty build and every other case passes on it, and
those four all come from `settlementWindow()`.

**The severity rationale.** The claim that this is S1 is my judgement, argued
from what happens when the window changes and from silence, not a label a model
suggested.

**The honesty of the scope claims.** I removed invented impact figures from the
first draft. There is no incident history in this submission because I have none
— `intent.md` says so explicitly.

## What I would do differently with a real codebase

The fixture has both forms of the defect: a constant offset that reproduces on
any machine, and the real local-time construction. In a real repository I would
start with the second, by running the existing suite under `TZ=Asia/Seoul` and
watching it break, then add the timezone matrix to CI permanently. I would also
compare the old and new windows across the release before anyone wrote the fix,
which is the step the first version of this work missed.
