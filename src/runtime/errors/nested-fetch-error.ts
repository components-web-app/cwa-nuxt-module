import FetchAndSaveError from './fetch-and-save-error'
import { CwaResource } from '@cwa/nuxt-module/runtime/resources/resource-utils'

export default class NestedFetchError extends FetchAndSaveError {
  public readonly resource: CwaResource

  constructor (message: string, originalError: any, resource: CwaResource) {
    super(message, originalError)
    this.name = 'NestedFetchError'
    this.resource = resource
  }
}
