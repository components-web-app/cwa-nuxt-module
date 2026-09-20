import { computed, toRef } from 'vue'
import type { FileOpsType, MediaFile, CwaFileReturnType } from '#cwa/composables/cwa-file'
import { useCwaFile } from '#cwa/composables/cwa-file'
import { useCwa } from '#cwa/composables/cwa'
import type { IriProp } from './cwa-resource'

export type FileFieldOps = Omit<FileOpsType, 'mediaObjects'>

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
