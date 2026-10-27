import { sdk } from '../sdk'
import { browserSettings } from './browserSettings'
import { connectionInfo } from './connectionInfo'
import { interactiveLogin } from './interactiveLogin'
import { proxySettings } from './proxySettings'
import { regenerateApiKey } from './regenerateApiKey'
import { resetBrowserProfiles } from './resetBrowserProfiles'

export const actions = sdk.Actions.of()
  .addAction(connectionInfo)
  .addAction(regenerateApiKey)
  .addAction(browserSettings)
  .addAction(proxySettings)
  .addAction(interactiveLogin)
  .addAction(resetBrowserProfiles)
