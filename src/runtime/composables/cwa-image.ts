import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import type { HTMLImageElement } from 'happy-dom'
import { computed, onMounted, ref } from 'vue'

export const useCwaImage = (iri: string, imageRef: ShallowRef<HTMLImageElement | null>, fileProperty: string = 'file', imagineFilterName?: string) => {
  const { query } = useCwaResourceEndpoint(iri)

  type MediaFile = {
    contentUrl: string
    fileSize: number
    mimeType: string
    formattedFileSize: string
    imagineFilter?: string
    width?: number
    height?: number
  }

  const loaded = ref(false)

  function handleLoad() {
    loaded.value = true
  }

  const imageFileMediaObjects = computed<MediaFile[] | undefined>(() => {
    return resource.value?.data?._metadata.mediaObjects?.[fileProperty]
  })

  const displayMedia = computed(() => {
    if (!imageFileMediaObjects.value || !imageFileMediaObjects.value.length) {
      return
    }
    const thumbnail = imageFileMediaObjects.value.filter(({ imagineFilter }) => (imagineFilter === imagineFilterName))
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
    if (imageRef.value?.complete || imageRef.value?.naturalHeight !== 0) {
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
