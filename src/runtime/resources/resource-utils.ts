import { CwaResource, CwaResourceTypes, resourceTypeToIriPrefix } from './resource-types'

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

export function getResourceTypeFromIri (iri: string): CwaResourceTypes|undefined {
  for (const type of Object.values(CwaResourceTypes)) {
    const prefix: string = resourceTypeToIriPrefix[type]
    if (iri.startsWith(prefix)) {
      return type
    }
  }
}
