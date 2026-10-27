import { sdk } from './sdk'

// Traces are debug recordings that the app prunes by size and age.
export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.withOptions({ exclude: ['/traces/'] })
    .addVolume('main')
    .addVolume('startos'),
)
