import { browserSettings } from '../actions/browserSettings'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const watchBrowserSettings = sdk.setupOnInit(async (effects) => {
  const identitySet = await storeJson
    .read((s) => !!s.browser.locale && !!s.browser.timezone)
    .const(effects)

  if (!identitySet) {
    await sdk.action.createOwnTask(effects, browserSettings, 'optional', {
      reason: i18n(
        "Match the browser locale and timezone to this server's IP location",
      ),
    })
  }
})
