import { reactive } from 'vue'
import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'

interface FetcherStatusInterface {
  fetch: {
    path?: string
    success?: boolean
  }
  fetched: {
    path?: string
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
    status: reactive({
      fetch: {},
      fetched: {}
    })
  }
}
