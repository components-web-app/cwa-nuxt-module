import type Cwa from '#cwa/cwa'

export interface ComponentUsagePage {
  iri: string
  title: string | null
  routePath: string | null
}

export interface ComponentUsageLocation {
  pageDataProperty: string | null
  layout: { reference: string } | null
  renderedOn: ComponentUsagePage[]
  renderedOnCount: number
}

export interface ComponentUsage {
  positionCount: number
  pageDataCount: number
  total: number
  locations?: ComponentUsageLocation[]
}

export async function fetchComponentUsage($cwa: Cwa, iri: string): Promise<ComponentUsage | undefined> {
  try {
    const { response } = $cwa.fetch({ path: `${iri}/usage`, noQuery: true })
    const { _data: data } = await response
    if (typeof data?.total !== 'number') {
      return
    }
    const usage: ComponentUsage = { positionCount: data.positionCount, pageDataCount: data.pageDataCount, total: data.total }
    if (Array.isArray(data.locations)) {
      usage.locations = data.locations
    }
    return usage
  }
  catch {
    return undefined
  }
}
