<template>
  <ClientOnly>
    <cwa-admin-header v-if="showAdmin" />
  </ClientOnly>
  <NuxtLayout id="cwa-root-layout" :name="layoutName">
    <slot />
  </NuxtLayout>
  <ClientOnly>
    <cwa-resource-manager />
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCwa } from '#imports'
import CwaAdminHeader from '#cwa/layer/_components/admin/cwa-admin-header.vue'
import CwaResourceManager from '#cwa/layer/_components/admin/cwa-resource-manager.vue'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'

const $cwa = useCwa()
const layoutName = computed(() => {
  const layoutResource = $cwa.resources.layout.value
  return layoutResource?.data?.uiComponent || 'cwa-default'
})

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})
</script>
