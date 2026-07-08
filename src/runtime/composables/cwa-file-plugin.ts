import { computed, reactive, useTemplateRef } from 'vue'
import type { UnwrapNestedRefs } from 'vue'
import type { HTMLImageElement } from 'happy-dom'
import type { FileOpsType, MediaFile, CwaFileReturnType } from '#cwa/composables/cwa-file'
import { useCwaFile } from '#cwa/composables/cwa-file'
import type { CwaResourcePlugin } from './cwa-component'

export type FilePluginOps = Pick<Partial<FileOpsType>, 'imageRef'> & Omit<FileOpsType, 'mediaObjects' | 'imageRef'>

// `useCwaComponent` plugin exposing an uploadable file field under a single `files` map keyed by
// its `fileProp` (defaults to 'file'). Use it multiple times for multiple file fields — each entry
// is accumulated into `files`, so `files.heroImage.contentUrl`, `files.thumbnail.contentUrl`, etc.
// Entries are `reactive` so nested refs unwrap in templates (`files.file.contentUrl`, no `.value`).
// The default template ref name for load detection is the `fileProp` (override via `imageRef`).
export const withFile = (fileOps?: FilePluginOps): CwaResourcePlugin<{
  files: Record<string, UnwrapNestedRefs<CwaFileReturnType>>
}> => {
  return (ctx) => {
    const { iri, resource } = ctx

    const mediaObjects = computed<Record<string, MediaFile[]>>(() => {
      return resource.value?.data?._metadata?.mediaObjects ?? {}
    })

    const fileProp = fileOps?.fileProp || 'file'
    const imageRef = fileOps?.imageRef || useTemplateRef<HTMLImageElement>(fileProp)

    const field = useCwaFile(iri, {
      ...fileOps,
      imageRef,
      mediaObjects,
    })

    return {
      files: { [fileProp]: reactive(field) },
    }
  }
}
