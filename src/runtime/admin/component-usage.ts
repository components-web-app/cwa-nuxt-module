import type Cwa from '#cwa/cwa'

export interface ComponentUsage {
  positionCount: number
  pageDataCount: number
  total: number
}

export async function fetchComponentUsage($cwa: Cwa, iri: string): Promise<ComponentUsage | undefined> {
  try {
    const { response } = $cwa.fetch({ path: `${iri}/usage`, noQuery: true })
    const { _data: data } = await response
    if (typeof data?.total !== 'number') {
      return
    }
    return { positionCount: data.positionCount, pageDataCount: data.pageDataCount, total: data.total }
  }
  catch {
    return undefined
  }
}
