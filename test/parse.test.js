import test from 'node:test';
import assert from 'node:assert/strict';
import { parseColumns } from '../src/graph/parse.js';
test(
  'parseColumns supports customQuery and rejects malformed inputs',
  () => {
    for (const value of [null, {}, {
      errors: [{}]
    }, {
      data: {
        customQuery: {
          edges: [null]
        }
      }
    }]) {
      assert.deepEqual(parseColumns(value), {});
    }
    const node = {
      id: '1',
      data: {}
    };
    assert.deepEqual(
      parseColumns({
        data: {
          customQuery: {
            edges: [
              {
                node: {
                  columns: [
                    {
                      key: 'builds',
                      value: {
                        nodes: [node, null]
                      }
                    },
                    {
                      key: 'builds',
                      value: {
                        nodes: [node]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }),
      {
        builds: [node, node]
      }
    );
  }
);
test(
  'parseColumns treats __proto__ as an ordinary column',
  () => {
    const node = {
      id: 'x'
    };
    const result = parseColumns({
      data: {
        customQuery: {
          edges: [{
            node: {
              columns: [{
                key: '__proto__',
                value: {
                  nodes: [node]
                }
              }]
            }
          }]
        }
      }
    });
    assert.deepEqual(result.__proto__, [node]);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
  }
);
