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
I confirmed the faulty build carries exactly one injected defect, isolated to
`settlementWindow()`, and that TC-01 to TC-04 and TC-09 to TC-16 pass on both
builds — so the four failures are the defect and nothing else.

**That TC-15 passes on both builds on purpose.** An AI-drafted suite wants
everything green on the fix and red on the bug. TC-15 is deliberately green on
both, because it demonstrates a mitigating control rather than the fix. I kept
it that way against the tidier-looking alternative.

**The severity rationale.** The claim that this is S1 is my judgement, argued
from blast radius and silence, not a label a model suggested.

**The honesty of the scope claims.** I removed invented impact figures from the
first draft. There is no incident history in this submission because I have none
— `intent.md` says so explicitly.

## What I would do differently with a real codebase

The fixture models the defect as an explicit `+9h` offset so it reproduces
deterministically on any machine. In a real repository I would instead reproduce
it the way it actually happens — run the existing suite under `TZ=Asia/Seoul`
and watch it break — then add the timezone matrix to CI permanently. That is
Gate 4 in the release checklist, and it is the control that makes this class of
defect fail in CI rather than in production.
