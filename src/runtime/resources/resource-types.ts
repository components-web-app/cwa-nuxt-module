export enum CwaResourceTypes {
  ROUTE = 'ROUTE',
  PAGE = 'PAGE',
  LAYOUT = 'LAYOUT',
  PAGE_DATA = 'PAGE_DATA',
  COMPONENT_GROUP = 'COMPONENT_GROUP',
  COMPONENT_POSITION = 'COMPONENT_POSITION',
  COMPONENT = 'COMPONENT'
}

type TypeToPathPrefixMap = {
  [T in CwaResourceTypes]: string;
}

export const resourceTypeToIriPrefix: TypeToPathPrefixMap = {
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

export interface CwaResource {
  '@id': string
  '@type': string
  _metadata?: {
    persisted: boolean
    publishable?: {
      published: boolean
      publishedAt: string
    }
    [key: string]: any
  }
  [key: string]: any
}
