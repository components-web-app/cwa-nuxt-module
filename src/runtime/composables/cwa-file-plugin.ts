import { computed, reactive } from 'vue'
import type { UnwrapNestedRefs } from 'vue'
import type { FileOpsType, MediaFile, CwaFileReturnType } from '#cwa/composables/cwa-file'
import { useCwaFile } from '#cwa/composables/cwa-file'
import type { CwaResourcePlugin } from './cwa-component'

export type FilePluginOps = Omit<FileOpsType, 'mediaObjects'>

// `useCwaComponent` plugin exposing an uploadable file field under a single `files` map keyed by
// its `fileProp` (defaults to 'file'). Use it multiple times for multiple file fields — each entry
// is accumulated into `files`, so `files.heroImage.contentUrl`, `files.thumbnail.contentUrl`, etc.
// Entries are `reactive` so nested refs unwrap in templates (`files.file.contentUrl`, no `.value`).
// `imageRef` is optional and NEVER registered implicitly (#267) — see `useCwaFileField`.
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
