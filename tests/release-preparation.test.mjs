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

test('P1 leaves the upstream Docker image pin unchanged', async () => {
  assert.equal((await read('Dockerfile')).split('\n')[0], 'FROM ghcr.io/jo-inc/camofox-browser:1.18.1@sha256:cff2c1432b609bde9c9d0b91e5b924dae0799d3c7bc9d468c0bc949325beaf2a');
});
