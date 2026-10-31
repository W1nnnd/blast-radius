import { RISK_CASES } from './riskCases.js';
import { run, has } from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
for (const [name, context, id, points] of RISK_CASES) {
  test(
    `risk signal: ${name}`,
    () => {
      const result = run(context);
      assert.equal(has(result, id)?.points, points);
      assert.ok(has(result, id).evidence[0].id);
    }
  );
}
