import { ref, Ref, watch } from 'vue'
import consola from 'consola'
import { $fetch } from 'ohmyfetch'
import {
  ApiDocumentationStore, CwaApiDocumentationStoreWithStateInterface
} from '../storage/stores/api-documentation/api-documentation-store'
import { CwaApiDocumentationDataInterface } from '../storage/stores/api-documentation/state'

export default class ApiDocumentation {
  private readonly apiUrl: string
  private readonly storeDefinition: ApiDocumentationStore
  private readonly apiDocsSet: Ref<boolean> = ref(false)
  private apiDocPromise: Promise<void>|undefined

  constructor (apiUrl: string, store: ApiDocumentationStore) {
    this.apiUrl = apiUrl
    this.storeDefinition = store
    this.apiDocsSet = ref(!!this.docsPath)
    if (!this.apiDocsSet.value) {
      this.store.$subscribe((mutation) => {
        if (!this.apiDocsSet.value && mutation.type === 'patch object' && mutation.payload.docsPath) {
          this.apiDocsSet.value = true
        }
      })
    }
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
    consola.debug('ApiDocumentation docsPath', this.docsPath)
  }

  public async getApiDocumentation (refresh = false): Promise<CwaApiDocumentationDataInterface|undefined> {
    // check if api docs is set and if not, wait for it to be set and continue
    if (!this.docsPath) {
      consola.debug('Waiting for docsPath to bet set to fetch API Documentation')
      return new Promise((resolve) => {
        watch(this.apiDocsSet, async (isSet: boolean) => {
          if (isSet) {
            const docs = await this.getApiDocumentation(refresh)
            resolve(docs)
          }
        })
      })
    }

    // if we are already fetching api docs then we will return when that is complete
    if (this.apiDocPromise) {
      consola.debug('Waiting for previous request to complete for API Documentation')
      await this.apiDocPromise
      return this.store.$state.apiDocumentation
    }

    // if we already have api docs and do not want to refresh, return what we have
    if (!refresh && this.store.apiDocumentation) {
      consola.debug('Not refreshing API Documentation. Returning cached data.')
      return this.store.$state.apiDocumentation
    }

    // create a promise to fetch the 2 endpoints for all api documentation
    consola.debug('Fetching API Documentation')
    this.apiDocPromise = Promise.all([
      this.doRequest(this.apiUrl),
      this.doRequest(this.docsPath)
    ]).then((responses) => {
      this.store.$patch({
        apiDocumentation: {
          entrypoint: responses[0],
          docs: responses[1]
        }
      })
      consola.debug('New API Documentation Saved')
    })

    // wait for the promises to resolve
    await this.apiDocPromise

    // unset the promise and return as we will have patched the docs now
    this.apiDocPromise = undefined

    return this.store.$state.apiDocumentation
  }

  private async doRequest (path: string) {
    const headers = {
      accept: 'application/ld+json,application/json'
    }
    return await $fetch(path, { headers })
  }

  private get store (): CwaApiDocumentationStoreWithStateInterface {
    return this.storeDefinition.useStore()
  }

  private get docsPath () {
    return this.store.$state.docsPath
  }
}
