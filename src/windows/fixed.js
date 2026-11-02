/**
 * CORRECTED settlement window (reference implementation).
 *
 * Implements rule R2 exactly: the period settled by a run at `runAt` is
 *   [ most recent Monday 00:00:00.000 UTC at or before runAt  -  7 days ,
 *     most recent Monday 00:00:00.000 UTC at or before runAt            )
 * Lower bound inclusive, upper bound exclusive. All arithmetic in UTC.
 *
 * Worked example — run at Tue 2026-11-03T09:00:00Z:
 *   end   = Mon 2026-11-02T00:00:00.000Z   (exclusive)
 *   start = Mon 2026-10-26T00:00:00.000Z   (inclusive)
 *   A task completed Sun 2026-11-01T23:59:59Z IS in this period.
 *   A task completed Mon 2026-11-02T00:00:00.000Z is NOT — it belongs to the
 *   next period, settled the following Tuesday.
 */

import { DAY_MS } from '../shared/rules.js';

/** Most recent Monday 00:00:00.000 UTC at or before `at`. Pure UTC math. */
function previousUtcMondayMidnight(at) {
  const utcDayStart = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  // getUTCDay(): 0 = Sunday .. 6 = Saturday. Shift so Monday = 0.
  const daysSinceMonday = (at.getUTCDay() + 6) % 7;
  return new Date(utcDayStart - daysSinceMonday * DAY_MS);
}

/**
 * @param {Date} runAt instant the settlement job fires
 * @returns {{periodId: string, start: Date, end: Date, contains: (t: Date) => boolean, label: string}}
 */
export function settlementWindow(runAt) {
  const end = previousUtcMondayMidnight(runAt);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  const periodId = `SETL-${start.toISOString().slice(0, 10)}`;

  return {
    periodId,
    start,
    end,
    // Lower bound inclusive, upper bound exclusive (R2).
    contains: (t) => t.getTime() >= start.getTime() && t.getTime() < end.getTime(),
    label: `[${start.toISOString()} , ${end.toISOString()})`,
  };
}

/** R4 says "at most once, ever", so the corrected build refuses repeat task IDs. */
export const guardAlreadyPaidTaskIds = true;

export const implementationName = 'fixed';
