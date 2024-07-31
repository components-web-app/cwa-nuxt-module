<template>
  <div class="cwa-bg-dark cwa-pt-12 cwa-pb-8 cwa-flex cwa-justify-center cwa-px-8 cwa-border-b-2 cwa-border-b-stone-700">
    <div class="cwa-w-full cwa-max-w-2xl">
      <div class="cwa-flex cwa-space-x-6 cwa-items-center">
        <div>
          <h1 class="cwa-text-4xl cwa-text-light">
            {{ title }}
          </h1>
        </div>
        <div>
          <button class="cwa-text-white cwa-bg-blue-600/90 hover:cwa-bg-blue-600 cwa-border-transparent cwa-p-2.5">
            <CwaUiIconPlusIcon class="cwa-w-4 cwa-h-4" />
            <span class="cwa-sr-only">Add</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  title: string
}>()
</script>
