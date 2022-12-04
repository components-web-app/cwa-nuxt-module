import { CwaResource } from './resource-types'

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
