import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTs } from './helpers/startos.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('1.18.1:3 prepares a wrapper-only revision with a no-write upgrade', async () => {
  const { versionGraph: graph } = loadTs('startos/versions/index.ts');
  assert.equal(graph.current.options.version, '1.18.1:3');
  const { v1_18_1_2 } = loadTs('startos/versions/v1_18_1_2.ts');
  const { previous } = loadTs('startos/versions/previous.ts');
  assert.equal(v1_18_1_2.options.version, '1.18.1:2');
  assert.equal(previous.options.version, '1.18.1:1');
  let version = '1.18.1:2';
  const calls = [];
  const effects = {
    getDataVersion: async () => {
      calls.push('getDataVersion');
      return version;
    },
    setDataVersion: async ({ version: next }) => {
      calls.push(`setDataVersion:${next}`);
      version = next;
    },
  };
  await graph.init(effects);
  assert.equal(version, '1.18.1:3');
  assert.deepEqual(calls, ['getDataVersion', 'setDataVersion:1.18.1:3']);
});

test('1.18.1:3 can roll back data metadata to 1.18.1:2 without data writes', async () => {
  const { versionGraph: graph } = loadTs('startos/versions/index.ts');
  assert.equal(typeof graph.current.options.migrations.down, 'function');
  let version = '1.18.1:3';
  const calls = [];
  const effects = {
    getDataVersion: async () => {
      calls.push('getDataVersion');
      return version;
    },
    setDataVersion: async ({ version: next }) => {
      calls.push(`setDataVersion:${next}`);
      version = next;
    },
  };
  const previous = graph.currentVersion().constructor.parse('1.18.1:2');
  await graph.uninit(effects, previous);
  assert.equal(version, '1.18.1:2');
  assert.deepEqual(calls, [
    'getDataVersion',
    'setDataVersion:1.18.1:2',
    'setDataVersion:1.18.1:2',
  ]);
});

test('P1 pins the reviewed patched image by immutable index digest', async () => {
  assert.equal((await read('Dockerfile')).split('\n')[0], 'FROM ghcr.io/bitcoinrph/camofox-browser:1.18.1-startos.1@sha256:e545da36937765eaf2480e07e81aeaf97c13589d7531ea77152b723319b0daaf');
});

test('1.18.1:3 manifest and release notes identify the unchanged runtime honestly', async () => {
  const manifest = await read('startos/manifest/index.ts');
  const version = await read('startos/versions/current.ts');
  assert.match(
    manifest,
    /upstreamRepo:\s*'https:\/\/github\.com\/bitcoinRph\/camofox-browser-startos\/tree\/master\/browser'/,
  );
  assert.match(version, /pinned runtime image is unchanged/);
  assert.match(version, /Additional browser-source changes are not yet in that image/);
});

test('StartOS Docker context excludes source and benchmark subtrees', async () => {
  const ignored = new Set((await read('.dockerignore')).split(/\r?\n/).filter(Boolean));
  for (const path of ['browser', 'benchmark', 'tests', 'docs', 'startos']) {
    assert.ok(ignored.has(path), `${path} must not enter the runtime build context`);
  }
});
