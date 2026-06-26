import type { Ref } from 'vue'
import type { ImageOpsType } from '#cwa/composables/cwa-image'
import type { CwaResourceUtilsOps } from './cwa-resource'
import { useCwaResource } from './cwa-resource'
import { withImage } from './cwa-image-plugin'

type ImageOps = Pick<Partial<ImageOpsType>, 'imageRef'> & Omit<ImageOpsType, 'mediaObjects' | 'imageRef'>

/**
 * @deprecated Use `useCwaComponent(props, [withImage(imageOps)])` instead.
 */
export const useCwaImageResource = (iri: Ref<string>, imageOps?: ImageOps, ops?: CwaResourceUtilsOps) => {
  const cwaResource = useCwaResource(iri, ops)
  const resource = cwaResource.getResource()
  const image = withImage(imageOps)({ iri, resource, $cwa: cwaResource.$cwa })

  return {
    ...cwaResource,
    resource,
    ...image,
  }
}
