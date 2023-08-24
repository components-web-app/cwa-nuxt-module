<template>
  <ClientOnly>
    <cwa-admin-header v-if="showAdmin" />
  </ClientOnly>
  <NuxtLayout id="cwa-root-layout" :name="layoutName" @contextmenu="onContextMenu">
    <slot />
  </NuxtLayout>
  <ClientOnly>
    <template v-if="showAdmin">
      <cwa-resource-manager />
      <context-menu
        v-model="isOpen"
        :virtual-element="virtualElement"
      >
        My Menu
      </context-menu>
    </template>
  </clientonly>
</template>

<script setup lang="ts">
import { computed, ref, unref } from 'vue'
import { useMouse, useWindowScroll } from '@vueuse/core'
import { useCwa } from '#imports'
import CwaAdminHeader from '#cwa/layer/_components/admin/cwa-admin-header.vue'
import CwaResourceManager from '#cwa/layer/_components/admin/cwa-resource-manager.vue'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'
import ContextMenu from '#cwa/layer/_components/admin/context-menu.vue'

const $cwa = useCwa()
const layoutName = computed(() => {
  const layoutResource = $cwa.resources.layout.value
  return layoutResource?.data?.uiComponent || 'cwa-default'
})

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})

const { x, y } = useMouse()
const { y: windowY } = useWindowScroll()
const isOpen = ref(false)
const virtualElement = ref({ getBoundingClientRect: () => ({}) })
function onContextMenu (e) {
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  e.preventDefault()
  const top = unref(y) - unref(windowY)
  const left = unref(x)
  virtualElement.value.getBoundingClientRect = () => ({
    width: 0,
    height: 0,
    top,
    left
  })
  isOpen.value = true
}
</script>
