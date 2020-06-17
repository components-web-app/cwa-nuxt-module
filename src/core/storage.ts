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
          consola.debug(currentResourceState)
          Vue.set(state.resources, stateKey, { ...newState, [payload.name]: currentResourceState })

          if (payload.category) {
            const resourceIriPrefix = payload.id.split('/').slice(0, -1).join('/')
            const newCategoryMapping = state.resources.categories[payload.category] ? { ...state.resources.categories[payload.category] } : {}
            Vue.set(state.resources.categories, payload.category, { ...newCategoryMapping, [resourceIriPrefix]: payload.name })
          }
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
        UPDATE_RESOURCES (state) {
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
          const found = Object.keys(typeMapping).find((iriPrefix: string) => {
            if (iri.startsWith(iriPrefix)) {
              return true
            }
          })
          if (!found) {
            return null
          }
          return typeMapping[found]
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

  setResource ({ id, name, resource, isNew, category }: { id: string, name: string, resource: object, isNew: boolean, category?: string }) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET_RESOURCE', {
      id,
      name,
      isNew,
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

  updateResources () {
    this.ctx.store.commit(this.options.vuex.namespace + '/UPDATE_RESOURCES')
  }

  getState (key) {
    return this.state[key]
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
