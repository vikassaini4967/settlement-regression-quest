#!/usr/bin/env node
/**
 * Regenerates everything in results/ from a clean run, so the evidence linked
 * from directive.md is never hand-edited, then checks the claims directive.md
 * makes about that evidence. Exits non-zero if any of them is no longer true.
 *
 *   node scripts/capture-evidence.js
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const resultsDir = join(root, 'results');
mkdirSync(resultsDir, { recursive: true });

function capture(args, impl, tz) {
  try {
    return execFileSync(process.execPath, args, {
      cwd: root,
      env: { ...process.env, IMPL: impl, ...(tz ? { TZ: tz } : {}) },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // A non-zero exit is expected for the faulty builds; keep its output.
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

const header = (impl, what, tz) =>
  [
    '='.repeat(72),
    `${what}  --  IMPL=${impl}${tz ? `  TZ=${tz}` : ''}`,
    `captured: ${new Date().toISOString()}`,
    `node:     ${process.version}`,
    '='.repeat(72),
    '',
  ].join('\n');

// The default reporter varies by Node version; summarise() below parses TAP.
const testArgs = ['--test', '--test-reporter=tap', 'tests/settlement.test.js'];
const demoArgs = ['src/cli/run-settlement.js'];
const cutoverArgs = ['src/cli/run-cutover.js'];

// Gate 4: the corrected build must be independent of the runner's timezone, and
// a real local-time regression must be caught. Asia/Seoul is the zone the
// defect is written against; America/New_York adds DST and the opposite sign.
const TZ_MATRIX = ['UTC', 'Asia/Seoul', 'America/New_York'];

const runMatrix = (impl) =>
  Object.fromEntries(
    TZ_MATRIX.map((tz) => [tz, header(impl, 'regression suite', tz) + capture(testArgs, impl, tz)]),
  );

const fixedByTz = runMatrix('fixed');
const localtimeByTz = runMatrix('localtime');

const files = {
  'tests-buggy.txt': header('buggy', 'regression suite') + capture(testArgs, 'buggy'),
  'tests-fixed.txt': header('fixed', 'regression suite') + capture(testArgs, 'fixed'),
  'demo-buggy.txt': header('buggy', 'single settlement run') + capture(demoArgs, 'buggy'),
  'demo-fixed.txt': header('fixed', 'single settlement run') + capture(demoArgs, 'fixed'),
  'demo-cutover.txt': header('n/a', 'consecutive weeks and cutover') + capture(cutoverArgs, 'fixed'),
  'tests-fixed-tz-matrix.txt': Object.values(fixedByTz).join('\n'),
  'tests-localtime-tz-matrix.txt': Object.values(localtimeByTz).join('\n'),
};

for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(resultsDir, name), content, 'utf8');
  console.log(`wrote results/${name}`);
}

// Small machine-readable summary for the handoff appendix.
const summarise = (text) => ({
  tests: Number(/^# tests (\d+)$/m.exec(text)?.[1] ?? 0),
  pass: Number(/^# pass (\d+)$/m.exec(text)?.[1] ?? 0),
  fail: Number(/^# fail (\d+)$/m.exec(text)?.[1] ?? 0),
  failing: [...text.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]),
});

const summariseMatrix = (byTz) =>
  Object.fromEntries(Object.entries(byTz).map(([tz, text]) => [tz, summarise(text)]));

const summary = {
  capturedAt: new Date().toISOString(),
  node: process.version,
  buggy: summarise(files['tests-buggy.txt']),
  fixed: summarise(files['tests-fixed.txt']),
  fixedTimezoneMatrix: summariseMatrix(fixedByTz),
  localtimeTimezoneMatrix: summariseMatrix(localtimeByTz),
};

writeFileSync(join(resultsDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log('wrote results/summary.json');
console.log(
  `\nbuggy: ${summary.buggy.pass}/${summary.buggy.tests} pass, ${summary.buggy.fail} fail` +
    `\nfixed: ${summary.fixed.pass}/${summary.fixed.tests} pass, ${summary.fixed.fail} fail`,
);

const caseIds = (run) => run.failing.map((name) => name.split(' ')[0]);
const allPass = (run) => run.tests > 0 && run.fail === 0;
const local = summary.localtimeTimezoneMatrix;

const checks = [
  ['faulty build fails exactly TC-05 to TC-08', caseIds(summary.buggy).join() === 'TC-05,TC-06,TC-07,TC-08'],
  ['corrected build passes', allPass(summary.fixed)],
  ['corrected build passes in every timezone', Object.values(summary.fixedTimezoneMatrix).every(allPass)],
  ['local-time regression is invisible under UTC', allPass(local.UTC)],
  ['local-time regression is caught under Asia/Seoul', local['Asia/Seoul'].fail > 0],
  ['local-time regression is caught under America/New_York', local['America/New_York'].fail > 0],
];

console.log('');
for (const [claim, holds] of checks) console.log(`${holds ? 'ok    ' : 'FAILED'} ${claim}`);

if (checks.some(([, holds]) => !holds)) process.exit(1);
