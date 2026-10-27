import { requireAsciiCredential } from '../credentialValidation'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { apiKeyLength } from '../utils'

const { InputSpec, Value } = sdk

const randomApiKey = {
  charset: 'a-z,A-Z,0-9',
  len: apiKeyLength,
}

const inputSpec = InputSpec.of({
  apiKey: Value.text({
    name: i18n('New API Key'),
    description: null,
    warning: null,
    required: true,
    default: randomApiKey,
    generate: randomApiKey,
    masked: true,
    minLength: apiKeyLength,
    maxLength: apiKeyLength,
    patterns: [
      {
        regex: `^[A-Za-z0-9]{${apiKeyLength}}$`,
        description: `Must be exactly ${apiKeyLength} ASCII letters or numbers.`,
      },
    ],
  }),
})

export const regenerateApiKey = sdk.Action.withInput(
  'regenerate-api-key',

  async () => ({
    name: i18n('Regenerate API Key'),
    description: i18n('Set a new API key. The service restarts to apply it.'),
    warning: i18n(
      'Copy the proposed key before submitting. The old key stops working, and the new key will not be shown again.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const apiKey = requireAsciiCredential(input.apiKey, apiKeyLength, 'API key')
    await storeJson.merge(effects, { apiKey })

    return {
      version: '1',
      title: i18n('Regenerate API Key'),
      message: i18n(
        'Update every client with the key you copied before submitting.',
      ),
      result: null,
    }
  },
)
