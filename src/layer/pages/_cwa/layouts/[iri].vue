<template>
  <ResourceModal @close="$emit('close')">
    <div class="cwa-mb-6">
      <div class="cwa-flex cwa-space-x-1 cwa-overflow-hidden cwa-items-center cwa-text-lg">
        <button class="cwa-py-1.5 cwa-px-3 cwa-transition cwa-rounded cwa-min-w-24" :class="[true ? 'cwa-text-stone-100 cwa-bg-stone-700/80' : 'cwa-text-stone-400 hover:cwa-text-stone-300']">
          Tab 1
        </button>
        <button class="cwa-py-1.5 cwa-px-3 cwa-transition cwa-rounded cwa-min-w-24" :class="[false ? 'cwa-text-stone-100 cwa-bg-stone-700/80' : 'cwa-text-stone-400 hover:cwa-text-stone-300']">
          Tab 2
        </button>
      </div>
    </div>
    <div>
      Content
    </div>
    <div class="cwa-flex cwa-justify-end cwa-mt-6">
      <div>
        <CwaUiFormButton color="blue">
          Save
        </CwaUiFormButton>
      </div>
    </div>
  </ResourceModal>
</template>

<script setup lang="ts">
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'

defineEmits(['close'])
</script>
