<template>
  <ListContainer class="cwa:bg-dark cwa:pt-12 cwa:pb-8 cwa:border-b-2 cwa:border-b-stone-700">
    <div class="cwa:w-full cwa:max-w-2xl">
      <slot />
      <div class="cwa:flex cwa:gap-x-6 cwa:items-center">
        <div>
          <h1 class="cwa:text-4xl cwa:text-light">
            {{ title }}
          </h1>
        </div>
        <div v-if="!hideAdd">
          <button
            class="cwa:text-white cwa:bg-blue-600/90 cwa:hover:bg-blue-600 cwa:border-transparent cwa:p-2.5 cwa:cursor-pointer"
            @click="$emit('add')"
          >
            <CwaUiIconPlusIcon class="cwa:w-4 cwa:h-4" />
            <span class="cwa:sr-only">Add</span>
          </button>
        </div>
      </div>
    </div>
  </ListContainer>
</template>

<script lang="ts" setup>
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'

defineProps<{
  title: string
  hideAdd?: boolean
}>()
defineEmits<{
  add: []
}>()
</script>
