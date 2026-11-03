/** Query registration and execution contracts stay aligned with verified TWG documentation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_QUERY, PERSISTED_QUERIES, curatedQuery, FIELDS } from '../src/graph/queries.js';
test(
  'persisted queries use ARI parameter arrays and precise relationship documentation',
  () => {
    for (const query of PERSISTED_QUERIES) {
      assert.deepEqual(query.paramsSchema, [{
        name: 'id',
        type: 'ARI',
        required: true
      }]);
      const relationship = query.cypher.match(/\[:([a-z_]+)\]/)[1];
      assert.equal(
        query.docUrl,
        'https://developer.atlassian.com/platform/teamwork-graph/api-reference/relationship-types/' + relationship.replaceAll('_', '-') + '/'
      );
    }
  }
);
test(
  'custom query key uses the official String! contract',
  () => {
    assert.match(CUSTOM_QUERY, /\$queryKey: String!/);
    assert.doesNotMatch(CUSTOM_QUERY, /\$queryKey: ID!/);
  }
);

 test('every graph operation meets the gateway naming contract', () => {
  for (const query of [CUSTOM_QUERY, ...Object.keys(FIELDS).map(curatedQuery)]) {
    const names = [...query.matchAll(/\b(?:query|mutation|subscription)\s+(\w+)/g)].map(match => match[1]);
    assert.ok(names.length > 0);
    for (const name of names) {
      assert.match(name, /^[A-Za-z0-9]{3,}_[A-Za-z0-9]{4,}$/);
      assert.ok(name.length <= 100);
    }
  }
});
