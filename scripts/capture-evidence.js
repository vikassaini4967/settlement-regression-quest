#!/usr/bin/env node
/**
 * Regenerates everything in results/ from a clean run, so the evidence linked
 * from directive.md is never hand-edited.
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
    // A non-zero exit is expected for the faulty build; keep its output.
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

// Gate 4: the corrected build must be independent of the runner's timezone.
// Asia/Seoul is the zone that produced the defect; America/New_York adds DST.
const TZ_MATRIX = ['UTC', 'Asia/Seoul', 'America/New_York'];

const files = {
  'tests-buggy.txt': header('buggy', 'regression suite') + capture(testArgs, 'buggy'),
  'tests-fixed.txt': header('fixed', 'regression suite') + capture(testArgs, 'fixed'),
  'demo-buggy.txt': header('buggy', 'single settlement run') + capture(demoArgs, 'buggy'),
  'demo-fixed.txt': header('fixed', 'single settlement run') + capture(demoArgs, 'fixed'),
  'tests-fixed-tz-matrix.txt': TZ_MATRIX.map(
    (tz) => header('fixed', 'regression suite', tz) + capture(testArgs, 'fixed', tz),
  ).join('\n'),
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

const summary = {
  capturedAt: new Date().toISOString(),
  node: process.version,
  buggy: summarise(files['tests-buggy.txt']),
  fixed: summarise(files['tests-fixed.txt']),
  fixedTimezoneMatrix: Object.fromEntries(
    TZ_MATRIX.map((tz) => [tz, summarise(capture(testArgs, 'fixed', tz))]),
  ),
};

writeFileSync(join(resultsDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log('wrote results/summary.json');
console.log(
  `\nbuggy: ${summary.buggy.pass}/${summary.buggy.tests} pass, ${summary.buggy.fail} fail` +
    `\nfixed: ${summary.fixed.pass}/${summary.fixed.tests} pass, ${summary.fixed.fail} fail`,
);
