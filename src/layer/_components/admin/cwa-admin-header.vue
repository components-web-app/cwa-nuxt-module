<template>
  <div class="cwa-h-16" />
  <div class="cwa-dark cwa-section cwa-border cwa-border-0 cwa-border-b-2 cwa-fixed cwa-z-10 cwa-w-full cwa-h-16 cwa-top-0">
    <button class="cwa-text-dark cwa-bg-light/90 hover:cwa-bg-light cwa-rounded cwa-py-1 cwa-px-4" @click="$cwa.admin.setEditing()">
      {{ $cwa.admin.isEditing ? 'Done' : 'Edit' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCwa } from '#imports'

const $cwa = useCwa()
</script>
