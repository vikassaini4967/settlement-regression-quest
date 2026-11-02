/**
 * Reconciliation: finds and pays eligible tasks that no weekly run will reach.
 *
 * A weekly run only looks at one period, so a task it misses is not retried by
 * the next run: the window has moved on. Four things leave a task behind:
 *
 *   - the SETL-001 fix shipping (the last faulty window stopped at Sun 15:00 UTC,
 *     the first corrected one starts at Mon 00:00 UTC, nothing covers the gap)
 *   - an account held when its period settled (R7)
 *   - a ledger write that failed and was not re-run before the next Tuesday
 *   - a task that arrived after its user was settled for the period
 *
 * Reconciliation is settlement with a wider window, so account holds, ledger
 * commit and notification ordering all behave as they do in a weekly run. The
 * task-ID guard is forced on: it is what makes the wider window safe. Run it
 * after the weekly run for the same week.
 */

import { runSettlement } from './engine.js';
import { ELIGIBLE_TASK_STATUS } from './rules.js';
import { settlementWindow } from '../windows/fixed.js';

/** Everything before the end of the last closed period. Always the UTC boundary. */
function catchUpWindow(runAt) {
  const { end } = settlementWindow(runAt);

  return {
    periodId: `RECON-${end.toISOString().slice(0, 10)}`,
    start: new Date(0),
    end,
    contains: (t) => t.getTime() < end.getTime(),
    label: `[all earlier tasks , ${end.toISOString()})`,
  };
}

/** Read-only. Eligible tasks from closed periods that no ledger entry covers. */
export function findUnpaidTasks({ store, runAt }) {
  const window = catchUpWindow(runAt);
  const paid = store.paidTaskIds();

  return store.tasks.filter(
    (t) =>
      t.status === ELIGIBLE_TASK_STATUS &&
      window.contains(new Date(t.completedAt)) &&
      !paid.has(t.taskId),
  );
}

export function runReconciliation({ store, runAt, adminConfig }) {
  return runSettlement({
    store,
    runAt,
    settlementWindow: catchUpWindow,
    adminConfig,
    guardAlreadyPaidTaskIds: true,
  });
}
