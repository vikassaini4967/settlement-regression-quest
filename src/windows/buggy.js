/**
 * FAULTY settlement window — this is defect SETL-001.
 *
 * This module reproduces, in a deterministic fixture, two mistakes made
 * together. The service is fictional, so neither has any incident history:
 *
 *   B1  The "Monday 00:00" boundaries were built from Seoul wall-clock midnight
 *       (the team's local time, KST = UTC+9) and then compared against task
 *       timestamps, which are true UTC instants. Monday 00:00 KST is Sunday
 *       15:00 UTC, so every boundary sits 9 hours EARLY.
 *
 *   B2  The upper bound is compared with <= instead of <, making the period
 *       end inclusive. Combined with the inclusive lower bound, an instant that
 *       lands exactly on a boundary belongs to two consecutive periods.
 *
 * The +9h shift is what local-time date construction (`new Date(y, m, d)` on a
 * host running TZ=Asia/Seoul) produces. It is modelled here as an explicit
 * offset constant so the fixture reproduces identically on any machine and in
 * CI, regardless of the runner's TZ. src/windows/localtime.js has the real
 * construction.
 *
 * Net effect of B1 + B2 on a run at Tue 2026-11-03T09:00:00Z:
 *   intended : [Mon 2026-10-26T00:00:00Z , Mon 2026-11-02T00:00:00Z)
 *   actual   : [Sun 2026-10-25T15:00:00Z , Sun 2026-11-01T15:00:00Z]
 *
 * Tasks in the last 9 hours of a period land in the wrong week. What that does
 * to money depends on which window ran the week before:
 *   faulty then faulty    the band is paid one week late, once
 *   correct then faulty   the band is paid twice (the fault ships)
 *   faulty then correct   the band is never paid (the fix ships) until
 *                         reconciliation pays it, see src/shared/reconcile.js
 */

import { DAY_MS, HOUR_MS } from '../shared/rules.js';

/** Hours the boundary is shifted by. KST (Asia/Seoul) is UTC+9, no DST. */
const SEOUL_UTC_OFFSET_HOURS = 9;

function previousMondayMidnight(at) {
  const utcDayStart = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const daysSinceMonday = (at.getUTCDay() + 6) % 7;
  return new Date(utcDayStart - daysSinceMonday * DAY_MS);
}

export function settlementWindow(runAt) {
  // B1: boundaries anchored to Seoul midnight, then used as if they were UTC.
  const shift = SEOUL_UTC_OFFSET_HOURS * HOUR_MS;
  const end = new Date(previousMondayMidnight(runAt).getTime() - shift);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  const periodId = `SETL-${new Date(start.getTime() + shift).toISOString().slice(0, 10)}`;

  return {
    periodId,
    start,
    end,
    // B2: upper bound inclusive.
    contains: (t) => t.getTime() >= start.getTime() && t.getTime() <= end.getTime(),
    label: `[${start.toISOString()} , ${end.toISOString()}]`,
  };
}

/** Before the fix the only idempotency guard was per (period, user). */
export const guardAlreadyPaidTaskIds = false;

export const implementationName = 'buggy';
