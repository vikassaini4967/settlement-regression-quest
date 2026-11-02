#!/usr/bin/env node
/**
 * What SETL-001 does to money across consecutive weeks, and what happens on the
 * week the fix ships.
 *
 *   node src/cli/run-cutover.js
 *
 * Three synthetic tasks, four timelines. It uses the faulty and corrected builds
 * directly, so IMPL has no effect here.
 */

import { runSettlement } from '../shared/engine.js';
import { createStore } from '../shared/store.js';
import { findUnpaidTasks, runReconciliation } from '../shared/reconcile.js';
import * as faulty from '../windows/buggy.js';
import * as correct from '../windows/fixed.js';

const TASKS = [
  // Sun 20:00 UTC, last 9 hours of the week of 10-19.
  { taskId: 'T-0999', userId: 'U-ben', completedAt: '2026-10-25T20:00:00.000Z', status: 'COMPLETED' },
  // Sun 16:30 and 23:10 UTC, last 9 hours of the week of 10-26.
  { taskId: 'T-1005', userId: 'U-dara', completedAt: '2026-11-01T16:30:00.000Z', status: 'COMPLETED' },
  { taskId: 'T-1004', userId: 'U-chen', completedAt: '2026-11-01T23:10:00.000Z', status: 'COMPLETED' },
];

const USERS = ['U-ben', 'U-chen', 'U-dara'].map((userId) => ({ userId, status: 'ACTIVE' }));

const WEEK_1 = '2026-10-27T09:00:00.000Z';
const WEEK_2 = '2026-11-03T09:00:00.000Z';
const WEEK_3 = '2026-11-10T09:00:00.000Z';

const paidTasks = (result) => result.payouts.flatMap((p) => p.taskIds).join(', ') || '(nobody)';

function timeline(title, steps, { reconcile = false } = {}) {
  const store = createStore({ tasks: TASKS, users: USERS });
  console.log(`\n${title}`);

  for (const [runAt, build] of steps) {
    const result = runSettlement({
      store,
      runAt: new Date(runAt),
      settlementWindow: build.settlementWindow,
      guardAlreadyPaidTaskIds: build.guardAlreadyPaidTaskIds,
    });
    const name = build === faulty ? 'faulty' : 'corrected';
    console.log(`  ${runAt.slice(0, 10)}  ${name.padEnd(13)} paid: ${paidTasks(result)}`);
  }

  if (reconcile) {
    const runAt = new Date(WEEK_3);
    const unpaid = findUnpaidTasks({ store, runAt }).map((t) => t.taskId);
    console.log(`  unpaid report                  : ${unpaid.join(', ') || '(none)'}`);
    const result = runReconciliation({ store, runAt });
    console.log(`  ${WEEK_3.slice(0, 10)}  reconciliation paid: ${paidTasks(result)}`);
  }

  const paid = store.ledger.flatMap((e) => e.taskIds);
  const counts = TASKS.map((t) => `${t.taskId} x${paid.filter((id) => id === t.taskId).length}`);
  console.log(`  times paid: ${counts.join('   ')}`);
}

timeline('A. Faulty window every week. Band paid a week late, nothing lost, nothing doubled.', [
  [WEEK_1, faulty],
  [WEEK_2, faulty],
  [WEEK_3, faulty],
]);

timeline('B. Fault ships after a correct run. T-0999 is paid twice.', [
  [WEEK_1, correct],
  [WEEK_2, faulty],
  [WEEK_3, faulty],
]);

timeline('C. Fix ships, no reconciliation. T-1004 and T-1005 are never paid.', [
  [WEEK_1, faulty],
  [WEEK_2, faulty],
  [WEEK_3, correct],
]);

timeline(
  'D. Fix ships, then reconciliation. Every task paid exactly once.',
  [
    [WEEK_1, faulty],
    [WEEK_2, faulty],
    [WEEK_3, correct],
  ],
  { reconcile: true },
);
