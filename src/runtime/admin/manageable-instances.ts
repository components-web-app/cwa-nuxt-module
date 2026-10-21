import type { Ref } from 'vue'
import type Cwa from '#cwa/cwa'

interface InstanceRegistry {
  instances: Map<string, Set<Ref<HTMLElement[]>>>
  listeners: Set<() => void>
}

const registries = new WeakMap<Cwa, InstanceRegistry>()

function registryOf($cwa: Cwa): InstanceRegistry {
  let registry = registries.get($cwa)
  if (!registry) {
    registry = { instances: new Map(), listeners: new Set() }
    registries.set($cwa, registry)
  }
  return registry
}

function notify(registry: InstanceRegistry) {
  for (const listener of registry.listeners) {
    listener()
  }
}

export function registerInstance($cwa: Cwa, iri: string, elements: Ref<HTMLElement[]>) {
  const registry = registryOf($cwa)
  let instances = registry.instances.get(iri)
  if (!instances) {
    instances = new Set()
    registry.instances.set(iri, instances)
  }
  if (instances.has(elements)) {
    return
  }
  instances.add(elements)
  notify(registry)
}

export function unregisterInstance($cwa: Cwa, iri: string, elements: Ref<HTMLElement[]>) {
  const registry = registryOf($cwa)
  const instances = registry.instances.get(iri)
  if (!instances?.delete(elements)) {
    return
  }
  if (!instances.size) {
    registry.instances.delete(iri)
  }
  notify(registry)
}

export function instancesOf($cwa: Cwa, iri: string | undefined): Ref<HTMLElement[]>[] {
  if (!iri) {
    return []
  }
  const { instances } = registryOf($cwa)
  const all: Ref<HTMLElement[]>[] = []
  for (const publishableIri of new Set([iri, ...$cwa.resources.findAllPublishableIris(iri)])) {
    all.push(...(instances.get(publishableIri) ?? []))
  }
  return all
}

export function onInstancesChange($cwa: Cwa, listener: () => void): () => void {
  const { listeners } = registryOf($cwa)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function boundsOf(elements: HTMLElement[]) {
  let top = Infinity
  let left = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const element of elements) {
    if (element.nodeType !== 1 || !element.isConnected) {
      continue
    }
    const rect = element.getBoundingClientRect()
    top = Math.min(top, rect.top)
    left = Math.min(left, rect.left)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }
  if (top === Infinity) {
    return
  }
  const scrollY = Math.max(document.body.scrollTop, document.documentElement.scrollTop)
  const scrollX = Math.max(document.body.scrollLeft, document.documentElement.scrollLeft)
  return {
    top: `${top + scrollY}px`,
    left: `${left + scrollX}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`,
  }
}
