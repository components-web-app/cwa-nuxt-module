import { useCwaImage } from '#cwa/composables/cwa-image'
import type { HTMLImageElement } from 'happy-dom'
import { useTemplateRef } from 'vue'
import type { Ref } from 'vue'
import { useCwaResource } from './cwa-resource'
import type { CwaResourceUtilsOps } from './cwa-resource'

type ImageOpsType = {
  imagineFilterName?: string
  fileProp?: string
  imageRef?: ShallowRef<HTMLImageElement | null>
}

export const useCwaImageResource = (iri: Ref<string>, imageOps?: ImageOpsType, ops?: CwaResourceUtilsOps) => {
  const cwaResource = useCwaResource(iri, ops)
  const resource = cwaResource.getResource()

  const image = imageOps?.imageRef || useTemplateRef<HTMLImageElement>('image')
  const {
    contentUrl,
    displayMedia,
    handleLoad,
    loaded,
  } = useCwaImage(iri, image, image?.fileProp, imageOps?.imagineFilterName)

  return {
    ...cwaResource,
    contentUrl,
    displayMedia,
    handleLoad,
    loaded,
    resource,
  }
}
