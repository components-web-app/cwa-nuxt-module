import { watch } from 'vue'
import type { ComputedRef, WatchStopHandle } from 'vue'
import isEqual from 'lodash-es/isEqual'
import type { ResourcesManager } from '../../../resources/resources-manager'
import { CwaResourceTypes, getResourceTypeFromIri } from '../../../resources/resource-utils'
import type { Resources } from '../../../resources/resources'
import type Auth from '../../../api/auth'
import type { CwaCurrentResourceInterface } from '../../../storage/stores/resources/state'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import { useCwa } from '../../../composables/cwa'

const resourceTypeProperty: {
  [CwaResourceTypes.PAGE]: 'pages'
  [CwaResourceTypes.LAYOUT]: 'layouts'
  [CwaResourceTypes.COMPONENT]: 'components'
} = {
  [CwaResourceTypes.PAGE]: 'pages',
  [CwaResourceTypes.LAYOUT]: 'layouts',
  [CwaResourceTypes.COMPONENT]: 'components',
}

interface SyncWatcherOps {
  resource: ComputedRef<CwaCurrentResourceInterface | undefined>
  location: string
  fullReference: ComputedRef<string | undefined>
  allowedComponents: string[] | null
}

export class ComponentGroupUtilSynchronizer {
  private readonly resourcesManager: ResourcesManager
  private readonly resources: Resources
  private readonly auth: Auth
  private watchStopHandle: WatchStopHandle | undefined

  constructor() {
    const { auth, resources, resourcesManager } = useCwa()
    this.resourcesManager = resourcesManager
    this.resources = resources
    this.auth = auth
  }

  public createSyncWatcher(ops: SyncWatcherOps) {
    this.watchStopHandle = watch(
      [this.resources.isLoading, this.auth.signedIn, ops.resource],
      async ([isLoading, signedIn, resource]) => {
        if (!isLoading && signedIn) {
          if (!resource) {
            await this.createComponentGroup(ops.location, ops.fullReference, ops.allowedComponents)
          }
          else if ((resource as CwaCurrentResourceInterface).apiState.status === CwaResourceApiStatuses.SUCCESS) {
            await this.updateAllowedComponents(ops.allowedComponents, resource)
          }
        }
      }, {
        immediate: true,
      })
  }

  public stopSyncWatcher() {
    this.watchStopHandle?.()
  }

  private async createComponentGroup(iri: string, fullReference: ComputedRef<string | undefined>, allowedComponents: string[] | null) {
    const locationResourceType = getResourceTypeFromIri(iri) as keyof typeof resourceTypeProperty
    const locationProperty = resourceTypeProperty[locationResourceType]

    const postData: {
      reference?: string
      location: string
      allowedComponents: string[] | null
      pages?: string[]
      layouts?: string[]
      components?: string[]
    } = {
      reference: fullReference.value,
      location: iri,
      allowedComponents,
    }
    if (locationProperty) {
      postData[locationProperty] = [iri]
    }
    await this.resourcesManager.createResource({
      endpoint: '/_/component_groups',
      data: postData,
    })
  }

  private async updateAllowedComponents(allowedComponents: string[] | null, resource: any) {
    if (isEqual(allowedComponents, resource?.data?.allowedComponents ?? null)) {
      return
    }

    await this.resourcesManager.updateResource({
      endpoint: resource?.data['@id'],
      data: {
        allowedComponents,
      },
    })
  }
}
