<template>
  <div class="cwa-text-light cwa-w-full cwa-bg-stone-800 cwa-max-w-4xl cwa-max-h-full cwa-min-h-96 cwa-flex cwa-flex-col">
    <div class="cwa-bg-stone-900/40 cwa-border-b-2 cwa-border-b-stone-700">
      <div class="cwa-p-3 cwa-flex cwa-justify-end cwa-text-stone-400">
        <button @click="closeModal">
          <CwaUiIconXMarkIcon class="cwa-h-10" />
        </button>
      </div>
      <div class="cwa-p-4 cwa-flex cwa-justify-center">
        <div class="cwa-w-full cwa-max-w-xl cwa-flex cwa-items-center cwa-space-x-4">
          <h2 class="cwa-text-4xl">
            Main Layout
          </h2>
          <CwaUiIconPenIcon class="cwa-h-[1.3em]" />
        </div>
      </div>
    </div>
    <div class="cwa-grow cwa-px-4 cwa-py-6 cwa-flex cwa-justify-center">
      <div class="cwa-w-full cwa-max-w-xl cwa-overflow-auto cwa-max-h-full">
        <slot />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
const emit = defineEmits(['close'])

function closeModal () {
  emit('close')
}
</script>
