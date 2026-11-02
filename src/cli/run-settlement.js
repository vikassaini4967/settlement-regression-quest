#!/usr/bin/env node
/**
 * Side-by-side demo of one settlement run, for the Loom walkthrough.
 *
 *   IMPL=buggy node src/cli/run-settlement.js
 *   IMPL=fixed node src/cli/run-settlement.js
 *
 * It settles one realistic week for four synthetic users and prints the window,
 * who got paid, who did not, and which alerts went out. The previous week was
 * settled correctly, so this is the first run after the build under test ships.
 * The difference between the two builds is visible in the output without
 * reading any test code.
 */

import { runSettlement } from '../shared/engine.js';
import { settlementWindow, engineOptions, implementationName } from '../impl.js';
import { createStore } from '../shared/store.js';
import { settlementWindow as correctWindow } from '../windows/fixed.js';

const PREVIOUS_RUN_AT = new Date('2026-10-27T09:00:00.000Z');
const RUN_AT = new Date('2026-11-03T09:00:00.000Z');

const TASKS = [
  // Ordinary mid-week work. Unaffected by the defect.
  { taskId: 'T-1001', userId: 'U-aisha', completedAt: '2026-10-28T10:00:00.000Z', status: 'COMPLETED' },
  { taskId: 'T-1002', userId: 'U-aisha', completedAt: '2026-10-29T14:00:00.000Z', status: 'COMPLETED' },
  { taskId: 'T-1003', userId: 'U-ben', completedAt: '2026-10-30T08:30:00.000Z', status: 'COMPLETED' },

  // "I finished it on Sunday night." Sun 23:10 UTC, inside the period.
  { taskId: 'T-1004', userId: 'U-chen', completedAt: '2026-11-01T23:10:00.000Z', status: 'COMPLETED' },

  // Sun 16:30 UTC = Mon 01:30 Asia/Seoul. Still inside the period in UTC.
  { taskId: 'T-1005', userId: 'U-dara', completedAt: '2026-11-01T16:30:00.000Z', status: 'COMPLETED' },

  // Late in the PREVIOUS period. Paid by the previous run, must not reappear.
  { taskId: 'T-0999', userId: 'U-ben', completedAt: '2026-10-25T20:00:00.000Z', status: 'COMPLETED' },
];

const USERS = ['U-aisha', 'U-ben', 'U-chen', 'U-dara'].map((userId) => ({ userId, status: 'ACTIVE' }));

const store = createStore({ tasks: TASKS, users: USERS });
runSettlement({ store, runAt: PREVIOUS_RUN_AT, settlementWindow: correctWindow });
const result = runSettlement({ store, runAt: RUN_AT, settlementWindow, ...engineOptions });

const line = '-'.repeat(72);
console.log(line);
console.log(`previous run     : ${PREVIOUS_RUN_AT.toISOString()} correct window, paid T-0999`);
console.log(`settlement run   : ${RUN_AT.toISOString()}`);
console.log(`build            : ${implementationName}`);
console.log(`period           : ${result.periodId}`);
console.log(`window           : ${result.window.label}`);
console.log(`intended window  : [2026-10-26T00:00:00.000Z , 2026-11-02T00:00:00.000Z)`);
console.log(line);

console.log('\nPAID');
if (result.payouts.length === 0) console.log('  (nobody)');
for (const p of result.payouts) {
  console.log(`  ${p.userId.padEnd(10)} ${String(p.credits).padStart(3)} cr   tasks: ${p.taskIds.join(', ')}`);
}

const unpaid = USERS.map((u) => u.userId).filter(
  (id) => !result.payouts.some((p) => p.userId === id),
);
console.log('\nNOT PAID THIS RUN');
if (unpaid.length === 0) console.log('  (nobody)');
for (const id of unpaid) console.log(`  ${id}`);

console.log('\nALERTS');
if (result.notifications.length === 0) console.log('  (none sent)');
for (const n of result.notifications) {
  console.log(`  ${n.userId.padEnd(10)} ${n.status}`);
}

const paidTaskIds = store.ledger.flatMap((e) => e.taskIds);
const paidTwice = [...new Set(paidTaskIds.filter((id, i) => paidTaskIds.indexOf(id) !== i))];
console.log('\nTASKS PAID MORE THAN ONCE');
if (paidTwice.length === 0) console.log('  (none)');
for (const id of paidTwice) console.log(`  ${id}`);

console.log(`\ntotals           : ${result.totals.usersPaid} users, ${result.totals.creditsPaid} credits`);
console.log(`status           : ${result.status}`);
console.log(line);
