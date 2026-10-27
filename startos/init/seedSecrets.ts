import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'
import { apiKeyLength } from '../utils'

export const seedSecrets = sdk.setupOnInit(async (effects) => {
  await storeJson.merge(effects, {})

  // An empty key would leave the API open, so any init that finds none makes one.
  const apiKey = await storeJson.read((s) => s.apiKey).once()
  if (!apiKey) {
    await storeJson.merge(effects, {
      apiKey: utils.getDefaultString({
        charset: 'a-z,A-Z,0-9',
        len: apiKeyLength,
      }),
    })
  }
})
