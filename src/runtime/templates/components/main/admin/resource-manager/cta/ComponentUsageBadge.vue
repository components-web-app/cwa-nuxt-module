<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { navigateTo } from '#app/composables/router'
import { useCwa } from '#cwa/composables/cwa'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import type { ComponentUsage, ComponentUsagePage } from '#cwa/admin/component-usage'

const $cwa = useCwa()
const currentIri = $cwa.admin.resourceStackManager.currentIri
const usage = ref<ComponentUsage>()
const open = ref(false)
const badgeClass = 'cwa:whitespace-nowrap cwa:text-xs cwa:text-yellow cwa:border cwa:border-yellow/60 cwa:rounded-full cwa:py-1 cwa:px-2.5'
let request = 0

const component = computed(() => {
  const iri = currentIri.value
  if (!iri || getResourceTypeFromIri(iri) !== CwaResourceTypes.COMPONENT) {
    return
  }
  const data = $cwa.resources.getResource(iri).value?.data
  if (data?._metadata?.persisted === false) {
    return
  }
  return { iri, positions: (data?.componentPositions ?? []).join(',') }
})

watch(() => component.value && `${component.value.iri}|${component.value.positions}`, async () => {
  usage.value = undefined
  const requestId = ++request
  const iri = component.value?.iri
  if (!iri) {
    return
  }
  const fetched = await fetchComponentUsage($cwa, iri)
  if (requestId === request) {
    usage.value = fetched
  }
}, { immediate: true })

const morePlaces = computed(() => usage.value?.locations ? usage.value.total - usage.value.locations.length : 0)

function pageName(page: ComponentUsagePage) {
  return page.title || page.routePath || 'Untitled page'
}

function isThisPage(page: ComponentUsagePage) {
  return page.iri === $cwa.resources.displayPageIri.value
}

async function goTo(routePath: string) {
  open.value = false
  await navigateTo({ path: routePath, query: { cwa_force: 'true' } })
}
</script>

<template>
  <template v-if="usage && usage.total > 1">
    <PopoverRoot
      v-if="usage.locations"
      v-model:open="open"
    >
      <PopoverTrigger
        data-testid="component-usage-badge"
        :class="[badgeClass, 'cwa:cursor-pointer cwa:hover:bg-yellow/10 cwa:focus-visible:outline-2 cwa:focus-visible:outline-yellow']"
      >
        Shared · {{ usage.total }} places
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side="top"
          align="end"
          :side-offset="8"
          data-testid="component-usage-list"
          class="cwa:z-context cwa:min-w-[220px] cwa:max-w-sm cwa:max-h-[50vh] cwa:overflow-y-auto cwa:p-3 cwa:rounded-lg cwa:dark-blur cwa:outline-dotted cwa:outline-1 cwa:outline-stone-400 cwa:shadow-lg cwa:text-sm cwa:text-light"
        >
          <ul class="cwa:flex cwa:flex-col cwa:gap-y-2">
            <li
              v-for="(location, index) in usage.locations"
              :key="index"
              data-testid="component-usage-location"
            >
              <template v-if="location.layout">
                <span>Layout: {{ location.layout.reference }}</span>
                {{ ' ' }}
                <span class="cwa:text-stone-400">on every page using it</span>
              </template>
              <template v-else>
                <span
                  v-if="location.pageDataProperty"
                  class="cwa:block cwa:text-stone-400"
                >Template default for {{ location.pageDataProperty }}</span>
                <ul>
                  <li
                    v-for="page in location.renderedOn"
                    :key="page.iri"
                  >
                    <template v-if="isThisPage(page)">
                      <span>{{ pageName(page) }}</span>
                      {{ ' ' }}
                      <span class="cwa:text-yellow">This page</span>
                    </template>
                    <a
                      v-else-if="page.routePath"
                      :href="page.routePath"
                      class="cwa:underline cwa:underline-offset-2 cwa:hover:text-white"
                      @click.prevent="goTo(page.routePath)"
                    >{{ pageName(page) }}</a>
                    <span v-else>{{ pageName(page) }}</span>
                  </li>
                  <li
                    v-if="location.renderedOnCount > location.renderedOn.length"
                    class="cwa:text-stone-400"
                  >
                    and {{ location.renderedOnCount - location.renderedOn.length }} more
                  </li>
                </ul>
              </template>
            </li>
          </ul>
          <p
            v-if="morePlaces > 0"
            data-testid="component-usage-more"
            class="cwa:mt-2 cwa:text-stone-400"
          >
            and {{ morePlaces }} more places
          </p>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <span
      v-else
      data-testid="component-usage-badge"
      :class="badgeClass"
    >Shared · {{ usage.total }} places</span>
  </template>
</template>
