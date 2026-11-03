import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveDefaultExport, resolveNamedExport} from '../src/forgeInterop.js';

test('Forge Resolver default works under both CJS namespace shapes', () => {
  class Resolver {}
  for (const mod of [{default: Resolver}, {default: {default: Resolver}}]) {
    assert.ok(new (resolveDefaultExport(mod))() instanceof Resolver);
  }
  assert.equal(resolveDefaultExport({}), undefined);
});

test('Forge API named exports work under all three namespace shapes', () => {
  const asUser = () => ({});
  const route = (strings, value) => `${strings[0]}${value}${strings[1]}`;
  for (const mod of [
    {asUser, route},
    {default: {asUser, route}},
    {default: {default: {asUser, route}}}
  ]) {
    assert.equal(resolveNamedExport(mod, 'asUser'), asUser);
    const resolvedRoute = resolveNamedExport(mod, 'route');
    assert.equal(resolvedRoute, route);
    assert.equal(resolvedRoute`/issue/${123}`, '/issue/123');
  }
  assert.equal(resolveNamedExport({}, 'missing'), undefined);
});

test('named export resolution prefers the first defined value', () => {
  assert.equal(resolveNamedExport({value: null, default: {value: 1}}, 'value'), null);
  assert.equal(resolveNamedExport({value: undefined, default: {value: false, default: {value: 2}}}, 'value'), false);
  assert.equal(resolveNamedExport({default: {value: undefined, default: {value: 3}}}, 'value'), 3);
});

test('entry uses namespace imports and validates resolved Forge API functions', () => {
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(source, /import \* as resolverModule from '@forge\/resolver'/);
  assert.match(source, /import \* as forgeApiModule from '@forge\/api'/);
  for (const name of ['asUser', 'route']) {
    assert.ok(source.includes(`const ${name} = resolveNamedExport(forgeApiModule, '${name}')`));
    assert.ok(source.includes(`if (typeof ${name} !== 'function')`));
    assert.match(source, new RegExp(`throw new TypeError\\('@forge/api did not expose an? ${name}[^']*'\\)`));
  }
  assert.doesNotMatch(source, /import\s*\{[^}]*\}\s*from\s*['"]@forge\/api['"]/);
  assert.doesNotMatch(source, /import\s+\w+\s*(?:,\s*\{[^}]*\})?\s+from\s+['"]@forge\/(?:resolver|api)['"]/);
});

test('real installed Forge modules initialize the entry handler under Node', async () => {
  const {handler} = await import('../src/index.js');
  assert.equal(typeof handler, 'function');
});
