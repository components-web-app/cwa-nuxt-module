import Vue from 'vue'
import consola from 'consola'
import { getProp } from '../utils'

export const StoreCategories = {
  PageData: 'PageData',
  Component: 'Component'
}

type resourcesState = {
  byId: object,
  allIds: string[],
  currentIds?: string[]
}

export class Storage {
  public ctx: any
  public options: any
  public state: any

  constructor (ctx, options) {
    this.ctx = ctx
    this.options = options

    this._initState()
  }

  _initState () {
    const storeModule = {
      namespaced: true,
      state: () => ({
        resources: {
          new: {},
          current: {},
          categories: {}
        }
      }),
      mutations: {
        SET (state, payload) {
          Vue.set(state, payload.key, payload.value)
        },
        DELETE_RESOURCE (state, payload) {
          const doDeleteResource = (state, payload) => {
            ['new', 'current'].forEach((stateName) => {
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
                if (payload.category === StoreCategories.Component) {
                  const componentPositions = namedResources.byId[payload.id]?.componentPositions
                  if (componentPositions) {
                    componentPositions.forEach((positionIri) => {
                      doDeleteResource(state, { id: positionIri, name: 'ComponentPosition', category: 'Default' })
                    })
                  }
                }

                namedResources.allIds.slice(allIdsIndex, 1)
                Vue.delete(namedResources.byId, payload.id)

                if (namedResources.currentIds && namedResources.currentIds[payload.id]) {
                  const currentIdsIndex = namedResources.currentIds.indexOf(payload.id)
                  if (currentIdsIndex) {
                    namedResources.currentIds.slice(currentIdsIndex, 1)
                  }
                }
              }
            })
          }
          doDeleteResource(state, payload)
        },
        RESET_CURRENT_RESOURCES (state) {
          Vue.set(state.resources, 'new', {})
          const resetCurrentIds = (obj) => {
            for (const resourceName in obj) {
              if (obj[resourceName].currentIds === undefined) {
                continue
              }
              Vue.set(obj[resourceName], 'currentIds', [])
            }
          }
          resetCurrentIds(state.resources.current)
        },
        SET_RESOURCE (state, payload) {
          const stateKey = payload.isNew ? 'new' : 'current'
          const newState = state.resources[stateKey] ? { ...state.resources[stateKey] } : {}
          const initialState:resourcesState = payload.isNew ? { byId: {}, allIds: [] } : { byId: {}, allIds: [], currentIds: [] }
          if (payload.isNew) {
            const currentResources = state.resources.current[payload.name]
            if (!currentResources) {
              consola.warn(`Not added new resource payload to store: the resource name '${payload.name}' is not currently known`)
              return
            }

            const currentResource = currentResources.byId[payload.id]
            if (!currentResource) {
              consola.warn(`Not added new resource payload to store: the current resource '${payload.name}' with id '${payload.id}' does not exist`)
              return
            }

            const removeModifiedAtTimestamp = (obj) => {
              const newObj = Object.assign({}, obj)
              delete newObj.modifiedAt
              return newObj
            }
            if (JSON.stringify(removeModifiedAtTimestamp(currentResource)) === JSON.stringify(removeModifiedAtTimestamp(payload.resource))) {
              consola.info(`Not added new resource payload to store. The new resource '${payload.name}' with ID '${payload.id}' is identical to the existing one`)
              return
            }
          }
          const currentResourceState = newState[payload.name] ? { ...newState[payload.name] } : initialState

          currentResourceState.byId[payload.id] = payload.resource
          currentResourceState.allIds = Object.keys(currentResourceState.byId)
          !payload.isNew && currentResourceState.currentIds.push(payload.id)
          // consola.trace(currentResourceState)
          Vue.set(state.resources, stateKey, { ...newState, [payload.name]: currentResourceState })

          const category = payload.category || 'Default'
          const resourceIriPrefix = payload.id.split('/').slice(0, -1).join('/')
          const newCategoryMapping = state.resources.categories[category] ? { ...state.resources.categories[category] } : {}
          Vue.set(state.resources.categories, category, { ...newCategoryMapping, [resourceIriPrefix]: payload.name })
        },
        SET_CURRENT_ROUTE (state, id) {
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
        MERGE_NEW_RESOURCES (state) {
          for (const [resourceName, { byId }] of Object.entries(state.resources.new) as [string, resourcesState][]) {
            for (const [resourceId, newResource] of Object.entries(byId)) {
              Vue.set(state.resources.current[resourceName].byId, resourceId, newResource)
            }
            Vue.delete(state.resources.new, resourceName)
          }
        }
      },
      getters: {
        GET_TYPE_FROM_IRI: state => ({ iri, category }) => {
          const typeMapping = state.resources.categories[category]
          if (!typeMapping) {
            return null
          }
          for (const iriPrefix in typeMapping) {
            if (iri.startsWith(iriPrefix)) {
              return typeMapping[iriPrefix]
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

  deleteResource (id) {
    const category = this.getCategoryFromIri(id)
    const name = this.getTypeFromIri(id, category)
    this.ctx.store.commit(this.options.vuex.namespace + '/DELETE_RESOURCE', {
      id,
      name,
      category
    })
  }

  setResource ({ resource, isNew, category }: { resource: object, isNew?: boolean, category?: string }) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET_RESOURCE', {
      id: resource['@id'],
      name: resource['@type'],
      isNew: isNew || false,
      resource,
      category
    })
  }

  setCurrentRoute (id) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET_CURRENT_ROUTE', id)
  }

  setState (key, value) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET', {
      key,
      value
    })

    return value
  }

  resetCurrentResources () {
    this.ctx.store.commit(this.options.vuex.namespace + '/RESET_CURRENT_RESOURCES')
  }

  mergeNewResources () {
    this.ctx.store.commit(this.options.vuex.namespace + '/MERGE_NEW_RESOURCES')
  }

  getState (key) {
    return this.state[key]
  }

  getCategoryFromIri (iri: string) {
    if (iri.startsWith('/component/')) {
      return StoreCategories.Component
    }
    if (iri.startsWith('/page_data/')) {
      return StoreCategories.PageData
    }
    return 'Default'
  }

  getTypeFromIri (iri, category) {
    return this.ctx.store.getters[this.options.vuex.namespace + '/GET_TYPE_FROM_IRI']({ iri, category })
  }

  areResourcesOutdated () {
    return this.ctx.store.getters[this.options.vuex.namespace + '/RESOURCES_OUTDATED']
  }

  watchState (key, fn) {
    return this.ctx.store.watch(
      state => getProp(state[this.options.vuex.namespace], key),
      fn
    )
  }

  removeState (key) {
    this.setState(key, undefined)
  }
}

export default Storage
