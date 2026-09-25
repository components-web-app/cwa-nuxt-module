import type Cwa from '#cwa/cwa'
import { watch } from 'vue'
import type { ComputedRef, WatchStopHandle } from 'vue'
import isEqual from 'lodash-es/isEqual'
import { consola as logger } from 'consola'
import type { ResourcesManager } from '../../../resources/resources-manager'
import { CwaResourceTypes, ResourceTypeFromIri, getResourceTypeFromIri } from '../../../resources/resource-utils'
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
  allowedComponents: string[] | null | undefined
}

const UNRESOLVED = Symbol('unresolved')

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
      // simpler to update the location resource, except for when there are multiple simultaneous requests which can happen.
      // then we could lose data of a component group being added. Safer to update the component group as it's less
      // common for there to be another simultaneous update call
      const locationIri = locationResource.value.data['@id']
      const locationResourceType = getResourceTypeFromIri(locationIri) as keyof typeof resourceTypeProperty
      const locationProperty = resourceTypeProperty[locationResourceType]
      const existingLocations = this.toLocationIris(resourceByRef[locationProperty])
      if (existingLocations.includes(locationIri)) {
        return
      }
      await this.resourcesManager.updateResource({
        endpoint: resourceByRef['@id'],
        data: {
          [locationProperty]: [...existingLocations, locationIri],
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
        await this.$cwa.addUniquePromise('component_group_sync', `${ops.fullReference.value}-${ops.location}`, async () => {
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

  private async createComponentGroup(iri: string, fullReference: ComputedRef<string | undefined>, allowedComponents: string[] | null | undefined) {
    const locationResourceType = getResourceTypeFromIri(iri) as keyof typeof resourceTypeProperty
    const locationProperty = resourceTypeProperty[locationResourceType]

    const resolvedAllowedComponents = await this.resolveAllowedComponents(allowedComponents)
    if (resolvedAllowedComponents === UNRESOLVED) {
      return
    }

    const postData: {
      reference?: string
      location: string
      allowedComponents?: string[] | null
      pages?: string[]
      layouts?: string[]
      components?: string[]
    } = {
      reference: fullReference.value,
      location: iri,
      allowedComponents: resolvedAllowedComponents,
    }
    if (locationProperty) {
      postData[locationProperty] = [iri]
    }
    await this.resourcesManager.createResource({
      endpoint: '/_/component_groups',
      data: postData,
    })
  }

  private toLocationIris(locations: unknown): string[] {
    if (!Array.isArray(locations)) {
      return []
    }
    return locations.reduce<string[]>((iris, location) => {
      const iri = typeof location === 'string' ? location : (location as { '@id'?: string })?.['@id']
      if (iri) {
        iris.push(iri)
      }
      return iris
    }, [])
  }

  private async resolveAllowedComponents(allowedComponents: string[] | null | undefined): Promise<string[] | null | undefined | typeof UNRESOLVED> {
    if (!allowedComponents) return allowedComponents
    if (!allowedComponents.length) return null

    const invalid = allowedComponents.filter(entry => typeof entry !== 'string')
    if (invalid.length) {
      logger.warn(`[CWA] allowedComponents was not synced: ${invalid.map(String).join(', ')} is not a component name.`)
      return UNRESOLVED
    }

    const names = allowedComponents.filter(entry => !entry.startsWith('/'))
    let endpoints: Record<string, string> = {}
    if (names.length) {
      const metadata = await this.$cwa.getComponentMetadata()
      if (!metadata) {
        return UNRESOLVED
      }
      const unknown = names.filter(name => !metadata[name])
      if (unknown.length) {
        logger.warn(`[CWA] allowedComponents was not synced: the API has no component named ${unknown.join(', ')}.`)
        return UNRESOLVED
      }
      endpoints = Object.fromEntries(names.map(name => [name, metadata[name]!.endpoint]))
    }

    const iris = allowedComponents.map(entry => endpoints[entry] ?? entry)
    const prefix = ResourceTypeFromIri.getPathPrefix()
    if (!prefix) return iris
    return iris.map(iri => iri.startsWith(prefix) ? iri : `${prefix}${iri}`)
  }

  private async updateAllowedComponents(allowedComponents: string[] | null | undefined, resource: any) {
    if (allowedComponents === undefined) return
    const stored = resource?.data?.allowedComponents
    const normalized = await this.resolveAllowedComponents(allowedComponents)
    if (normalized === UNRESOLVED || isEqual(normalized, stored ?? null)) {
      return
    }

    await this.resourcesManager.updateResource({
      endpoint: resource?.data['@id'],
      data: {
        allowedComponents: normalized,
      },
    })
  }
}
