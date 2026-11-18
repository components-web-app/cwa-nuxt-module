<template>
  <div v-if="name">
    <button
      ref="selector"
      type="button"
      data-testid="path-selector"
      :aria-haspopup="hasParents ? 'dialog' : undefined"
      :aria-expanded="hasParents ? isOpen : undefined"
      :aria-controls="hasParents && isOpen ? stack?.contentId : undefined"
      :aria-disabled="hasParents ? undefined : 'true'"
      :aria-label="hasParents ? `${name}, choose a parent` : undefined"
      class="cwa:flex cwa:min-h-9 cwa:items-center cwa:gap-2 cwa:border cwa:border-dashed cwa:border-line-dash cwa:bg-neutral-800 cwa:px-3 cwa:py-1.5 cwa:text-label cwa:text-white cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
      :class="hasParents ? 'cwa:cursor-pointer cwa:hover:border-solid cwa:hover:border-fg cwa:hover:bg-field-hover' : 'cwa:cursor-default'"
      @click="toggle"
    >
      <span :class="{ 'cwa:invisible': isOpen }">{{ name }}</span>
      <span
        v-if="hasParents"
        aria-hidden="true"
        class="cwa:text-fg-muted"
      >▾</span>
    </button>
    <ResourceStack
      v-if="isOpen && selector"
      ref="stack"
      :levels="levels"
      :selected="levels[0]!.key"
      :at="selector"
      :return-to="selector"
      :min-width="selector.offsetWidth"
      :avoid="avoid"
      :keyboard="openedByKeyboard"
      :select="select"
      @close="isOpen = false"
    />
    <span
      role="status"
      aria-live="polite"
      class="cwa:sr-only"
      data-testid="path-selector-announcer"
    >{{ announcer.message.value }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, provide, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from '#app/composables/router'
import { resourceStackLevels } from '#cwa/templates/components/core/ui/resource-stack'
import { createAnnouncer } from '#cwa/templates/components/core/ui/field-context'
import { announceKey } from '#cwa/templates/components/core/ui/field-keys'
import { useCwa } from '#cwa/composables/cwa'

const ResourceStack = defineAsyncComponent(() => import('#cwa/templates/components/core/ui/ResourceStack.vue'))

const { avoid } = defineProps<{ avoid?: HTMLElement | null }>()

const $cwa = useCwa()
const stackManager = $cwa.admin.resourceStackManager
const router = useRouter()
const announcer = createAnnouncer()
provide(announceKey, announcer.announce)

const isOpen = ref(false)
const openedByKeyboard = ref(false)
const selector = useTemplateRef<HTMLButtonElement | null>('selector')
const stack = useTemplateRef<{ close: (refocus: boolean) => void, contentId?: string } | null>('stack')

const levels = computed(() => resourceStackLevels(stackManager.resourceStack.value))
const name = computed(() => {
  const first = stackManager.resourceStack.value[0]
  return first && (first.displayName || first.iri)
})
const hasParents = computed(() => levels.value.length > 1)

watch([() => $cwa.resources.displayPageIri.value, () => router.currentRoute.value.fullPath], () => {
  isOpen.value = false
})

async function select(key: string) {
  const item = stackManager.resourceStack.value[Number(key)]
  await stackManager.selectStackIndex(Number(key), false)
  return stackManager.currentStackItem.value?.iri === item?.iri
}

function toggle(event: MouseEvent) {
  if (isOpen.value) {
    stack.value ? stack.value.close(true) : (isOpen.value = false)
    return
  }
  openedByKeyboard.value = event.detail === 0
  isOpen.value = hasParents.value
}
</script>
