import os from 'node:os';
import { join } from 'node:path';

/** Same pattern for user ids and session keys. Keeps them URL- and path-safe. */
export const IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

function intFrom(value, fallback) {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read the gateway settings from the environment.
 *
 * The fields `accessKey`, `apiKey` and `cookiesDir` have the same names and
 * meaning as in the upstream `loadMcpConfig()`, because the upstream request
 * helpers read them from this object.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadGatewayConfig(env = process.env) {
  const camofoxPort = intFrom(env.CAMOFOX_PORT, 9377);
  return {
    port: intFrom(env.MCP_PORT, 9378),
    bind: env.MCP_BIND || '0.0.0.0',
    baseUrl: (env.CAMOFOX_BASE_URL || `http://127.0.0.1:${camofoxPort}`).replace(/\/+$/, ''),
    authToken: (env.MCP_AUTH_TOKEN || '').trim(),
    allowNoAuth: env.MCP_ALLOW_NO_AUTH === '1',
    accessKey: (env.CAMOFOX_ACCESS_KEY || '').trim(),
    apiKey: env.CAMOFOX_API_KEY || '',
    cookiesDir: env.CAMOFOX_COOKIES_DIR || join(os.homedir(), '.camofox', 'cookies'),
    defaultUserId: env.CAMOFOX_DEFAULT_USER_ID || 'agent',
    skillsDir: env.CAMOFOX_SKILLS_DIR || '',
    novncEnabled: env.CAMOFOX_NOVNC_ENABLED === '1' || env.CAMOFOX_NOVNC_ENABLED === 'true',
    idleTimeoutMs: env.MCP_SESSION_IDLE_MS === undefined ? 30 * 60 * 1000 :
      /^\d+$/.test(env.MCP_SESSION_IDLE_MS) ? Number(env.MCP_SESSION_IDLE_MS) : NaN,
    maxSessions: intFrom(env.MCP_MAX_SESSIONS, 100),
  };
}

/**
 * Return a list of problems that stop the gateway from starting.
 * @param {ReturnType<typeof loadGatewayConfig>} config
 * @returns {string[]}
 */
export function validateGatewayConfig(config) {
  const problems = [];
  if (!Number.isSafeInteger(config.idleTimeoutMs) || config.idleTimeoutMs < 1 || config.idleTimeoutMs > 86_400_000) {
    problems.push('MCP_SESSION_IDLE_MS must be a whole number from 1 to 86400000 milliseconds.');
  }
  if (!config.authToken && !config.allowNoAuth) {
    problems.push('MCP_AUTH_TOKEN is not set. Set it, or set MCP_ALLOW_NO_AUTH=1 to run without inbound auth.');
  }
  if (!IDENTITY_PATTERN.test(config.defaultUserId)) {
    problems.push('CAMOFOX_DEFAULT_USER_ID must match ^[A-Za-z0-9_.-]{1,64}$.');
  }
  return problems;
}
