import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'
import { reactive } from '#imports'

interface FetchStatusInterface {
  // fetchingEndpoint?: string
  // endpoints: { [key: string]: CwaFetcherAsyncResponse }
  // isFetching: boolean
  // lastFetchSuccess?: boolean
  // fetchedEndpoint?: string
  // fetchedPage?: {
  //   pageIri: string
  //   endpoint: string
  // }

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
  status: FetchStatusInterface
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
