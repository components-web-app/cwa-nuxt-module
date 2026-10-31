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
import type { CwaResource } from '../../../resources/resource-utils'
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

type LocationProperty = typeof resourceTypeProperty[keyof typeof resourceTypeProperty]

interface SyncWatcherOps {
  resource: ComputedRef<CwaCurrentResourceInterface | undefined>
  location: string
  fullReference: ComputedRef<string>
  allowedComponents: string[] | null | undefined
  maxComponents?: number | null
}

const UNRESOLVED = Symbol('unresolved')
const COMPONENT_GROUPS_ENDPOINT = '/_/component_groups'

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
    { allowedComponents, maxComponents, location, fullReference }: SyncWatcherOps,
    [isAdmin, componentGroupResource]: [boolean, CwaCurrentResourceInterface | undefined],
  ) {
    if (!isAdmin) {
      return
    }
    // if the component groups exists, we can check if the allowed components are in sync
    if (componentGroupResource) {
      if (componentGroupResource.apiState.status === CwaResourceApiStatuses.SUCCESS) {
        await this.updateComponentGroup(allowedComponents, maxComponents, componentGroupResource)
      }
      return
    }

    const locationProperty = this.locationPropertyFor(location)
    if (!locationProperty) {
      logger.warn(`[CWA] The component group '${fullReference.value}' was not created or attached: its location '${location}' cannot own a component group. A component group cannot be owned by page data, so it would be invisible to visitors and reported as orphaned. Pass the page IRI as the location instead.`)
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
    const lookupPath = `/_/component_groups/${fullReference.value}`
    const resourceByRef = await this.$cwa.fetchResource({ path: lookupPath })

    if (resourceByRef) {
      await this.attachLocation(resourceByRef, locationProperty, locationResource.value.data['@id'])
      return
    }

    if (!this.isNotFound(lookupPath)) {
      return
    }

    const created = await this.createComponentGroup(location, locationProperty, fullReference, allowedComponents, maxComponents)
    if (created !== undefined) {
      return
    }

    const duplicateReference = this.resourcesManager.errors.find(error => error.event?.endpoint === COMPONENT_GROUPS_ENDPOINT && error.violations?.some(violation => violation.property === 'reference'))
    if (!duplicateReference) {
      return
    }
    this.resourcesManager.removeError(duplicateReference.timestamp)
    const existing = await this.$cwa.fetchResource({ path: lookupPath })
    if (existing) {
      await this.attachLocation(existing, locationProperty, locationResource.value.data['@id'])
    }
  }

  private async attachLocation(componentGroup: CwaResource, locationProperty: LocationProperty, locationIri: string) {
    // simpler to update the location resource, except for when there are multiple simultaneous requests which can happen.
    // then we could lose data of a component group being added. Safer to update the component group as it's less
    // common for there to be another simultaneous update call
    const existingLocations = this.toLocationIris(componentGroup[locationProperty])
    if (existingLocations.includes(locationIri)) {
      return
    }
    await this.resourcesManager.updateResource({
      endpoint: componentGroup['@id'],
      data: {
        [locationProperty]: [...existingLocations, locationIri],
      },
    })
  }

  private isNotFound(iri: string) {
    const apiState = this.resources.getResource(iri).value?.apiState
    return apiState?.status === CwaResourceApiStatuses.ERROR && apiState.error?.statusCode === 404
  }

  public createSyncWatcher(ops: SyncWatcherOps) {
    this.watchStopHandle = watch(
      [
        this.auth.isAdmin,
        ops.resource,
      ],
      async (
        [
          currentIsAdmin,
          currentResource,
        ],
      ) => {
        await this.$cwa.addUniquePromise('component_group_sync', `${ops.fullReference.value}-${ops.location}`, async () => {
          await this.createComponentGroupWatchHandler(ops, [currentIsAdmin, currentResource])
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

  private locationPropertyFor(iri: string): LocationProperty | undefined {
    const locationResourceType = getResourceTypeFromIri(iri)
    if (!locationResourceType || !(locationResourceType in resourceTypeProperty)) {
      return undefined
    }
    return resourceTypeProperty[locationResourceType as keyof typeof resourceTypeProperty]
  }

  private async createComponentGroup(iri: string, locationProperty: LocationProperty, fullReference: ComputedRef<string | undefined>, allowedComponents: string[] | null | undefined, maxComponents: number | null | undefined) {
    const resolvedAllowedComponents = await this.resolveAllowedComponents(allowedComponents)
    if (resolvedAllowedComponents === UNRESOLVED) {
      return
    }
    const resolvedMaxComponents = this.resolveMaxComponents(maxComponents)

    return this.resourcesManager.createResource({
      endpoint: COMPONENT_GROUPS_ENDPOINT,
      data: {
        reference: fullReference.value,
        location: iri,
        allowedComponents: resolvedAllowedComponents,
        ...(resolvedMaxComponents === UNRESOLVED || resolvedMaxComponents === undefined ? {} : { maxComponents: resolvedMaxComponents }),
        [locationProperty]: [iri],
      },
    })
  }

  private resolveMaxComponents(maxComponents: number | null | undefined): number | null | undefined | typeof UNRESOLVED {
    if (maxComponents === undefined || maxComponents === null) return maxComponents
    if (!Number.isInteger(maxComponents) || maxComponents < 1) {
      logger.warn(`[CWA] maxComponents was not synced: ${maxComponents} is not a positive whole number.`)
      return UNRESOLVED
    }
    return maxComponents
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

  private async updateComponentGroup(allowedComponents: string[] | null | undefined, maxComponents: number | null | undefined, resource: any) {
    const data: { allowedComponents?: string[] | null, maxComponents?: number | null } = {}

    if (allowedComponents !== undefined) {
      const normalized = await this.resolveAllowedComponents(allowedComponents)
      if (normalized !== UNRESOLVED && !isEqual(normalized, resource?.data?.allowedComponents ?? null)) {
        data.allowedComponents = normalized
      }
    }

    const resolvedMaxComponents = this.resolveMaxComponents(maxComponents)
    if (resolvedMaxComponents !== undefined && resolvedMaxComponents !== UNRESOLVED && resolvedMaxComponents !== (resource?.data?.maxComponents ?? null)) {
      data.maxComponents = resolvedMaxComponents
    }

    if (!Object.keys(data).length) {
      return
    }

    await this.resourcesManager.updateResource({
      endpoint: resource?.data['@id'],
      data,
    })
  }
}
