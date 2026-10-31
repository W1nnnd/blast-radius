/** Shared transport fixtures for TWG pagination and coverage tests. */
/** Build deterministic graph test data. */
export const connection = (nodes = [], next = false, cursor = null) => ({
  edges: nodes.map(node => ({
    node
  })),
  pageInfo: {
    hasNextPage: next,
    endCursor: cursor
  }
});
/** Build deterministic graph test data. */
export const custom = (column, nodes) => {
  return {
    data: {
      customQuery: {
        edges: [{
          node: {
            columns: [{
              key: column,
              value: {
                nodes
              }
            }]
          }
        }],
        pageInfo: {
          hasNextPage: false
        }
      }
    }
  };
};
/** Build deterministic graph test data. */
export const ref = {
  key: 'PAY-142',
  ari: 'ari:issue/142',
  summary: 'Refunds',
  status: {
    name: 'Done',
    statusCategory: {
      key: 'done'
    }
  }
};
