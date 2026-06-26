import { toRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type Cwa from '#cwa/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { CwaResourceUtilsOps, IriProp } from './cwa-resource'
import { useCwaResource } from './cwa-resource'

export interface CwaResourcePluginContext {
  iri: Ref<string>
  resource: ComputedRef<CwaResource | undefined>
  $cwa: Cwa
}

export type CwaResourcePlugin<T extends object = object> = (ctx: CwaResourcePluginContext) => T

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

type PluginResults<P extends CwaResourcePlugin<any>[]> = UnionToIntersection<
  { [K in keyof P]: P[K] extends CwaResourcePlugin<infer R> ? R : never }[number]
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

  return {
    resource,
    exposeMeta,
    $cwa,
    getCurrentStyleName,
    ...Object.assign({}, ...pluginResults) as unknown as PluginResults<P>,
  }
}
