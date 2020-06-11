import Vue from 'vue'
import consola from 'consola'
import { getProp } from '../utils'

export const StoreCategories = {
  PageData: 'PageData',
  Component: 'Component'
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
          current: {}
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
              const resourcesObject = obj[resourceName]
              if (resourcesObject.typeMapping !== undefined) {
                resetCurrentIds(resourcesObject)
                continue
              }
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
          const resourcesState = state.resources
          const activeState = resourcesState[stateKey] ? { ...resourcesState[stateKey] } : {}

          let categoryState
          if (!payload.category) {
            categoryState = activeState
          } else {
            // If a category is used, we also add typeMapping so we can find the name of the resource from the IRI
            // This is used for Components and PageData where their name could be anything
            if (!activeState[payload.category]) {
              Vue.set(activeState, payload.category, { typeMapping: {} })
            }
            categoryState = activeState[payload.category]
            const resourceIriPrefix = payload.id.split('/').slice(0, -1).join('/')
            Vue.set(categoryState.typeMapping, resourceIriPrefix, payload.name)
          }
          const currentResourceState = categoryState[payload.name] ? { ...categoryState[payload.name] } : { byId: {}, allIds: [], currentIds: [] }
          currentResourceState.byId[payload.id] = payload.resource
          currentResourceState.allIds = Object.keys(currentResourceState.byId)
          currentResourceState.currentIds.push(payload.id)

          const newValue = { ...categoryState, [payload.name]: currentResourceState }
          if (payload.category) {
            Vue.set(resourcesState[stateKey], payload.category, newValue)
          } else {
            Vue.set(resourcesState, stateKey, newValue)
          }
          consola.debug(payload.category, payload.name, currentResourceState)
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
        }
      },
      getters: {
        GET_TYPE_FROM_IRI: (state) => ({ iri, category }) => {
          const typeMapping = state.resources.current[category].typeMapping
          const found = Object.keys(typeMapping).find((iriPrefix: string) => {
            if (iri.startsWith(iriPrefix)) {
              return true
            }
          })
          if (!found) {
            return null
          }
          return typeMapping[found]
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

  resetCurrentResources() {
    this.ctx.store.commit(this.options.vuex.namespace + '/RESET_CURRENT_RESOURCES')
  }

  getState (key) {
    return this.state[key]
  }

  getTypeFromIri(iri, category) {
    return this.ctx.store.getters[this.options.vuex.namespace + '/GET_TYPE_FROM_IRI']({ iri, category})
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
