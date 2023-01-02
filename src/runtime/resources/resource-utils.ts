export enum CwaResourceTypes {
  ROUTE = 'ROUTE',
  PAGE = 'PAGE',
  LAYOUT = 'LAYOUT',
  PAGE_DATA = 'PAGE_DATA',
  COMPONENT_GROUP = 'COMPONENT_GROUP',
  COMPONENT_POSITION = 'COMPONENT_POSITION',
  COMPONENT = 'COMPONENT'
}

export interface CwaResource {
  '@id': string
  '@type': string
  publishedResource?: string
  _metadata: {
    persisted: boolean
    publishable?: {
      published: boolean
      publishedAt: string
    }
    [key: string]: any
  }
  [key: string]: any
}

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

export function isCwaResource (obj: any): obj is CwaResource {
  if (typeof obj !== 'object') {
    return false
  }
  return obj['@id'] !== undefined && obj['@type'] !== undefined && obj._metadata !== undefined && typeof obj._metadata === 'object'
}

export function isCwaResourceSame (resource1: CwaResource, resource2: CwaResource): boolean {
  const clearAndStringify = (obj: CwaResource): string => {
    const newObj: any = Object.assign({}, obj)
    delete newObj.publishedResource
    delete newObj.draftResource
    delete newObj.modifiedAt
    // remove metadata, can include things specific to the resource such as published timestamps
    delete newObj._metadata
    // remove null values
    Object.keys(newObj).forEach(k => newObj[k] === null && delete newObj[k])
    return JSON.stringify(newObj)
  }
  return clearAndStringify(resource1) === clearAndStringify(resource2)
}
