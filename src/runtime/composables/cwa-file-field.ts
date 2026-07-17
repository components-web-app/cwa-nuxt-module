import { computed, toRef } from 'vue'
import type { FileOpsType, MediaFile, CwaFileReturnType } from '#cwa/composables/cwa-file'
import { useCwaFile } from '#cwa/composables/cwa-file'
import { useCwa } from '#cwa/composables/cwa'
import type { IriProp } from './cwa-resource'

export type FileFieldOps = Omit<FileOpsType, 'mediaObjects'>

// Standalone per-field variant of the file resolver — the same thing `withFile` uses under the
// hood, but named at the call site so a component can wire N file fields:
//   const hero  = useCwaFileField(props, { fileProp: 'heroImage' })
//   const thumb = useCwaFileField(props, { fileProp: 'thumbnail' })
// `imageRef` is optional and NEVER registered implicitly (#267): a template ref was previously
// auto-created from the `fileProp`, which made two calls sharing a `fileProp` collide on the same
// key — a Vue dev warning but a hard `TypeError: Cannot redefine property` in a production build.
// Pass `useTemplateRef('...')` yourself if you want the already-loaded-on-mount check.
export const useCwaFileField = (props: IriProp, fileOps?: FileFieldOps): CwaFileReturnType => {
  const $cwa = useCwa()
  const iri = toRef(props, 'iri')

  const resource = computed(() => (iri.value ? $cwa.resources.getResource(iri.value).value : undefined))
  const mediaObjects = computed<Record<string, MediaFile[]>>(() => {
    return resource.value?.data?._metadata?.mediaObjects ?? {}
  })

  return useCwaFile(iri, {
    ...fileOps,
    mediaObjects,
  })
}
