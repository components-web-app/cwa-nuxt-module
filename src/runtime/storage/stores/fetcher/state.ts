import { markRaw, reactive } from 'vue'
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

// A retained per-route manifest structure, kept after the fetch itself is cleaned up so a revisit
// can lay out + locate the page instantly (from this + the resource data still in `byId`) without a
// fresh manifest round-trip. IRIs only — cheap. The bounded LRU (#257) evicts these; evicting an
// entry cascade-drops the `byId` resources it exclusively owns (reference-counted).
export interface RouteCacheEntry {
  resourceTree: NestedJsonStructure[]
  irisByDepth: string[][]
  // flattened, de-duplicated list of every resource IRI this route needs (all depths)
  resourceIris: string[]
  cachedAt: number
  lastAccessed: number
}

export interface CwaFetcherStateInterface {
  primaryFetch: {
    fetchingToken?: string
    successToken?: string
    // The fetch whose page is currently on screen — may be a fully-resolved success OR a page that
    // early-switched into view but was superseded before it finished. The anti-flash hold
    // (`resolvedDisplayFetchStatus`) reads this so navigation never reverts past the page the user
    // was actually looking at. See #256.
    displayedToken?: string
  }
  fetches: FetcherChainInterface
  // Route path → retained manifest structure. Intentionally NOT reactive (`markRaw`): it is read
  // imperatively when priming a revisit, so it should not add Vue proxy overhead per cached route.
  // See #257.
  routeCache: Map<string, RouteCacheEntry>
}

export default function (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({}),
    routeCache: markRaw(new Map<string, RouteCacheEntry>()),
  }
}
