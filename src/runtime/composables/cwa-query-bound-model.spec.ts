// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { useQueryBoundModel } from '#cwa/composables/cwa-query-bound-model'

// vi.hoisted can't use vue's reactive — var is hoisted (no TDZ), assigned in the mock factory
// eslint-disable-next-line no-var
var mockQuery: Record<string, any>
const mockRouterReplace = vi.hoisted(() => vi.fn())

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mockQuery = reactive({})
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...mod,
    useRoute: () => ({ query: mockQuery }),
    useRouter: () => ({ replace: mockRouterReplace }),
  }
})

describe('useQueryBoundModel', () => {
  let scope: EffectScope
  const useModel = (...args: Parameters<typeof useQueryBoundModel>) => scope.run(() => useQueryBoundModel(...args))!

  afterEach(async () => {
    scope.stop()
    await new Promise(resolve => setTimeout(resolve, 20))
  })

  beforeEach(() => {
    scope = effectScope()
    for (const key of Object.keys(mockQuery)) {
      delete mockQuery[key]
    }
    vi.clearAllMocks()
  })

  describe('model initialization', () => {
    test('initializes from matching query param', () => {
      mockQuery.page = '3'
      const { model } = useModel('page')
      expect(model.value).toBe('3')
    })

    test('uses defaultValue when no query match', () => {
      const { model } = useModel('page', { defaultValue: 1 })
      expect(model.value).toBe(1)
    })

    test('initializes as undefined when no match and no default', () => {
      const { model } = useModel('missing')
      expect(model.value).toBeUndefined()
    })

    test('converts value to number when asNumber is true', () => {
      mockQuery.page = '5'
      const { model } = useModel('page', { asNumber: true })
      expect(model.value).toBe(5)
    })

    test('handles bracket-notation param as object', () => {
      mockQuery['filter[status]'] = 'active'
      const { model } = useModel('filter')
      expect(model.value).toEqual({ status: 'active' })
    })

    test('matches array queryParam', () => {
      mockQuery.foo = 'bar'
      const { model } = useModel(['foo', 'baz'])
      expect(model.value).toBe('bar')
    })

    test('returns array value when param ends with []', () => {
      mockQuery['tags[]'] = ['a', 'b']
      const { model } = useModel('tags[]')
      expect(model.value).toEqual(['a', 'b'])
    })
  })

  describe('model → router.replace sync', () => {
    test('calls router.replace with updated query when model changes', async () => {
      const { model } = useModel('page')
      model.value = '2'
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ page: '2' }) }),
      )
    })

    test('removes query key when model is set to falsy', async () => {
      mockQuery.page = '2'
      const { model } = useModel('page')
      model.value = null
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.not.objectContaining({ page: expect.anything() }) }),
      )
    })

    test('builds bracket-notation query for object model value', async () => {
      const { model } = useModel('filter')
      model.value = { status: 'active' }
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ 'filter[status]': 'active' }) }),
      )
    })
  })

  describe('query → model sync', () => {
    test('updates model when matching query param changes reactively', async () => {
      const { model } = useModel('page')
      expect(model.value).toBeUndefined()
      mockQuery.page = '7'
      await nextTick()
      expect(model.value).toBe('7')
    })

    test('falls back to defaultValue, not null, when the param is removed from the route', async () => {
      mockQuery.page = '3'
      const { model } = useModel('page', { defaultValue: 1 })
      expect(model.value).toBe('3')
      delete mockQuery.page
      await nextTick()
      expect(model.value).toBe(1)
    })

    test('becomes null when the param is removed and there is no defaultValue', async () => {
      mockQuery.page = '3'
      const { model } = useModel('page')
      delete mockQuery.page
      await nextTick()
      expect(model.value).toBeNull()
    })

    test('a present param still wins over defaultValue', async () => {
      const { model } = useModel('page', { defaultValue: 1 })
      mockQuery.page = '4'
      await nextTick()
      expect(model.value).toBe('4')
    })

    test('does not write back to the URL when falling back to defaultValue', async () => {
      mockQuery.page = '3'
      const { model } = useModel('page', { defaultValue: 1 })
      delete mockQuery.page
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(model.value).toBe(1)
      expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    test('writes a later model change back to the URL after falling back', async () => {
      mockQuery.page = '3'
      const { model } = useModel('page', { defaultValue: 1 })
      delete mockQuery.page
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      model.value = 5
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(mockRouterReplace).toHaveBeenCalledTimes(1)
      expect(mockRouterReplace).toHaveBeenCalledWith({ query: { page: 5 } })
    })
  })
})
