import { reactive } from '#imports'

export interface CwaApiDocumentationStateInterface {
  docsPath: string|null
}

export default function (): CwaApiDocumentationStateInterface {
  return reactive({
    docsPath: null
  })
}
