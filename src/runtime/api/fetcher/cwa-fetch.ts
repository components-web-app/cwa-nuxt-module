import { $fetch } from 'ohmyfetch'

export default class CwaFetch {
  public readonly fetch

  constructor (baseURL: string) {
    this.fetch = $fetch.create({
      baseURL,
      headers: {
        accept: 'application/ld+json,application/json'
      }
    })
  }
}
