import { $fetch } from 'ofetch'

// todo: this is just a utils export of 'fetch' we shouldn't be using a class for this.
export default class CwaFetch {
  public readonly fetch

  constructor (baseURL: string) {
    this.fetch = $fetch.create({
      baseURL,
      headers: {
        accept: 'application/ld+json,application/json'
      },
      credentials: 'include'
    })
  }
}
