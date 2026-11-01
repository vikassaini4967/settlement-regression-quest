/**
 * Selects which build is under test.
 *
 *   IMPL=buggy  -> the faulty window (defect SETL-001 present)
 *   IMPL=fixed  -> the corrected window (default)
 *
 * Everything else in the system is identical between the two builds.
 */

import * as fixed from './windows/fixed.js';
import * as buggy from './windows/buggy.js';

const requested = (process.env.IMPL ?? 'fixed').toLowerCase();

if (!['fixed', 'buggy'].includes(requested)) {
  throw new Error(`IMPL must be "fixed" or "buggy", got "${process.env.IMPL}"`);
}

const selected = requested === 'buggy' ? buggy : fixed;

export const settlementWindow = selected.settlementWindow;
export const implementationName = selected.implementationName;
export const isBuggyBuild = requested === 'buggy';
