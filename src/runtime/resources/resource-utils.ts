import { CwaResource, CwaResourceTypes } from './resource-types'

type TypeToPathPrefixMap = {
  [T in CwaResourceTypes]: string;
}

const resourceTypeToIriPrefix: TypeToPathPrefixMap = {
  [CwaResourceTypes.ROUTE]: '/_/routes/',
  [CwaResourceTypes.PAGE]: '/_/pages/',
  [CwaResourceTypes.PAGE_DATA]: '/page_data/',
  [CwaResourceTypes.LAYOUT]: '/_/layouts/',
  [CwaResourceTypes.COMPONENT_GROUP]: '/_/component_groups/',
  [CwaResourceTypes.COMPONENT_POSITION]: '/_/component_positions/',
  [CwaResourceTypes.COMPONENT]: '/component/'
}

export function getResourceTypeFromIri (iri: string): CwaResourceTypes|undefined {
  for (const type of Object.values(CwaResourceTypes)) {
    const prefix: string = resourceTypeToIriPrefix[type]
    if (iri.startsWith(prefix)) {
      return type
    }
  }
}

export function getPublishedResourceIri (resource: CwaResource): string|null {
  const publishableMetadata = resource._metadata?.publishable
  const resourceIri = resource['@id']
  // not a publishable resource
  if (!publishableMetadata) {
    return resourceIri
  }
  if (publishableMetadata.published) {
    return resourceIri
  }
  return resource.publishedResource || null
}
