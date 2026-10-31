/** Decode persisted-query column lists without trusting malformed graph responses. */
/** Return only list-node columns; malformed responses and graph errors fail closed. */
export function parseColumns(json) {
  if (!json || json.errors?.length) {
    return {};
  }
  const edges = (json.data?.customQuery ?? json.data?.cypherQuery)?.edges;
  if (!Array.isArray(edges)) {
    return {};
  }
  const result = {};
  for (const edge of edges) {
    const columns = edge?.node?.columns;
    if (!Array.isArray(columns)) {
      continue;
    }
    for (const column of columns) {
      if (typeof column?.key !== 'string' || !Array.isArray(column?.value?.nodes)) {
        continue;
      }
      const nodes = column.value.nodes.filter(node => node && typeof node === 'object');
      Object.defineProperty(
        result,
        column.key,
        {
          value: [
            ...(Object.hasOwn(result, column.key) ? result[column.key] : []),
            ...nodes
          ],
          enumerable: true,
          configurable: true,
          writable: true
        }
      );
    }
  }
  return result;
}
