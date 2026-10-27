import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {Object} Skill
 * @property {string} name
 * @property {string} description
 * @property {string} body - Markdown without the frontmatter.
 * @property {string} uri - `camofox://skills/<name>`
 */

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Read the top-level `key: value` pairs of a YAML frontmatter block. Handles
 * quoted values, block scalars (`>`, `|`) and plain multi-line values. Nested
 * maps (such as `metadata:`) are skipped.
 * @param {string} block
 * @returns {Record<string, string>}
 */
export function parseFrontmatter(block) {
  const out = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, key, rest] = m;
    const continuation = [];
    while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
      continuation.push(lines[++i]);
    }
    const parts = continuation.map((l) => l.trim()).filter(Boolean);
    if (/^[>|][+-]?$/.test(rest.trim())) {
      out[key] = parts.join(rest.trim().startsWith('|') ? '\n' : ' ');
    } else if (rest.trim() === '') {
      // A nested map or list: not a plain string value.
    } else {
      out[key] = unquote([rest, ...parts].join(' '));
    }
  }
  return out;
}

/**
 * Split a SKILL.md into frontmatter fields and body.
 * @param {string} source
 */
export function parseSkillFile(source) {
  const clean = source.replace(/^﻿/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(clean);
  if (!m) return { meta: {}, body: clean.trim() };
  return { meta: parseFrontmatter(m[1]), body: m[2].trim() };
}

/**
 * Load every `<dir>/<name>/SKILL.md`. A missing directory gives an empty list.
 * @param {string} dir
 * @param {(msg: string, fields?: object) => void} [log]
 * @returns {Promise<Skill[]>}
 */
export async function loadSkills(dir, log = () => {}) {
  if (!dir) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    log('skills directory not readable', { dir, error: err.code || String(err) });
    return [];
  }
  /** @type {Skill[]} */
  const skills = [];
  const seen = new Set();
  for (const entry of entries.filter((e) => e.isDirectory() || e.isSymbolicLink()).sort((a, b) => a.name.localeCompare(b.name))) {
    let source;
    try {
      source = await readFile(join(dir, entry.name, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    const { meta, body } = parseSkillFile(source);
    const name = meta.name || entry.name;
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name) || seen.has(name) || !body) {
      log('skill skipped', { dir: entry.name, name });
      continue;
    }
    seen.add(name);
    skills.push({ name, description: meta.description || `Skill ${name}`, body, uri: `camofox://skills/${name}` });
  }
  return skills;
}
