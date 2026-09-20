import { computed, toRef } from 'vue'
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

type PluginResults<P extends CwaResourcePlugin<any>[]> = UnionToIntersection<
  { [K in keyof P]: P[K] extends CwaResourcePlugin<infer R> ? R : never }[number] | Record<never, never>
>

export const useCwaComponent = <P extends CwaResourcePlugin<any>[]>(
  props: IriProp,
  plugins?: [...P],
  ops?: CwaResourceUtilsOps,
) => {
  const iri = toRef(props, 'iri')
  const { getResource, $cwa, exposeMeta, getCurrentStyleName, uiClassNames } = useCwaResource(iri, ops)
  const resource = getResource()
  const publishedIri = computed(() => $cwa.resources.findPublishedComponentIri(iri.value).value ?? iri.value)
  const ctx: CwaResourcePluginContext = { iri, resource, $cwa }
  const pluginResults = (plugins ?? []).map(plugin => plugin(ctx))

  type BaseReturn = {
    resource: typeof resource
    exposeMeta: typeof exposeMeta
    $cwa: typeof $cwa
    getCurrentStyleName: typeof getCurrentStyleName
    uiClassNames: typeof uiClassNames
    publishedIri: typeof publishedIri
  }

  const merged: Record<string, unknown> = { resource, exposeMeta, $cwa, getCurrentStyleName, uiClassNames, publishedIri } satisfies BaseReturn
  const files: Record<string, unknown> = {}
  for (const pluginResult of pluginResults) {
    if (pluginResult && typeof pluginResult === 'object' && 'files' in pluginResult) {
      const { files: pluginFiles, ...rest } = pluginResult as { files: Record<string, unknown> }
      Object.assign(files, pluginFiles)
      Object.assign(merged, rest)
    }
    else {
      Object.assign(merged, pluginResult)
    }
  }
  if (Object.keys(files).length) {
    merged.files = files
  }

  return merged as BaseReturn & PluginResults<P>
}
