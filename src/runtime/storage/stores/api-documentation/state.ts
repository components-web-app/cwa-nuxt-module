import { ref } from 'vue'
import type { Ref } from 'vue'
import type { CwaResource } from '#cwa/resources/resource-utils'

export interface PageDataMetadataResource extends CwaResource {
  '@type': 'PageDataMetadata'
  'resourceClass': string
  'properties': { 'property': string, 'componentShortName': string, '@id': string, '@type': 'PageDataPropertyMetadata' }[]
}

export interface CwaApiDocumentationDataInterface {
  entrypoint?: {
    '@context': string
    '@id': string
    '@type': 'Entrypoint'
    [key: string]: string
  }
  docs?: {
    '@context': any
    '@id': string
    '@type': 'ApiDocumentation'
    'title': string
    'description': string
    'entrypoint': string
    'supportedClass': Array<{
      '@id': string
      '@type': string
      'title': string
      'rdfs:label': string
      'description': string
      'supportedOperation': Array<{
        '@type': Array<string> | string
        'method': string
        'title': string
        'rdfs:label': string
        'returns': string
      }>
      'supportedProperty': Array<{
        '@type': 'SupportedProperty'
        'title': string
        'required': boolean
        'readable': boolean
        'writeable': boolean
        'property': Array<{
          '@id': string
          '@type': string
          'rdfs:label': string
          'domain': string
          'range': string
        }>
      }>
    }>
    'info': {
      version: string
    }
  }
  pageDataMetadata?: {
    '@context': {
      '@vocab': string
      'hydra': string
      'properties': 'PageDataMetadata/properties'
    }
    '@id': '/_/page_data_metadatas'
    '@type': 'Collection'
    'member': PageDataMetadataResource[]
  }
}

export interface CwaApiDocumentationStateInterface {
  docsPath: Ref<string | null>
  apiDocumentation?: CwaApiDocumentationDataInterface
}

export default function (): CwaApiDocumentationStateInterface {
  return {
    docsPath: ref(null),
  }
}
