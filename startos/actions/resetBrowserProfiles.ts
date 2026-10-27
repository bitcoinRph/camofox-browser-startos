import { mkdir, rm } from 'node:fs/promises'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const directories = ['profiles', 'cookies']

export const resetBrowserProfiles = sdk.Action.withoutInput(
  'reset-browser-profiles',

  async () => ({
    name: i18n('Reset Browser Profiles'),
    description: i18n(
      'Delete all saved cookies and browser profiles. Stop the service before you run this action.',
    ),
    warning: i18n('Every saved login ends. This action cannot be undone.'),
    allowedStatuses: 'only-stopped',
    group: null,
    visibility: 'enabled',
  }),

  async () => {
    for (const directory of directories) {
      const path = sdk.volumes.main.subpath(directory)
      await rm(path, { recursive: true, force: true })
      await mkdir(path, { recursive: true })
    }

    return {
      version: '1',
      title: i18n('Browser Profiles Reset'),
      message: i18n('All saved cookies and browser profiles are deleted.'),
      result: null,
    }
  },
)
