import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { apiKeyLength } from '../utils'

export const regenerateApiKey = sdk.Action.withoutInput(
  'regenerate-api-key',

  async () => ({
    name: i18n('Regenerate API Key'),
    description: i18n(
      'Create a new API key. The service restarts to apply the new key.',
    ),
    warning: i18n(
      'The old key stops working. Update every client that uses the old key.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const apiKey = utils.getDefaultString({
      charset: 'a-z,A-Z,0-9',
      len: apiKeyLength,
    })
    await storeJson.merge(effects, { apiKey })

    return {
      version: '1',
      title: i18n('New API Key'),
      message: i18n('Use this key in every client.'),
      result: {
        type: 'single',
        value: apiKey,
        masked: true,
        copyable: true,
        qr: false,
        launchable: false,
      },
    }
  },
)
