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
  // (`pageIriAtDepth`, early-switch, `iriDepths`, fetch batch) read this unchanged.
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
  // Depth structure of the CURRENT primary fetch, driving the depth-aware `path` request header:
  // resource IRI → rendering depth, and depth → that depth's route path. Derived from the manifest
  // tree, plus `registerIriDepth` for nested IRIs the manifest did not itself contain.
  //
  // A depth-0 resource MUST be requested with the depth-0 route path, or the API resolves a dynamic
  // position's `pageDataProperty` against the wrong page data. On a nested route the fallback (the
  // current route path) points at the CHILD — a static page with no page data — so the position
  // comes back with `component: null` and the parent data page's content vanishes.
  //
  // This lives in the store, NOT on `FetchStatusManager`, because it must survive the SSR→client
  // payload: the client builds a fresh manager and runs no manifest fetch, so in-memory maps would
  // start empty and every client-side re-fetch after a server-side load would send the wrong path.
  // Reset per primary fetch (see `resetIriDepths`). Plain objects so they serialise. See #261.
  iriDepths: Record<string, number>
  depthPaths: Record<number, string>
}

export default function (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({}),
    routeCache: markRaw(new Map<string, RouteCacheEntry>()),
    iriDepths: reactive({}),
    depthPaths: reactive({}),
  }
}
