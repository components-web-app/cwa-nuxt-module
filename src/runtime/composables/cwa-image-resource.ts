import { type ImageOpsType, type MediaFile, useCwaImage } from '#cwa/composables/cwa-image'
import type { HTMLImageElement } from 'happy-dom'
import { useTemplateRef, computed } from 'vue'
import type { Ref } from 'vue'
import { useCwaResource } from './cwa-resource'
import type { CwaResourceUtilsOps } from './cwa-resource'

export const useCwaImageResource = (iri: Ref<string>, imageOps?: Pick<Partial<ImageOpsType>, 'imageRef'> & Omit<ImageOpsType, 'mediaObjects' | 'imageRef'>, ops?: CwaResourceUtilsOps) => {
  const cwaResource = useCwaResource(iri, ops)
  const resource = cwaResource.getResource()

  const mediaObjects = computed<Record<string, MediaFile[]>>(() => {
    return resource.value?.data?._metadata.mediaObjects
  })
  const imageRef = imageOps?.imageRef || useTemplateRef<HTMLImageElement>('image')

  const {
    contentUrl,
    displayMedia,
    handleLoad,
    loaded,
  } = useCwaImage(iri, { ...imageOps, imageRef, mediaObjects })

  return {
    ...cwaResource,
    contentUrl,
    displayMedia,
    handleLoad,
    loaded,
    resource,
    mediaObjects,
  }
}
