/**
 * The settlement engine.
 *
 * One engine, two window implementations. The ONLY difference between the
 * faulty build and the corrected build is which `settlementWindow` is injected,
 * which is also the honest shape of the root cause: SETL-001 lives entirely
 * inside the window function, and the fix is a change to that function.
 *
 * Order of operations matters and is asserted by the test suite:
 *   1. select tasks whose completedAt falls in the period        (R2)
 *   2. drop duplicate task IDs within the run                    (R4)
 *   3. drop users already settled for this period (idempotency)  (R4)
 *   4. hold users whose account is not payable
 *   5. commit the ledger entry                                   -- money moves here
 *   6. ONLY THEN attempt the notification                        (R5)
 *   7. a notification failure is recorded, never unwound         (R6)
 */

import { defaultAdminConfig, ELIGIBLE_TASK_STATUS, PAYABLE_ACCOUNT_STATUS } from './rules.js';

/**
 * @param {object} args
 * @param {ReturnType<import('./store.js').createStore>} args.store
 * @param {Date} args.runAt
 * @param {(runAt: Date) => any} args.settlementWindow injected window implementation
 * @param {object} [args.adminConfig]
 * @param {boolean} [args.guardAlreadyPaidTaskIds]
 *   Defence-in-depth control recommended by the SETL-001 root-cause analysis.
 *   Defaults to false, which is the behaviour that was in production: the only
 *   idempotency guard was per (period, user), so a task dragged into a second
 *   period by a bad window boundary was paid twice. Turning it on refuses to
 *   pay a task ID that any earlier ledger entry already covered.
 */
export function runSettlement({
  store,
  runAt,
  settlementWindow,
  adminConfig = defaultAdminConfig(),
  guardAlreadyPaidTaskIds = false,
}) {
  const period = settlementWindow(runAt);
  const creditsPerTask = adminConfig.creditsPerTask;

  const result = {
    runAt: runAt.toISOString(),
    periodId: period.periodId,
    window: { start: period.start.toISOString(), end: period.end.toISOString(), label: period.label },
    status: 'SUCCESS',
    payouts: [],
    held: [],
    skipped: [],
    failures: [],
    notifications: [],
    duplicateTaskIdsDropped: [],
    alreadyPaidTaskIdsDropped: [],
    totals: { usersPaid: 0, creditsPaid: 0 },
  };

  // --- 1. select by period -------------------------------------------------
  const inPeriod = store.tasks.filter(
    (t) => t.status === ELIGIBLE_TASK_STATUS && period.contains(new Date(t.completedAt)),
  );

  // --- 2. de-duplicate task IDs within the run (R4) ------------------------
  const alreadyPaid = guardAlreadyPaidTaskIds ? store.paidTaskIds() : new Set();
  const seenTaskIds = new Set();
  /** @type {Map<string, string[]>} */
  const tasksByUser = new Map();

  for (const task of inPeriod) {
    if (seenTaskIds.has(task.taskId)) {
      result.duplicateTaskIdsDropped.push(task.taskId);
      continue;
    }
    if (alreadyPaid.has(task.taskId)) {
      result.alreadyPaidTaskIdsDropped.push(task.taskId);
      continue;
    }
    seenTaskIds.add(task.taskId);
    if (!tasksByUser.has(task.userId)) tasksByUser.set(task.userId, []);
    tasksByUser.get(task.userId).push(task.taskId);
  }

  // Deterministic ordering so partial-failure runs are reproducible.
  const userIds = [...tasksByUser.keys()].sort();

  for (const userId of userIds) {
    const taskIds = tasksByUser.get(userId);
    const credits = taskIds.length * creditsPerTask;
    const idempotencyKey = `${period.periodId}:${userId}`;

    // --- 3. already settled for this period (retry safety, R4) -------------
    if (store.hasSettled(idempotencyKey)) {
      result.skipped.push({ userId, reason: 'ALREADY_SETTLED_FOR_PERIOD', idempotencyKey });
      continue;
    }

    // --- 4. account state --------------------------------------------------
    const user = store.users.get(userId);
    if (!user) {
      result.held.push({ userId, reason: 'UNKNOWN_ACCOUNT', taskIds });
      continue;
    }
    if (user.status !== PAYABLE_ACCOUNT_STATUS) {
      result.held.push({ userId, reason: `ACCOUNT_${user.status}`, taskIds });
      continue;
    }

    // --- 5. commit the payout ----------------------------------------------
    try {
      store.writeLedger({ idempotencyKey, userId, periodId: period.periodId, credits, taskIds });
    } catch (error) {
      result.status = 'PARTIAL_FAILURE';
      result.failures.push({ userId, reason: 'LEDGER_WRITE_FAILED', error: error.message, taskIds });
      continue; // no payout => no notification (R5)
    }

    result.payouts.push({ userId, credits, taskIds });
    result.totals.usersPaid += 1;
    result.totals.creditsPaid += credits;

    // --- 6/7. notify after commit; never unwind on failure (R5, R6) --------
    if (!adminConfig.notificationsEnabled) {
      const record = { userId, periodId: period.periodId, credits, status: 'SUPPRESSED_BY_ADMIN' };
      store.recordNotification(record);
      result.notifications.push(record);
      continue;
    }

    try {
      store.sendNotification({ userId, periodId: period.periodId, credits });
      const record = { userId, periodId: period.periodId, credits, status: 'SENT' };
      store.recordNotification(record);
      result.notifications.push(record);
    } catch (error) {
      const record = {
        userId,
        periodId: period.periodId,
        credits,
        status: 'PENDING_RETRY',
        error: error.message,
      };
      store.recordNotification(record);
      result.notifications.push(record);
      // Deliberately NOT rethrown and NOT rolled back. The payout stands (R6).
    }
  }

  return result;
}
