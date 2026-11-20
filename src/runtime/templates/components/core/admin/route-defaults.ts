import { computed, ref, watch, watchEffect } from 'vue'
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

  watchEffect(() => {
    const iri = parentIri.value
    if (iri && !parentResource.value?.data) {
      $cwa.fetchResource({ path: iri, shallowFetch: true })
    }
  })

  const parentRoutePrefix = computed(() => pathOfRouteIri(parentResource.value?.data?.route) ?? null)
  const parentHasNoRoute = computed(() => !!parentIri.value && !parentRoutePrefix.value)

  const startPath = computed(() => parentRoutePrefix.value && parentRoutePrefix.value !== '/' ? parentRoutePrefix.value : '')
  const lockedPrefix = computed(() => classRoutePrefix.value ? startPath.value + classRoutePrefix.value : undefined)

  const recommendedPath = computed(() => {
    const title = page()?.title
    if (!title) {
      return undefined
    }
    const suffix = '/' + slugify(title.toLowerCase(), { strict: true })
    return (lockedPrefix.value ?? startPath.value) + suffix
  })

  return { parentIri, parentName, parentRoutePrefix, parentHasNoRoute, recommendedPath, lockedPrefix }
}
