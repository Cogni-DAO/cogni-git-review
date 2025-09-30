import { test } from 'node:test';
import assert from 'node:assert';
import { evalCriteria } from '../../src/gates/cogni/rules.js';

const cases = [
  {
    name: 'gte pass',
    metrics: { cov: 85 },
    criteria: { require: [{ metric: 'cov', gte: 80 }] },
    expect: 'pass'
  },
  {
    name: 'missing -> neutral',
    metrics: {},
    criteria: { require: [{ metric: 'cov', gte: 80 }], neutral_on_missing_metrics: true },
    expect: 'neutral'
  },
  {
    name: 'lte fail',
    metrics: { bugs: 5 },
    criteria: { require: [{ metric: 'bugs', lte: 2 }] },
    expect: 'fail'
  }
];

for (const c of cases) {
  test(`evalCriteria: ${c.name}`, () => {
    const out = evalCriteria(c.metrics, c.criteria);
    assert.strictEqual(out.status, c.expect);
  });
}