import { createHash, timingSafeEqual } from 'node:crypto';
import { IDENTITY_PATTERN } from './config.mjs';

/**
 * Compare two secrets in constant time. Both sides are hashed first so the
 * length of the expected token does not leak.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Express middleware that requires `Authorization: Bearer <token>`.
 * With no token configured (MCP_ALLOW_NO_AUTH=1) it lets every request pass.
 * @param {string} token
 */
export function bearerAuth(token) {
  return function checkBearer(req, res, next) {
    if (!token) return next();
    const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
    if (match && safeEqual(match[1].trim(), token)) return next();
    res
      .status(401)
      .set('WWW-Authenticate', 'Bearer realm="camofox-mcp"')
      .json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
  };
}

/**
 * Work out which camofox identity an MCP session uses. The header wins over the
 * query string, so a client can set it either way.
 *
 * @param {import('express').Request} req
 * @param {{defaultUserId: string}} config
 * @param {() => string} newSessionKey - Makes the default sessionKey.
 * @returns {{userId: string, sessionKey: string, explicitSessionKey: boolean} | {error: string}}
 */
export function resolveIdentity(req, config, newSessionKey) {
  const userId = (req.headers['x-camofox-user'] ?? req.query?.user) ?? config.defaultUserId;
  if (typeof userId !== 'string' || !IDENTITY_PATTERN.test(userId)) {
    return { error: 'Invalid user id. Use 1-64 characters from A-Z a-z 0-9 _ . -' };
  }
  const requestedKey = (req.headers['x-camofox-session'] ?? req.query?.session);
  if (requestedKey !== undefined && (typeof requestedKey !== 'string' || !IDENTITY_PATTERN.test(requestedKey))) {
    return { error: 'Invalid session key. Use 1-64 characters from A-Z a-z 0-9 _ . -' };
  }
  return {
    userId,
    sessionKey: requestedKey ?? newSessionKey(),
    explicitSessionKey: requestedKey !== undefined,
  };
}
