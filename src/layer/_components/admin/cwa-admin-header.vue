<template>
  <div class="cwa-h-16" />
  <div class="cwa-dark cwa-section cwa-border-0 cwa-border-b-2 cwa-fixed cwa-z-50 cwa-w-full cwa-h-16 cwa-top-0">
    <div class="cwa-flex cwa-justify-between cwa-items-center">
      <div class="cwa-flex cwa-justify-start cwa-space-x-4">
        <button class="cwa-text-dark cwa-bg-light/90 hover:cwa-bg-light cwa-py-1 cwa-px-4" @click="$cwa.admin.toggleEdit()">
          {{ $cwa.admin.isEditing ? 'Done' : 'Edit' }}
        </button>
        <CwaUiFormToggle v-if="$cwa.admin.isEditing" v-model="isNavEnabled" label="Enable Navigation" />
      </div>
      <div v-if="$cwa.admin.isEditing" class="flex cwa-space-x-4 cwa-items-center">
        <LiveDraft />
        <CwaUiSpinnerTick :is-loading="isLoading" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LiveDraft from '#cwa/layer/_components/admin/live-draft.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

const isNavEnabled = computed({
  get: () => {
    return $cwa.admin.navigationGuardDisabled
  },
  set: (newValue: boolean) => {
    $cwa.admin.setNavigationGuardDisabled(newValue)
  }
})

const isLoading = computed(() => $cwa.fetchingTotal.value > 0)
</script>
