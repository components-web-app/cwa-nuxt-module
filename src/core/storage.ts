import Vue from 'vue'
import consola from 'consola'
import { isUnset, decodeValue, encodeValue, getProp } from '../utils'

export default class Storage {
  public ctx: any
  public options: any
  public state: any

  constructor (ctx, options) {
    this.ctx = ctx
    this.options = options

    this._initState()
  }

  // ------------------------------------
  // Local state (reactive)
  // ------------------------------------

  _initState () {
    // Private state is suitable to keep information not being exposed to Vuex store
    // This helps prevent stealing token from SSR response HTML
    Vue.set(this, '_state', {})

    const storeModule = {
      namespaced: true,
      state: () => this.options.initialState,
      mutations: {
        SET (state, payload) {
          Vue.set(state, payload.key, payload.value)
        },
        SET_RESOURCE (state, payload) {
          const stateKey = payload.isNew ? 'new' : 'current'
          const newState = state[stateKey] ? { ...state[stateKey] } : {}
          const currentResourceState = newState[payload.name] ? { ...newState[payload.name] } : { byId: {}, allIds: [] }
          currentResourceState.byId[payload.id] = payload.resource
          currentResourceState.allIds = Object.keys(currentResourceState.byId)
          consola.debug(currentResourceState)
          Vue.set(state, stateKey, { ...newState, [payload.name]: currentResourceState })
        },
        SET_CURRENT_ROUTE (state, payload) {
          const stateKey = 'current'
          const name = 'Route'
          const newState = state[stateKey] ? { ...state[stateKey] } : {}
          const currentResourceState = newState[name]
          if (!currentResourceState) {
            return
          }
          currentResourceState.currentId = payload.id
          consola.debug('Set current route ID:', payload.id)
          Vue.set(state, stateKey, { ...newState, [payload.name]: currentResourceState })
        }
      }
    }

    this.ctx.store.registerModule(this.options.vuex.namespace, storeModule, {
      preserveState: Boolean(this.ctx.store.state[this.options.vuex.namespace])
    })

    this.state = this.ctx.store.state[this.options.vuex.namespace]
  }

  setResource ({ id, name, resource, isNew }) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET_RESOURCE', {
      id,
      name,
      isNew,
      resource
    })
  }

  setCurrentRoute ({ id }) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET_CURRENT_ROUTE', {
      id
    })
  }

  setState (key, value) {
    this.ctx.store.commit(this.options.vuex.namespace + '/SET', {
      key,
      value
    })

    return value
  }

  getState (key) {
    return this.state[key]
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
