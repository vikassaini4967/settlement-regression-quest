/**
 * Regression suite for the weekly rewards settlement flow.
 *
 *   IMPL=buggy npm test   -> the four SETL-001 regression cases FAIL
 *   IMPL=fixed npm test   -> everything passes
 *
 * Cases tagged [SETL-001] are the regression gate for the defect that was
 * selected for deep work. The rest are coverage for the surrounding flow and
 * pass on both builds — they exist so that a future fix to the window cannot
 * quietly break duplicate handling, retries, partial failure or notifications.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { runSettlement } from '../src/shared/engine.js';
import { settlementWindow, implementationName } from '../src/impl.js';
import { defaultAdminConfig } from '../src/shared/rules.js';
import {
  RUN_WEEK_A,
  RUN_WEEK_B,
  PERIOD_A,
  PERIOD_B,
  MIDWEEK_1,
  MIDWEEK_2,
  MIDWEEK_3,
  WINDOW_START_EXACT,
  WINDOW_END_EXACT,
  LATE_SUNDAY_UTC,
  SUNDAY_1630_UTC,
  SEOUL_MIDNIGHT_UTC,
  PRIOR_PERIOD_LATE,
  task,
  user,
  storeWith,
} from './fixtures.js';

/** Runs settlement against whichever build IMPL selected. */
function run(store, runAt, options = {}) {
  return runSettlement({ store, runAt, settlementWindow, ...options });
}

test(`build under test: ${implementationName}`, () => {
  assert.ok(['fixed', 'buggy'].includes(implementationName));
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test('TC-01 happy path: three qualifying tasks pay 30 credits and notify once', () => {
  const store = storeWith([
    task('T-1', 'U1', MIDWEEK_1),
    task('T-2', 'U1', MIDWEEK_2),
    task('T-3', 'U1', MIDWEEK_3),
  ]);

  const result = run(store, RUN_WEEK_A);

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.periodId, PERIOD_A);
  assert.equal(result.payouts.length, 1);
  assert.equal(store.creditsFor('U1'), 30);
  assert.equal(store.ledgerFor('U1').length, 1, 'one ledger entry per user per period');
  assert.deepEqual(
    store.notificationsFor('U1').map((n) => n.status),
    ['SENT'],
  );
});

test('TC-02 multi-user: credits are grouped per user, one ledger entry each', () => {
  const store = storeWith([
    task('T-1', 'U1', MIDWEEK_1),
    task('T-2', 'U2', MIDWEEK_1),
    task('T-3', 'U2', MIDWEEK_2),
  ]);

  const result = run(store, RUN_WEEK_A);

  assert.equal(result.totals.usersPaid, 2);
  assert.equal(result.totals.creditsPaid, 30);
  assert.equal(store.creditsFor('U1'), 10);
  assert.equal(store.creditsFor('U2'), 20);
  assert.equal(store.ledger.length, 2);
});

// ---------------------------------------------------------------------------
// Period boundaries
// ---------------------------------------------------------------------------

test('TC-03 cut-off boundary: a task at exactly Monday 00:00 UTC belongs to the NEXT period', () => {
  const store = storeWith([task('T-1', 'U1', WINDOW_END_EXACT)]);

  const first = run(store, RUN_WEEK_A);
  assert.equal(first.payouts.length, 0, 'upper bound is exclusive');
  assert.equal(store.creditsFor('U1'), 0);

  const second = run(store, RUN_WEEK_B);
  assert.equal(second.periodId, PERIOD_B);
  assert.equal(store.creditsFor('U1'), 10, 'paid exactly once, in the following period');
});

test('TC-04 cut-off boundary: a task at exactly the period start IS included', () => {
  const store = storeWith([task('T-1', 'U1', WINDOW_START_EXACT)]);

  run(store, RUN_WEEK_A);

  assert.equal(store.creditsFor('U1'), 10, 'lower bound is inclusive');
});

test('TC-05 [SETL-001] a task completed late Sunday UTC is settled on the next Tuesday', () => {
  const store = storeWith([task('T-1', 'U1', LATE_SUNDAY_UTC)]);

  const result = run(store, RUN_WEEK_A);

  assert.equal(
    store.creditsFor('U1'),
    10,
    'Sun 23:59:59Z is inside [Mon 00:00Z, Mon 00:00Z) and must be paid this run',
  );
  assert.equal(result.payouts.length, 1);
  assert.deepEqual(
    store.notificationsFor('U1').map((n) => n.status),
    ['SENT'],
    'a settled user must receive their settlement alert in the same run',
  );
});

test('TC-06 [SETL-001] timezone conversion: Sun 16:30 UTC (Mon 01:30 KST) is still this period', () => {
  const store = storeWith([task('T-1', 'U1', SUNDAY_1630_UTC)]);

  run(store, RUN_WEEK_A);

  assert.equal(
    store.creditsFor('U1'),
    10,
    'period boundaries are defined in UTC, not in the server or team local zone',
  );
});

test('TC-07 [SETL-001] no cross-period double count at the boundary instant', () => {
  const store = storeWith([task('T-1', 'U1', SEOUL_MIDNIGHT_UTC)]);

  run(store, RUN_WEEK_A);
  run(store, RUN_WEEK_B);

  assert.equal(store.creditsFor('U1'), 10, 'one task must never be paid in two periods');
  assert.equal(store.ledger.length, 1);
});

test('TC-08 [SETL-001] a task from the previous period is not dragged into this run', () => {
  const store = storeWith([task('T-1', 'U1', PRIOR_PERIOD_LATE)]);

  const result = run(store, RUN_WEEK_A);

  assert.equal(result.payouts.length, 0);
  assert.equal(store.creditsFor('U1'), 0, 'Sat/Sun of the prior week was settled a week ago');
});

// ---------------------------------------------------------------------------
// Duplicate input and retries
// ---------------------------------------------------------------------------

test('TC-09 duplicate input: the same task ID twice in the source data pays once', () => {
  const store = storeWith([
    task('T-1', 'U1', MIDWEEK_1),
    task('T-1', 'U1', MIDWEEK_2), // same task ID, re-emitted by the upstream job
  ]);

  const result = run(store, RUN_WEEK_A);

  assert.equal(store.creditsFor('U1'), 10);
  assert.deepEqual(result.duplicateTaskIdsDropped, ['T-1']);
});

test('TC-10 retry: re-running the same settlement does not create a second payout', () => {
  const store = storeWith([task('T-1', 'U1', MIDWEEK_1), task('T-2', 'U1', MIDWEEK_2)]);

  run(store, RUN_WEEK_A);
  const retry = run(store, RUN_WEEK_A);

  assert.equal(store.creditsFor('U1'), 20, 'credits unchanged by the retry');
  assert.equal(store.ledger.length, 1);
  assert.equal(retry.skipped.length, 1);
  assert.equal(retry.skipped[0].reason, 'ALREADY_SETTLED_FOR_PERIOD');
  assert.equal(store.notificationsFor('U1').length, 1, 'no duplicate settlement alert');
});

// ---------------------------------------------------------------------------
// Failure paths and recovery
// ---------------------------------------------------------------------------

test('TC-11 partial failure: one failed ledger write does not affect other users, and resumes', () => {
  const store = storeWith([
    task('T-1', 'U1', MIDWEEK_1),
    task('T-2', 'U2', MIDWEEK_1),
    task('T-3', 'U3', MIDWEEK_1),
  ]);
  store.failLedgerFor('U2');

  const first = run(store, RUN_WEEK_A);

  assert.equal(first.status, 'PARTIAL_FAILURE');
  assert.equal(store.creditsFor('U1'), 10);
  assert.equal(store.creditsFor('U3'), 10);
  assert.equal(store.creditsFor('U2'), 0);
  assert.equal(store.notificationsFor('U2').length, 0, 'no payout means no notification');
  assert.equal(first.failures[0].reason, 'LEDGER_WRITE_FAILED');

  store.clearFaults();
  const resumed = run(store, RUN_WEEK_A);

  assert.equal(resumed.status, 'SUCCESS');
  assert.equal(store.creditsFor('U2'), 10, 'the resumed run settles only the user that failed');
  assert.equal(store.creditsFor('U1'), 10, 'the already-paid user is untouched');
  assert.equal(store.ledger.length, 3);
});

test('TC-12 a notification failure does not reverse the committed payout', () => {
  const store = storeWith([task('T-1', 'U1', MIDWEEK_1)]);
  store.failNotificationFor('U1');

  const result = run(store, RUN_WEEK_A);

  assert.equal(store.creditsFor('U1'), 10, 'the payout stands');
  assert.equal(store.ledger.length, 1);
  assert.equal(result.status, 'SUCCESS', 'undelivered alerts are not a settlement failure');
  assert.deepEqual(
    store.notificationsFor('U1').map((n) => n.status),
    ['PENDING_RETRY'],
    'the failure is recorded for retry, not swallowed',
  );
});

// ---------------------------------------------------------------------------
// Account changes and admin configuration
// ---------------------------------------------------------------------------

test('TC-13 account change: a suspended user is held, then paid after reactivation', () => {
  const store = storeWith(
    [task('T-1', 'U1', MIDWEEK_1), task('T-2', 'U2', MIDWEEK_1)],
    [user('U1', 'ACTIVE'), user('U2', 'SUSPENDED')],
  );

  const first = run(store, RUN_WEEK_A);

  assert.equal(store.creditsFor('U1'), 10);
  assert.equal(store.creditsFor('U2'), 0);
  assert.equal(first.held[0].reason, 'ACCOUNT_SUSPENDED');
  assert.equal(store.notificationsFor('U2').length, 0);

  store.setAccountStatus('U2', 'ACTIVE');
  run(store, RUN_WEEK_A);

  assert.equal(store.creditsFor('U2'), 10, 'held credits are not lost');
});

test('TC-14 admin setting: credits per task is read from config, not hard-coded', () => {
  const store = storeWith([task('T-1', 'U1', MIDWEEK_1), task('T-2', 'U1', MIDWEEK_2)]);
  const adminConfig = { ...defaultAdminConfig(), creditsPerTask: 25 };

  run(store, RUN_WEEK_A, { adminConfig });

  assert.equal(store.creditsFor('U1'), 50);
});

test('TC-15 defence in depth: the paid-task-ID guard contains a bad window boundary', () => {
  // T-1 was completed late in the previous period and settled a week earlier.
  const store = storeWith([task('T-1', 'U1', PRIOR_PERIOD_LATE)]);
  run(store, new Date('2026-10-27T09:00:00.000Z'), { guardAlreadyPaidTaskIds: true });

  run(store, RUN_WEEK_A, { guardAlreadyPaidTaskIds: true });

  assert.equal(
    store.creditsFor('U1'),
    10,
    'with the guard on, a task already covered by a ledger entry is never paid again',
  );
});

test('TC-16 admin setting: disabling notifications suppresses the alert but still pays', () => {
  const store = storeWith([task('T-1', 'U1', MIDWEEK_1)]);
  const adminConfig = { ...defaultAdminConfig(), notificationsEnabled: false };

  run(store, RUN_WEEK_A, { adminConfig });

  assert.equal(store.creditsFor('U1'), 10);
  assert.deepEqual(
    store.notificationsFor('U1').map((n) => n.status),
    ['SUPPRESSED_BY_ADMIN'],
  );
});
