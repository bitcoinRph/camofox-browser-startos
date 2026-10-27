import { TOOLS, TOOL_BY_NAME } from './tool-defs.mjs';
import { validateArgs } from './args.mjs';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  buildRequest,
  buildCookieRequest,
  fetchSpec,
  parseNetscapeCookieFile,
} from './contracts.mjs';
import {
  jsonResult,
  snapshotResult,
  imagesResult,
  downloadsResult,
  errorResult,
} from './results.mjs';

const MAX_COOKIE_FILE_BYTES = 5 * 1024 * 1024;
// camofox accepts at most 500 cookies and 512 kB of JSON per import request.
const COOKIES_PER_REQUEST = 500;
const COOKIE_BYTES_PER_REQUEST = 400 * 1024;

const enc = encodeURIComponent;

/**
 * @typedef {Object} CallContext
 * @property {string} userId
 * @property {string} sessionKey
 */

/**
 * Build the REST request for tools that map to one call. Returns null for the
 * tools that need custom handling (status, cookie import).
 * Original tools go through the upstream builder, except snapshot and
 * screenshot, which have extra options the upstream builder does not know.
 *
 * @param {string} name
 * @param {Record<string, any>} a - Validated arguments.
 * @param {CallContext} ctx
 * @returns {object | null} Request spec for the upstream fetch helper.
 */
function buildSpec(name, a, ctx) {
  const { userId } = ctx;
  const q = (extra = {}) => new URLSearchParams({ userId, ...extra });
  const post = (path, body, kind = 'json') => ({
    method: 'POST',
    path,
    auth: 'accessKey',
    responseKind: kind,
    body: { ...body, userId },
  });
  const get = (path, params, kind = 'json') => ({
    method: 'GET',
    path: `${path}?${params}`,
    auth: 'accessKey',
    responseKind: kind,
  });
  const tab = a.tabId === undefined ? '' : `/tabs/${enc(a.tabId)}`;
  const num = (v) => String(Math.trunc(v));

  switch (name) {
    case 'camofox_snapshot': {
      const params = q();
      if (a.includeScreenshot) params.set('includeScreenshot', 'true');
      if (a.offset != null) params.set('offset', num(a.offset));
      return get(`${tab}/snapshot`, params, 'snapshot');
    }
    case 'camofox_screenshot':
      return get(`${tab}/screenshot`, q(a.fullPage ? { fullPage: 'true' } : {}), 'image');
    case 'camofox_wait': {
      const { tabId: _t, ...body } = a;
      return post(`${tab}/wait`, body);
    }
    case 'camofox_press':
      return post(`${tab}/press`, { key: a.key });
    case 'camofox_select': {
      return post(`${tab}/select`, { ref: a.ref, selector: a.selector, option: a.option });
    }
    case 'camofox_back':
    case 'camofox_forward':
    case 'camofox_refresh':
      return post(`${tab}/${name.slice('camofox_'.length)}`, {});
    case 'camofox_links': {
      const params = q();
      if (a.limit != null) params.set('limit', num(a.limit));
      if (a.offset != null) params.set('offset', num(a.offset));
      return get(`${tab}/links`, params);
    }
    case 'camofox_extract':
      return post(`${tab}/extract`, { schema: a.schema });
    case 'camofox_images': {
      const params = q();
      if (a.limit != null) params.set('limit', num(a.limit));
      if (a.includeData) {
        params.set('includeData', 'true');
        params.set('maxBytes', num(a.maxBytes ?? 2_000_000));
      }
      return get(`${tab}/images`, params);
    }
    case 'camofox_downloads': {
      const params = q();
      if (a.includeData) {
        params.set('includeData', 'true');
        params.set('maxBytes', num(a.maxBytes ?? 1_000_000));
      }
      if (a.consume) params.set('consume', 'true');
      return get(`${tab}/downloads`, params);
    }
    case 'camofox_close_session':
      return { method: 'DELETE', path: `/sessions/${enc(userId)}`, auth: 'accessKey', responseKind: 'json' };
    case 'camofox_status':
    case 'camofox_import_cookies':
      return null;
    default:
      return buildRequest(name, a, ctx);
  }
}

/** Split cookies into batches the camofox import route accepts. */
function chunkCookies(cookies) {
  const chunks = [];
  let current = [];
  let bytes = 0;
  for (const cookie of cookies) {
    const size = Buffer.byteLength(JSON.stringify(cookie)) + 1;
    if (current.length && (current.length >= COOKIES_PER_REQUEST || bytes + size > COOKIE_BYTES_PER_REQUEST)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(cookie);
    bytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/**
 * Create the tool runner for one gateway process.
 * @param {ReturnType<import('./config.mjs').loadGatewayConfig>} config
 */
export function createToolRunner(config) {
  async function importCookies(a, ctx) {
    if (a.cookiesTxt !== undefined && a.cookiesPath !== undefined) {
      throw new Error('Pass either "cookiesTxt" or "cookiesPath", not both.');
    }
    if (a.cookiesTxt === undefined && a.cookiesPath === undefined) {
      throw new Error('Pass "cookiesTxt" (file content) or "cookiesPath".');
    }
    let cookies;
    let spec;
    if (a.cookiesTxt !== undefined) {
      if (!config.apiKey) {
        throw new Error('CAMOFOX_API_KEY is not set on the gateway, so cookie import is disabled.');
      }
      if (Buffer.byteLength(a.cookiesTxt) > MAX_COOKIE_FILE_BYTES) throw new Error('cookiesTxt is too large (max 5MB).');
      cookies = parseNetscapeCookieFile(a.cookiesTxt);
      if (a.domainSuffix) cookies = cookies.filter((c) => c.domain.endsWith(a.domainSuffix));
      cookies = cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
      }));
      spec = {
        method: 'POST',
        path: `/sessions/${enc(ctx.userId)}/cookies`,
        auth: 'apiKey',
        responseKind: 'json',
      };
    } else {
      // Upstream reads the file, checks the path stays inside the cookies dir and parses it.
      spec = await buildCookieRequest({ cookiesPath: a.cookiesPath, domainSuffix: a.domainSuffix }, ctx, config);
      cookies = spec.body.cookies;
    }
    if (cookies.length === 0) {
      throw new Error('No cookies found. Expect Netscape cookies.txt format: 7 tab-separated columns per line.');
    }
    let result;
    for (const chunk of chunkCookies(cookies)) {
      result = await fetchSpec(config.baseUrl, { ...spec, body: { cookies: chunk } }, config);
    }
    return jsonResult({ imported: cookies.length, userId: ctx.userId, result });
  }

  async function status(ctx) {
    let camofox;
    try {
      camofox = await fetchSpec(config.baseUrl, { method: 'GET', path: '/health', auth: 'none', responseKind: 'json' }, config);
    } catch (err) {
      camofox = { ok: false, error: String(err?.message ?? err).slice(0, 300) };
    }
    return jsonResult({
      camofox,
      userId: ctx.userId,
      sessionKey: ctx.sessionKey,
      novncEnabled: config.novncEnabled,
    });
  }

  /**
   * Reject protocol mistakes before execution. Execution errors are tool results.
   * @param {string} name
   * @param {unknown} rawArgs
   * @param {CallContext} ctx
   */
  async function callTool(name, rawArgs, ctx) {
    const def = TOOL_BY_NAME.get(name);
    if (!def) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
    const checked = validateArgs(def.inputSchema, rawArgs);
    if ('error' in checked) throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${checked.error}`);
    const a = checked.args;
    if (name === 'camofox_navigate' && !a.url && !a.macro) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: give "url" or "macro".');
    }
    if (name === 'camofox_select' && !a.ref && !a.selector) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: give "ref" or "selector".');
    }
    try {
      if (name === 'camofox_import_cookies') return await importCookies(a, ctx);
      if (name === 'camofox_status') return await status(ctx);

      const spec = buildSpec(name, a, ctx);
      const payload = await fetchSpec(config.baseUrl, spec, config);
      switch (name) {
        case 'camofox_snapshot':
          return snapshotResult(payload, a);
        case 'camofox_screenshot':
          return { content: [payload] };
        case 'camofox_images':
          return imagesResult(payload);
        case 'camofox_downloads':
          return downloadsResult(payload);
        default:
          return jsonResult(payload);
      }
    } catch (err) {
      return errorResult(err, { baseUrl: config.baseUrl });
    }
  }

  return { callTool, tools: TOOLS };
}
