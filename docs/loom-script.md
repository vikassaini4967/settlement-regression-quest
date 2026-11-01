# Loom script — 5 minutes, SETL-001

**You have to record this yourself.** It is a required submission artifact and
it is the one part nobody can generate for you — the reviewers are explicitly
assessing what *you* owned. The script below is timed to just under five
minutes at a normal speaking pace.

**Before you hit record**

- Two terminal panes, both in `settlement-quest/`, font size up
- `docs/flow-map.md` open to the ASCII diagram, and `src/windows/buggy.js` open
- Clear the panes. Do a dry run once — the demo output is the whole video

---

### 0:00–0:35 · The problem, not the code

> I'm Vikas. I've spent four and a half years in QA, most recently as a senior
> test engineer on fintech products, where I own regression for flows that move
> money.
>
> This quest is about a weekly rewards settlement. The rule is simple: every
> Tuesday at 9 UTC, settle the week that ran Monday to Monday, upper bound
> excluded, ten credits a task, notify after payout.
>
> The failure I picked is the one the job posting describes — a user finishes
> something on Sunday, settlement runs Tuesday, and nobody can say whether it
> counted. I'll show you why that happens, and the regression that stops it.

### 0:35–1:05 · Why this one

> I listed five candidate failures and ranked them. Retry double-payment,
> notification rollback, duplicate task IDs, partial-batch replay — all real,
> all need a trigger. A retry. An outage. A bad upstream emission.
>
> This one needs nothing. It's wrong on a quiet Tuesday with healthy
> infrastructure and clean input, it's wrong every single week, and the run
> reports success. That combination — high frequency, silent — is why I picked
> it. I had no incident data, so I ranked on the rules as written and said so.

### 1:05–2:15 · Reproduce it

Run `IMPL=buggy node src/cli/run-settlement.js`. Let the output sit on screen.

> Four users, one week. Look at the window line: the period should be Monday
> the 26th to Monday the 2nd. It's Sunday the 25th at 15:00 to Sunday the 1st
> at 15:00. Nine hours early at both ends, and closed at the top instead of
> open.
>
> Two things fall out of that. U-ben gets twenty credits — one of those tasks
> is from the *previous* week, already settled, now paid a second time. And
> U-chen and U-dara don't appear at all. They finished Sunday evening, inside
> the period, and they're not paid and get no alert.
>
> And the status says SUCCESS. No error, no failed job, nothing to alert on.
> The only way anyone finds this is a user complaining.

### 2:15–2:50 · Root cause

Switch to `src/windows/buggy.js`, highlight the offset line and the `<=`.

> Two mistakes in one function. The boundary was anchored to Monday midnight in
> Seoul — the team's local time — and then compared against UTC timestamps.
> Monday midnight KST is Sunday 3pm UTC. That's the nine hours.
>
> And the upper bound uses less-than-or-equal where the rule says excluded. On
> its own that needs a timestamp at exactly midnight, so it'd almost never
> fire. Combined with the shift it moves the boundary to 3pm, which is busy —
> so the same task lands in two consecutive periods and gets paid twice.
>
> One cause, two opposite symptoms, which is why triage would split this into
> a payments bug and a notifications bug and find nothing in either.

### 2:50–3:40 · The regression gate

Run `IMPL=buggy npm test`, then scroll to the four failures.

> Sixteen cases. Thirteen pass. Four fail, and they're all the same defect from
> four angles: the late-Sunday task, the timezone conversion, the double count
> at the boundary instant, and the previous period bleeding in.
>
> The other twelve pass on both builds on purpose — duplicate input, retry,
> partial failure, notification failure, account suspension, admin config.
> Those are the guardrails, so whoever changes this window next can't quietly
> break the things around it.

Run `IMPL=fixed npm test`.

> Seventeen, zero failures. The fix is UTC arithmetic and an exclusive upper
> bound — about two lines. Finding it was the work; changing it wasn't.

### 3:40–4:20 · What I'd ship around the fix

> Three things beyond the two lines.
>
> One, the suite runs under Seoul and a DST zone in CI, not just UTC — so a
> local-time date constructor fails in CI instead of in production.
>
> Two, a paid-task-ID guard. There's a test showing it contains the double
> payment even with the window still broken. It's defence in depth, not a fix —
> it stops the money going out twice but it wouldn't have stopped the two users
> going unpaid.
>
> Three, the run prints its own window. That's the smallest change with the
> biggest operational payoff: "did Sunday count?" becomes a ten-second lookup
> instead of an engineer reading code.

### 4:20–4:50 · AI, and what I owned

> I used AI for scaffolding, for broadening the boundary-case list, and for
> drafting the docs. What I verified myself: every date against a calendar —
> the whole thing collapses if the 2nd isn't a Monday. The nine-hour arithmetic
> in both directions. And I predicted which four cases would fail *before*
> running anything, so that the run confirmed my understanding rather than
> supplying it.
>
> I also cut the invented impact numbers from my first draft. I have no
> incident data for this system, so there are no ticket counts anywhere in the
> submission.

### 4:50–5:00 · Close

> Everything's in the repo — intent, directive, business rules, sixteen cases,
> the defect report and the release checklist. Thanks for watching.

---

## Recording notes

- **Do not read this.** Talk from the beats. Reviewers can hear a script
- The money shot is the buggy demo output at 1:05. Pause on it
- Under five minutes is a hard limit. Cut section 3:40–4:20 first if you run long
- Show real terminal output, never a screenshot of it
- Confirm no employer data, credentials or keys are visible in any pane
