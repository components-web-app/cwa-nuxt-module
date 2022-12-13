import { reactive } from 'vue'
import { FetchError } from 'ohmyfetch'

interface FetchManifestInterface {
  resources?: string[]
  path: string
  fetchError?: FetchError
}

interface TopLevelFetchPathInterface {
  token: string,
  resources: string[],
  manifest?: FetchManifestInterface
}

export interface FetcherChainInterface {
  [resource: string]: TopLevelFetchPathInterface
}

export interface CwaFetcherStateInterface {
  primaryFetch: {
    fetchingResource?: string
    successResource?: string
  }
  fetches: FetcherChainInterface
}

export default function (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({})
  }
}
