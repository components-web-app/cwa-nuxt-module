import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'
import { reactive } from '#imports'

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
  return reactive({
    status: {
      fetch: {
        inProgress: false,
        paths: {}
      },
      fetched: {}
    }
  })
}
