import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { previous } from './previous'

export const versionGraph = VersionGraph.of({
  current,
  other: [previous],
})
