import { ref } from 'vue'
import type { Ref } from 'vue'

export interface CwaApiDocumentationDataInterface {
  entrypoint?: {
    '@context': string
    '@id': string
    '@type': 'Entrypoint'
    [key: string]: string
  },
  docs?: {
    '@context': any
    '@id': string
    '@type': 'hydra:ApiDocumentation'
    'hydra:title': string
    'hydra:description': string
    'hydra:entrypoint': string
    'hydra:supportedClass': Array<{
      '@id': string
      '@type': string
      'hydra:title': string
      'rdfs:label': string
      'hydra:description': string
      'hydra:supportedOperation': Array<{
        '@type': Array<string>|string
        'hydra:method': string
        'hydra:title': string
        'rdfs:label': string
        'returns': string
      }>
      'hydra:supportedProperty': Array<{
        '@type': 'hydra:SupportedProperty'
        'hydra:title': string
        'hydra:required': boolean
        'hydra:readable': boolean
        'hydra:writeable': boolean
        'hydra:property': Array<{
          '@id': string
          '@type': string
          'rdfs:label': string
          'domain': string
          'range': string
        }>
      }>
    }>
    info: {
      version: string
    }
  }
}

export interface CwaApiDocumentationStateInterface {
  docsPath: Ref<string|null>,
  apiDocumentation?: CwaApiDocumentationDataInterface
}

export default function (): CwaApiDocumentationStateInterface {
  return {
    docsPath: ref(null)
  }
}
