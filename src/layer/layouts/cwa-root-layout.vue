<template>
  <ClientOnly>
    <cwa-admin-header v-if="$cwa.auth.hasRole(CwaUserRoles.ADMIN)" />
  </ClientOnly>
  <NuxtLayout :name="layoutName">
    <slot />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCwa } from '#imports'
import CwaAdminHeader from '#cwa/layer/_components/admin/cwa-admin-header.vue'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'

const $cwa = useCwa()
const layoutName = computed(() => {
  const layoutResource = $cwa.resources.layout.value
  return layoutResource?.data?.uiComponent || 'cwa-default'
})
</script>
