import type { CwaApiDocumentationDataInterface, PageDataMetadataResource } from '../storage/stores/api-documentation/state'

export function pageDataTypes(docs: CwaApiDocumentationDataInterface | undefined): PageDataMetadataResource[] {
  return docs?.pageDataMetadata?.member?.filter(data => !data.resourceClass.endsWith('\\AbstractPageData')) ?? []
}
