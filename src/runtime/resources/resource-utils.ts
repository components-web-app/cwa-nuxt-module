import type { CwaCurrentResourceInterface } from '#cwa/runtime/storage/stores/resources/state'

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
  draftResource?: string
  uiComponent?: string
  sortValue?: number
  _metadata: {
    adding?: {
      instantAdd: boolean
      endpoint: string
      isPublishable: boolean
    }
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

type TypeToNestedPropertiesMap = {
  [T in CwaResourceTypes]: Array<string>;
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
    if (iri.startsWith(prefix) || iri === prefix.slice(0, -1)) {
      return type
    }
  }
}

export function getPublishedResourceState (resource: Pick<CwaCurrentResourceInterface, 'data'>): undefined|boolean {
  const publishableMeta = resource.data?._metadata.publishable
  return publishableMeta?.published
}

// todo: used in mercure, perhaps we should use the new resource store mapping though? This doesn't require any more fetches to have been made though..
export function getPublishedResourceIri (resourceData: CwaResource): string|null {
  const publishableMetadata = resourceData._metadata?.publishable
  const resourceIri = resourceData['@id']
  // not a publishable resource
  if (!publishableMetadata) {
    return resourceIri
  }
  if (publishableMetadata.published) {
    return resourceIri
  }
  return resourceData.publishedResource || null
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
    if (getResourceTypeFromIri(newObj['@id']) === CwaResourceTypes.COMPONENT) {
      // remove componentPositions back-reference. If deleting a live resource when a draft is available, we'll receive an
      // update and the draft will now have a component position it didn't have before but is not necessary to know
      delete newObj.componentPositions
    }
    // remove null values
    Object.keys(newObj).forEach(k => newObj[k] === null && delete newObj[k])
    return JSON.stringify(newObj)
  }
  return clearAndStringify(resource1) === clearAndStringify(resource2)
}

export const resourceTypeToNestedResourceProperties: TypeToNestedPropertiesMap = {
  [CwaResourceTypes.ROUTE]: ['pageData', 'page'],
  [CwaResourceTypes.PAGE]: ['layout', 'componentGroups'],
  [CwaResourceTypes.PAGE_DATA]: ['page'],
  [CwaResourceTypes.LAYOUT]: ['componentGroups'],
  [CwaResourceTypes.COMPONENT_GROUP]: ['componentPositions'],
  [CwaResourceTypes.COMPONENT_POSITION]: ['component'],
  // draft will always be fetched by default if exists and auth to do, so we just need to fetch the associated published resource - will only be returned if we have auth
  [CwaResourceTypes.COMPONENT]: ['componentGroups', 'publishedResource']
}
