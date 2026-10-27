import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'camofox-browser',
  title: 'Camofox Browser',
  license: 'MIT',
  packageRepo: 'https://github.com/bitcoinRph/camofox-browser-startos',
  upstreamRepo: 'https://github.com/bitcoinRph/camofox-browser-patched',
  marketingUrl: 'https://github.com/jo-inc/camofox-browser',
  donationUrl: null,
  description: { short, long },
  // `startos` holds store.json and no subcontainer mounts it.
  volumes: ['main', 'startos'],
  images: {
    'camofox-browser': {
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
