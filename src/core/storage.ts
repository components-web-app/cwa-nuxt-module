import consola from 'consola'
import { getProp } from '../utils'
import CwaVuexModule, { stateVars } from './storage/CwaVuexModule/index'

export const StoreCategories = {
  PageData: 'PageData',
  Component: 'Component'
}

export type resourcesState = {
  byId: object
  allIds: string[]
  currentIds?: string[]
  extensions?: {
    [key: string]: any
  }
}

export class Storage {
  public ctx: any
  public options: any
  public state: any

  constructor(ctx, options) {
    this.ctx = ctx
    this.options = options

    this._initState()
  }

  isResourceSame(resource1, resource2): boolean {
    const cleanResourceForComparison = (obj): any => {
      const newObj = Object.assign({}, obj)
      // remove sort collection - api should not return fix
      // todo: remove when the API is fixed
      delete newObj.sortCollection
      // remove published resource
      delete newObj.publishedResource
      // remove draft resource
      delete newObj.draftResource
      // remove modified at timestamp
      delete newObj.modifiedAt
      // remove metadata, can include things specific to the resource such as published timestamps
      delete newObj._metadata
      // remove null values
      Object.keys(newObj).forEach((k) => newObj[k] === null && delete newObj[k])
      return JSON.stringify(newObj)
    }
    const resource1String = cleanResourceForComparison(resource1)
    const resource2String = cleanResourceForComparison(resource2)
    return resource1String === resource2String
  }

  _initState() {
    const module = CwaVuexModule(this)
    this.ctx.store.registerModule(this.options.vuex.namespace, module, {
      preserveState: Boolean(this.ctx.store.state[this.options.vuex.namespace])
    })

    this.state = this.ctx.store.state[this.options.vuex.namespace]
  }

  deleteResource(id) {
    const category = this.getCategoryFromIri(id)
    const name = this.getTypeFromIri(id, category)
    this.ctx.store.commit(this.options.vuex.namespace + '/DELETE_RESOURCE', {
      id,
      name,
      category
    })
  }

  mapDraftResource({ publishedIri, draftIri }) {
    this.ctx.store.commit(this.options.vuex.namespace + '/MAP_DRAFT_RESOURCE', {
      publishedIri,
      draftIri
    })
  }

  clearDraftResources() {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/CLEAR_DRAFT_RESOURCES'
    )
  }

  setResource({
    resource,
    isNew,
    category,
    force
  }: {
    resource: any
    isNew?: boolean
    category?: string
    force?: boolean
  }) {
    const id = resource['@id']
    category = category || this.getCategoryFromIri(id)
    const name = resource['@type'] || this.getTypeFromIri(id, category)
    this.ctx.store.commit(this.options.vuex.namespace + '/SET_RESOURCE', {
      id,
      name,
      isNew: isNew || false,
      resource,
      category,
      force
    })

    this.populateCollectionComponentResources({ resource, isNew, force })
  }

  private populateCollectionComponentResources({
    resource,
    isNew,
    force
  }: {
    resource: any
    isNew?: boolean
    force?: boolean
  }) {
    if (resource?._metadata?.collection === true) {
      for (const item of resource?.collection['hydra:member']) {
        const existingItem = this.getResource(item['@id'])
        if (existingItem) {
          this.setResource({
            resource: { ...existingItem, ...item },
            isNew,
            force
          })
        } else {
          this.setResource({ resource: item, isNew, force })
        }
      }
    }
  }

  setCurrentRoute(id) {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/SET_CURRENT_ROUTE',
      id
    )
  }

  get currentRoute() {
    const routeResources = this.state.resources.current?.Route || {}
    return routeResources?.byId?.[routeResources.current] || null
  }

  get mercurePendingProcesses() {
    return this.getState(stateVars.mercurePendingProcesses)
  }

  increaseMercurePendingProcessCount(requestCount: number = 1) {
    this.setState(
      stateVars.mercurePendingProcesses,
      this.mercurePendingProcesses + requestCount
    )
  }

  decreaseMercurePendingProcessCount(requestCount: number = 1) {
    const calcValue = this.mercurePendingProcesses - requestCount
    if (calcValue < 0) {
      consola.warn(
        'Cannot decrease Mercure pending processes counter to less than 0'
      )
    }
    const newValue = Math.max(calcValue, 0)
    this.setState(stateVars.mercurePendingProcesses, newValue)
  }

  setState(key, value) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET', {
      key,
      value
    })

    return value
  }

  resetCurrentResources() {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/RESET_CURRENT_RESOURCES'
    )
  }

  mergeNewResources() {
    this.ctx.store.commit(this.options.vuex.namespace + '/MERGE_NEW_RESOURCES')
  }

  getState(key) {
    return this.state[key]
  }

  getCategoryFromIri(iri: string) {
    if (!iri) {
      throw new Error('getCategoryFromIri requires the iri parameter')
    }
    if (iri.startsWith('/component/')) {
      return StoreCategories.Component
    }
    if (iri.startsWith('/page_data/')) {
      return StoreCategories.PageData
    }
    return 'Default'
  }

  findDraftIri(iri) {
    const resource = this.getResource(iri)
    if (!resource) {
      return null
    }
    if (resource._metadata.published === false) {
      return iri
    }
    const draftMappedIri = this.state.resources.draftMapping[iri]
    const draftResource = this.getResource(draftMappedIri)
    if (draftResource._metadata.published === false) {
      return draftMappedIri
    }
    return null
  }

  findPublishedIri(iri) {
    for (const [publishedIri, draftIri] of Object.entries(
      this.state.resources.draftMapping
    )) {
      if (draftIri === iri) {
        if (draftIri === publishedIri) {
          return null
        }
        return publishedIri
      }
    }

    const resource = this.getResource(iri)
    if (!resource) {
      return null
    }
    if (resource?._metadata?.published === true) {
      return iri
    }
    return null
  }

  getResource(iri: string) {
    if (iri === null) {
      throw new Error(
        'getResource iri parameter requires a string. Null given.'
      )
    }
    const category = this.getCategoryFromIri(iri)
    const type = this.getTypeFromIri(iri, category)
    if (!type) {
      consola.trace(
        `Could not resolve a resource type for iri ${iri} in the category ${category}. The resource does not exist.`
      )
      return null
    }
    consola.trace(
      `Resolved resource type for iri ${iri} in the category ${category} to ${type}`
    )
    return this.state.resources.current[type].byId?.[iri] || null
  }

  getTypeFromIri(iri, category?: string) {
    if (!category) {
      category = this.getCategoryFromIri(iri)
    }
    return this.get('GET_TYPE_FROM_IRI')({ iri, category })
  }

  areResourcesOutdated() {
    return this.get('RESOURCES_OUTDATED')
  }

  get(getter) {
    return this.ctx.store.getters[`${this.options.vuex.namespace}/${getter}`]
  }

  getCollectionByPlacement({ iri, name }) {
    const collectionIri = this.get('COLLECTION_BY_PLACEMENT')({ iri, name })
    if (!collectionIri) {
      return null
    }
    return this.getResource(collectionIri)
  }

  watchState(key, fn) {
    return this.ctx.store.watch(
      (state) => getProp(state[this.options.vuex.namespace], key),
      fn
    )
  }

  removeState(key) {
    this.setState(key, undefined)
  }

  togglePublishable(draftIri: string, showPublished: boolean) {
    this.ctx.store.commit(this.options.vuex.namespace + '/TOGGLE_PUBLISHABLE', {
      iri: draftIri,
      showPublished
    })
  }

  isIriMappedToPublished(iri: string): boolean {
    return this.state.resources.mapToPublished.includes(iri)
  }

  setCloneComponent(iri: string) {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/SET_CLONE_COMPONENT',
      iri
    )
  }

  setCloneFromPath(iri: string) {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/SET_CLONE_FROM_PATH',
      iri
    )
  }

  setCloneDestination(iri: string) {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/SET_CLONE_DESTINATION',
      iri
    )
  }

  setCloneNavigate(navigate: boolean) {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/SET_CLONE_NAVIGATE',
      navigate
    )
  }

  fetchComponentMetadata() {
    return this.ctx.store.dispatch(
      this.options.vuex.namespace + '/fetchComponentMetadata'
    )
  }
}

export default Storage
