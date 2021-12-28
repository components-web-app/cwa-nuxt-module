import Vue from 'vue'
import consola from 'consola'
import { resourcesState, StoreCategories } from '../storage'
// @ts-ignore
import components from '~/.nuxt/cwa/components'

function getUiComponent(resourceName) {
  const searchKey = `CwaComponents${resourceName}`
  const uiComponent = components[searchKey]
  if (!uiComponent) {
    consola.error(
      `UI component not found for API component named ${resourceName}. Searched for key ${searchKey}`
    )
    return
  }
  return components[searchKey]
}

export default function (storage) {
  return {
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
      },
      reuse: {
        component: null,
        navigate: false,
        destination: null
      },
      componentMetadata: {
        isLoading: false,
        data: null
      }
    }),
    actions: {
      async fetchComponentMetadata({ commit, state }) {
        if (state.componentMetadata.data !== null) {
          return state.componentMetadata.data
        }
        commit('setComponentMetadataLoading', true)
        const metadata = {}
        const data = await this.$cwa.getApiDocumentation()
        const properties = data.docs['hydra:supportedClass'].reduce(
          (obj, supportedClass) => {
            obj[supportedClass['rdfs:label']] = supportedClass[
              'hydra:supportedProperty'
            ].map((supportedProperty) => supportedProperty['hydra:title'])
            return obj
          },
          {}
        )

        for (const [key, endpoint] of Object.entries(
          data.entrypoint
        ) as string[][]) {
          if (endpoint.startsWith('/component/')) {
            const resourceName = key[0].toUpperCase() + key.slice(1)
            if (!getUiComponent(resourceName)) {
              continue
            }
            const isPublishable =
              properties?.[resourceName].includes('publishedAt') || false
            metadata[resourceName] = {
              resourceName,
              endpoint,
              isPublishable
            }
          }
        }
        commit('setComponentMetadata', metadata)
        commit('setComponentMetadataLoading', false)
        return metadata
      }
    },
    mutations: {
      setComponentMetadataLoading(state, isLoading) {
        state.componentMetadata.isLoading = isLoading
      },
      setComponentMetadata(state, metadata) {
        state.componentMetadata.data = metadata
      },
      SET_REUSE_COMPONENT(state, iri) {
        state.reuse.component = iri
      },
      SET_REUSE_NAVIGATE(state, navigate) {
        state.reuse.navigate = navigate
      },
      SET_REUSE_DESTINATION(state, iri) {
        state.reuse.destination = iri
      },
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
          if (id !== null) {
            consola.warn(`${defaultWarning} no routes have been loaded`)
          }
          return
        }
        if (id === null) {
          Vue.set(routeResources, 'current', null)
          consola.debug('Loaded route unset')
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
      GET_TYPE_FROM_IRI:
        (state) =>
        ({ iri, category }) => {
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
}
