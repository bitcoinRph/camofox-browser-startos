import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');

// Exercise the real action and daemon functions without starting StartOS daemons.
export function loadTs(path, stubs = {}) {
  const filename = resolve(root, path);
  if (Object.hasOwn(stubs, filename)) return stubs[filename];
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const localRequire = (name) => Object.hasOwn(stubs, name) ? stubs[name] : name.startsWith('.')
    ? loadTs(`${resolve(dirname(filename), name)}.ts`, stubs)
    : require(name);
  // Only trusted repository source is compiled. No request or persisted input is code.
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return module.exports;
}

export function stubsFor(values) {
  return Object.fromEntries(Object.entries(values).map(([path, value]) => [resolve(root, path), value]));
}
