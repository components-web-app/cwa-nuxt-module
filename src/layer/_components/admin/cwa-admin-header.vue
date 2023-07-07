<template>
  <div class="cwa-h-16" />
  <div class="cwa-dark cwa-section cwa-border cwa-border-0 cwa-border-b-2 cwa-fixed cwa-z-10 cwa-w-full cwa-h-16 cwa-top-0">
    <div class="flex justify-start cwa-space-x-4">
      <button class="cwa-text-dark cwa-bg-light/90 hover:cwa-bg-light cwa-rounded cwa-py-1 cwa-px-4" @click="$cwa.admin.toggleEdit()">
        {{ $cwa.admin.isEditing ? 'Done' : 'Edit' }}
      </button>
      <CwaUiFormToggle v-if="$cwa.admin.isEditing" v-model="isNavEnabled" label="Enable Navigation" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
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

function clickHandler (e: any) {
  $cwa.admin.componentManager.addToStack({ clickTarget: e.target })
}

onMounted(() => {
  document.body.addEventListener('click', clickHandler)
})

onBeforeUnmount(() => {
  document.body.removeEventListener('click', clickHandler)
})
</script>
