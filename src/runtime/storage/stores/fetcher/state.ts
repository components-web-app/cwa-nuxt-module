import { reactive } from 'vue'

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

export interface CwaFetcherStateInterface {
  status: FetcherStatusInterface
  fetchedPage?: {
    iri: string
    path: string
  }
}

export default function (): CwaFetcherStateInterface {
  return {
    status: reactive({})
  }
}
