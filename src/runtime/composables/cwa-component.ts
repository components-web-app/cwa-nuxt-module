import { toRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type Cwa from '#cwa/cwa'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'
import type { CwaResourceUtilsOps, IriProp } from './cwa-resource'
import { useCwaResource } from './cwa-resource'

export interface CwaResourcePluginContext {
  iri: Ref<string>
  resource: ComputedRef<CwaCurrentResourceInterface | undefined>
  $cwa: Cwa
}

export type CwaResourcePlugin<T extends object = object> = (ctx: CwaResourcePluginContext) => T

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

// Unioning with Record<never, never> ensures PluginResults always resolves to an object type (never → {}) so it is safe to spread
type PluginResults<P extends CwaResourcePlugin<any>[]> = UnionToIntersection<
  { [K in keyof P]: P[K] extends CwaResourcePlugin<infer R> ? R : never }[number] | Record<never, never>
>

export const useCwaComponent = <P extends CwaResourcePlugin<any>[]>(
  props: IriProp,
  plugins?: [...P],
  ops?: CwaResourceUtilsOps,
) => {
  const iri = toRef(props, 'iri')
  const { getResource, $cwa, exposeMeta, getCurrentStyleName } = useCwaResource(iri, ops)
  const resource = getResource()

  const ctx: CwaResourcePluginContext = { iri, resource, $cwa }
  const pluginResults = (plugins ?? []).map(plugin => plugin(ctx))

  type BaseReturn = {
    resource: typeof resource
    exposeMeta: typeof exposeMeta
    $cwa: typeof $cwa
    getCurrentStyleName: typeof getCurrentStyleName
  }

  return Object.assign(
    { resource, exposeMeta, $cwa, getCurrentStyleName } satisfies BaseReturn,
    ...pluginResults,
  ) as BaseReturn & PluginResults<P>
}
