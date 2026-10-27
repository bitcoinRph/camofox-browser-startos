/**
 * Registry of live MCP sessions (one transport and one server each).
 *
 * @typedef {Object} SessionEntry
 * @property {string} id
 * @property {any} transport
 * @property {any} server
 * @property {string} userId
 * @property {string} sessionKey
 * @property {boolean} ownsSessionKey - True when the gateway made the key, so no one else can reach its tabs.
 * @property {number} lastSeen
 * @property {number} inflight - POST requests being handled now.
 */

export class SessionRegistry {
  /**
   * @param {{idleTimeoutMs: number, onClose?: (entry: SessionEntry, reason: string) => void|Promise<void>}} opts
   */
  constructor({ idleTimeoutMs, onClose }) {
    this.idleTimeoutMs = idleTimeoutMs;
    this.onClose = onClose;
    /** @type {Map<string, SessionEntry>} */
    this.sessions = new Map();
    this.timer = null;
  }

  get size() {
    return this.sessions.size;
  }

  /** @param {SessionEntry} entry */
  add(entry) {
    this.sessions.set(entry.id, entry);
  }

  /** @param {string} id */
  get(id) {
    return this.sessions.get(id);
  }

  /**
   * Mark a request as active. Returns a function to call when it ends.
   * @param {SessionEntry} entry
   */
  begin(entry) {
    entry.inflight++;
    entry.lastSeen = Date.now();
    return () => {
      entry.inflight--;
      entry.lastSeen = Date.now();
    };
  }

  /**
   * Forget a session, close its server and transport, and run the close hook.
   * Safe to call more than once.
   * @param {string} id
   * @param {string} reason
   */
  async close(id, reason) {
    const entry = this.sessions.get(id);
    if (!entry) return;
    this.sessions.delete(id);
    try {
      await entry.server.close();
    } catch {
      // The transport may already be closed.
    }
    try {
      await entry.transport.close();
    } catch {
      // Same.
    }
    try {
      await this.onClose?.(entry, reason);
    } catch {
      // Cleanup is best effort.
    }
  }

  /** Close sessions that have had no active request for the idle timeout. */
  sweep(now = Date.now()) {
    for (const entry of [...this.sessions.values()]) {
      if (entry.inflight === 0 && now - entry.lastSeen > this.idleTimeoutMs) {
        void this.close(entry.id, 'idle');
      }
    }
  }

  start(intervalMs = Math.min(60_000, Math.max(1000, Math.floor(this.idleTimeoutMs / 2)))) {
    this.timer = setInterval(() => this.sweep(), intervalMs);
    this.timer.unref();
  }

  async closeAll(reason = 'shutdown') {
    clearInterval(this.timer);
    await Promise.all([...this.sessions.keys()].map((id) => this.close(id, reason)));
  }
}
