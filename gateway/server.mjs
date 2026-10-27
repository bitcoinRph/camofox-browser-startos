#!/usr/bin/env node
// Remote MCP gateway for camofox-browser.
//
// Serves the camofox tools over Streamable HTTP (POST/GET/DELETE /mcp) and
// forwards each call to the camofox REST server. Request shapes and auth come
// from the upstream contracts in ../mcp/lib, so behavior matches the stdio MCP
// server. See lib/config.mjs for the environment settings.

import { readFileSync } from 'node:fs';

import { loadGatewayConfig, validateGatewayConfig } from './lib/config.mjs';
import { loadSkills } from './lib/skills.mjs';
import { createApp } from './lib/app.mjs';

const log = (msg, fields = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...fields }));

const config = loadGatewayConfig();
const problems = validateGatewayConfig(config);
if (problems.length) {
  for (const p of problems) console.error(`[camofox-mcp-gateway] ${p}`);
  process.exit(1);
}
if (!config.authToken) log('inbound auth is OFF (MCP_ALLOW_NO_AUTH=1)');

let version = '0.0.0';
try {
  version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
} catch {
  // Running outside the image: keep the placeholder.
}

const skills = await loadSkills(config.skillsDir, log);
const { app, registry } = createApp({ config, skills, version, log });

const httpServer = app.listen(config.port, config.bind, () => {
  log('mcp gateway listening', {
    bind: config.bind,
    port: config.port,
    upstream: config.baseUrl,
    skills: skills.map((s) => s.name),
    novnc: config.novncEnabled,
    version,
  });
});
httpServer.on('error', (err) => {
  console.error(`[camofox-mcp-gateway] cannot listen on ${config.bind}:${config.port}: ${err.message}`);
  process.exit(1);
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log('shutting down', { signal });
  const force = setTimeout(() => process.exit(1), 5000);
  force.unref();
  httpServer.close();
  await registry.closeAll('shutdown');
  httpServer.closeAllConnections();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
