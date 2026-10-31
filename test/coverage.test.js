import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoverage, SOURCES } from '../src/engine/coverage.js';
for (const [node, expected] of [[0, 'low'], [2, 'low'], [3, 'medium'], [4, 'high'], [5, 'high']]) {
  test(
    `coverage with ${node} sources`,
    () => {
      const context = {
        coverage: Object.fromEntries(SOURCES.slice(0, node).map(key => [key, {
          available: true
        }]))
      };
      assert.equal(computeCoverage(context).confidence, expected);
      assert.equal(computeCoverage(context).fraction, node / 5);
    }
  );
}
