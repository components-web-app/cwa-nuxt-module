import { $fetch } from 'ofetch'
import { ref, Ref } from 'vue'

// todo: this is just a utils export of 'fetch' we shouldn't be using a class for this.
export default class CwaFetch {
  public readonly fetch
  public readonly fetchingTotal: Ref<number> = ref(0)

  constructor (baseURL: string) {
    this.fetch = $fetch.create({
      baseURL,
      headers: {
        accept: 'application/ld+json,application/json'
      },
      credentials: 'include',
      onRequest: () => {
        this.fetchingTotal.value++
      },
      onResponse: () => {
        this.fetchingTotal.value--
      },
      onResponseError: () => {
        this.fetchingTotal.value--
      }
    })
  }
}
