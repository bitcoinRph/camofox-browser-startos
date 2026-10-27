import {
  CallToolRequestParamsSchema,
  JSONRPCMessageSchema,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/sdk/types.js';

/** MCP 2025-06-18 removed JSON-RPC batching. Earlier versions still allow it. */
const FIRST_UNBATCHED_PROTOCOL_VERSION = '2025-06-18';

/** The version the SDK initialize handler answers with for a requested version. */
export function negotiatedProtocolVersion(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
}

function allowsBatches(protocolVersion) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion) &&
    protocolVersion < FIRST_UNBATCHED_PROTOCOL_VERSION;
}

/** Preserve only valid MCP request IDs, including zero and the empty string. */
export function requestId(body) {
  return typeof body?.id === 'string' || Number.isInteger(body?.id) ? body.id : null;
}

export function isNotification(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body) &&
    body.jsonrpc === '2.0' && typeof body.method === 'string' && !Object.hasOwn(body, 'id');
}

/**
 * Classify decoded JSON before the SDK can misreport it as a parse error.
 * Batches under a pre-2025-06-18 protocol go to the SDK unchanged, so its
 * legacy batch handling stays in effect.
 * @param {unknown} body
 * @param {string} protocolVersion - Negotiated session version, else the request header, else the SDK default.
 */
export function preflight(body, protocolVersion) {
  if (Array.isArray(body) && allowsBatches(protocolVersion)) return null;
  const object = body !== null && typeof body === 'object' && !Array.isArray(body);
  const validId = object && (!Object.hasOwn(body, 'id') || requestId(body) !== null);
  if (validId && body.jsonrpc === '2.0' && body.method === 'tools/call' &&
      !CallToolRequestParamsSchema.safeParse(body.params).success) {
    return { code: -32602, message: 'Invalid tools/call params' };
  }
  if (!object || !validId || !JSONRPCMessageSchema.safeParse(body).success) {
    return { code: -32600, message: 'Invalid Request' };
  }
  return null;
}
