import { reactive } from 'vue'
import { FetchError } from 'ohmyfetch'

interface FetchManifestInterface {
  resources?: string[]
  path: string
  fetchError?: FetchError
}

export interface TopLevelFetchPathInterface {
  isServerFetch: boolean
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
