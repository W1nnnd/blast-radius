/** Manifest wiring and verified scopes stay aligned with action exports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test(
  'manifest action references and handler exports are coherent',
  () => {
    const manifest = readFileSync(new URL('../manifest.yml', import.meta.url), 'utf8');
    const actionSection = manifest.split('  action:')[1].split('  rovo:agent:')[0];
    const keys = [...actionSection.matchAll(/    - key: ([\w-]+)/g)].map(m => m[1]);
    assert.equal(keys.length, 4);
    for (const key of keys) {
      assert.ok(key.length < 64);
      for (const section of ['rovo:agent', 'rovo:mcp']) {
        assert.ok(manifest.split(`  ${section}:`)[1].split(/\n  [a-z]/)[0].includes(`- ${key}`));
      }
    }
    const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
    for (const match of manifest.matchAll(/handler: index\.(\w+)/g)) {
      assert.ok(new RegExp(`export (?:async function ${match[1]}|const ${match[1]})`).test(index));
    }
    assert.equal((actionSection.match(/actionVerb: GET/g) ?? []).length, 4);
    assert.ok(manifest.split('  rovo:mcp:')[1].match(/name: (.+)/)[1].length <= 30);
    assert.doesNotMatch(manifest, /rovo:skill/);
    const schema = readFileSync(new URL('../docs/TWG_VERIFIED_SCHEMA.md', import.meta.url), 'utf8');
    for (const scope of new Set(schema.match(/read:graph:[\w-]+:[\w-]+/g))) {
      assert.ok(manifest.includes(`- ${scope}`), scope);
    }
  }
);
