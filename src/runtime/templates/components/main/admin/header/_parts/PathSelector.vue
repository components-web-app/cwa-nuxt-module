<template>
  <div v-if="levels.length">
    <button
      ref="selector"
      type="button"
      data-testid="path-selector"
      :aria-haspopup="hasParents ? 'tree' : undefined"
      :aria-expanded="hasParents ? isOpen : undefined"
      :aria-disabled="hasParents ? undefined : 'true'"
      :aria-label="hasParents ? `${name}, choose a parent` : undefined"
      class="cwa:flex cwa:min-h-9 cwa:items-center cwa:gap-2 cwa:border cwa:border-dashed cwa:border-line-dash cwa:bg-neutral-800 cwa:px-3 cwa:py-1.5 cwa:text-label cwa:text-white cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
      :class="hasParents ? 'cwa:cursor-pointer cwa:hover:border-solid cwa:hover:border-fg cwa:hover:bg-field-hover' : 'cwa:cursor-default'"
      @click="openMenu"
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
      :levels="levels"
      :selected="levels[0]!.key"
      :at="selector"
      :return-to="selector"
      :min-width="selector.offsetWidth"
      :avoid="avoid"
      :select="select"
      @close="isOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, useTemplateRef } from 'vue'
import { resourceStackLevels } from '#cwa/templates/components/core/ui/resource-stack'
import { useCwa } from '#cwa/composables/cwa'

const ResourceStack = defineAsyncComponent(() => import('#cwa/templates/components/ui/ResourceStack.vue'))

const { avoid } = defineProps<{ avoid?: HTMLElement | null }>()

const stackManager = useCwa().admin.resourceStackManager

const isOpen = ref(false)
const selector = useTemplateRef<HTMLButtonElement | null>('selector')

const levels = computed(() => resourceStackLevels(stackManager.resourceStack.value))
const name = computed(() => levels.value[0]?.label)
const hasParents = computed(() => levels.value.length > 1)

function select(key: string) {
  return stackManager.selectStackIndex(Number(key), false)
}

function openMenu() {
  isOpen.value = !isOpen.value && hasParents.value
}
</script>
