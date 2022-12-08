import { reactive } from 'vue'
import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'
import { ReactiveVariable } from 'vue/macros'

interface FetcherStatusInterface {
  fetch: {
    path?: string
    paths: { [key: string]: CwaFetcherAsyncResponse|undefined }
    success?: boolean
  }
  fetched: {
    path?: string
  }
}

export interface CwaFetcherStateInterface {
  status: ReactiveVariable<FetcherStatusInterface>
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
