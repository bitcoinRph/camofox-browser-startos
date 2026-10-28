import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import * as downloads from '../../lib/downloads.js';

const source = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
const start = source.indexOf('async function navigatePage(');
const end = source.indexOf('\n}', start) + 2;
const navigatePage = vm.runInNewContext(`(${source.slice(start, end)})`, { ...downloads });

function pageWithFailure(message, emit = 'during') {
  const page = new EventEmitter();
  const error = new Error(message);
  page.goto = jest.fn(async () => {
    if (emit === 'during') page.emit('download', {});
    if (emit === 'after') setTimeout(() => page.emit('download', {}), 20);
    throw error;
  });
  page.waitForLoadState = jest.fn();
  return { page, error };
}

test.each(['page.goto: Download is starting', 'page.goto: NS_BINDING_ABORTED'])(
  'navigation recognizes a real download with %s', async message => {
    const { page } = pageWithFailure(message);
    await expect(navigatePage(page, 'http://localhost/attachment')).resolves.toEqual({ downloadStarted: true });
    expect(page.waitForLoadState).not.toHaveBeenCalled();
    expect(page.listenerCount('download')).toBe(0);
  },
);

test('navigation recognizes a download event delivered after goto rejects', async () => {
  const { page } = pageWithFailure('page.goto: NS_BINDING_ABORTED', 'after');
  await expect(navigatePage(page, 'http://localhost/attachment')).resolves.toEqual({ downloadStarted: true });
  expect(page.listenerCount('download')).toBe(0);
});

test.each(['Timeout 30000ms exceeded', 'Target page, context or browser has been closed', 'SEC_ERROR_UNKNOWN_ISSUER', 'unrelated failure'])(
  'a concurrent download does not mask %s', async message => {
    const { page, error } = pageWithFailure(message);
    await expect(navigatePage(page, 'http://localhost/page')).rejects.toBe(error);
    expect(page.listenerCount('download')).toBe(0);
  },
);

test('a stale download cannot turn an unrelated navigation abort into success', async () => {
  const { page, error } = pageWithFailure('page.goto: NS_BINDING_ABORTED', 'never');
  page.emit('download', {});
  await expect(navigatePage(page, 'http://localhost/page')).rejects.toBe(error);
  expect(page.listenerCount('download')).toBe(0);
});

test('ordinary document navigation still returns its HTTP response', async () => {
  const page = new EventEmitter();
  const response = { headers: () => ({ 'content-type': 'text/html' }), status: () => 503 };
  page.goto = jest.fn(async () => response);
  page.waitForLoadState = jest.fn();
  expect(await navigatePage(page, 'http://localhost/page')).toBe(response);
  expect(page.waitForLoadState).toHaveBeenCalledWith('domcontentloaded', { timeout: 30000 });
  expect(page.listenerCount('download')).toBe(0);
});
