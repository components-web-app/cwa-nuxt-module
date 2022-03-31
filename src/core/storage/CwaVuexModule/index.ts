import Vue from 'vue'
import {
  TogglePublishable,
  DeleteResource,
  SetResource,
  SetCurrentRoute,
  MergeNewResources,
  ResetCurrentResources
} from './mutations'
import { FetchComponentMetadata } from './actions'
import ApiDocumentation from '@cwa/nuxt-module/core/api-documentation'

export const stateVars = {
  highlightComponent: 'highlightComponent',
  apiDocumentation: 'apiDocumentation',
  docsUrl: 'docsUrl',
  mercurePendingProcesses: 'mercurePendingProcesses'
}

export interface cwaModuleState {
  mercurePendingProcesses: number
  editMode: boolean
  resources: {
    new: any
    current: any
    categories: any
    draftMapping: any
    mapToPublished: string[]
  }
  clone: {
    component: string
    navigate: boolean
    destination: string
    fromPath: string
  }
  componentMetadata: {
    isLoading: boolean
    data: any
  }
  apiDocumentation: ApiDocumentation
  docsUrl?: string
}

export default function (storage) {
  return {
    namespaced: true,
    state: () =>
      ({
        mercurePendingProcesses: 0,
        editMode: false,
        resources: {
          new: {},
          current: {},
          categories: {},
          draftMapping: {},
          mapToPublished: []
        },
        clone: {
          component: null,
          navigate: false,
          destination: null,
          fromPath: null
        },
        componentMetadata: {
          isLoading: false,
          data: null
        },
        apiDocumentation: null
      } as cwaModuleState),
    actions: {
      async fetchComponentMetadata(ctx) {
        return await FetchComponentMetadata.apply(this, [ctx])
      }
    },
    mutations: {
      SET(state, payload) {
        Vue.set(state, payload.key, payload.value)
      },
      setComponentMetadataLoading(state, isLoading) {
        state.componentMetadata.isLoading = isLoading
      },
      setComponentMetadata(state, metadata) {
        state.componentMetadata.data = metadata
      },
      SET_CLONE_COMPONENT(state, iri) {
        state.clone.component = iri
      },
      SET_CLONE_NAVIGATE(state, navigate) {
        state.clone.navigate = navigate
      },
      SET_CLONE_DESTINATION(state, iri) {
        state.clone.destination = iri
      },
      SET_CLONE_FROM_PATH(state, fromPath) {
        state.clone.fromPath = fromPath
      },
      TOGGLE_PUBLISHABLE(state, payload) {
        TogglePublishable(state, payload)
      },
      MAP_DRAFT_RESOURCE(state, { publishedIri, draftIri }) {
        if (draftIri === null) {
          Vue.delete(state.resources.draftMapping, publishedIri)
        } else {
          Vue.set(state.resources.draftMapping, publishedIri, draftIri)
        }
      },
      DELETE_RESOURCE(state, payload) {
        DeleteResource(state, payload)
      },
      RESET_CURRENT_RESOURCES(state) {
        ResetCurrentResources(state)
      },
      SET_RESOURCE(state, payload) {
        SetResource(storage, state, payload)
      },
      SET_CURRENT_ROUTE(state, id) {
        SetCurrentRoute(state, id)
      },
      MERGE_NEW_RESOURCES(state) {
        MergeNewResources(state)
      }
    },
    getters: {
      COLLECTION_BY_PLACEMENT:
        (state) =>
        ({ iri, name }) => {
          const getLookupProperty = (placementIri) => {
            if (placementIri.startsWith('component')) {
              return 'components'
            }
            if (placementIri.startsWith('/_/layouts/')) {
              return 'layouts'
            }
            if (placementIri.startsWith('/_/pages/')) {
              return 'pages'
            }
            return null
          }
          const lookupProperty = getLookupProperty(iri)
          return state.resources.current.ComponentCollection.extensions
            .componentCollectionByPlacement[lookupProperty][iri]?.[name]
        },
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
      },
      CLONE_ALLOW_NAVIGATE: ({ clone }) => {
        const isCloning = !!clone.component
        if (!isCloning) {
          return null
        }
        return clone.navigate
      }
    }
  }
}
