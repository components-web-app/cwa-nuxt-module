import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import type { HTMLImageElement } from 'happy-dom'
import { computed, onMounted, ref, type Ref, type ShallowRef, type ComputedRef } from 'vue'

export type FileOpsType = {
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

export type CwaFileReturnType = {
  contentUrl: ComputedRef<string | undefined>
  displayMedia: ComputedRef<MediaFile | undefined>
  handleLoad: () => void
  loaded: Ref<boolean>
}

// Resolves a single uploadable file field on a resource — the display media (optionally an imagine
// filter variant) and its content URL. Works for any uploadable file, not just images; the
// `imageRef` / `imagineFilterName` options are image-specific conveniences.
export const useCwaFile = (iri: Ref<string>, ops: FileOpsType): CwaFileReturnType => {
  const { query } = useCwaResourceEndpoint(iri)

  const fileProperty = ops.fileProp || 'file'

  const loaded = ref(false)

  function handleLoad() {
    loaded.value = true
  }

  const fieldMediaObjects = computed<MediaFile[] | undefined>(() => {
    return ops.mediaObjects.value?.[fileProperty]
  })

  const displayMedia = computed(() => {
    if (!fieldMediaObjects.value || !fieldMediaObjects.value.length) {
      return
    }
    const thumbnail = fieldMediaObjects.value.filter(({ imagineFilter }) => (imagineFilter === ops.imagineFilterName))
    return thumbnail?.[0] || fieldMediaObjects.value[0]
  })

  const contentUrl = computed(() => {
    const mediaUrl = displayMedia.value?.contentUrl
    if (!mediaUrl) {
      return
    }
    return `${mediaUrl}${query.value}`
  })

  // An <img> that was already loaded (from cache) before the `@load` listener was attached never
  // fires it, so detect that on mount. The ref is not necessarily a bare <img> though: `ref="file"`
  // on a COMPONENT (`<NuxtImg ref="file">`) resolves to the component instance, a ref name that
  // doesn't match `fileProp` resolves to null, and a file field needn't be an image at all. In each
  // of those `naturalHeight` is `undefined` — and `undefined !== 0` is TRUE, which flipped `loaded`
  // on mount before the image had loaded and made the placeholder vanish instantly.
  onMounted(() => {
    const target = ops.imageRef.value as { $el?: unknown } | null
    // unwrap a component instance to its root element
    const el = (target && '$el' in target ? target.$el : target) as HTMLImageElement | null
    // Only an <img> can report its own load state. Anything else must wait for `@load`.
    if (!el || typeof el.naturalHeight !== 'number') {
      return
    }
    if (el.complete || el.naturalHeight !== 0) {
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
