import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import { computed, onMounted, ref, type Ref, type ShallowRef, type ComputedRef } from 'vue'

export type FileOpsType = {
  imagineFilterName?: string
  fileProp?: string
  // OPTIONAL template ref pointing at the <img> that renders this file — used ONLY for the
  // "already loaded before @load was attached" check on mount (see `onMounted` below). It is never
  // registered for you: pass `useTemplateRef('...')` yourself if you want that check, and omit it
  // otherwise (a file field needn't be an image at all). Deliberately permissive because a template
  // ref may resolve to an element OR a component instance (`<NuxtImg ref="...">`), which is
  // unwrapped via `$el`; anything that cannot report img load state is ignored at runtime.
  imageRef?: Readonly<ShallowRef<unknown>>
  mediaObjects: ComputedRef<Record<string, MediaFile[]>>
}

// The only thing `imageRef` is ever read for — an <img>'s own load state.
type ImgLoadState = {
  complete?: boolean
  naturalHeight?: number
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
  // fires it, so detect that on mount. This is opt-in: without an `imageRef` there is nothing to
  // inspect, so we simply wait for `@load` (#267 — the ref is no longer auto-registered).
  // Even when given, the ref is not necessarily a bare <img>: `ref="file"` on a COMPONENT
  // (`<NuxtImg ref="file">`) resolves to the component instance, an unmatched ref name resolves to
  // null, and a file field needn't be an image at all. In each of those `naturalHeight` is
  // `undefined` — and `undefined !== 0` is TRUE, which flipped `loaded` on mount before the image
  // had loaded and made the placeholder vanish instantly.
  onMounted(() => {
    if (!ops.imageRef) {
      return
    }
    const target = ops.imageRef.value as { $el?: unknown } | null
    // unwrap a component instance to its root element
    const el = (target && typeof target === 'object' && '$el' in target ? target.$el : target) as ImgLoadState | null
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
