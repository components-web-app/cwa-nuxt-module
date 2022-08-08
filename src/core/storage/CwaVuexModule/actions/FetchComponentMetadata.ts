import consola from 'consola'
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

export async function FetchComponentMetadata({ commit, state }) {
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

  for (const [key, endpoint] of Object.entries(data.entrypoint) as string[][]) {
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

export default FetchComponentMetadata
