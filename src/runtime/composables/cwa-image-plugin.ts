import { computed, useTemplateRef } from 'vue'
import type { ComputedRef } from 'vue'
import type { HTMLImageElement } from 'happy-dom'
import type { ImageOpsType, MediaFile } from '#cwa/composables/cwa-image'
import { useCwaImage } from '#cwa/composables/cwa-image'
import type { CwaResourcePlugin } from './cwa-component'

type ImagePluginOps = Pick<Partial<ImageOpsType>, 'imageRef'> & Omit<ImageOpsType, 'mediaObjects' | 'imageRef'>

export const withImage = (imageOps?: ImagePluginOps): CwaResourcePlugin<{
  contentUrl: ReturnType<typeof useCwaImage>['contentUrl']
  displayMedia: ReturnType<typeof useCwaImage>['displayMedia']
  handleLoad: ReturnType<typeof useCwaImage>['handleLoad']
  loaded: ReturnType<typeof useCwaImage>['loaded']
  mediaObjects: ComputedRef<Record<string, MediaFile[]>>
}> => {
  return (ctx) => {
    const { iri, resource } = ctx

    const mediaObjects = computed<Record<string, MediaFile[]>>(() => {
      return resource.value?.data?._metadata?.mediaObjects ?? {}
    })

    const imageRef = imageOps?.imageRef || useTemplateRef<HTMLImageElement>('image')

    const { contentUrl, displayMedia, handleLoad, loaded } = useCwaImage(iri, {
      ...imageOps,
      imageRef,
      mediaObjects,
    })

    return {
      contentUrl,
      displayMedia,
      handleLoad,
      loaded,
      mediaObjects,
    }
  }
}
