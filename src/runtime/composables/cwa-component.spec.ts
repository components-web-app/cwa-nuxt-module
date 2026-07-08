// @vitest-environment happy-dom

import { describe, expect, vi, test, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCwaComponent } from '#cwa/composables/cwa-component'

const mockResource = vi.hoisted(() => ({ value: undefined as any }))
const mockExposeMeta = vi.hoisted(() => ({ cwaResource: {}, disableManager: false }))
const mockCwa = vi.hoisted(() => ({ resources: {}, admin: { eventBus: { emit: vi.fn() } } }))
const mockGetCurrentStyleName = vi.hoisted(() => vi.fn())
const mockUseCwaResource = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa-resource', () => ({
  useCwaResource: mockUseCwaResource,
}))

describe('useCwaComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCwaResource.mockReturnValue({
      getResource: vi.fn(() => mockResource),
      exposeMeta: mockExposeMeta,
      $cwa: mockCwa,
      getCurrentStyleName: mockGetCurrentStyleName,
    })
  })

  test('returns resource directly, not a getResource function', () => {
    const result = useCwaComponent({ iri: '/component/1' })
    expect(result.resource).toBe(mockResource)
    expect('getResource' in result).toBe(false)
  })

  test('returns exposeMeta from useCwaResource', () => {
    const result = useCwaComponent({ iri: '/component/1' })
    expect(result.exposeMeta).toBe(mockExposeMeta)
  })

  test('forwards ops to useCwaResource', () => {
    const ops = { name: 'MyComp', manager: { disabled: true as const } }
    useCwaComponent({ iri: '/component/1' }, undefined, ops)
    expect(mockUseCwaResource).toHaveBeenCalledWith(
      expect.objectContaining({ value: '/component/1' }),
      ops,
    )
  })

  test('calls plugin with iri ref, resource, and $cwa context', () => {
    const mockPlugin = vi.fn(() => ({}))
    useCwaComponent({ iri: '/component/1' }, [mockPlugin])
    const ctx = mockPlugin.mock.calls[0][0]
    expect(ctx.iri.value).toBe('/component/1')
    expect(ctx.resource).toBe(mockResource)
    expect(ctx.$cwa).toBe(mockCwa)
  })

  test('merges single plugin result into return value', () => {
    const extra = ref('hello')
    const result = useCwaComponent({ iri: '/component/1' }, [() => ({ extra })])
    expect((result as any).extra).toBe(extra)
  })

  test('merges multiple plugin results into return value', () => {
    const a = ref(1)
    const b = ref(2)
    const result = useCwaComponent({ iri: '/component/1' }, [() => ({ a }), () => ({ b })])
    expect((result as any).a).toBe(a)
    expect((result as any).b).toBe(b)
  })

  test('works with no plugins', () => {
    const result = useCwaComponent({ iri: '/component/1' })
    expect(result.resource).toBeDefined()
    expect(result.exposeMeta).toBeDefined()
  })

  describe('files map accumulation (withFile)', () => {
    test('accumulates the `files` key across multiple plugins instead of overwriting', () => {
      const hero = { contentUrl: '/hero.jpg' }
      const thumb = { contentUrl: '/thumb.jpg' }
      const result = useCwaComponent({ iri: '/component/1' }, [
        () => ({ files: { heroImage: hero } }),
        () => ({ files: { thumbnail: thumb } }),
      ])
      expect((result as any).files).toEqual({ heroImage: hero, thumbnail: thumb })
    })

    test('a file plugin can also contribute non-files keys, merged normally', () => {
      const field = { contentUrl: '/f.jpg' }
      const extra = ref('x')
      const result = useCwaComponent({ iri: '/component/1' }, [
        () => ({ files: { file: field }, extra }),
      ])
      expect((result as any).files).toEqual({ file: field })
      expect((result as any).extra).toBe(extra)
    })

    test('no `files` key when no plugin provides one', () => {
      const result = useCwaComponent({ iri: '/component/1' }, [() => ({ a: 1 })])
      expect('files' in result).toBe(false)
    })
  })
})
