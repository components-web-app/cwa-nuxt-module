import { Mercure } from '@cwa/nuxt-module/runtime/api/mercure'

export class Fetcher {
  private readonly mercure: Mercure

  constructor () {
    this.mercure = new Mercure()
  }
}
