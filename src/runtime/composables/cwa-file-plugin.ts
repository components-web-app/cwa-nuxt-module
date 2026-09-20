import { computed, reactive } from 'vue'
import type { UnwrapNestedRefs } from 'vue'
import type { FileOpsType, MediaFile, CwaFileReturnType } from '#cwa/composables/cwa-file'
import { useCwaFile } from '#cwa/composables/cwa-file'
import type { CwaResourcePlugin } from './cwa-component'

export type FilePluginOps = Omit<FileOpsType, 'mediaObjects'>

export const withFile = (fileOps?: FilePluginOps): CwaResourcePlugin<{
  files: Record<string, UnwrapNestedRefs<CwaFileReturnType>>
}> => {
  return (ctx) => {
    const { iri, resource } = ctx

    const mediaObjects = computed<Record<string, MediaFile[]>>(() => {
      return resource.value?.data?._metadata?.mediaObjects ?? {}
    })

    const fileProp = fileOps?.fileProp || 'file'

    const field = useCwaFile(iri, {
      ...fileOps,
      mediaObjects,
    })

    return {
      files: { [fileProp]: reactive(field) },
    }
  }
}
