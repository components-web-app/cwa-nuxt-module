<template>
  <div class="cwa-dark cwa-section cwa-border cwa-admin-header">
    <button class="cwa-text-dark cwa-bg-light/90 hover:cwa-bg-light cwa-rounded cwa-py-1 cwa-px-4" @click="$cwa.admin.setEditing()">
      {{ $cwa.admin.isEditing ? 'Done' : 'Edit' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCwa } from '#imports'

const $cwa = useCwa()
</script>

<style lang="css">
.cwa-admin-header {
  @apply border-b-2 fixed z-10 w-full;
}
</style>
