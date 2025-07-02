import { computed, onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import { useCwaResource } from './cwa-resource'
import type { CwaResourceUtilsOps } from './cwa-resource'
import { useCwaResourceEndpoint } from './cwa-resource-endpoint'

export const useCwaImage = (iri: Ref<string>, imagineFilterName?: string, ops?: CwaResourceUtilsOps) => {
  type MediaFile = {
    contentUrl: string
    fileSize: number
    mimeType: string
    formattedFileSize: string
    imagineFilter?: string
    width?: number
    height?: number
  }

  const cwaResource = useCwaResource(iri, ops)
  const { query } = useCwaResourceEndpoint(iri)
  const resource = cwaResource.getResource()

  const loaded = ref(false)
  const image = ref()

  function handleLoad() {
    loaded.value = true
  }

  const imageFileMediaObjects = computed<MediaFile[] | undefined>(() => {
    return resource.value?.data?._metadata.mediaObjects?.file
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
    if (image.value?.complete || image.value?.naturalHeight !== 0) {
      handleLoad()
    }
  })

  return {
    ...cwaResource,
    contentUrl,
    displayMedia,
    handleLoad,
    loaded,
    resource,
  }
}
