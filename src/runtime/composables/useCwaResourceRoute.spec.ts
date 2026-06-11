// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { useCwaResourceRoute } from '#cwa/composables/useCwaResourceRoute'

describe('useCwaResourceRoute', () => {
  describe('getInternalResourceLink', () => {
    test('returns correct named route object with iri as cwaPage0 param', () => {
      const { getInternalResourceLink } = useCwaResourceRoute()
      const result = getInternalResourceLink('/some/iri')
      expect(result).toEqual({
        name: '_cwa-resource-page',
        params: { cwaPage0: '/some/iri' },
      })
    })
  })

  describe('getResourceRoute', () => {
    test('returns the resource property value when set', () => {
      const { getResourceRoute } = useCwaResourceRoute()
      const resource: any = { '@id': '/some/iri', link: '/external-link' }
      expect(getResourceRoute(resource, 'link')).toBe('/external-link')
    })

    test('falls back to internal link when property is falsy', () => {
      const { getResourceRoute } = useCwaResourceRoute()
      const resource: any = { '@id': '/some/iri' }
      const result = getResourceRoute(resource, 'link')
      expect(result).toEqual({
        name: '_cwa-resource-page',
        params: { cwaPage0: '/some/iri' },
      })
    })

    test('falls back to internal link when property value is undefined', () => {
      const { getResourceRoute } = useCwaResourceRoute()
      const resource: any = { '@id': '/my/iri', link: undefined }
      const result = getResourceRoute(resource, 'link')
      expect(result).toEqual({
        name: '_cwa-resource-page',
        params: { cwaPage0: '/my/iri' },
      })
    })
  })
})
