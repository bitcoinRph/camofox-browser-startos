import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  getAddresses,
  novncPort,
  vncHostId,
  vncInterfaceId,
  vncPasswordLength,
} from '../utils'

const waitForAddresses = async (
  effects: Parameters<typeof getAddresses>[0],
) => {
  const deadline = Date.now() + 10_000
  for (;;) {
    const addresses = await getAddresses(
      effects,
      vncHostId,
      novncPort,
      vncInterfaceId,
    )
    if (addresses.length > 0 || Date.now() > deadline) return addresses
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

export const interactiveLogin = sdk.Action.withoutInput(
  'interactive-login',

  async ({ effects }) => {
    const enabled = await storeJson
      .read((s) => s.interactive.enabled)
      .const(effects)
    return enabled
      ? {
          name: i18n('Disable Interactive Login'),
          description: i18n(
            'Close the noVNC page and remove the VNC password. The service restarts.',
          ),
          warning: i18n(
            'Open browser sessions end. Saved cookies stay on disk.',
          ),
          allowedStatuses: 'any' as const,
          group: null,
          visibility: 'enabled' as const,
        }
      : {
          name: i18n('Enable Interactive Login'),
          description: i18n(
            'Show the browser on a noVNC page, so that you can sign in to sites yourself. The service restarts.',
          ),
          warning: i18n(
            'Anyone with the VNC password who can reach the noVNC address controls the browser. Disable this feature after you sign in.',
          ),
          allowedStatuses: 'any' as const,
          group: null,
          visibility: 'enabled' as const,
        }
  },

  async ({ effects }) => {
    const enabled = await storeJson.read((s) => s.interactive.enabled).once()

    if (enabled) {
      await storeJson.merge(effects, {
        interactive: { enabled: false, password: null },
      })
      return {
        version: '1',
        title: i18n('Interactive Login Is Off'),
        message: i18n('The noVNC page is closed.'),
        result: null,
      }
    }

    const password = utils.getDefaultString({
      charset: 'a-z,A-Z,0-9',
      len: vncPasswordLength,
    })
    await storeJson.merge(effects, { interactive: { enabled: true, password } })

    const addresses = await waitForAddresses(effects)

    return {
      version: '1',
      title: i18n('Interactive Login Is On'),
      message: i18n(
        'Open the noVNC address and enter the VNC password. Run this action again to turn the feature off.',
      ),
      result: {
        type: 'group',
        value: [
          ...addresses.map((a) => ({
            type: 'single' as const,
            name: a.url,
            description: null,
            value: a.url,
            masked: false,
            copyable: true,
            qr: false,
            launchable: true,
          })),
          {
            type: 'single' as const,
            name: i18n('VNC Password'),
            description: null,
            value: password,
            masked: true,
            copyable: true,
            qr: false,
            launchable: false,
          },
        ],
      },
    }
  },
)
