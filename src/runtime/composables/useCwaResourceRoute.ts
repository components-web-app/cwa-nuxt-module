import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

export const useCwaResourceRoute = () => {
  function getInternalResourceLink(iri: string) {
    return {
      name: '_cwa-resource-page',
      params: {
        cwaPage0: iri,
      },
    }
  }

  function getResourceRoute(resource: CwaResource, property: string) {
    return resource[property] || getInternalResourceLink(resource['@id'])
  }

  return {
    getInternalResourceLink,
    getResourceRoute,
  }
}
