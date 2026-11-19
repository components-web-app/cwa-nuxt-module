<script lang="ts" setup>
import { POPOVER_GAP } from '#cwa/templates/components/core/ui/popover-gap'
import { menuPanel } from '#cwa/templates/components/core/ui/field-looks'
import { computed, ref, watch } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { navigateTo } from '#app/composables/router'
import { useCwa } from '#cwa/composables/cwa'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import type { ComponentUsage, ComponentUsagePage } from '#cwa/admin/component-usage'
import ShareGlyph from '#cwa/templates/components/core/ui/ShareGlyph.vue'

const $cwa = useCwa()
const currentIri = $cwa.admin.resourceStackManager.currentIri
const usage = ref<ComponentUsage>()
const open = ref(false)
const badgeClass = 'cwa:whitespace-nowrap cwa:text-xs cwa:text-yellow cwa:border cwa:border-yellow/60 cwa:py-1 cwa:px-2.5'
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
        class="cwa:inline-flex cwa:h-control cwa:shrink-0 cwa:items-center cwa:px-1 cwa:text-yellow cwa:cursor-pointer cwa:outline-1 cwa:outline-transparent cwa:hover:bg-yellow/10 cwa:aria-expanded:bg-yellow/10 cwa:aria-expanded:shadow-[inset_0_-2px_0_currentColor] cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-yellow cwa:pointer-coarse:h-hit"
      >
        <span
          data-testid="component-usage-pill"
          :class="badgeClass"
        >
          <span class="cwa:sr-only cwa:sm:not-sr-only">Shared · {{ usage.total }} places</span>
          <span
            aria-hidden="true"
            data-testid="component-usage-compact"
            class="cwa:inline-flex cwa:items-center cwa:gap-1 cwa:sm:hidden"
          ><ShareGlyph />{{ usage.total }}</span>
        </span>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side="top"
          align="end"
          :side-offset="POPOVER_GAP"
          data-testid="component-usage-list"
          :class="[menuPanel, 'cwa:min-w-48']"
        >
          <div class="cwa:max-h-72 cwa:overflow-y-auto cwa:p-3">
            <ul class="cwa:m-0 cwa:flex cwa:list-none cwa:flex-col cwa:gap-y-2 cwa:p-0">
              <li
                v-for="(location, index) in usage.locations"
                :key="index"
                data-testid="component-usage-location"
              >
                <template v-if="location.layout">
                  <span>Layout: {{ location.layout.reference }}</span>
                  {{ ' ' }}
                  <span class="cwa:text-fg-muted">on every page using it</span>
                </template>
                <template v-else>
                  <span
                    v-if="location.pageDataProperty"
                    class="cwa:block cwa:text-fg-muted"
                  >Template default for {{ location.pageDataProperty }}</span>
                  <ul class="cwa:m-0 cwa:list-none cwa:p-0">
                    <li
                      v-for="page in location.renderedOn"
                      :key="page.iri"
                    >
                      <template v-if="isThisPage(page)">
                        <span>{{ pageName(page) }}</span>
                        {{ ' ' }}
                        <span class="cwa:text-accent-fg">This page</span>
                      </template>
                      <a
                        v-else-if="page.routePath"
                        :href="page.routePath"
                        class="cwa:cursor-pointer cwa:text-fg cwa:underline cwa:underline-offset-2 cwa:outline-1 cwa:outline-transparent cwa:hover:text-accent-fg cwa:focus-visible:outline-2 cwa:focus-visible:outline-accent-fg"
                        @click.prevent="goTo(page.routePath)"
                      >{{ pageName(page) }}</a>
                      <span v-else>{{ pageName(page) }}</span>
                    </li>
                    <li
                      v-if="location.renderedOnCount > location.renderedOn.length"
                      class="cwa:text-fg-muted"
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
              class="cwa:mt-2 cwa:mb-0 cwa:text-fg-muted"
            >
              and {{ morePlaces }} more places
            </p>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <span
      v-else
      data-testid="component-usage-badge"
      :class="badgeClass"
    >
      <span class="cwa:sr-only cwa:sm:not-sr-only">Shared · {{ usage.total }} places</span>
      <span
        aria-hidden="true"
        data-testid="component-usage-compact"
        class="cwa:inline-flex cwa:items-center cwa:gap-1 cwa:sm:hidden"
      ><ShareGlyph />{{ usage.total }}</span>
    </span>
  </template>
</template>
