import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { bearerAuth, resolveIdentity } from './auth.mjs';
import { createMcpServer } from './mcp.mjs';
import { SessionRegistry } from './sessions.mjs';
import { fetchSpec } from './contracts.mjs';
import { buildInstructions } from './instructions.mjs';
import { createToolRunner } from './tools.mjs';

const STATELESS_SESSION_KEY = 'mcp-stateless';

function rpcError(res, status, code, message) {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

/**
 * Replace the Accept header. The SDK insists on both media types even when it
 * answers with plain JSON, and it reads `rawHeaders`, not `headers`.
 */
function setAccept(req, value) {
  const raw = [];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() !== 'accept') raw.push(req.rawHeaders[i], req.rawHeaders[i + 1]);
  }
  req.rawHeaders = [...raw, 'Accept', value];
  req.headers.accept = value;
}

/**
 * Create the Express app and its session registry.
 *
 * `/mcp` speaks Streamable HTTP with stateful sessions. A POST that carries no
 * `Mcp-Session-Id` and is not an `initialize` request is served statelessly: one
 * short-lived server answers it with a plain JSON body. That lets simple
 * JSON-RPC clients call tools without the handshake.
 *
 * @param {Object} deps
 * @param {ReturnType<import('./config.mjs').loadGatewayConfig>} deps.config
 * @param {import('./skills.mjs').Skill[]} deps.skills
 * @param {string} deps.version
 * @param {(msg: string, fields?: object) => void} deps.log
 * @returns {{app: import('express').Express, registry: SessionRegistry}}
 */
export function createApp({ config, skills, version, log }) {
  const runner = createToolRunner(config);
  const info = { name: 'camofox-browser', version };
  const instructions = buildInstructions(config, skills);

  const registry = new SessionRegistry({
    idleTimeoutMs: config.idleTimeoutMs,
    // Tabs opened under a key that only this session knew would otherwise stay
    // open until camofox expires the whole user session.
    onClose: async (entry, reason) => {
      log('mcp session closed', { session: entry.id, userId: entry.userId, reason });
      if (!entry.ownsSessionKey) return;
      const spec = {
        method: 'DELETE',
        path: `/tabs/group/${encodeURIComponent(entry.sessionKey)}?${new URLSearchParams({ userId: entry.userId })}`,
        auth: 'accessKey',
        responseKind: 'json',
      };
      await fetchSpec(config.baseUrl, spec, config).catch(() => {});
    },
  });

  registry.start();

  const makeServer = (identity) => createMcpServer({ info, instructions, runner, skills, identity });
  const newSessionKey = () => `mcp-${randomBytes(4).toString('hex')}`;

  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', async (_req, res) => {
    try {
      const upstream = await fetch(`${config.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      const body = await upstream.json().catch(() => ({}));
      if (upstream.ok && body.ok !== false) return res.json({ ok: true });
      res.status(503).json({ ok: false, upstream: upstream.status });
    } catch (err) {
      res.status(503).json({ ok: false, error: String(err?.cause?.code || err?.message || err) });
    }
  });

  app.use('/mcp', bearerAuth(config.authToken));

  app.post('/mcp', express.json({ limit: '4mb' }), async (req, res) => {
    const sid = req.get('mcp-session-id');
    if (sid) {
      const entry = registry.get(sid);
      if (!entry) return rpcError(res, 404, -32001, 'Session not found');
      res.on('close', registry.begin(entry));
      return entry.transport.handleRequest(req, res, req.body);
    }

    const identity = resolveIdentity(req, config, newSessionKey);
    if ('error' in identity) return rpcError(res, 400, -32602, identity.error);

    const body = req.body;
    const isInit = Array.isArray(body) ? body.some(isInitializeRequest) : isInitializeRequest(body);

    if (!isInit) {
      const stateless = { ...identity, sessionKey: identity.explicitSessionKey ? identity.sessionKey : STATELESS_SESSION_KEY };
      const server = makeServer(stateless);
      setAccept(req, 'application/json, text/event-stream');
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      return transport.handleRequest(req, res, body);
    }

    if (registry.size >= config.maxSessions) {
      return rpcError(res, 503, -32000, 'Too many MCP sessions. Close one or wait for idle sessions to expire.');
    }
    /** @type {import('./sessions.mjs').SessionEntry} */
    const entry = {
      id: '',
      transport: null,
      server: null,
      userId: identity.userId,
      sessionKey: identity.sessionKey,
      ownsSessionKey: !identity.explicitSessionKey,
      lastSeen: Date.now(),
      inflight: 0,
    };
    entry.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (id) => {
        entry.id = id;
        registry.add(entry);
        log('mcp session opened', { session: id, userId: entry.userId, sessionKey: entry.sessionKey });
      },
    });
    entry.server = makeServer({ userId: entry.userId, sessionKey: entry.sessionKey });
    entry.server.onclose = () => {
      if (entry.id) void registry.close(entry.id, 'transport closed');
    };
    await entry.server.connect(entry.transport);
    return entry.transport.handleRequest(req, res, body);
  });

  const withSession = async (req, res) => {
    const sid = req.get('mcp-session-id');
    if (!sid) {
      if (req.method === 'GET') return res.status(405).set('Allow', 'POST, DELETE').end();
      return rpcError(res, 400, -32000, 'Mcp-Session-Id header is required');
    }
    const entry = registry.get(sid);
    if (!entry) return rpcError(res, 404, -32001, 'Session not found');
    entry.lastSeen = Date.now();
    return entry.transport.handleRequest(req, res);
  };
  app.get('/mcp', withSession);
  app.delete('/mcp', withSession);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Express error handler: bad JSON bodies and unexpected failures.
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return res.end();
    if (err?.type === 'entity.too.large') return rpcError(res, 413, -32600, 'Request body too large');
    if (err?.type === 'entity.parse.failed') return rpcError(res, 400, -32700, 'Parse error');
    log('request failed', { error: String(err?.message || err) });
    rpcError(res, 500, -32603, 'Internal error');
  });

  return { app, registry };
}
