import consola from 'consola'
import Vue from 'vue'
import { resourcesState } from '@cwa/nuxt-module/core/storage'

function componentGroupResourceExtension(resourceState, resource) {
  if (!resourceState.extensions) {
    Vue.set(resourceState, 'extensions', {})
  }
  if (!resourceState.extensions.componentGroupByPlacement) {
    Vue.set(resourceState.extensions, 'componentGroupByPlacement', {
      components: {},
      layouts: {},
      pages: {}
    })
  }
  const keys = ['layouts', 'pages', 'components']
  for (const key of keys) {
    for (const iri of resource[key]) {
      if (!resourceState.extensions.componentGroupByPlacement[key][iri]) {
        resourceState.extensions.componentGroupByPlacement[key][iri] = {}
        Vue.set(
          resourceState.extensions.componentGroupByPlacement[key],
          iri,
          {}
        )
      }
      Vue.set(
        resourceState.extensions.componentGroupByPlacement[key][iri],
        resource.location,
        resource['@id']
      )
    }
  }
}

export function SetResource(storage, state, payload) {
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

      if (storage.isResourceSame(currentResource, payload.resource)) {
        consola.info(
          `Not added new resource payload to store. The new resource '${payload.name}' with ID '${payload.id}' is identical to the existing one`
        )
        return
      }
      consola.info(
        `Added new resource payload to store. The new resource '${payload.name}' with ID '${payload.id}' is different from the existing one`
      )
    }
  }
  const currentResourceState = newState[payload.name]
    ? { ...newState[payload.name] }
    : initialState

  currentResourceState.byId[payload.id] = payload.resource
  currentResourceState.allIds = Object.keys(currentResourceState.byId)
  if (!payload.isNew && !currentResourceState.currentIds.includes(payload.id)) {
    currentResourceState.currentIds.push(payload.id)
  }

  if (payload.name === 'ComponentGroup') {
    componentGroupResourceExtension(currentResourceState, payload.resource)
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
}

export default SetResource
