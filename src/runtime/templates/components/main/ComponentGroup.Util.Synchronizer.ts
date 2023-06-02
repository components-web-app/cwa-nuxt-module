import { ComputedRef, watch, WatchStopHandle } from 'vue'
// @ts-ignore
import _isEqual from 'lodash/isEqual.js'
import type { ResourcesManager } from '#cwa/runtime/resources/resources-manager'
import { CwaResource, CwaResourceTypes, getResourceTypeFromIri } from '#cwa/runtime/resources/resource-utils'
import type { Resources } from '#cwa/runtime/resources/resources'
import type Auth from '#cwa/runtime/api/auth'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import { useCwa } from '#cwa/runtime/composables/cwa'

const resourceTypeProperty = {
  [CwaResourceTypes.PAGE]: 'pages',
  [CwaResourceTypes.LAYOUT]: 'layouts',
  [CwaResourceTypes.COMPONENT]: 'components'
}

export class ComponentGroupUtilSynchronizer {
  private readonly resourcesManager: ResourcesManager
  private readonly resources: Resources
  private readonly auth: Auth
  private watcher: WatchStopHandle|undefined

  constructor () {
    const { auth, resources, resourcesManager } = useCwa()
    this.resourcesManager = resourcesManager
    this.resources = resources
    this.auth = auth
  }

  public createSyncWatcher (resourceRef: ComputedRef<CwaResource>, location: string, fullReference: ComputedRef<string>, allowedComponents: any[]) {
    this.watcher = watch(
      () => [this.resources.isLoading.value, this.auth.signedIn.value, resourceRef.value],
      async ([isLoading, signedIn, resource]) => {
        if (!isLoading && signedIn) {
          if (!resource) {
            await this.createComponentGroup(location, fullReference, allowedComponents)
          } else if ((resource as CwaResource).apiState.status === CwaResourceApiStatuses.SUCCESS) {
            await this.updateAllowedComponents(allowedComponents, resource)
          }
        }
      }, {
        immediate: true
      })
  }

  // TODO: TEST THIS
  public stopSyncWatcher () {
    this.watcher?.()
  }

  private async createComponentGroup (iri: string, fullReference: ComputedRef<string>, allowedComponents: any[]) {
    const locationResourceType = getResourceTypeFromIri(iri) as keyof typeof resourceTypeProperty
    const locationProperty = resourceTypeProperty[locationResourceType]

    const postData = {
      reference: fullReference.value,
      location: iri,
      allowedComponents
    }
    if (locationProperty) {
      // @ts-ignore
      postData[locationProperty] = [iri]
    }
    await this.resourcesManager.createResource({
      endpoint: '/_/component_groups',
      data: postData
    })
  }

  private async updateAllowedComponents (allowedComponents: any[], resource: any) {
    if (_isEqual(allowedComponents, resource?.data?.allowedComponents)) {
      return
    }

    await this.resourcesManager.updateResource({
      endpoint: resource?.data['@id'],
      data: {
        allowedComponents
      }
    })
  }
}
