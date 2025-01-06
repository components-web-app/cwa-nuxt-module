import { $fetch, type $Fetch } from 'ofetch'
import { useRequestHeaders } from '#imports'

// todo: this is just a utils export of 'fetch' we shouldn't be using a class for this.
export default class CwaFetch {
  public readonly fetch: $Fetch

  constructor(baseURL: string) {
    this.fetch = $fetch.create({
      baseURL,
      headers: {
        accept: 'application/ld+json,application/json',
      },
      credentials: 'include',
      onRequest(ctx) {
        if (import.meta.server) {
          const { cookie } = useRequestHeaders(['cookie'])
          cookie && ctx.options.headers.append('cookie', cookie)
        }
      },
    })
  }
}
