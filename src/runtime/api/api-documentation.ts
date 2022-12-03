import { ref, Ref } from 'vue'
import consola from 'consola'
import {
  ApiDocumentationStore
} from '../storage/stores/api-documentation/api-documentation-store'
import { CwaApiDocumentationStateInterface } from '../storage/stores/api-documentation/state'

export default class ApiDocumentation {
  private docsPath?: Ref<string>
  private storeDefinition: ApiDocumentationStore

  constructor (store: ApiDocumentationStore) {
    this.storeDefinition = store
  }

  private get store (): CwaApiDocumentationStateInterface {
    return this.storeDefinition.useStore()
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
    this.docsPath = ref(matches[1])
    consola.debug('ApiDocumentation docsPath', this.docsPath.value)
  }
}
