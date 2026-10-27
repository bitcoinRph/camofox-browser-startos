import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const loadTypeScriptModule = async (path) => {
  const source = await read(path)
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  return import(url)
}

test('credential validation rejects unsafe values before persistence', async () => {
  const { requireAsciiCredential } = await loadTypeScriptModule(
    'startos/credentialValidation.ts',
  )

  assert.equal(requireAsciiCredential('A1b2C3d4', 8, 'test'), 'A1b2C3d4')
  for (const value of [
    '',
    'short',
    '123456789',
    '        ',
    'abcd123\n',
    'abcd123é',
    null,
    undefined,
  ]) {
    assert.throws(
      () => requireAsciiCredential(value, 8, 'test'),
      /exactly 8 ASCII letters or numbers/,
    )
  }
})

test('connection info never reads or returns stored credentials', async () => {
  const source = await read('startos/actions/connectionInfo.ts')

  assert.doesNotMatch(source, /storeJson/)
  assert.doesNotMatch(source, /interactive\.password/)
  assert.doesNotMatch(source, /\$\{apiKey\}/)
  assert.doesNotMatch(source, /value:\s*apiKey/)
})

test('API key rotation receives a masked generated key and returns no secret', async () => {
  const source = await read('startos/actions/regenerateApiKey.ts')

  assert.match(source, /Action\.withInput/)
  assert.match(source, /masked:\s*true/)
  assert.match(source, /const randomApiKey = \{[\s\S]*charset:[\s\S]*len:/)
  assert.match(source, /default:\s*randomApiKey/)
  assert.match(source, /patterns:[\s\S]*\^\[A-Za-z0-9\]/)
  assert.doesNotMatch(source, /value:\s*apiKey/)
  assert.ok(
    source.indexOf('const apiKey = requireAsciiCredential(') <
      source.indexOf('storeJson.merge(effects'),
  )
})

test('interactive login receives a masked generated password and returns no secret', async () => {
  const source = await read('startos/actions/interactiveLogin.ts')
  const actions = await read('startos/actions/index.ts')

  assert.match(source, /enableInteractiveLogin\s*=\s*sdk\.Action\.withInput/)
  assert.match(
    source,
    /disableInteractiveLogin\s*=\s*sdk\.Action\.withoutInput/,
  )
  assert.match(source, /masked:\s*true/)
  assert.match(source, /const randomVncPassword = \{[\s\S]*charset:[\s\S]*len:/)
  assert.match(source, /default:\s*randomVncPassword/)
  assert.match(source, /patterns:[\s\S]*\^\[A-Za-z0-9\]/)
  assert.doesNotMatch(source, /value:\s*password/)
  assert.ok(
    source.indexOf('const password = requireAsciiCredential(') <
      source.indexOf('storeJson.merge(effects'),
  )
  assert.match(actions, /addAction\(enableInteractiveLogin\)/)
  assert.match(actions, /addAction\(disableInteractiveLogin\)/)
})

test('shipped documentation matches the copy-before-submit workflow', async () => {
  const paths = [
    'README.md',
    'instructions.md',
    'skills/camofox-agent-setup/SKILL.md',
    'skills/camofox-login-handoff/SKILL.md',
  ]
  const documentation = (await Promise.all(paths.map(read))).join('\n')

  assert.match(documentation, /copy[^\n]*before submit/i)
  assert.doesNotMatch(documentation, /Connection Info[^\n]*shows[^\n]*API key/i)
  assert.doesNotMatch(
    documentation,
    /action shows the noVNC URL and a password/i,
  )
  assert.doesNotMatch(documentation, /^\s*- interactive-login\s*$/m)
})
