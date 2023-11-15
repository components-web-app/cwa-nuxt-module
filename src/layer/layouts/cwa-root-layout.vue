<template>
  <ClientOnly>
    <CwaAdminHeader v-if="showAdmin" />
    <OutdatedContentNotice v-else class="cwa-absolute cwa-top-0 cwa-mt-1.5 cwa-left-1/2 -cwa-translate-x-1/2 cwa-z-10" />
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
import type { LayoutKey } from '#build/types/layouts'
import OutdatedContentNotice from '#cwa/runtime/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'

const $cwa = useCwa()
const resourceManager = ref(null)

function onContextMenu (e: PointerEvent) {
  resourceManager.value && resourceManager.value.onContextMenu(e)
}

const layoutName = computed<LayoutKey>(() => {
  const layoutResource = $cwa.resources.layout.value
  return (layoutResource?.data?.uiComponent as LayoutKey) || 'cwa-default'
})

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})
</script>
