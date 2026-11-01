# directive.md — final

**Quest:** AI-Native Product QA Engineer (Business Flows & Operational Quality) — MUST Company
**Author:** Vikas Kumar Saini
**Date:** 2026-11-01
**Status:** Complete — fix verified, regression in place, release decision recorded

> **Before submitting:** replace the two `‹…›` placeholders in the appendix with
> your public repository URL and your Loom URL. Everything else is final.

---

## 1. Objective

Take one high-impact failure in a weekly settlement, payout and notification
flow; reproduce it deterministically; establish the business rule it violates;
and leave a regression check that fails against the broken behaviour and passes
against the fix — so the failure cannot return silently.

The measure of success is not that a bug was found. It is that the same class of
failure now fails in CI instead of in a user's settlement alert.

## 2. Scope

### In scope

- The fictional weekly rewards settlement defined by the quest brief: Tuesday
  09:00 UTC run, Monday-to-Monday period with the upper bound excluded, 10
  credits per qualifying task, task IDs counted once, notification only after a
  successful payout, notification failure never reversing a payout.
- One defect solved deeply: **SETL-001**, the settlement period boundary.
- A runnable fixture with a faulty build and a corrected build.
- Sixteen automated cases covering the happy path, both cut-off boundaries, a
  timezone conversion, duplicate input, retry, partial failure, account changes
  and admin settings.
- A defect report, a release-readiness checklist and a signed release decision.

### Out of scope, and deliberately so

- **Any live or production system.** Everything runs in memory. Nothing touches
  a network, a chain or a payment provider.
- **Four of the five candidate failures.** Ranked in [`intent.md`](intent.md),
  not solved; each has a passing guardrail test so the chosen fix cannot regress
  them.
- **Invented impact history.** I have no access to MUST's incident data, support
  queue or codebase. There are no ticket counts or production metrics anywhere
  in this submission, and inference is labelled as inference.
- **Concurrency, DST transitions and the notification retry worker.** Named as
  known gaps in [`docs/test-cases.md`](docs/test-cases.md#known-gaps) rather
  than quietly omitted.

## 3. Requirements

| # | Requirement | Where it is met |
|---|---|---|
| R-1 | At least three candidate failures listed and ranked by impact, frequency and effort; one chosen with reasoning | [`intent.md` §2–3](intent.md) — five candidates, scored |
| R-2 | Uncertainty explained rather than incident history invented | [`intent.md` §1, §4](intent.md); no metrics claimed anywhere |
| R-3 | The flow mapped | [`docs/flow-map.md`](docs/flow-map.md) |
| R-4 | At least eight cases with inputs and expected outcomes, covering happy path, cut-off boundary, timezone conversion, duplicate input, retry, partial failure | [`docs/test-cases.md`](docs/test-cases.md) — 16 cases |
| R-5 | Assumptions about account changes and admin settings stated | [`docs/business-rules.md`](docs/business-rules.md) R7, R8; tested by TC-13, TC-14, TC-16 |
| R-6 | A minimal reproducible fixture with automated checks | `src/`, `tests/` — zero dependencies, Node 20+ |
| R-7 | The regression fails against the faulty behaviour and passes after the fix | `IMPL=buggy` 13/17 · `IMPL=fixed` 17/17 — [`results/summary.json`](results/summary.json) |
| R-8 | No live financial system tested | In-memory store only; no network calls in the codebase |
| R-9 | One actionable defect report: repro, expected vs actual, severity rationale, root cause, evidence, proposed fix | [`docs/defect-report-SETL-001.md`](docs/defect-report-SETL-001.md) |
| R-10 | Which release checks would block this failure | Defect report, final section; Gates 2, 4 and 6 in the checklist |
| R-11 | Final test run demonstrated, remaining gaps recorded, release-readiness decision and handoff given | §5 below; [`docs/release-readiness-checklist.md`](docs/release-readiness-checklist.md) |
| R-12 | AI usage and personal verification made visible | [`docs/ai-usage.md`](docs/ai-usage.md) |

## 4. Completion criteria

All met.

- [x] Five candidate failures ranked; one chosen with stated reasoning
- [x] Business rules written with every ambiguity resolved and each rule mapped to a test
- [x] Flow mapped, with each candidate failure attached to the node that admits it
- [x] ≥ 8 automated cases — **16 delivered**, covering all six required categories
- [x] Defect reproduced on demand by a single command
- [x] Regression **fails** on the faulty build: exactly TC-05, TC-06, TC-07, TC-08
- [x] Regression **passes** on the corrected build: 17/17
- [x] Corrected build proven independent of the runner's timezone across UTC, Asia/Seoul and a DST zone
- [x] Defect report with severity rationale and root cause, not just a repro
- [x] Mitigating control identified, tested (TC-15) and correctly distinguished from the fix
- [x] Release-readiness checklist with seven gates and a signed GO decision
- [x] Remaining gaps recorded rather than omitted
- [x] Evidence generated by script, so it cannot drift from the code
- [ ] **Loom recorded** — script ready at [`docs/loom-script.md`](docs/loom-script.md); this is yours to record

## 5. Results

### The defect, in one run

| | corrected | faulty |
|---|---|---|
| window | `[2026-10-26T00:00:00Z , 2026-11-02T00:00:00Z)` | `[2026-10-25T15:00:00Z , 2026-11-01T15:00:00Z]` |
| users paid | 4 | 2 |
| credits paid | 50 | 40 |
| alerts sent | 4 | 2 |
| wrong payments | none | U-ben paid twice for a prior-period task; U-chen and U-dara unpaid and unnotified |
| run status | `SUCCESS` | `SUCCESS` ← the defect raises no error |

### Final test run

| build | result | failing cases |
|---|---|---|
| `IMPL=buggy` | **13 pass, 4 fail** | TC-05, TC-06, TC-07, TC-08 — all SETL-001 |
| `IMPL=fixed` | **17 pass, 0 fail** | — |
| `IMPL=fixed TZ=UTC` | 17 pass, 0 fail | — |
| `IMPL=fixed TZ=Asia/Seoul` | 17 pass, 0 fail | — |
| `IMPL=fixed TZ=America/New_York` | 17 pass, 0 fail | — |

Captured on Node v22.23.4. Regenerate with `node scripts/capture-evidence.js`.

### Remaining gaps

1. No DST-transition case — Asia/Seoul has no DST, so the fixture models a constant offset.
2. Concurrency untested — simultaneous runs would race on the idempotency check; a real system needs a database unique constraint, not an application-level lookup.
3. Notification redelivery is recorded but not driven; the retry worker is out of scope.
4. Gate 7 alerting on anomalous `SUCCESS` runs is a recommendation, not implemented here.

### Release-readiness decision

**GO.** Gates 1–6 pass; no gate fails. For a real system the fix ships with the
paid-task-ID guard alongside it, and the concurrency constraint is the next
piece of work before the next settlement change.
Full record: [`docs/release-readiness-checklist.md`](docs/release-readiness-checklist.md).

## 6. Handoff

To take this over, in order:

1. **Read** [`docs/business-rules.md`](docs/business-rules.md) first. If you disagree with R2, R7 or R8, stop — everything downstream depends on them, and R7 and R8 are my assumptions rather than given rules.
2. **Run** `IMPL=buggy node src/cli/run-settlement.js`, then the same with `IMPL=fixed`. Thirty seconds, and the defect is visible without reading code.
3. **Run** `IMPL=buggy npm test` and `IMPL=fixed npm test` to see the gate open and close.
4. **To change the business rules:** edit `src/shared/rules.js` and `src/windows/fixed.js`. Nothing else encodes a rule.
5. **To add a case:** add it to `tests/settlement.test.js` using the instants in `tests/fixtures.js`. Tag it `[SETL-001]` only if it fails on the faulty build — that tag is the regression gate and should stay precise.
6. **To change fault behaviour:** `store.failLedgerFor(userId)` and `store.failNotificationFor(userId)` in `src/shared/store.js`.
7. **Never hand-edit `results/`.** Run `node scripts/capture-evidence.js`.

**If this were going into a real repository:** wire `npm test` into CI across the
three-timezone matrix, add the lint rule banning local-time date constructors in
settlement code (Gate 4), and move the idempotency guarantee from the
application-level `hasSettled` lookup to a database unique constraint on
`(periodId, userId)` plus one on the task ID in the payout-line table.

---

## Appendix — links and verification evidence

### Work

| | |
|---|---|
| Repository | ‹add your public repo URL› |
| Loom (≤ 5 min) | ‹add your Loom URL› |
| `intent.md` | [intent.md](intent.md) |
| `directive.md` | this file |
| Runnable test project | [`tests/settlement.test.js`](tests/settlement.test.js), [`tests/fixtures.js`](tests/fixtures.js), `src/` |
| 16 cases and results | [`docs/test-cases.md`](docs/test-cases.md) |
| Defect / root-cause report | [`docs/defect-report-SETL-001.md`](docs/defect-report-SETL-001.md) |
| Release-readiness checklist | [`docs/release-readiness-checklist.md`](docs/release-readiness-checklist.md) |
| Business rules | [`docs/business-rules.md`](docs/business-rules.md) |
| Flow map | [`docs/flow-map.md`](docs/flow-map.md) |
| AI usage and personal verification | [`docs/ai-usage.md`](docs/ai-usage.md) |

### Verification evidence

| | |
|---|---|
| Machine-readable summary | [`results/summary.json`](results/summary.json) |
| Faulty build, full test output | [`results/tests-buggy.txt`](results/tests-buggy.txt) |
| Corrected build, full test output | [`results/tests-fixed.txt`](results/tests-fixed.txt) |
| Timezone matrix | [`results/tests-fixed-tz-matrix.txt`](results/tests-fixed-tz-matrix.txt) |
| Faulty build, demo run | [`results/demo-buggy.txt`](results/demo-buggy.txt) |
| Corrected build, demo run | [`results/demo-fixed.txt`](results/demo-fixed.txt) |

### Reproduce every claim above

```bash
git clone ‹your repo URL› && cd settlement-quest
IMPL=buggy node src/cli/run-settlement.js    # the defect
IMPL=fixed node src/cli/run-settlement.js    # the fix
IMPL=buggy npm test                          # 13 pass, 4 fail
IMPL=fixed npm test                          # 17 pass, 0 fail
node scripts/capture-evidence.js             # regenerates results/
```

No install step. No dependencies. Node 20 or newer.

### Confidentiality

No confidential information, personal data, credentials or API keys from any
past or current employer appear in this submission. The rewards service is the
fictional one defined by the quest brief.
