import { ref, Ref } from 'vue'
import consola from 'consola'

export default class ApiDocumentation {
  private docsPath?: Ref<string>

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
