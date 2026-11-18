<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, useTemplateRef } from 'vue'
import { managerTabKey, managerTabMountedKey, presenceLayerKey, tabFieldsKey, tabMetaOnlyKey } from '../core/ui/field-keys'
import { useCwa } from '#cwa/composables/cwa'

const { iri } = defineProps<{
  iri?: string
}>()

const $cwa = useCwa()
const metaOnly = inject(tabMetaOnlyKey, false)
const fields = inject(tabFieldsKey, undefined)
const currentIri = $cwa.admin.resourceStackManager.currentIri
const tabIri = computed(() => iri ?? currentIri.value)

provide(managerTabKey, {
  iri: tabIri,
  register(field: string) {
    fields && !fields.includes(field) && fields.push(field)
  },
})

const row = useTemplateRef<HTMLElement>('row')
const presenceLayer = useTemplateRef<HTMLElement>('presenceLayer')
provide(presenceLayerKey, { el: presenceLayer, align: 'start' })
const mounted = import.meta.env.DEV ? inject(managerTabMountedKey, undefined) : undefined
let unmounted: (() => void) | undefined
const overflowStart = ref(false)
const overflowEnd = ref(false)
let observer: ResizeObserver | undefined

function measure() {
  const el = row.value
  if (!el) {
    return
  }
  overflowStart.value = el.scrollLeft > 1
  overflowEnd.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

onMounted(() => {
  if (!row.value) {
    return
  }
  unmounted = mounted?.(row.value)
  row.value.addEventListener('scroll', measure, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(row.value)
  }
  measure()
})

onBeforeUnmount(() => {
  unmounted?.()
  row.value?.removeEventListener('scroll', measure)
  observer?.disconnect()
})

defineExpose({ measure })
</script>

<template>
  <slot v-if="metaOnly" />
  <div
    v-else
    class="cwa:bar-fades cwa:h-manager-row cwa:min-w-0 cwa:px-0! cwa:py-0!"
    :data-overflow-start="overflowStart || undefined"
    :data-overflow-end="overflowEnd || undefined"
    data-testid="manager-tab"
  >
    <div
      ref="row"
      class="cwa:relative cwa:flex cwa:h-full cwa:w-full cwa:items-center cwa:gap-row-gap cwa:overflow-x-auto cwa:overflow-y-hidden cwa:px-row-x cwa:py-row-y cwa:scroll-px-10 cwa:[scrollbar-width:none] cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:[&::-webkit-scrollbar]:hidden"
      :tabindex="overflowStart || overflowEnd ? 0 : undefined"
      :role="overflowStart || overflowEnd ? 'region' : undefined"
      :aria-label="overflowStart || overflowEnd ? 'Fields' : undefined"
    >
      <slot />
    </div>
    <div
      ref="presenceLayer"
      data-testid="presence-layer"
      class="cwa:pointer-events-none cwa:absolute cwa:inset-0 cwa:overflow-hidden"
    />
  </div>
</template>
