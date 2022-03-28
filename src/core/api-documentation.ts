import type { NuxtAxiosInstance } from '@nuxtjs/axios'
import { stateVars } from './storage/CwaVuexModule'

export interface ApiDocsInterface {
  entrypoint: any
  docs: any
}

export class ApiDocumentation {
  private $storage: Storage
  private readonly $state: any
  private $axios: NuxtAxiosInstance
  private apiUrl: string
  private apiDocPromise: Promise<ApiDocsInterface>

  constructor({ $storage, $state, $axios, apiUrl }) {
    this.$storage = $storage
    this.$state = $state
    this.$axios = $axios
    this.apiUrl = apiUrl
  }

  async getApiDocumentation(refresh = false): Promise<ApiDocsInterface> {
    const apiDocumentationStorageKey = stateVars.apiDocumentation

    // wait for the variable
    if (!this.$state[stateVars.docsUrl]) {
      return new Promise((resolve) => {
        this.$storage.watchState(stateVars.docsUrl, (newValue) => {
          if (newValue) {
            this.getApiDocumentation(refresh).then((docs) => {
              resolve(docs)
            })
          }
        })
      })
    }

    if (this.apiDocPromise) {
      return await this.apiDocPromise
    }

    // fetch.. but if we have already asked for it to be fetched, let us prevent many requests.
    if (!refresh && this.$state[apiDocumentationStorageKey]) {
      return this.$state[apiDocumentationStorageKey]
    }

    this.apiDocPromise = new Promise((resolve) => {
      Promise.all([
        this.$axios.$get(this.apiUrl),
        this.$axios.$get(this.$state[stateVars.docsUrl])
      ]).then((responses) => {
        this.$storage.setState(apiDocumentationStorageKey, {
          entrypoint: responses[0],
          docs: responses[1]
        })
        resolve(this.$state[apiDocumentationStorageKey])
      })
    })
    return await this.apiDocPromise
  }
}

export default ApiDocumentation
