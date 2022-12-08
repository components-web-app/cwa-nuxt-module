import { reactive } from 'vue'
import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'

interface FetcherStatusInterface {
  fetch: {
    path?: string
    inProgress: boolean
    paths: { [key: string]: CwaFetcherAsyncResponse|undefined }
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
      fetch: {
        inProgress: false,
        paths: {}
      },
      fetched: {}
    })
  }
}
