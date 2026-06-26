// @vitest-environment happy-dom

import { describe, expect, vi, test, beforeEach } from 'vitest'
import { computed, ref, nextTick } from 'vue'
import * as vue from 'vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { useCwaLayout } from '#cwa/composables/cwa-layout'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn(fn => fn()),
    getCurrentInstance: vi.fn(() => null),
  }
})

describe('useCwaLayout', () => {
  let mockLayoutResource: ReturnType<typeof ref<any>>
  let mockClassList: { add: ReturnType<typeof vi.fn>, remove: ReturnType<typeof vi.fn>, contains: ReturnType<typeof vi.fn> }
  let mockEl: { nodeType: number, isConnected: boolean, classList: typeof mockClassList }
  let mockCwa: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockLayoutResource = ref(undefined)
    mockClassList = {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
    }
    mockEl = { nodeType: 1, isConnected: true, classList: mockClassList }
    mockCwa = {
      resources: {
        layout: computed(() => mockLayoutResource.value),
      },
    }
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => mockCwa)
  })

  test('layout returns current layout resource', () => {
    mockLayoutResource.value = { data: { '@type': 'Layout', title: 'My Layout' } }
    const { layout } = useCwaLayout()
    expect(layout.value).toEqual(mockLayoutResource.value)
  })

  test('uiClassNames returns layout uiClassNames', () => {
    mockLayoutResource.value = { data: { uiClassNames: ['text-xl', 'font-bold'] } }
    const { uiClassNames } = useCwaLayout()
    expect(uiClassNames.value).toEqual(['text-xl', 'font-bold'])
  })

  test('uiClassNames is undefined when layout has no uiClassNames', () => {
    mockLayoutResource.value = { data: {} }
    const { uiClassNames } = useCwaLayout()
    expect(uiClassNames.value).toBeUndefined()
  })

  test('auto-applies uiClassNames to root element on mount', () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
    mockLayoutResource.value = { data: { uiClassNames: ['text-xl', 'font-bold'] } }

    useCwaLayout()

    expect(mockClassList.add).toHaveBeenCalledWith('text-xl')
    expect(mockClassList.add).toHaveBeenCalledWith('font-bold')
  })

  test('does not apply when autoClass is false', () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
    mockLayoutResource.value = { data: { uiClassNames: ['text-xl'] } }

    useCwaLayout({ autoClass: false })

    expect(mockClassList.add).not.toHaveBeenCalled()
  })

  test('stays passive when all classes already present on element', () => {
    mockClassList.contains.mockReturnValue(true)
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
    mockLayoutResource.value = { data: { uiClassNames: ['text-xl'] } }

    useCwaLayout()

    expect(mockClassList.add).not.toHaveBeenCalled()
  })

  test('skips when root element is not an element node', () => {
    const commentNode = { nodeType: 8, isConnected: true }
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: commentNode } } as any)
    mockLayoutResource.value = { data: { uiClassNames: ['text-xl'] } }

    expect(() => useCwaLayout()).not.toThrow()
    expect(mockClassList.add).not.toHaveBeenCalled()
  })

  test('on change: removes old CWA-applied classes and adds new ones', async () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
    mockLayoutResource.value = { data: { uiClassNames: ['text-xl'] } }

    useCwaLayout()

    mockLayoutResource.value = { data: { uiClassNames: ['font-bold'] } }
    await nextTick()

    expect(mockClassList.remove).toHaveBeenCalledWith('text-xl')
    expect(mockClassList.add).toHaveBeenCalledWith('font-bold')
  })
})
