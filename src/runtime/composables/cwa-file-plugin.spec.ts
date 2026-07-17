// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, computed, useTemplateRef } from 'vue'
import * as cwaFileModule from '#cwa/composables/cwa-file'
import { withFile } from '#cwa/composables/cwa-file-plugin'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, useTemplateRef: vi.fn(() => ref(null)) }
})

vi.mock('#cwa/composables/cwa-file', () => ({
  useCwaFile: vi.fn(() => ({
    contentUrl: computed(() => '/mock.jpg'),
    displayMedia: computed(() => undefined),
    handleLoad: vi.fn(),
    loaded: ref(false),
  })),
}))

describe('withFile', () => {
  function makeCtx(resourceValue: any = undefined) {
    return {
      iri: ref('/image/1'),
      resource: ref(resourceValue),
      $cwa: {} as any,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cwaFileModule.useCwaFile).mockReturnValue({
      contentUrl: computed(() => '/mock.jpg'),
      displayMedia: computed(() => undefined),
      handleLoad: vi.fn(),
      loaded: ref(false),
    })
  })

  test('exposes the field under a `files` map keyed by fileProp (default "file")', () => {
    const { files } = withFile()(makeCtx())
    expect(Object.keys(files)).toEqual(['file'])
    // reactive entry — nested refs are unwrapped for template friendliness
    expect(files.file!.contentUrl).toBe('/mock.jpg')
  })

  test('keys the entry by a custom fileProp', () => {
    const { files } = withFile({ fileProp: 'heroImage' })(makeCtx())
    expect(Object.keys(files)).toEqual(['heroImage'])
    expect(files.heroImage!.contentUrl).toBe('/mock.jpg')
  })

  test('passes mediaObjects computed from resource._metadata through to useCwaFile', () => {
    const mediaObjects = { file: [{ contentUrl: '/img.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B' }] }
    withFile()(makeCtx({ data: { _metadata: { mediaObjects } } }))
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.mediaObjects.value).toEqual(mediaObjects)
  })

  test('mediaObjects is an empty object when the resource has no data', () => {
    withFile()(makeCtx())
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.mediaObjects.value).toEqual({})
  })

  test('passes iri and fileOps through to useCwaFile', () => {
    const imageRef = ref(null) as any
    withFile({ imagineFilterName: 'thumbnail', imageRef })(makeCtx())
    expect(cwaFileModule.useCwaFile).toHaveBeenCalledWith(
      expect.objectContaining({ value: '/image/1' }),
      expect.objectContaining({ imagineFilterName: 'thumbnail', imageRef }),
    )
  })

  // #267: see the matching test in cwa-file-field.spec.ts — the implicit registration keyed on
  // `fileProp` is what made a second call with the same key throw in a production build.
  test('never registers a template ref implicitly', () => {
    withFile({ fileProp: 'heroImage' })(makeCtx())
    expect(vi.mocked(useTemplateRef)).not.toHaveBeenCalled()
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.imageRef).toBeUndefined()
  })
})
