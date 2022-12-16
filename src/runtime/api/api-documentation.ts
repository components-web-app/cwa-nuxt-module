import { ref, Ref, watch } from 'vue'
import consola from 'consola'
import {
  ApiDocumentationStore, CwaApiDocumentationStoreInterface
} from '../storage/stores/api-documentation/api-documentation-store'
import { CwaApiDocumentationDataInterface } from '../storage/stores/api-documentation/state'
import CwaFetch from './fetcher/cwa-fetch'

export default class ApiDocumentation {
  private readonly cwaFetch: CwaFetch
  private readonly storeDefinition: ApiDocumentationStore
  private readonly apiDocsSet: Ref<boolean> = ref(false)
  private apiDocPromise: Promise<void>|undefined

  constructor (cwaFetch: CwaFetch, store: ApiDocumentationStore) {
    this.cwaFetch = cwaFetch
    this.storeDefinition = store
    this.apiDocsSet = ref(!!this.docsPath)
  }

  public setDocsPathFromLinkHeader (linkHeader: string) {
    if (this.docsPath) {
      return
    }
    const matches =
      /<(.+)>; rel="http:\/\/www.w3.org\/ns\/hydra\/core#apiDocumentation"/.exec(
        linkHeader
      )
    if (!matches || !matches[1]) {
      consola.error(
        'The "Link" HTTP header is not of the type "http://www.w3.org/ns/hydra/core#apiDocumentation".'
      )
      return
    }

    this.store.$patch({
      docsPath: matches[1]
    })
    this.apiDocsSet.value = true
    consola.debug('ApiDocumentation docsPath', this.docsPath)
  }

  public async getApiDocumentation (refresh = false): Promise<CwaApiDocumentationDataInterface|undefined> {
    // check if api docs is set and if not, wait for it to be set and continue
    if (!this.docsPath) {
      consola.debug('Waiting for docsPath to bet set to fetch API Documentation')
      return this.reRunGetApiDocumentationWhenReady(refresh)
    }

    const currentDocs = this.getCurrentApiDocs(refresh)
    if (currentDocs) {
      return currentDocs
    }

    consola.debug('Fetching API Documentation')
    return await this.fetchAllApiDocumentation(this.docsPath)
  }

  private reRunGetApiDocumentationWhenReady (refresh = false): Promise<CwaApiDocumentationDataInterface|undefined> {
    return new Promise((resolve) => {
      watch(this.apiDocsSet, async (isSet: boolean) => {
        if (isSet) {
          const docs = await this.getApiDocumentation(refresh)
          resolve(docs)
        }
      })
    })
  }

  private getCurrentApiDocs (refresh: boolean) {
    if (!this.apiDocPromise && !refresh && this.store.$state.apiDocumentation) {
      consola.debug('Not refreshing API Documentation. Returning cached data.')
      return this.store.$state.apiDocumentation
    }
    return null
  }

  private async awaitApiDocPromise () {
    consola.debug('Waiting for previous request to complete for API Documentation')
    await this.apiDocPromise
    return this.store.$state.apiDocumentation
  }

  private async fetchAllApiDocumentation (docsPath: string): Promise<CwaApiDocumentationDataInterface|undefined> {
    if (this.apiDocPromise) {
      return await this.awaitApiDocPromise()
    }
    this.apiDocPromise = Promise.all([
      this.doRequest('/'),
      this.doRequest(docsPath)
    ]).then((responses) => {
      this.store.$patch({
        apiDocumentation: {
          entrypoint: responses[0],
          docs: responses[1]
        }
      })
      consola.debug('New API Documentation Saved')
      this.apiDocPromise = undefined
    })
    await this.apiDocPromise
    return this.store.$state.apiDocumentation
  }

  private async doRequest (path: string) {
    return await this.cwaFetch.fetch(path)
  }

  private get store (): CwaApiDocumentationStoreInterface {
    return this.storeDefinition.useStore()
  }

  private get docsPath () {
    return this.store.$state.docsPath
  }
}
