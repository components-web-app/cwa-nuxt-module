<template>
  <div
    ref="cwaPage"
    class="cwa:page cwa:h-full"
  >
    <CwaPage />
  </div>
</template>

<script setup lang="ts">
import type { UseHeadOptions } from '@unhead/vue'
import { useElementSize } from '@vueuse/core'
import { computed, provide, useTemplateRef, watch } from 'vue'
import { withoutTrailingSlash } from 'ufo'
import { titleCase } from 'scule'
import CwaPage from './components/main/CwaPage.vue'
import { useCwa, useError, useHead, useRoute } from '#imports'

// to prevent errors navigating between pages, a page should have a single root element
// resource loader will be 1 at a time but can switch between 3 states

const $cwa = useCwa()
provide('cwa-page-depth', 0)

const cwaPage = useTemplateRef('cwaPage')
const { width, height } = useElementSize(cwaPage)

watch([width, height], () => {
  $cwa.admin.emitRedraw()
})

const minimalPriority: UseHeadOptions = {
  // give nuxt.config values higher priority
  tagPriority: 101,
}

// from Nuxt-SEO-Utils as the plugin is not extensible and we need to overwrite the title
// https://github.com/harlan-zw/nuxt-seo-utils/blob/main/src/runtime/app/plugins/titles.ts
// composable requested - https://github.com/harlan-zw/nuxt-seo-utils/issues/65
const route = useRoute()
const err = useError()

const fallbackTitle = computed(() => {
  if (typeof err.value?.status === 'number' && [404, 500].includes(err.value.status)) {
    return `${err.value.status} - ${err.value.message}`
  }
  if (typeof route.meta?.title === 'string')
    return route.meta?.title
  // if no title has been set then we should use the last segment of the URL path and title case it
  const path = withoutTrailingSlash(route.path || '/')
  const lastSegment = path.split('/').pop()
  return lastSegment ? titleCase(lastSegment) : null
})

const metaDescription = computed(() => {
  const count = $cwa.resources.depthCount.value
  for (let d = count - 1; d >= 0; d--) {
    const desc = $cwa.resources.pageDataAtDepth(d).value?.data?.metaDescription
      || $cwa.resources.pageAtDepth(d).value?.data?.metaDescription
    if (desc) return desc
  }
  return undefined
})

useHead({
  title: () => {
    const count = $cwa.resources.depthCount.value
    const titles: string[] = []
    for (let d = count - 1; d >= 0; d--) {
      const t = $cwa.resources.pageDataAtDepth(d).value?.data?.title
        || $cwa.resources.pageAtDepth(d).value?.data?.title
      if (t) titles.push(t)
    }
    const userDefinedTitle = titles.length ? titles.join(' | ') : undefined
    if (!userDefinedTitle && $cwa.siteConfig.config.fallbackTitle) {
      return fallbackTitle.value
    }
    return userDefinedTitle || null
  },
  meta: [
    { name: 'description', content: metaDescription },
  ],
}, minimalPriority)
</script>
