import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTs } from './helpers/startos.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('P1 prepares a wrapper-only revision with a no-write upgrade', async () => {
  const { versionGraph: graph } = loadTs('startos/versions/index.ts');
  assert.equal(graph.current.options.version, '1.18.1:2');
  let version = '1.18.1:1';
  const effects = {
    getDataVersion: async () => version,
    setDataVersion: async ({ version: next }) => { version = next; },
  };
  await graph.init(effects);
  assert.equal(version, '1.18.1:2');
});

test('P1 can roll back data metadata to the previous wrapper revision without data writes', async () => {
  const { versionGraph: graph } = loadTs('startos/versions/index.ts');
  assert.equal(typeof graph.current.options.migrations.down, 'function');
  let version = '1.18.1:2';
  const effects = {
    getDataVersion: async () => version,
    setDataVersion: async ({ version: next }) => { version = next; },
  };
  const previous = graph.currentVersion().constructor.parse('1.18.1:1');
  await graph.uninit(effects, previous);
  assert.equal(version, '1.18.1:1');
});

test('P1 pins the reviewed patched image by immutable index digest', async () => {
  assert.equal((await read('Dockerfile')).split('\n')[0], 'FROM ghcr.io/bitcoinrph/camofox-browser:1.18.1-startos.1@sha256:e545da36937765eaf2480e07e81aeaf97c13589d7531ea77152b723319b0daaf');
});

test('P1 manifest and release notes identify the patched runtime honestly', async () => {
  const manifest = await read('startos/manifest/index.ts');
  const version = await read('startos/versions/current.ts');
  assert.match(manifest, /upstreamRepo: 'https:\/\/github\.com\/bitcoinRph\/camofox-browser-startos\/tree\/master\/browser'/);
  assert.match(version, /handle direct-download navigation/);
  assert.doesNotMatch(version, /upstream image are unchanged|No browser-engine fixes/);
});

test('StartOS Docker context excludes source and benchmark subtrees', async () => {
  const ignored = new Set((await read('.dockerignore')).split(/\r?\n/).filter(Boolean));
  for (const path of ['browser', 'benchmark', 'tests', 'docs', 'startos']) {
    assert.ok(ignored.has(path), `${path} must not enter the runtime build context`);
  }
});
