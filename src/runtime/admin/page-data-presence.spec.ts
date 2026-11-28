import { describe, expect, test, vi } from 'vitest'
import { hasPageDataTypes } from './page-data-presence'
import type Cwa from '#cwa/cwa'

const docs = (classes: string[]) => ({ pageDataMetadata: { member: classes.map(resourceClass => ({ resourceClass })) } })

function cwaWith(getApiDocumentation: () => Promise<unknown>) {
  return { getApiDocumentation: vi.fn(getApiDocumentation) } as unknown as Cwa & { getApiDocumentation: ReturnType<typeof vi.fn> }
}

describe('hasPageDataTypes', () => {
  test('is true only when the API documents a page data class other than the abstract one', async () => {
    expect(await hasPageDataTypes(cwaWith(async () => docs(['App\\Entity\\BlogArticleData'])))).toBe(true)
    expect(await hasPageDataTypes(cwaWith(async () => docs(['Silverback\\AbstractPageData'])))).toBe(false)
  })

  test('asks the API once per Cwa, so the bar, the menu and the Dashboard share one answer', async () => {
    const $cwa = cwaWith(async () => docs(['App\\Entity\\BlogArticleData']))
    await Promise.all([hasPageDataTypes($cwa), hasPageDataTypes($cwa)])
    await hasPageDataTypes($cwa)
    expect($cwa.getApiDocumentation).toHaveBeenCalledTimes(1)
  })

  test('a failed request answers false and is asked again next time', async () => {
    const $cwa = cwaWith(async () => {
      throw new Error('offline')
    })
    expect(await hasPageDataTypes($cwa)).toBe(false)
    $cwa.getApiDocumentation.mockResolvedValueOnce(docs(['App\\Entity\\BlogArticleData']))
    expect(await hasPageDataTypes($cwa)).toBe(true)
  })
})
