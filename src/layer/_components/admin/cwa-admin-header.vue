<template>
  <div class="cwa-h-16" />
  <div class="cwa-dark-blur cwa-section cwa-border-0 cwa-border-b-2 cwa-fixed cwa-z-50 cwa-w-full cwa-h-16 cwa-top-0" @click.stop @contextmenu.stop>
    <div class="cwa-flex cwa-justify-between cwa-items-center">
      <div class="absolute cwa-left-1/2 cwa-top-1/2 -cwa-translate-x-1/2 -cwa-translate-y-1/2 cwa-text-center cwa-text-gray-300">
        <span v-if="!$cwa.admin.isEditing">{{ $cwa.resources?.page?.data?.reference }}</span>
        <path-selector v-else />
      </div>
      <div class="cwa-flex cwa-justify-start cwa-space-x-4">
        <button class="cwa-text-white cwa-bg-blue-600/90 hover:cwa-bg-blue-600 cwa-py-1 cwa-px-4 cwa-min-w-[100px]" @click="$cwa.admin.toggleEdit()">
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
import PathSelector from '#cwa/layer/_components/admin/path-selector.vue'

const $cwa = useCwa()

const isNavEnabled = computed({
  get: () => {
    return $cwa.admin.navigationGuardDisabled
  },
  set: (newValue: boolean) => {
    $cwa.admin.setNavigationGuardDisabled(newValue)
  }
})

const isLoading = computed(() => false)
</script>
