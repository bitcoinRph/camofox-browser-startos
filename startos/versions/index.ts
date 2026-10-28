import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { previous } from './previous'
import { v1_18_1_2 } from './v1_18_1_2'

export const versionGraph = VersionGraph.of({
  current,
  other: [v1_18_1_2, previous],
})
