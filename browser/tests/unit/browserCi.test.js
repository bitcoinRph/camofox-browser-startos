import { readFileSync, existsSync } from 'node:fs';

const file = new URL('../../../.github/workflows/verify-monorepo.yml', import.meta.url);
const workflow = () => existsSync(file) ? readFileSync(file, 'utf8') : '';
const publishFile = new URL('../../../.github/workflows/startos-image.yml', import.meta.url);

test('browser CI runs the canonical test and MCP gates in a GTK/Xvfb environment', () => {
  const source = workflow();
  expect(source).toContain('container: node:24-trixie');
  expect(source).toMatch(/node-version: 24\s/);
  expect(source).toMatch(/HOME:\s*\/root/);
  expect(source).toContain('libgtk-3-0');
  expect(source).toContain('libnss3');
  expect(source).toContain('xvfb');
  expect(source).toContain('npm ci');
  expect(source).toContain('npm run fetch-bin');
  expect(source).toMatch(/run: npm test\s/);
  expect(source).toMatch(/run: npm run test:mcp\s/);
});

test('browser CI pins every action to a verified immutable release commit', () => {
  const actions = [...workflow().matchAll(/uses: ([^\s#]+)/g)].map(match => match[1]);
  expect(actions).toContain('actions/checkout@11d5960a326750d5838078e36cf38b85af677262');
  expect(actions).toContain('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020');
  for (const action of actions) expect(action).toMatch(/@[a-f0-9]{40}$/);
});

test('browser CI keeps the root lockfile active when installing its reporter', () => {
  const source = workflow();
  expect(source).toContain('npm install --no-save jest-junit@17.0.0');
  expect(source).not.toContain('--package-lock=false');
});

test('browser CI verifies the actual bundled release and shared libraries', () => {
  const source = workflow();
  expect(source).toContain('version.json');
  expect(source).toContain('BUNDLED_CAMOUFOX_RELEASE');
  expect(source).toContain('camoufox-bin --version');
  expect(source).toContain('ldd');
  expect(source).toContain('libxul.so');
  expect(source).toContain('not found');
  expect(source).toContain('libmozgtk.so');
});

test('browser CI smoke-tests a real server tab without publishing', () => {
  const source = workflow();
  expect(source).toContain('node scripts/smoke-browser.mjs');
  expect(source).toContain('contents: read');
  expect(source).not.toMatch(/packages: write|contents: write|docker (?:push|login)|push: true|npm publish/);
  expect(source).toContain('workflow_dispatch:');
});

test('browser CI resets its shared-library evidence before appending every check', () => {
  const source = workflow();
  const reset = source.indexOf(': > libraries.log');
  const loop = source.indexOf('for library in camoufox-bin libxul.so libmozgtk.so; do');
  expect(reset).toBeGreaterThanOrEqual(0);
  expect(reset).toBeLessThan(loop);
  expect(source).toContain('ldd "$CACHE/$library" | tee -a libraries.log');
  expect(source).not.toContain('| tee libraries.log');
});

test('consolidation does not activate browser image publishing', () => {
  expect(existsSync(publishFile)).toBe(false);
  expect(workflow()).not.toMatch(/packages: write|docker (?:push|login)|push: true/);
});
