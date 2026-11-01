/**
 * Shared fixture data and the canonical instants the test suite reasons about.
 *
 * Everything is pinned to real 2026 calendar dates so the assertions can be
 * checked by hand against a calendar:
 *   Sun 2026-11-01 | Mon 2026-11-02 | Tue 2026-11-03
 *   Mon 2026-10-26 is exactly 7 days before Mon 2026-11-02.
 */

import { createStore } from '../src/shared/store.js';

// ---- settlement runs --------------------------------------------------------
/** Tuesday 09:00 UTC. Settles [2026-10-26T00:00Z, 2026-11-02T00:00Z). */
export const RUN_WEEK_A = new Date('2026-11-03T09:00:00.000Z');
/** The following Tuesday. Settles [2026-11-02T00:00Z, 2026-11-09T00:00Z). */
export const RUN_WEEK_B = new Date('2026-11-10T09:00:00.000Z');

export const PERIOD_A = 'SETL-2026-10-26';
export const PERIOD_B = 'SETL-2026-11-02';

// ---- instants ---------------------------------------------------------------
/** Safely mid-period. Inside the intended window and inside the faulty one. */
export const MIDWEEK_1 = '2026-10-28T10:00:00.000Z';
export const MIDWEEK_2 = '2026-10-29T14:00:00.000Z';
export const MIDWEEK_3 = '2026-10-30T08:30:00.000Z';

/** Exactly the inclusive lower bound of period A. */
export const WINDOW_START_EXACT = '2026-10-26T00:00:00.000Z';
/** Exactly the exclusive upper bound of period A — belongs to period B. */
export const WINDOW_END_EXACT = '2026-11-02T00:00:00.000Z';

/** One second before the period closes. The "I finished on Sunday" case. */
export const LATE_SUNDAY_UTC = '2026-11-01T23:59:59.000Z';
/** Sunday 16:30 UTC = Monday 01:30 in Asia/Seoul. Timezone-conversion case. */
export const SUNDAY_1630_UTC = '2026-11-01T16:30:00.000Z';
/** Sunday 15:00 UTC = Monday 00:00 in Asia/Seoul. The faulty boundary itself. */
export const SEOUL_MIDNIGHT_UTC = '2026-11-01T15:00:00.000Z';
/** Late in the PREVIOUS period. Already settled a week earlier. */
export const PRIOR_PERIOD_LATE = '2026-10-25T20:00:00.000Z';

// ---- helpers ----------------------------------------------------------------
export function task(taskId, userId, completedAt, overrides = {}) {
  return { taskId, userId, completedAt, status: 'COMPLETED', ...overrides };
}

export function user(userId, status = 'ACTIVE') {
  return { userId, status };
}

export function storeWith(tasks, users) {
  const derivedUsers =
    users ?? [...new Set(tasks.map((t) => t.userId))].map((id) => user(id));
  return createStore({ tasks, users: derivedUsers });
}
