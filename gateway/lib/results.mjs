/** Helpers that turn camofox REST payloads and errors into MCP tool results. */

const IMAGE_MIME = /^image\/(png|jpeg|gif|webp)$/i;

/** @param {string} text */
export const text = (text) => ({ type: 'text', text });

/**
 * Compact JSON result. No indentation, to save tokens.
 * @param {unknown} payload
 */
export function jsonResult(payload) {
  return { content: [text(JSON.stringify(payload))] };
}

/**
 * Snapshot result: one header line, then the raw snapshot string.
 * The REST payload has no page title, so the header carries url, refs and paging.
 * @param {any} payload - `GET /tabs/:id/snapshot` response.
 * @param {{includeScreenshot?: boolean, includeStructure?: boolean}} opts
 */
export function snapshotResult(payload, opts = {}) {
  const p = payload || {};
  const header = [`url: ${p.url ?? 'unknown'}`, `refs: ${p.refsCount ?? 0}`];
  if (p.totalChars != null) header.push(`chars: ${p.totalChars}`);
  if (p.hasMore) header.push(`hasMore: true`, `nextOffset: ${p.nextOffset}`);
  const content = [text(`${header.join(' | ')}\n${p.snapshot ?? ''}`)];
  if (opts.includeStructure && p.structure) {
    content.push(text(`structure: ${JSON.stringify(p.structure)}`));
  }
  if (opts.includeScreenshot && p.screenshot?.data) {
    content.push({ type: 'image', data: p.screenshot.data, mimeType: p.screenshot.mimeType || 'image/png' });
  }
  return { content };
}

/**
 * Images result. With includeData the inline data URLs become image blocks and
 * leave the JSON, so the model gets pictures and not megabytes of base64 text.
 * @param {any} payload
 */
export function imagesResult(payload) {
  const blocks = [];
  const images = (payload?.images || []).map((img) => {
    const { dataUrl, ...rest } = img;
    const m = typeof dataUrl === 'string' ? /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl) : null;
    if (m && IMAGE_MIME.test(m[1])) {
      blocks.push({ type: 'image', data: m[2], mimeType: m[1] });
      return { ...rest, attached: true };
    }
    return dataUrl ? { ...rest, dataSkipped: 'unsupported_image_type' } : rest;
  });
  return { content: [text(JSON.stringify({ ...payload, images })), ...blocks] };
}

/**
 * Downloads result. With includeData the file bytes become embedded resources.
 * @param {any} payload
 */
export function downloadsResult(payload) {
  const blocks = [];
  const downloads = (payload?.downloads || []).map((d) => {
    const { dataBase64, ...rest } = d;
    if (typeof dataBase64 !== 'string') return rest;
    const name = encodeURIComponent(d.suggestedFilename || d.id || 'download');
    blocks.push({
      type: 'resource',
      resource: {
        uri: `camofox://downloads/${encodeURIComponent(d.id || name)}/${name}`,
        mimeType: d.mimeType || 'application/octet-stream',
        blob: dataBase64,
      },
    });
    return { ...rest, attached: true };
  });
  return { content: [text(JSON.stringify({ ...payload, downloads })), ...blocks] };
}

/**
 * Split the `"<status>: <body>"` message that the upstream fetch helper throws.
 * @param {Error} err
 * @returns {{status: number|null, message: string, code?: string}}
 */
export function parseUpstreamError(err) {
  const raw = String(err?.message ?? err);
  const m = /^(\d{3}): ([\s\S]*)$/.exec(raw);
  if (!m) return { status: null, message: raw };
  const status = Number(m[1]);
  let message = m[2].trim();
  let code;
  try {
    const body = JSON.parse(message);
    if (body && typeof body === 'object') {
      message = String(body.error ?? body.message ?? message);
      code = body.code;
    }
  } catch {
    // Not JSON: keep the raw text.
  }
  return { status, message: message.slice(0, 500), code };
}

function hintFor(status, code) {
  if (code === 'browser_restarted' || code === 'tab_destroyed' || code === 'page_crashed' || code === 'tab_unresponsive') {
    return 'The tab is gone. Call camofox_create_tab to open a new one.';
  }
  switch (status) {
    case 401:
    case 403:
      return 'Key mismatch between the gateway and camofox (CAMOFOX_ACCESS_KEY / CAMOFOX_API_KEY). Check that both use the same key.';
    case 404:
      return 'Tab not found. It may be closed, expired or owned by another user id. Call camofox_list_tabs, or camofox_create_tab for a new one.';
    case 409:
    case 422:
      return 'The page changed or the ref/selector did not match one element. Call camofox_snapshot and use a current ref.';
    case 410:
      return 'The tab is gone. Call camofox_create_tab to open a new one.';
    case 429:
    case 503:
      return 'Camofox is busy, or the session expired. Wait a few seconds and retry. Create a new tab if the tab is gone.';
    default:
      return null;
  }
}

/**
 * Build an MCP error result with the status, the upstream message and one hint.
 * @param {unknown} err
 * @param {{baseUrl?: string}} [ctx]
 */
export function errorResult(err, ctx = {}) {
  const { status, message, code } = parseUpstreamError(/** @type {Error} */ (err));
  let line;
  if (status == null) {
    const cause = /** @type {any} */ (err)?.cause?.code;
    if (cause === 'ECONNREFUSED' || cause === 'ECONNRESET' || cause === 'UND_ERR_SOCKET' || /fetch failed/i.test(message)) {
      line = `camofox is unreachable at ${ctx.baseUrl ?? 'the configured URL'} (${cause || message}). It may still be starting. Wait and retry.`;
    } else {
      line = message;
    }
  } else {
    line = `camofox ${status}: ${message}`;
    const hint = hintFor(status, code);
    if (hint) line += `\nHint: ${hint}`;
  }
  return { isError: true, content: [text(line)] };
}
