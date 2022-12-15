import { reactive } from 'vue'
import { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'

interface FetchManifestInterface {
  path: string
  resources?: string[]
  error?: CwaResourceErrorObject
}

export interface TopLevelFetchPathInterface {
  path: string,
  isPrimary: boolean,
  resources: string[],
  manifest?: FetchManifestInterface
}

export interface FetcherChainInterface {
  [token: string]: TopLevelFetchPathInterface
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
    fetches: reactive({})
  }
}
