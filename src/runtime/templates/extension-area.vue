<template>
  <div
    v-if="area"
    data-testid="extension-area"
  >
    <div class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pt-10 cwa:sm:px-8">
      <h1 class="cwa:m-0 cwa:text-[1.75rem] cwa:leading-tight cwa:font-semibold cwa:text-fg">
        {{ area.label }}
      </h1>
      <div
        role="tablist"
        :aria-label="area.label"
        class="cwa:relative cwa:mt-6 cwa:flex cwa:h-hit cwa:items-stretch cwa:overflow-x-auto cwa:border-b cwa:border-line cwa:[scrollbar-width:none]"
      >
        <NuxtLink
          v-for="(tab, index) in tabs"
          :id="`${tabsId}-${tab.path}`"
          :key="tab.path"
          :to="{ name: tab.name }"
          role="tab"
          :aria-selected="tab.selected ? 'true' : 'false'"
          :aria-controls="panelId"
          :tabindex="tab.selected ? 0 : -1"
          data-testid="extension-area-tab"
          class="cwa:relative cwa:inline-flex cwa:shrink-0 cwa:items-center cwa:whitespace-nowrap cwa:px-4 cwa:text-label cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
          :class="tab.selected ? 'cwa:text-fg' : 'cwa:text-fg-muted cwa:hover:text-fg'"
          @keydown="onTabKey($event, index)"
        >
          {{ tab.label }}
        </NuxtLink>
        <TabIndicator />
      </div>
    </div>
    <div
      :id="panelId"
      role="tabpanel"
      class="cwa:pt-6"
      :aria-labelledby="selectedTab ? `${tabsId}-${selectedTab.path}` : undefined"
    >
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, provide, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TabIndicator from '#cwa/templates/components/core/ui/TabIndicator.vue'
import { areaHeadingKey } from '#cwa/templates/components/core/ui/field-keys'
import { useCwa } from '#cwa/composables/cwa'
import { extensionRouteName, openablePages } from '#cwa/admin/extension-areas'
import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'

const $cwa = useCwa()
const route = useRoute()
const router = useRouter()
const tabsId = useId()
const panelId = `${tabsId}-panel`
provide(areaHeadingKey, true)

const area = computed(() => (extensionAreas as CwaExtensionArea[]).find(candidate => route.matched.some(record => record.name === extensionRouteName(candidate.segment))))

const tabs = computed(() => {
  if (!area.value) {
    return []
  }
  const segment = area.value.segment
  return openablePages(area.value, role => $cwa.auth.hasRole(role)).map((page) => {
    const name = extensionRouteName(segment, page.path)
    return { path: page.path, label: page.label, name, selected: route.matched.some(record => record.name === name) }
  })
})

const selectedTab = computed(() => tabs.value.find(tab => tab.selected))

function onTabKey(event: KeyboardEvent, index: number) {
  const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.value.length - 1 }
  if (!(event.key in moves) || event.altKey || event.metaKey || event.ctrlKey) {
    return
  }
  event.preventDefault()
  const next = tabs.value[(moves[event.key]! + tabs.value.length) % tabs.value.length]!
  router.push({ name: next.name })
  nextTick(() => document.getElementById(`${tabsId}-${next.path}`)?.focus())
}
</script>
