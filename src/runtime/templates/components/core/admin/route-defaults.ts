import { computed, watchEffect } from 'vue'
import slugify from 'slugify'
import { useCwa } from '#cwa/composables/cwa'

export function pathOfRouteIri(iri?: string | null) {
  return iri ? iri.replace(/^.*\/_\/routes\//, '') : undefined
}

export function useRouteDefaults(page: () => Record<string, any> | undefined) {
  const $cwa = useCwa()
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

  const recommendedPath = computed(() => {
    const title = page()?.title
    if (!title) {
      return undefined
    }
    const suffix = '/' + slugify(title.toLowerCase(), { strict: true })
    return parentRoutePrefix.value && parentRoutePrefix.value !== '/' ? parentRoutePrefix.value + suffix : suffix
  })

  return { parentIri, parentName, parentRoutePrefix, parentHasNoRoute, recommendedPath }
}
