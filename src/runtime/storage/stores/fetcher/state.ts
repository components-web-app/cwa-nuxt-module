import { reactive } from 'vue'
import type { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'

interface FetchManifestInterface {
  path: string
  irisByDepth?: string[][]
  fetchComplete?: true
  error?: CwaResourceErrorObject
}

export type FetchAbortReason = 'redirect'

export interface FetchStatus {
  path: string
  isPrimary: boolean
  resources: string[]
  manifest?: FetchManifestInterface
  abort?: true
  abortReason?: FetchAbortReason
  timestamp: number
}

export interface FetcherChainInterface {
  [token: string]: FetchStatus
}

export interface CwaFetcherStateInterface {
  primaryFetch: {
    fetchingToken?: string
    successToken?: string
  }
  fetches: FetcherChainInterface
}

export default function (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({}),
  }
}
