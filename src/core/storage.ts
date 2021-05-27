import Vue from 'vue'
import consola from 'consola'
import { getProp } from '../utils'

export const StoreCategories = {
  PageData: 'PageData',
  Component: 'Component'
}

export type resourcesState = {
  byId: object
  allIds: string[]
  currentIds?: string[]
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

  _initState() {
    const storeModule = {
      namespaced: true,
      state: () => ({
        mercurePendingProcesses: 0,
        editMode: false,
        resources: {
          new: {},
          current: {},
          categories: {},
          draftMapping: {},
          mapToPublished: []
        }
      }),
      mutations: {
        TOGGLE_PUBLISHABLE(
          state,
          { iri, showPublished }: { iri: string; showPublished: boolean }
        ) {
          if (showPublished) {
            if (!state.resources.mapToPublished.includes(iri)) {
              state.resources.mapToPublished.push(iri)
            }
          } else {
            const useLiveIndex = state.resources.mapToPublished.indexOf(iri)
            if (useLiveIndex !== -1) {
              state.resources.mapToPublished.splice(useLiveIndex, 1)
            }
          }
        },
        SET(state, payload) {
          Vue.set(state, payload.key, payload.value)
        },
        MAP_DRAFT_RESOURCE(state, { publishedIri, draftIri }) {
          if (draftIri === null) {
            Vue.delete(state.resources.draftMapping, publishedIri)
          } else {
            Vue.set(state.resources.draftMapping, publishedIri, draftIri)
          }
        },
        DELETE_RESOURCE(state, payload) {
          const doDeleteResource = (state, payload) => {
            ;['new', 'current'].forEach((stateName) => {
              const resourceState = state.resources[stateName]
              if (!resourceState) {
                return
              }
              const namedResources = resourceState[payload.name]
              if (!namedResources) {
                return
              }

              const allIdsIndex = namedResources.allIds.indexOf(payload.id)
              if (allIdsIndex !== -1) {
                // Delete positions if a component
                // Should this really be done here??
                // Or should this be the responsibility of the task that is deleting a resource...
                // will positions actually be deleted?? We can't guarantee that can we, so
                // by doing this we are making assumptions...
                if (payload.category === StoreCategories.Component) {
                  const componentPositions =
                    namedResources.byId[payload.id]?.componentPositions
                  if (componentPositions) {
                    componentPositions.forEach((positionIri) => {
                      doDeleteResource(state, {
                        id: positionIri,
                        name: 'ComponentPosition',
                        category: 'Default'
                      })
                    })
                  }
                }

                // Delete from id mapping table
                namedResources.allIds.splice(allIdsIndex, 1)
                if (namedResources.currentIds) {
                  const currentIdsIndex = namedResources.currentIds.indexOf(
                    payload.id
                  )
                  if (currentIdsIndex !== -1) {
                    namedResources.currentIds.splice(currentIdsIndex, 1)
                  }
                }

                // Delete from draft mapping if either no longer exists
                // for (const [key, value] of Object.entries(
                //   state.resources.draftMapping
                // )) {
                //   if (key === payload.id || value === payload.id) {
                //     Vue.delete(state.resources.draftMapping, payload.id)
                //   }
                // }

                Vue.delete(namedResources.byId, payload.id)
              }
            })
          }
          doDeleteResource(state, payload)
        },
        RESET_CURRENT_RESOURCES(state) {
          Vue.set(state.resources, 'new', {})
          const resetCurrentIds = (obj) => {
            // of not in? Object.values() ?
            for (const resourceName of Object.keys(obj)) {
              if (obj[resourceName].currentIds === undefined) {
                continue
              }
              Vue.set(obj[resourceName], 'currentIds', [])
            }
          }
          resetCurrentIds(state.resources.current)
        },
        SET_RESOURCE(state, payload) {
          if (payload.originalId && payload.originalId !== payload['@id']) {
            state.resources.draftMapping[payload.originalId] = payload['@id']
          }
          const stateKey = payload.isNew ? 'new' : 'current'
          const newState = state.resources[stateKey]
            ? { ...state.resources[stateKey] }
            : {}
          const initialState: resourcesState = payload.isNew
            ? { byId: {}, allIds: [] }
            : { byId: {}, allIds: [], currentIds: [] }
          if (payload.isNew) {
            const currentResources = state.resources.current[payload.name]
            if (!currentResources) {
              consola.warn(
                `Not added new resource payload to store: the resource name '${payload.name}' is not currently known`
              )
              return
            }

            if (!payload.force) {
              const currentResource = currentResources.byId[payload.id]

              if (!currentResource) {
                consola.warn(
                  `Not added new resource payload to store: the current resource '${payload.name}' with id '${payload.id}' does not exist`
                )
                return
              }

              const cleanResourceForComparison = (obj) => {
                const newObj = Object.assign({}, obj)
                // remove sort collection - api should not return fix
                // todo: remove when the API is fixed
                delete newObj.sortCollection
                // remove published resource
                delete newObj.publishedResource
                // remove modified at timestamp
                delete newObj.modifiedAt
                // remove null values
                Object.keys(newObj).forEach(
                  (k) => newObj[k] === null && delete newObj[k]
                )
                return newObj
              }
              if (
                JSON.stringify(cleanResourceForComparison(currentResource)) ===
                JSON.stringify(cleanResourceForComparison(payload.resource))
              ) {
                consola.info(
                  `Not added new resource payload to store. The new resource '${payload.name}' with ID '${payload.id}' is identical to the existing one`
                )
                return
              }
              consola.info(
                `Added new resource payload to store. The new resource '${payload.name}' with ID '${payload.id}' is different from the existing one`
              )
              consola.info(
                JSON.stringify(cleanResourceForComparison(payload.resource)),
                JSON.stringify(cleanResourceForComparison(currentResource))
              )
            }
          }
          const currentResourceState = newState[payload.name]
            ? { ...newState[payload.name] }
            : initialState

          currentResourceState.byId[payload.id] = payload.resource
          currentResourceState.allIds = Object.keys(currentResourceState.byId)
          if (
            !payload.isNew &&
            !currentResourceState.currentIds.includes(payload.id)
          ) {
            currentResourceState.currentIds.push(payload.id)
          }

          Vue.set(state.resources, stateKey, {
            ...newState,
            [payload.name]: currentResourceState
          })

          const category = payload.category || 'Default'
          const resourceIriPrefix = payload.id.split('/').slice(0, -1).join('/')
          const newCategoryMapping = state.resources.categories[category]
            ? { ...state.resources.categories[category] }
            : {}
          Vue.set(state.resources.categories, category, {
            ...newCategoryMapping,
            [resourceIriPrefix]: payload.name
          })
        },
        SET_CURRENT_ROUTE(state, id) {
          const routeResources = state.resources.current.Route
          const defaultWarning = `Could not set loaded route to '${id}':`
          if (routeResources === undefined) {
            consola.warn(`${defaultWarning} no routes have been loaded`)
            return
          }
          if (!routeResources.allIds.includes(id)) {
            consola.warn(`${defaultWarning} does not exist`)
            return
          }
          Vue.set(routeResources, 'current', id)
          consola.debug('Loaded route set:', id)
        },
        MERGE_NEW_RESOURCES(state) {
          for (const [resourceName, { byId }] of Object.entries(
            state.resources.new
          ) as [string, resourcesState][]) {
            for (const [resourceId, newResource] of Object.entries(byId)) {
              Vue.set(
                state.resources.current[resourceName].byId,
                resourceId,
                newResource
              )

              const maintainedIdentifierKeys = ['allIds', 'currentIds']
              for (const idKey of maintainedIdentifierKeys) {
                if (
                  !state.resources.current[resourceName][idKey].includes(
                    resourceId
                  )
                ) {
                  state.resources.current[resourceName][idKey].push(resourceId)
                }
              }
            }
            Vue.delete(state.resources.new, resourceName)
          }
        }
      },
      getters: {
        GET_TYPE_FROM_IRI: (state) => ({ iri, category }) => {
          if (!iri) {
            return null
          }
          const typeMapping = state.resources.categories[category]
          if (!typeMapping) {
            return null
          }
          for (const mappingKey of Object.keys(typeMapping)) {
            if (iri.startsWith(mappingKey)) {
              return typeMapping[mappingKey]
            }
          }
          return null
        },
        RESOURCES_OUTDATED: (state) => {
          return Object.entries(state.resources.new).length !== 0
        }
      }
    }

    this.ctx.store.registerModule(this.options.vuex.namespace, storeModule, {
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

  setResource({
    resource,
    isNew,
    category,
    force
  }: {
    resource: object
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
  }

  setCurrentRoute(id) {
    this.ctx.store.commit(
      this.options.vuex.namespace + '/SET_CURRENT_ROUTE',
      id
    )
  }

  get mercurePendingProcesses() {
    return this.getState('mercurePendingProcesses')
  }

  increaseMercurePendingProcessCount(requestCount: number = 1) {
    this.setState(
      'mercurePendingProcesses',
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
    this.setState('mercurePendingProcesses', newValue)
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
    if (iri.startsWith('/component/')) {
      return StoreCategories.Component
    }
    if (iri.startsWith('/page_data/')) {
      return StoreCategories.PageData
    }
    return 'Default'
  }

  getTypeFromIri(iri, category: string = null) {
    if (!category) {
      category = this.getCategoryFromIri(iri)
    }
    return this.ctx.store.getters[
      this.options.vuex.namespace + '/GET_TYPE_FROM_IRI'
    ]({ iri, category })
  }

  findDraftIri(iri) {
    const resource = this.getResource(iri)
    if (resource._metadata.published === false) {
      return iri
    }
    return this.state.resources.draftMapping[iri] || null
  }

  findPublishedIri(iri) {
    for (const [key, value] of Object.entries(
      this.state.resources.draftMapping
    )) {
      if (value === iri) {
        return key
      }
    }
    return null
  }

  getResource(iri) {
    const category = this.getCategoryFromIri(iri)
    const type = this.getTypeFromIri(iri, category)
    if (!type) {
      consola.warn(
        `Could not resolve a resource type for iri ${iri} in the category ${category}`
      )
      return null
    }
    consola.trace(
      `Resolved resource type for iri ${iri} in the category ${category} to ${type}`
    )
    return this.state.resources.current[type].byId?.[iri] || null
  }

  areResourcesOutdated() {
    return this.ctx.store.getters[
      this.options.vuex.namespace + '/RESOURCES_OUTDATED'
    ]
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
}

export default Storage
