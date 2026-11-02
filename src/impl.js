/**
 * Selects which build is under test.
 *
 *   IMPL=fixed      -> the corrected build (default)
 *   IMPL=buggy      -> the faulty window, task-ID guard off (defect SETL-001)
 *   IMPL=localtime  -> the corrected build with local-time date construction;
 *                      only wrong when the host is not on UTC
 *
 * The engine is identical across builds. A build chooses the window and whether
 * the task-ID guard is on.
 */

import * as fixed from './windows/fixed.js';
import * as buggy from './windows/buggy.js';
import * as localtime from './windows/localtime.js';

const builds = { fixed, buggy, localtime };
const requested = (process.env.IMPL ?? 'fixed').toLowerCase();

if (!Object.hasOwn(builds, requested)) {
  throw new Error(
    `IMPL must be one of ${Object.keys(builds).join(', ')}, got "${process.env.IMPL}"`,
  );
}

const selected = builds[requested];

export const settlementWindow = selected.settlementWindow;
export const engineOptions = { guardAlreadyPaidTaskIds: selected.guardAlreadyPaidTaskIds };
export const implementationName = selected.implementationName;
export const isBuggyBuild = requested === 'buggy';
