import { computed, toRef, useTemplateRef } from 'vue'
import type { HTMLImageElement } from 'happy-dom'
import type { FileOpsType, MediaFile, CwaFileReturnType } from '#cwa/composables/cwa-file'
import { useCwaFile } from '#cwa/composables/cwa-file'
import { useCwa } from '#cwa/composables/cwa'
import type { IriProp } from './cwa-resource'

export type FileFieldOps = Pick<Partial<FileOpsType>, 'imageRef'> & Omit<FileOpsType, 'mediaObjects' | 'imageRef'>

// Standalone per-field variant of the file resolver — the same thing `withFile` uses under the
// hood, but named at the call site so a component can wire N file fields without collisions:
//   const hero  = useCwaFileField(props, { fileProp: 'heroImage' })
//   const thumb = useCwaFileField(props, { fileProp: 'thumbnail' })
// The default template ref name for load detection is the `fileProp` (override via `imageRef`).
export const useCwaFileField = (props: IriProp, fileOps?: FileFieldOps): CwaFileReturnType => {
  const $cwa = useCwa()
  const iri = toRef(props, 'iri')

  const resource = computed(() => (iri.value ? $cwa.resources.getResource(iri.value).value : undefined))
  const mediaObjects = computed<Record<string, MediaFile[]>>(() => {
    return resource.value?.data?._metadata?.mediaObjects ?? {}
  })

  const fileProp = fileOps?.fileProp || 'file'
  const imageRef = fileOps?.imageRef || useTemplateRef<HTMLImageElement>(fileProp)

  return useCwaFile(iri, {
    ...fileOps,
    imageRef,
    mediaObjects,
  })
}
