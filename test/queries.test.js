/** Query registration and execution contracts stay aligned with verified TWG documentation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_QUERY, PERSISTED_QUERIES } from '../src/graph/queries.js';
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
