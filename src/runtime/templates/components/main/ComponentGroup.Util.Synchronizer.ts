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

interface AllowedComponentRule {
  component: string
  ui?: string[]
  styles?: string[]
}

type AllowedComponentEntry = string | AllowedComponentRule

type AllowedComponentUi = Record<string, { ui?: (string | null)[], styles?: string[] }>

interface ResolvedAllowedComponents {
  allowedComponents: string[] | null
  allowedComponentUi: AllowedComponentUi | null
}

interface SyncWatcherOps {
  resource: ComputedRef<CwaCurrentResourceInterface | undefined>
  location: string
  fullReference: ComputedRef<string>
  allowedComponents: AllowedComponentEntry[] | null | undefined
  maxComponents?: number | null
}

const UNRESOLVED = Symbol('unresolved')
const warnedIriEntries = new Set<string>()

function isRule(entry: unknown): entry is AllowedComponentRule {
  return !!entry && typeof entry === 'object' && typeof (entry as AllowedComponentRule).component === 'string'
}
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

  private async createComponentGroup(iri: string, locationProperty: LocationProperty, fullReference: ComputedRef<string | undefined>, allowedComponents: AllowedComponentEntry[] | null | undefined, maxComponents: number | null | undefined) {
    const resolved = await this.resolveAllowedComponents(allowedComponents)
    if (resolved === UNRESOLVED) {
      return
    }
    const resolvedMaxComponents = this.resolveMaxComponents(maxComponents)

    return this.resourcesManager.createResource({
      endpoint: COMPONENT_GROUPS_ENDPOINT,
      data: {
        reference: fullReference.value,
        location: iri,
        allowedComponents: resolved?.allowedComponents,
        ...(resolved?.allowedComponentUi ? { allowedComponentUi: resolved.allowedComponentUi } : {}),
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

  private async resolveAllowedComponents(allowedComponents: AllowedComponentEntry[] | null | undefined): Promise<ResolvedAllowedComponents | undefined | typeof UNRESOLVED> {
    if (allowedComponents === undefined) return undefined
    if (!allowedComponents?.length) return { allowedComponents: null, allowedComponentUi: null }

    const invalid = allowedComponents.filter(entry => typeof entry !== 'string' && !isRule(entry))
    if (invalid.length) {
      logger.warn(`[CWA] allowedComponents was not synced: ${invalid.map(String).join(', ')} is not a component name.`)
      return UNRESOLVED
    }

    const nameOf = (entry: AllowedComponentEntry) => isRule(entry) ? entry.component : entry
    for (const entry of allowedComponents) {
      const name = nameOf(entry)
      if (name.startsWith('/') && !warnedIriEntries.has(name)) {
        warnedIriEntries.add(name)
        logger.warn(`[CWA] The allowedComponents entry '${name}' is a collection IRI, the old syntax. Use the component name, from CwaComponentNames. IRIs will stop working in the next alpha, without further warning.`)
      }
    }

    const names = allowedComponents.map(nameOf).filter(name => !name.startsWith('/'))
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

    const prefix = ResourceTypeFromIri.getPathPrefix()
    const iriOf = (name: string) => {
      const iri = endpoints[name] ?? name
      return prefix && !iri.startsWith(prefix) ? `${prefix}${iri}` : iri
    }

    const allowedComponentUi: AllowedComponentUi = {}
    for (const rule of allowedComponents.filter(isRule)) {
      const restriction: AllowedComponentUi[string] = {}
      if (rule.ui?.length) {
        restriction.ui = rule.ui.map(ui => ui === `CwaComponent${rule.component}` ? null : ui)
      }
      if (rule.styles?.length) {
        restriction.styles = rule.styles.map(style => `style:${style}`)
      }
      if (Object.keys(restriction).length) {
        allowedComponentUi[iriOf(rule.component)] = restriction
      }
    }

    return {
      allowedComponents: allowedComponents.map(entry => iriOf(nameOf(entry))),
      allowedComponentUi: Object.keys(allowedComponentUi).length ? allowedComponentUi : null,
    }
  }

  private async updateComponentGroup(allowedComponents: AllowedComponentEntry[] | null | undefined, maxComponents: number | null | undefined, resource: any) {
    const data: { allowedComponents?: string[] | null, allowedComponentUi?: AllowedComponentUi | null, maxComponents?: number | null } = {}

    const resolved = await this.resolveAllowedComponents(allowedComponents)
    if (resolved && resolved !== UNRESOLVED) {
      if (!isEqual(resolved.allowedComponents, resource?.data?.allowedComponents ?? null)) {
        data.allowedComponents = resolved.allowedComponents
      }
      if (!isEqual(resolved.allowedComponentUi, resource?.data?.allowedComponentUi ?? null)) {
        data.allowedComponentUi = resolved.allowedComponentUi
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
