import { reactive } from 'vue'
import type { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'

interface FetchManifestInterface {
  path: string
  resources?: string[]
  error?: CwaResourceErrorObject
}

export interface FetchStatus {
  path: string
  isPrimary: boolean
  resources: string[]
  manifest?: FetchManifestInterface
  abort?: true
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
