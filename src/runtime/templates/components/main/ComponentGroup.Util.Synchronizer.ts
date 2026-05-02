import type Cwa from '#cwa/cwa'
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
  fullReference: ComputedRef<string>
  allowedComponents: string[] | null
}

export class ComponentGroupUtilSynchronizer {
  private readonly resourcesManager: ResourcesManager
  private readonly resources: Resources
  private readonly auth: Auth
  private watchStopHandle: WatchStopHandle | undefined
  private $cwa: Cwa

  constructor() {
    this.$cwa = useCwa()
    this.resourcesManager = this.$cwa.resourcesManager
    this.resources = this.$cwa.resources
    this.auth = this.$cwa.auth
  }

  private async createComponentGroupWatchHandler(
    { allowedComponents, location, fullReference }: SyncWatcherOps,
    [signedIn, componentGroupResource]: [boolean, CwaCurrentResourceInterface | undefined],
  ) {
    // not signed in? we shouldn't have permissions anyway to do anything in creating new component groups
    if (!signedIn) {
      return
    }
    // if the component groups exists, we can check if the allowed components are in sync
    if (componentGroupResource) {
      if (componentGroupResource.apiState.status === CwaResourceApiStatuses.SUCCESS) {
        await this.updateAllowedComponents(allowedComponents, componentGroupResource)
      }
      return
    }

    // find the resource where this component group should be located
    const locationResource = this.resources.getResource(location)
    // no location, no action
    if (!locationResource.value?.data) {
      return
    }

    // at this point we are going to be performing an API request to update or create resources.
    // Check if the resource reference already exists, may not be assigned to this location yet
    const resourceByRef = await this.$cwa.fetchResource({
      path: `/_/component_groups/${fullReference.value}`,
    })

    if (resourceByRef) {
      await this.resourcesManager.updateResource({
        endpoint: locationResource.value.data['@id'],
        data: {
          componentGroups: [
            ...(locationResource.value.data.componentGroups || []),
            resourceByRef['@id'],
          ],
        },
      })
      return
    }

    await this.createComponentGroup(location, fullReference, allowedComponents)
  }

  public createSyncWatcher(ops: SyncWatcherOps) {
    this.watchStopHandle = watch(
      [
        this.auth.signedIn,
        ops.resource,
      ],
      async (
        [
          currentSignedIn,
          currentResource,
        ],
      ) => {
        await this.$cwa.addUniquePromise('component_group_sync', ops.fullReference.value, async () => {
          await this.createComponentGroupWatchHandler(ops, [currentSignedIn, currentResource])
        })
      },
      {
        immediate: true,
      },
    )
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
