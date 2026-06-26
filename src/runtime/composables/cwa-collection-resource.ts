import type { Ref } from 'vue'
import type { CwaResourceUtilsOps } from './cwa-resource'
import { useCwaResource } from './cwa-resource'
import { withCollection } from './cwa-collection-plugin'

/**
 * @deprecated Use `useCwaComponent(props, [withCollection()])` instead.
 */
export const useCwaCollectionResource = (iri: Ref<string>, ops?: CwaResourceUtilsOps) => {
  const cwaResource = useCwaResource(iri, ops)
  const resource = cwaResource.getResource()
  const collection = withCollection()({ iri, resource, $cwa: cwaResource.$cwa })

  return {
    ...cwaResource,
    resource,
    ...collection,
  }
}
