import { ref, Ref } from 'vue'
import consola from 'consola'

export default class Mercure {
  private eventSource?: EventSource
  private hub?: Ref<string>

  public setMercureHubFromLinkHeader (linkHeader: string) {
    if (this.hub) {
      return
    }
    const matches = linkHeader.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!matches || !matches[1]) {
      consola.log('No Mercure rel in link header.')
      return
    }

    this.hub = ref(matches[1])
    consola.debug('Mercure hub set', this.hub.value)
  }
}
