<template>
  <div
    id="cwa-root-layout"
    ref="rootLayout"
    class="cwa:relative cwa:h-full cwa:flex cwa:flex-col"
    @contextmenu="closeContextMenu"
  >
    <ClientOnly>
      <LazyCwaAdminHeader v-if="showAdmin" />
      <OutdatedContentNotice
        v-else
        class="cwa:absolute cwa:top-0 cwa:mt-1.5 cwa:left-1/2 cwa:-translate-x-1/2 cwa:z-50"
      />
    </ClientOnly>
    <component
      :is="resolvedComponent"
      v-if="resolvedComponent"
      class="cwa:relative"
      @click.stop="onLayoutClick"
      @contextmenu.stop="onLayoutContextMenu"
    >
      <div
        ref="page"
        class="cwa:grow"
        @click.stop="onPageClick"
        @contextmenu.stop="onPageContextMenu"
      >
        <slot />
      </div>
    </component>
    <ClientOnly>
      <template v-if="showAdmin">
        <LazyCwaAdminResourceManager ref="resourceManager" />
        <LayoutPageOverlay
          v-if="$cwa.admin.isEditing && page && rootLayout"
          :page="page"
          :layout="rootLayout"
        />
        <teleport to="body">
          <DialogsWrapper />
        </teleport>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, getCurrentInstance } from 'vue'
import { DialogsWrapper } from 'vuejs-confirm-dialog'
import { useRouter } from 'vue-router'
import { useCwa } from '#imports'
import { LazyCwaAdminHeader, LazyCwaAdminResourceManager, LazyCwaDefaultLayout } from '#components'
import OutdatedContentNotice from '#cwa/runtime/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'
import type { GlobalComponentNames } from '#cwa/module'
import LayoutPageOverlay from '#cwa/runtime/templates/components/main/admin/resource-manager/LayoutPageOverlay.vue'

const $cwa = useCwa()
const currentRoute = useRouter().currentRoute
const resourceManager = ref<null | InstanceType<typeof LazyCwaAdminResourceManager>>(null)
const page = ref<null | HTMLDivElement>(null)
const rootLayout = ref<null | HTMLDivElement>(null)
const instance = getCurrentInstance()

const cwaPageMeta = computed(() => {
  return currentRoute.value.meta?.cwa
})

function callResourceManagerHandler(handler: 'contextMenuHandler' | 'clickHandler', e: MouseEvent, type: 'layout' | 'page') {
  resourceManager.value && resourceManager.value[handler](e, type)
}

function closeContextMenu(e: MouseEvent) {
  resourceManager.value && resourceManager.value.closeContextMenu(e)
}

function onLayoutContextMenu(e: MouseEvent) {
  callResourceManagerHandler('contextMenuHandler', e, 'layout')
}

function onPageContextMenu(e: MouseEvent) {
  callResourceManagerHandler('contextMenuHandler', e, 'page')
}

function onPageClick(e: MouseEvent) {
  callResourceManagerHandler('clickHandler', e, 'page')
}

function onLayoutClick(e: MouseEvent) {
  callResourceManagerHandler('clickHandler', e, 'layout')
}

const layoutResource = computed(() => {
  return $cwa.resources.layout.value
})

const layoutUiComponent = computed<GlobalComponentNames>(() => {
  return cwaPageMeta.value?.staticLayout || (layoutResource.value?.data?.uiComponent as GlobalComponentNames) || LazyCwaDefaultLayout
})

// todo: adjust to not be global https://github.com/nuxt/nuxt/issues/14036#issuecomment-2110180751
const resolvedComponent = computed(() => {
  // todo: add checks to ensure component exists - otherwise output a warning and/or default
  if (
    typeof instance?.appContext.components !== 'object'
    || !layoutUiComponent.value
  ) {
    return LazyCwaDefaultLayout
  }
  return layoutUiComponent.value
})

const showAdmin = $cwa.auth.isAdmin
</script>
