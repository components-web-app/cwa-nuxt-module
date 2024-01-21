<template>
  <div id="cwa-root-layout" ref="rootLayout" class="cwa-relative cwa-h-full" @contextmenu="closeContextMenu">
    <ClientOnly>
      <CwaAdminHeader v-if="showAdmin" />
      <OutdatedContentNotice v-else class="cwa-absolute cwa-top-0 cwa-mt-1.5 cwa-left-1/2 -cwa-translate-x-1/2 cwa-z-50" />
    </ClientOnly>
    <component :is="resolvedComponent" v-if="resolvedComponent" class="cwa-relative" @click.stop="onLayoutClick" @contextmenu.stop="onLayoutContextMenu">
      <div ref="page" @click.stop="onPageClick" @contextmenu.stop="onPageContextMenu">
        <slot />
      </div>
    </component>
    <ClientOnly>
      <CwaAdminResourceManager ref="resourceManager" />
      <LayoutPageOverlay v-if="$cwa.admin.isEditing" :page="page" :layout="rootLayout" />
    </clientonly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, getCurrentInstance } from 'vue'
import { useCwa } from '#imports'
import { CwaAdminHeader, CwaAdminResourceManager } from '#components'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'
import OutdatedContentNotice from '#cwa/runtime/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'
import type { GlobalComponentNames } from '#cwa/module'
import LayoutPageOverlay from '#cwa/runtime/templates/components/main/admin/resource-manager/LayoutPageOverlay.vue'

const $cwa = useCwa()
const resourceManager = ref<null|InstanceType<typeof CwaAdminResourceManager>>(null)
const page = ref<null|HTMLDivElement>(null)
const rootLayout = ref<null|HTMLDivElement>(null)
const instance = getCurrentInstance()

function callResourceManagerHandler (handler: 'contextMenuHandler'|'clickHandler', e: MouseEvent, type: 'layout'|'page') {
  resourceManager.value && resourceManager.value[handler](e, type)
}

function closeContextMenu (e: MouseEvent) {
  resourceManager.value && resourceManager.value.closeContextMenu(e)
}

function onLayoutContextMenu (e: MouseEvent) {
  callResourceManagerHandler('contextMenuHandler', e, 'layout')
}

function onPageContextMenu (e: MouseEvent) {
  callResourceManagerHandler('contextMenuHandler', e, 'page')
}

function onPageClick (e: MouseEvent) {
  callResourceManagerHandler('clickHandler', e, 'page')
}

function onLayoutClick (e: MouseEvent) {
  callResourceManagerHandler('clickHandler', e, 'layout')
}

const layoutResource = computed(() => {
  return $cwa.resources.layout.value
})

const layoutUiComponent = computed<GlobalComponentNames>(() => {
  return (layoutResource.value?.data?.uiComponent as GlobalComponentNames) || 'CwaDefaultLayout'
})

const resolvedComponent = computed(() => {
  // todo: add checks to ensure component exists - otherwise output a warning and/or default
  if (
    typeof instance?.appContext.components !== 'object' ||
      !layoutUiComponent.value
  ) {
    return 'CwaDefaultLayout'
  }
  return layoutUiComponent.value
})

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})
</script>
