import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import type { HTMLImageElement } from 'happy-dom'
import { computed, onMounted, ref, type Ref, type ShallowRef, type ComputedRef } from 'vue'

export type ImageOpsType = {
  imagineFilterName?: string
  fileProp?: string
  imageRef: ShallowRef<HTMLImageElement | null>
  mediaObjects: ComputedRef<Record<string, MediaFile[]>>
}

export type MediaFile = {
  contentUrl: string
  fileSize: number
  mimeType: string
  formattedFileSize: string
  imagineFilter?: string
  width?: number
  height?: number
}

export type CwaImageReturnType = {
  contentUrl: ComputedRef<string | undefined>
  displayMedia: ComputedRef<MediaFile | undefined>
  handleLoad: () => void
  loaded: Ref<boolean>
}

export const useCwaImage = (iri: Ref<string>, ops: ImageOpsType): CwaImageReturnType => {
  const { query } = useCwaResourceEndpoint(iri)

  const fileProperty = ops.fileProp || 'file'

  const loaded = ref(false)

  function handleLoad() {
    loaded.value = true
  }

  const imageFileMediaObjects = computed<MediaFile[] | undefined>(() => {
    return ops.mediaObjects.value?.[fileProperty]
  })

  const displayMedia = computed(() => {
    if (!imageFileMediaObjects.value || !imageFileMediaObjects.value.length) {
      return
    }
    const thumbnail = imageFileMediaObjects.value.filter(({ imagineFilter }) => (imagineFilter === ops.imagineFilterName))
    return thumbnail?.[0] || imageFileMediaObjects.value[0]
  })

  const contentUrl = computed(() => {
    const mediaUrl = displayMedia.value?.contentUrl
    if (!mediaUrl) {
      return
    }
    return `${mediaUrl}${query.value}`
  })

  onMounted(() => {
    if (ops.imageRef.value?.complete || ops.imageRef.value?.naturalHeight !== 0) {
      handleLoad()
    }
  })

  return {
    contentUrl,
    displayMedia,
    handleLoad,
    loaded,
  }
}
