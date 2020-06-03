import Vue from 'vue'
import { isUnset, decodeValue, encodeValue, getProp } from '../utils'

export default class Storage {
  public ctx: any
  public options: any
  public state: any
  private _state: any
  private _useVuex: boolean

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

    // Use vuex for local state's if possible
    this._useVuex = this.options.vuex && this.ctx.store

    if (this._useVuex) {
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
            // TODO: debug or dev mode log?
            console.log(currentResourceState)
            Vue.set(state, stateKey, { ...newState, [payload.name]: currentResourceState })
          }
        }
      }

      this.ctx.store.registerModule(this.options.vuex.namespace, storeModule, {
        preserveState: Boolean(this.ctx.store.state[this.options.vuex.namespace])
      })

      this.state = this.ctx.store.state[this.options.vuex.namespace]
    } else {
      Vue.set(this, 'state', {})
    }
  }

  setResource ({ id, name, resource, isNew }) {
    if (this._useVuex) {
      this.ctx.store.commit(this.options.vuex.namespace + '/SET_RESOURCE', {
        id,
        name,
        isNew,
        resource
      })
    }
  }

  setState (key, value) {
    if (key[0] === '_') {
      Vue.set(this._state, key, value)
    } else if (this._useVuex) {
      this.ctx.store.commit(this.options.vuex.namespace + '/SET', {
        key,
        value
      })
    } else {
      Vue.set(this.state, key, value)
    }

    return value
  }

  getState (key) {
    if (key[0] !== '_') {
      return this.state[key]
    } else {
      return this._state[key]
    }
  }

  watchState (key, fn) {
    if (this._useVuex) {
      return this.ctx.store.watch(
        state => getProp(state[this.options.vuex.namespace], key),
        fn
      )
    }
  }

  removeState (key) {
    this.setState(key, undefined)
  }

  // ------------------------------------
  // Local storage
  // ------------------------------------

  setLocalStorage (key, value) {
    // Unset null, undefined
    if (isUnset(value)) {
      return this.removeLocalStorage(key)
    }

    if (typeof localStorage === 'undefined' || !this.options.localStorage) {
      return
    }

    const _key = this.options.localStorage.prefix + key

    try {
      localStorage.setItem(_key, encodeValue(value))
    } catch (e) {
      if (!this.options.ignoreExceptions) {
        throw e
      }
    }

    return value
  }

  getLocalStorage (key) {
    if (typeof localStorage === 'undefined' || !this.options.localStorage) {
      return
    }

    const _key = this.options.localStorage.prefix + key

    const value = localStorage.getItem(_key)

    return decodeValue(value)
  }

  removeLocalStorage (key) {
    if (typeof localStorage === 'undefined' || !this.options.localStorage) {
      return
    }

    const _key = this.options.localStorage.prefix + key
    localStorage.removeItem(_key)
  }
}
