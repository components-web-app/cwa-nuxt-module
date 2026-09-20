import { markRaw, reactive } from 'vue'
import type { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'

export interface NestedJsonStructure {
  iri: string
  children: NestedJsonStructure[]
}

interface FetchManifestInterface {
  path: string
  resourceTree?: NestedJsonStructure[]
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

export interface RouteCacheEntry {
  resourceTree: NestedJsonStructure[]
  irisByDepth: string[][]
  resourceIris: string[]
  cachedAt: number
  lastAccessed: number
}

export interface CwaFetcherStateInterface {
  primaryFetch: {
    fetchingToken?: string
    successToken?: string
    displayedToken?: string
  }
  fetches: FetcherChainInterface
  routeCache: Map<string, RouteCacheEntry>
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
