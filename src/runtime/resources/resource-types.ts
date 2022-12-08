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
