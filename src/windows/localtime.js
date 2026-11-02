/**
 * LOCAL-TIME regression: the corrected window with one mistake put back.
 *
 * buggy.js models the shift as a constant so it reproduces on any machine. This
 * module writes the mistake the way a person would, with local-time date
 * methods, so its behaviour depends on the host timezone:
 *
 *   TZ=UTC               every test passes, the mistake is invisible
 *   TZ=Asia/Seoul        boundaries move 9 hours early, the suite fails
 *   TZ=America/New_York  boundaries move 5 hours late, the suite fails
 *
 * It exists to prove Gate 4: a suite that only ever runs under UTC would ship
 * this. It is not part of any release, only of the evidence.
 */

import { DAY_MS } from '../shared/rules.js';

/** Looks correct, and is, on any host that happens to run UTC. */
function previousLocalMondayMidnight(at) {
  const daysSinceMonday = (at.getDay() + 6) % 7;
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() - daysSinceMonday);
}

export function settlementWindow(runAt) {
  const end = previousLocalMondayMidnight(runAt);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  const periodId = `SETL-${start.toISOString().slice(0, 10)}`;

  return {
    periodId,
    start,
    end,
    contains: (t) => t.getTime() >= start.getTime() && t.getTime() < end.getTime(),
    label: `[${start.toISOString()} , ${end.toISOString()})`,
  };
}

export const guardAlreadyPaidTaskIds = true;

export const implementationName = 'localtime';
