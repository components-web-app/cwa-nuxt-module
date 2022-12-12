import { reactive } from 'vue'
import { FetchError } from 'ohmyfetch'

interface FetcherStatusInterface {
  fetch?: {
    token: string
    path: string
    success?: boolean
  }
  fetched?: {
    path: string
  }
}
export interface FetcherManifestsInterface {
  [path: string]: {
    inProgress: boolean
    fetchError?: FetchError
  }
}

export interface CwaFetcherStateInterface {
  status: FetcherStatusInterface
  manifests: FetcherManifestsInterface
  fetchedPage?: {
    iri: string
    path: string
  }
}

export default function (): CwaFetcherStateInterface {
  return {
    status: reactive({}),
    manifests: reactive({})
  }
}
