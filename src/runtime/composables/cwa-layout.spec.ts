// @vitest-environment happy-dom

import { describe, expect, vi, test, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
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
  let mockCwa: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockLayoutResource = ref(undefined)
    mockCwa = {
      resources: {
        layout: computed(() => mockLayoutResource.value),
      },
    }
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => mockCwa)
  })

  test('layout returns current layout resource', () => {
    mockLayoutResource.value = { data: { '@type': 'Layout', 'title': 'My Layout' } }
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
})
