<template>
  <ClientOnly>
    <CwaAdminHeader v-if="showAdmin" />
  </ClientOnly>
  <NuxtLayout id="cwa-root-layout" :name="layoutName" @contextmenu="onContextMenu">
    <slot />
  </NuxtLayout>
  <ClientOnly>
    <CwaAdminResourceManager ref="resourceManager" />
  </clientonly>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCwa } from '#imports'
import { CwaAdminHeader, CwaAdminResourceManager } from '#components'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'

const $cwa = useCwa()
const resourceManager = ref(null)

function onContextMenu (e: PointerEvent) {
  resourceManager.value && resourceManager.value.onContextMenu(e)
}

const layoutName = computed(() => {
  const layoutResource = $cwa.resources.layout.value
  return layoutResource?.data?.uiComponent || 'cwa-default'
})

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})
</script>
