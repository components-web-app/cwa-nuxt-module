import { reactive } from 'vue'
import type { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'

// A node in the nested per-depth manifest tree the API returns as `resource_iris` (module #250 /
// api-components-bundle #197). `iri` is the resource IRI; `children` are the nested/related
// resources reachable without crossing a page-nesting boundary (always present — empty for leaves).
// This is a bespoke DTO shape, not a JSON-LD graph (hence `iri`, not `@id`).
export interface NestedJsonStructure {
  iri: string
  children: NestedJsonStructure[]
}

interface FetchManifestInterface {
  path: string
  // Raw per-depth manifest tree (outer array indexed by rendering depth, root first). Preserves
  // component containment for future placeholder/skeleton rendering — retained but not yet rendered.
  resourceTree?: NestedJsonStructure[]
  // Derived: each depth's tree flattened to its flat IRI list. Existing consumers
  // (`pageIriAtDepth`, early-switch, `_iriToDepth`, fetch batch) read this unchanged.
  irisByDepth?: string[][]
  fetchComplete?: true
  error?: CwaResourceErrorObject
}

export type FetchAbortReason = 'redirect'

export interface FetchStatus {
  path: string
  isPrimary: boolean
  resources: string[]
  manifest?: FetchManifestInterface
  abort?: true
  abortReason?: FetchAbortReason
  timestamp: number
}

export interface FetcherChainInterface {
  [token: string]: FetchStatus
}

export interface CwaFetcherStateInterface {
  primaryFetch: {
    fetchingToken?: string
    successToken?: string
  }
  fetches: FetcherChainInterface
}

export default function (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({}),
  }
}
