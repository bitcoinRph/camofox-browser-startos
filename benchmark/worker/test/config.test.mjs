import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { forbiddenOutbound } from './harness.mjs';

test('deployment configuration keeps the Free-plan fixture unrouted and observability disabled', () => {
  const path = new URL('../wrangler.toml', import.meta.url);
  assert.ok(existsSync(path), 'deployment manifest exists');
  const config = readFileSync(path, 'utf8');
  assert.match(config, /^name = "camofox-botlab-fixture"$/m);
  assert.match(config, /^main = "src\/index.mjs"$/m);
  assert.match(config, /^workers_dev = false$/m);
  assert.match(config, /^preview_urls = false$/m);
  assert.match(config, /\[observability\]\s+enabled = false/);
  assert.doesNotMatch(config, /^\s*(routes?|account_id|zone_id|kv_namespaces|durable_objects|d1_databases|r2_buckets|queues|analytics_engine_datasets|logfwdr|tail_consumers)\s*=/m);
  assert.doesNotMatch(config, /TURNSTILE_SECRET\s*=|TRIAL_NONCE_SECRET\s*=/);
});

test('production source has no logging, storage, or inbound credential/IP capture', () => {
  const source = readFileSync(new URL('../src/index.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /console\s*\.|\.waitUntil\s*\(|\.put\s*\(|cf-connecting-ip|x-forwarded-for|request\.headers\.get\(['"](?:cookie|authorization)/i);
  assert.equal(forbiddenOutbound.length, 0, 'all handler outbound requests were explicitly intercepted');
});

test('offline sandbox grants no network or child-process permission', () => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 26, 'offline acceptance requires the declared Node 26+ engine');
  assert.ok(process.allowedNodeEnvironmentFlags.has('--allow-net'), 'runtime must implement network permissions; an unknown permission scope can also return false');
  assert.ok(process.permission, 'run the canonical sandboxed command');
  assert.equal(process.permission.has('net'), false);
  assert.equal(process.permission.has('child'), false);
});
