import { computed, ref, watch } from 'vue'
import slugify from 'slugify'
import { useCwa } from '#cwa/composables/cwa'

export function pathOfRouteIri(iri?: string | null) {
  return iri ? iri.replace(/^.*\/_\/routes\//, '') : undefined
}

function isRoutePrefix(value: unknown): value is string {
  return typeof value === 'string' && /^\/[^/]/.test(value) && !value.endsWith('/')
}

export function useRouteDefaults(page: () => Record<string, any> | undefined, className: () => string | undefined = () => page()?.['@type']) {
  const $cwa = useCwa()
  const classRoutePrefix = ref<string>()
  const shortClassName = computed(() => className()?.split('\\').pop())

  watch(shortClassName, async (name) => {
    classRoutePrefix.value = undefined
    if (!name || name === 'Page') {
      return
    }
    const docs = await $cwa.getApiDocumentation()
    const routePrefix = docs?.docs?.supportedClass?.find(supportedClass => supportedClass.title === name)?.routePrefix
    if (name === shortClassName.value) {
      classRoutePrefix.value = isRoutePrefix(routePrefix) ? routePrefix : undefined
    }
  }, { immediate: true })

  const parentIri = computed(() => page()?.parentPage || page()?.parentPageData || undefined)
  const parentResource = computed(() => parentIri.value ? $cwa.resources.getResource(parentIri.value).value : null)
  const parentName = computed(() => parentResource.value?.data?.reference || parentResource.value?.data?.title || undefined)
  const parentHasNoRoute = computed(() => !!parentIri.value && !!parentResource.value?.data && !parentResource.value.data.route)

  const ancestry = computed(() => {
    const seen = new Set<string>()
    let iri: string | undefined = parentIri.value
    while (iri && !seen.has(iri)) {
      seen.add(iri)
      const data = $cwa.resources.getResource(iri).value?.data
      if (!data) {
        return { unloaded: iri }
      }
      if (data.route) {
        return { routedPath: pathOfRouteIri(data.route) }
      }
      iri = data.parentPage || data.parentPageData || undefined
    }
    return {}
  })

  watch(() => ancestry.value.unloaded, (iri) => {
    iri && $cwa.fetchResource({ path: iri, shallowFetch: true })
  }, { immediate: true })

  const startPath = computed(() => {
    const path = ancestry.value.routedPath
    return path && path !== '/' ? path : ''
  })
  const lockedPrefix = computed(() => (startPath.value + (classRoutePrefix.value ?? '')) || undefined)

  const recommendedPath = computed(() => {
    const title = page()?.title
    if (!title) {
      return undefined
    }
    const suffix = '/' + slugify(title.toLowerCase(), { strict: true })
    return (lockedPrefix.value ?? '') + suffix
  })

  return { parentIri, parentName, parentHasNoRoute, recommendedPath, lockedPrefix }
}
